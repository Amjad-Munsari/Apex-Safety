import { cache } from "react"
import { adminClient } from "./admin"

export const getDashboardStats = cache(async () => {
  const now = new Date().toISOString()
  const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const [
    overdueRes,
    expiringRes,
    reviewRes,
    errorRes,
    clientRes,
    proposalRes,
    totalDocRes,
  ] = await Promise.all([
    // 1. Overdue Docs
    adminClient
      .from("documents")
      .select("*", { count: "exact", head: true })
      .lt("expiry_date", now),
    // 2. Expiring Docs (next 30 days)
    adminClient
      .from("documents")
      .select("*", { count: "exact", head: true })
      .gte("expiry_date", now)
      .lt("expiry_date", thirtyDaysFromNow),
    // 3. Drafts to Review
    adminClient
      .from("form_submissions")
      .select("*", { count: "exact", head: true })
      .eq("status", "draft_ready_for_review"),
    // 4. Workflow Errors (last 24h)
    adminClient
      .from("workflow_errors")
      .select("*", { count: "exact", head: true })
      .gte("created_at", yesterday),
    // 5. Total Clients
    adminClient
      .from("clients")
      .select("*", { count: "exact", head: true }),
    // 6. Total Proposals
    adminClient
      .from("proposals")
      .select("*", { count: "exact", head: true }),
    // 7. Total Documents (for compliance badge)
    adminClient
      .from("documents")
      .select("*", { count: "exact", head: true }),
  ])

  const overdueCount = overdueRes.count
  const expiringCount = expiringRes.count
  const reviewCount = reviewRes.count
  const errorCount = errorRes.count
  const clientCount = clientRes.count
  const proposalCount = proposalRes.count
  const totalDocCount = totalDocRes.count

  if (overdueRes.error) console.error(`Dashboard stats error (overdue): ${overdueRes.error.message}`)
  if (expiringRes.error) console.error(`Dashboard stats error (expiring): ${expiringRes.error.message}`)
  if (reviewRes.error) console.error(`Dashboard stats error (review): ${reviewRes.error.message}`)
  if (errorRes.error) console.error(`Dashboard stats error (errors): ${errorRes.error.message}`)
  if (clientRes.error) console.error(`Dashboard stats error (clients): ${clientRes.error.message}`)
  if (proposalRes.error) console.error(`Dashboard stats error (proposals): ${proposalRes.error.message}`)

  return {
    overdueCount: overdueCount || 0,
    expiringCount: expiringCount || 0,
    totalExpiries: (overdueCount || 0) + (expiringCount || 0),
    reviewCount: reviewCount || 0,
    errorCount: errorCount || 0,
    clientCount: clientCount || 0,
    proposalCount: proposalCount || 0,
    totalDocCount: totalDocCount || 0,
    totalItemsNeeded: (overdueCount || 0) + (reviewCount || 0)
  }
})

export async function getReportsAwaitingReview(limit: number = 3) {
  const { data, error } = await adminClient
    .from("form_submissions")
    .select(`
      id,
      created_at,
      status,
      client:clients(name),
      template:template_versions(form_templates(name))
    `)
    .eq("status", "draft_ready_for_review")
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) {
    console.error("getReportsAwaitingReview error:", { code: error.code, message: error.message })
    return []
  }
  return data || []
}

/**
 * Completed reports — assessments that have been reviewed, approved, and had
 * their PDF generated (status='completed'). These leave the awaiting-review
 * queue, so this powers the "Completed" tab so they remain findable.
 */
export async function getCompletedReports(limit: number = 50) {
  const { data, error } = await adminClient
    .from("form_submissions")
    .select(`
      id,
      created_at,
      submitted_at,
      status,
      report_storage_path,
      client:clients(name),
      template:template_versions(form_templates(name))
    `)
    .eq("status", "completed")
    .order("submitted_at", { ascending: false, nullsFirst: false })
    .limit(limit)

  if (error) {
    console.error("getCompletedReports error:", { code: error.code, message: error.message })
    return []
  }
  return data || []
}

export async function getUpcomingExpiries(limit: number = 100) {
  const now = new Date().toISOString()
  const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await adminClient
    .from("documents")
    .select(`
      id,
      filename,
      expiry_date,
      document_category,
      client:clients(name)
    `)
    .lt("expiry_date", thirtyDaysFromNow)
    .order("expiry_date", { ascending: true })
    .limit(limit)

  if (error) {
    console.error("getUpcomingExpiries error:", { code: error.code, message: error.message })
    return []
  }
  return data || []
}

export async function getComplianceAggregates() {
  const now = new Date().toISOString()
  const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

  // Run counts in parallel. Each bucket is counted directly so documents with a
  // NULL expiry_date land in their own `undated` bucket instead of being folded
  // into `current` (which is what `total - expired - expiring` used to do).
  const [expiredRes, expiringRes, currentRes, totalRes] = await Promise.all([
    adminClient.from("documents").select("*", { count: "exact", head: true }).lt("expiry_date", now),
    adminClient.from("documents").select("*", { count: "exact", head: true }).gte("expiry_date", now).lt("expiry_date", thirtyDaysFromNow),
    adminClient.from("documents").select("*", { count: "exact", head: true }).gte("expiry_date", thirtyDaysFromNow),
    adminClient.from("documents").select("*", { count: "exact", head: true })
  ])

  const expired = expiredRes.count || 0
  const expiring = expiringRes.count || 0
  const current = currentRes.count || 0
  const total = totalRes.count || 0
  const undated = total - expired - expiring - current

  if (expiredRes.error || expiringRes.error || currentRes.error || totalRes.error) {
    console.error("getComplianceAggregates error:", {
      expired: expiredRes.error?.message,
      expiring: expiringRes.error?.message,
      current: currentRes.error?.message,
      total: totalRes.error?.message
    })
  }

  return { current, expiring, expired, undated, total }
}

export type WorkflowErrorDetail = { label: string; value: string }

export type WorkflowErrorWithDetails = {
  id: string
  workflow_name: string
  error_message: string | null
  created_at: string
  details: WorkflowErrorDetail[]
  /** payload.severity, when present (e.g. "high"). */
  severity: string | null
  /** Resolved submission id for deep-linking to the assessment review, if any. */
  submissionId: string | null
}

type RawWorkflowErrorRow = {
  id: string
  workflow_name: string
  error_message: string | null
  created_at: string
  payload: unknown
}

function cadenceLabel(cadence: unknown): string | null {
  switch (cadence) {
    case "7d": return "7 days before due"
    case "1d": return "1 day before due"
    case "overdue": return "Overdue"
    default: return cadence ? String(cadence) : null
  }
}

function formatDay(value: unknown): string | null {
  if (!value) return null
  const d = new Date(String(value))
  if (isNaN(d.getTime())) return String(value)
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
}

// PostgREST embeds can come back as an object or a single-element array.
function embedName(rel: unknown): string | undefined {
  const r = Array.isArray(rel) ? rel[0] : rel
  return (r as { name?: string } | null | undefined)?.name
}

/**
 * Enriches raw workflow_errors rows with human-readable identifying details
 * (client name, document/form name, dates) so they can be acted on without
 * cross-referencing IDs. Some workflows store names directly in the payload;
 * others only store IDs, which are resolved here against the DB.
 */
async function enrichWorkflowErrors(rows: RawWorkflowErrorRow[]): Promise<WorkflowErrorWithDetails[]> {
  // Collect IDs that need resolving to names.
  const submissionIds = new Set<string>()
  const assignmentIds = new Set<string>()
  const clientIds = new Set<string>()
  for (const r of rows) {
    const p = (r.payload ?? {}) as Record<string, unknown>
    const sub = p.submission_id ?? p.submissionId
    if (sub) submissionIds.add(String(sub))
    if (p.assignment_id) assignmentIds.add(String(p.assignment_id))
    if (p.client_id) clientIds.add(String(p.client_id))
  }

  const [subsRes, assignsRes, clientsRes] = await Promise.all([
    submissionIds.size
      ? adminClient.from("form_submissions").select("id, client:clients(name)").in("id", [...submissionIds])
      : Promise.resolve({ data: [] as { id: string; client: unknown }[] }),
    assignmentIds.size
      ? adminClient.from("form_assignments").select("id, client:clients(name), template:form_templates(name)").in("id", [...assignmentIds])
      : Promise.resolve({ data: [] as { id: string; client: unknown; template: unknown }[] }),
    clientIds.size
      ? adminClient.from("clients").select("id, name").in("id", [...clientIds])
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ])

  const subClient = new Map<string, string | undefined>()
  for (const s of (subsRes.data ?? []) as { id: string; client: unknown }[]) {
    subClient.set(s.id, embedName(s.client))
  }
  const assignInfo = new Map<string, { client?: string; form?: string }>()
  for (const a of (assignsRes.data ?? []) as { id: string; client: unknown; template: unknown }[]) {
    assignInfo.set(a.id, { client: embedName(a.client), form: embedName(a.template) })
  }
  const clientName = new Map<string, string>()
  for (const c of (clientsRes.data ?? []) as { id: string; name: string }[]) {
    clientName.set(c.id, c.name)
  }

  return rows.map((r) => {
    const p = (r.payload ?? {}) as Record<string, unknown>
    const details: WorkflowErrorDetail[] = []
    const push = (label: string, value: unknown) => {
      if (value) details.push({ label, value: String(value) })
    }

    switch (r.workflow_name) {
      case "report_delivery_email":
        push("Client", p.client_name)
        push("Assessment date", p.assessment_date)
        break
      case "expiry_alert":
      case "expiry_alert_manual":
        push("Client", p.client_name)
        push("Document", p.document_name)
        push("Expiry date", formatDay(p.expiry_date))
        break
      case "document_uploaded":
        push("Client", p.client_id ? clientName.get(String(p.client_id)) : undefined)
        push("Document", p.document_name)
        break
      case "ai_report_draft":
      case "assessment-submission-webhook": {
        const id = p.submission_id ?? p.submissionId
        push("Client", id ? subClient.get(String(id)) : undefined)
        break
      }
      case "assignment_reminder": {
        const info = p.assignment_id ? assignInfo.get(String(p.assignment_id)) : undefined
        push("Client", info?.client)
        push("Form", info?.form)
        push("Reminder", cadenceLabel(p.cadence))
        break
      }
    }

    const subId = p.submission_id ?? p.submissionId

    return {
      id: r.id,
      workflow_name: r.workflow_name,
      error_message: r.error_message,
      created_at: r.created_at,
      details,
      severity: p.severity ? String(p.severity) : null,
      submissionId: subId ? String(subId) : null,
    }
  })
}

/**
 * Recent workflow errors for the dashboard / errors log, newest first.
 */
export async function getWorkflowErrors(limit: number = 5): Promise<WorkflowErrorWithDetails[]> {
  const { data, error } = await adminClient
    .from("workflow_errors")
    .select("id, workflow_name, error_message, payload, created_at")
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) {
    console.error(`getWorkflowErrors failure: ${error.message} (Code: ${error.code})`)
    return []
  }
  return enrichWorkflowErrors((data ?? []) as RawWorkflowErrorRow[])
}

/**
 * Workflow errors since a given ISO timestamp (e.g. start of month), newest
 * first. Same enrichment as getWorkflowErrors.
 */
export async function getWorkflowErrorsSince(
  sinceIso: string,
  limit: number = 25,
): Promise<WorkflowErrorWithDetails[]> {
  const { data, error } = await adminClient
    .from("workflow_errors")
    .select("id, workflow_name, error_message, payload, created_at")
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) {
    console.error(`getWorkflowErrorsSince failure: ${error.message} (Code: ${error.code})`)
    return []
  }
  return enrichWorkflowErrors((data ?? []) as RawWorkflowErrorRow[])
}

const VAT_RATE = 0.2

/**
 * Fallback total for proposals whose `total_price` column is NULL.
 *
 * Handles two services_json shapes the codebase has produced over time:
 *   - Legacy demo seed: `{ name, price }` or `{ name, unit_price }` at top level
 *   - New builder: `{ service: { name, unit_price }, quantity }`
 *
 * Returns the total *including VAT* so it stays consistent with
 * `proposals.total_price`, which stores the VAT-inclusive headline.
 */
export function calculateProposalTotal(servicesJson: any): number {
  if (!servicesJson || !Array.isArray(servicesJson)) return 0
  const subtotal = servicesJson.reduce((acc: number, item: any) => {
    const price =
      Number(item?.price) ||
      Number(item?.unit_price) ||
      Number(item?.service?.unit_price) ||
      0
    const qty = Number(item?.quantity) || 1
    return acc + price * qty
  }, 0)
  return subtotal * (1 + VAT_RATE)
}
