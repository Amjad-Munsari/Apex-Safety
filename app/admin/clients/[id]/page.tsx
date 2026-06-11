import { adminClient } from "@/lib/supabase/admin"
import { notFound } from "next/navigation"
import { UploadDocumentModal } from "@/components/admin/upload-document-modal"
import { Card } from "@/components/ui/card"
import { Building, Calendar, Clock, MapPin } from "lucide-react"
import { AdjustHoursDialog } from "@/components/clients/adjust-hours-dialog"
import { ClientTabs } from "./client-tabs"
import { ClientDangerZone } from "./client-danger-zone"
import { normalizeClientTemplateRows } from "./client-templates"
import { calculateProposalTotal } from "@/lib/supabase/dashboard"

export default async function ClientDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const { data: client, error: clientError } = await adminClient
    .from("clients")
    .select("*")
    .eq("id", id)
    .single()

  if (clientError || !client) {
    notFound()
  }

  const [
    documentsRes,
    proposalRes,
    hoursRes,
    assignmentRes,
    clientUsersRes,
    publishedRes,
    clientTemplatesRes,
    submissionRes,
  ] = await Promise.all([
    adminClient
      .from("documents")
      .select("*")
      .eq("client_id", id)
      .order("uploaded_at", { ascending: false }),
    adminClient
      .from("proposals")
      .select("*")
      .eq("client_id", id)
      .order("created_at", { ascending: false }),
    // Hours transactions, oldest first so we can compute a running balance.
    adminClient
      .from("hours_transactions")
      .select("id, transaction_type, hours_amount, notes, created_at")
      .eq("client_id", id)
      .order("created_at", { ascending: true }),
    // Assignments for this client — filtered by deleted_at IS NULL (T-16-08).
    adminClient
      .from("form_assignments")
      .select("id, status, due_date, instructions, created_at, template_version_id, template:form_templates(id, name)")
      .eq("client_id", id)
      .is("deleted_at", null)
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false }),
    // Portal users with access to this client org (Access tab).
    adminClient
      .from("client_users")
      .select("id, name, email, role, created_at")
      .eq("client_id", id)
      .order("created_at", { ascending: true }),
    // Published templates — for the "Assign template" modal in the Assigned Forms tab.
    adminClient
      .from("form_templates")
      .select("id, name")
      .eq("is_published", true)
      .is("deleted_at", null)
      .order("name"),
    // Client-built forms — templates this client owns (built from scratch or
    // forked from a master). The "Assigned forms" tab surfaces them read-only so
    // Matt has full visibility into self-serve activity (spec 2.6). Admin reads
    // are permitted by RLS form_templates_admin_all; adminClient bypasses RLS
    // anyway, so the explicit owner_type/owner_id filter is the scope guard.
    // Fork lineage (parent master name) is resolved by a follow-up query below —
    // the self-referential PostgREST embed resolves in the children direction
    // and always returned [], so "Cloned from …" never named the master.
    adminClient
      .from("form_templates")
      .select("id, name, template_type, is_published, created_at, parent_template_id")
      .eq("owner_type", "customer")
      .eq("owner_id", id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    // Assessments are form_submissions for this client. We join template_versions
    // → form_templates to surface the template name in the UI.
    adminClient
      .from("form_submissions")
      .select(`
        id,
        status,
        created_at,
        submitted_at,
        report_storage_path,
        template:template_versions(
          form_template:form_templates(name)
        )
      `)
      .eq("client_id", id)
      .order("created_at", { ascending: false }),
  ])

  const { data: documents } = documentsRes
  const { data: proposalRows } = proposalRes
  const { data: hoursRows } = hoursRes
  const { data: assignmentRows } = assignmentRes
  const { data: clientUsers } = clientUsersRes
  const { data: publishedTemplates, error: publishedTemplatesError } = publishedRes
  const { data: clientTemplateRows, error: clientTemplatesError } = clientTemplatesRes
  const { data: submissionRows } = submissionRes

  // pdfUrl removed — ClientTabs links to /admin/proposals/[id] for the detail
  // view where signed URLs are computed fresh. Computing them here was dead
  // code and a footgun now that the bucket is private (getPublicUrl returns a
  // 401-ing URL).
  const proposals = (proposalRows ?? []).map((p) => ({
    id: p.id,
    status: p.status,
    created_at: p.created_at,
    total: (p as { total_price?: number }).total_price || calculateProposalTotal(p.services_json),
    pdfUrl: null as string | null,
  }))

  let running = 0
  const hoursLogChronological = (hoursRows ?? []).map((row) => {
    const delta = Number(row.hours_amount) || 0
    running += delta
    return {
      id: row.id,
      date: row.created_at,
      description: row.notes?.trim() || row.transaction_type || "Hours transaction",
      delta,
      balance: running,
    }
  })
  // Newest first for the UI.
  const hoursLog = hoursLogChronological.reverse()

  // Supabase can return the `template:form_templates(id, name)` join as an
  // ARRAY instead of an object; normalize to the object-or-null shape the
  // AssignmentRow type expects so `assignment.template?.name` can't blow up
  // the Assigned Forms panel at render time (same pattern as the assessments
  // normalization below and app/admin/assessments/new/page.tsx).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const assignments = (assignmentRows ?? []).map((row: any) => ({
    ...row,
    template: Array.isArray(row.template) ? row.template[0] ?? null : row.template ?? null,
  }))

  // Don't fail silently: a query error here (e.g. schema drift) previously
  // emptied the picker with no signal. Surface it in logs so it's diagnosable.
  if (publishedTemplatesError) {
    console.error(
      "[admin/clients/[id]] publishedTemplates query failed — Assign-Template picker will be empty:",
      publishedTemplatesError.message
    )
  }

  if (clientTemplatesError) {
    console.error(
      "[admin/clients/[id]] clientTemplates query failed — Client-built forms panel will be empty:",
      clientTemplatesError.message
    )
  }

  // Resolve fork lineage: map parent_template_id → master name for the
  // "Cloned from …" badge. Soft-deleted masters are intentionally included —
  // lineage is historical fact, not a live reference.
  const parentIds = [
    ...new Set(
      (clientTemplateRows ?? [])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((row: any) => row.parent_template_id)
        .filter((pid: string | null): pid is string => !!pid)
    ),
  ]
  let parentNames: Record<string, string> = {}
  if (parentIds.length > 0) {
    const { data: parentRows } = await adminClient
      .from("form_templates")
      .select("id, name")
      .in("id", parentIds)
    parentNames = Object.fromEntries((parentRows ?? []).map((p) => [p.id, p.name]))
  }

  const clientTemplates = normalizeClientTemplateRows(clientTemplateRows, parentNames)

  const assessments = (submissionRows ?? []).map((row: any) => {
    const templateName: string =
      row.template?.form_template?.name ??
      (Array.isArray(row.template) ? row.template[0]?.form_template?.name : null) ??
      "Assessment"

    // Map DB status → UI status. Anything past `submitted` shows as "Delivered"
    // (the final PDF is in storage); draft variants show as "Draft"; mid-flight
    // statuses (submitted, draft_ready_for_review) show as "In review".
    let uiStatus: "Delivered" | "Draft" | "In review"
    switch (row.status) {
      case "completed":
        uiStatus = "Delivered"
        break
      case "submitted":
      case "draft_ready_for_review":
        uiStatus = "In review"
        break
      default:
        uiStatus = "Draft"
    }

    // Clicking an assessment shows the ASSESSMENT itself: in-progress drafts open
    // the editable fill page; submitted+ open the read-only answers view. The
    // report draft lives separately in the Reports tab.
    const viewHref =
      uiStatus === "Draft"
        ? `/admin/assessments/${row.id}`
        : `/admin/assessments/${row.id}/view`

    return {
      id: `ASMT-${row.id.slice(0, 6).toUpperCase()}`,
      submissionId: row.id,
      date: row.submitted_at ?? row.created_at,
      type: templateName,
      status: uiStatus,
      viewHref,
    }
  })

  // Reports = assessments that have reached the report stage (an AI draft exists,
  // failed, or a final PDF was delivered). These live in the Reports tab. A
  // delivered report opens its PDF directly; a draft/failed one opens the review
  // workspace where it's reviewed / approved / generated.
  const reportRows = (submissionRows ?? []).filter((row: any) =>
    ["draft_ready_for_review", "ai_draft_failed", "completed"].includes(row.status)
  )

  // Pre-sign delivered report PDFs (1h TTL) so clicking a Delivered row opens the
  // actual PDF rather than the generate/review page.
  const deliveredPaths = reportRows
    .filter((row: any) => row.status === "completed" && row.report_storage_path)
    .map((row: any) => row.report_storage_path as string)
  const reportSignedMap = new Map<string, string>()
  if (deliveredPaths.length > 0) {
    const { data: signed } = await adminClient.storage
      .from("reports")
      .createSignedUrls(deliveredPaths, 60 * 60)
    for (const item of signed ?? []) {
      if (item.path && item.signedUrl) reportSignedMap.set(item.path, item.signedUrl)
    }
  }

  const reports = reportRows.map((row: any) => {
    const templateName: string =
      row.template?.form_template?.name ??
      (Array.isArray(row.template) ? row.template[0]?.form_template?.name : null) ??
      "Assessment"
    const reportStatus: "Draft" | "Failed" | "Delivered" =
      row.status === "completed"
        ? "Delivered"
        : row.status === "ai_draft_failed"
          ? "Failed"
          : "Draft"
    return {
      id: `RPT-${row.id.slice(0, 6).toUpperCase()}`,
      submissionId: row.id,
      date: row.submitted_at ?? row.created_at,
      type: templateName,
      status: reportStatus,
      reviewHref: `/admin/assessments/${row.id}/review`,
      pdfUrl: row.report_storage_path ? reportSignedMap.get(row.report_storage_path) ?? null : null,
    }
  })

  const isInactive = client.active === false

  return (
    <div className="flex flex-col gap-10 pt-12 pb-20 max-w-6xl mx-auto w-full">
      {/* ─── DEACTIVATED BANNER ─── */}
      {isInactive && (
        <div className="flex items-center gap-3 rounded-sm border border-gold/30 bg-gold/[0.06] px-5 py-3 text-sm text-gold">
          <span className="font-mono text-[10px] uppercase tracking-[0.25em] shrink-0">
            Deactivated
          </span>
          <span className="text-white/70">
            This client is frozen. Uploading documents, creating proposals or
            assessments, assigning forms, adjusting hours, and inviting users are
            disabled. Existing records stay intact — reactivate to make changes.
          </span>
        </div>
      )}

      {/* ─── HEADER ─── */}
      <div className="flex justify-between items-end">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3 font-mono text-xs tracking-widest text-[#666] uppercase">
            <Building className="w-3.5 h-3.5" />
            Client Record
          </div>
          <h2 className="font-serif text-[32px] md:text-[34px] leading-tight text-white whitespace-nowrap flex items-center gap-3">
            {client.name}
            {client.active === false && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-sm font-mono text-[9px] uppercase tracking-[0.25em] text-[#888] bg-white/5 border border-white/10 leading-none">
                Inactive
              </span>
            )}
          </h2>
        </div>

        <div className="flex gap-4 items-center">
          {!isInactive && <UploadDocumentModal clientId={client.id} />}
        </div>
      </div>

      {/* ─── SUMMARY CARDS ─── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-[#1c1c1c] border-white/5 rounded-sm p-6 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-[#888] font-mono text-[10px] uppercase tracking-widest mb-2">
            <MapPin className="w-3 h-3" /> Site Address
          </div>
          <div className="text-white/90 text-sm leading-relaxed">
            {client.site_address || "No primary address registered."}
          </div>
        </Card>

        <Card className="bg-[#1c1c1c] border-white/5 rounded-sm p-6 flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2 text-[#888] font-mono text-[10px] uppercase tracking-widest mb-2">
            <div className="flex items-center gap-2">
              <Clock className="w-3 h-3" /> Retained Hours
            </div>
            {!isInactive && (
              <AdjustHoursDialog clientId={client.id} currentBalance={client.hours_balance || 0} />
            )}
          </div>
          <div className="text-white font-serif text-3xl">
            {client.hours_balance || 0}{" "}
            <span className="text-sm font-sans text-white/40">hrs</span>
          </div>
        </Card>

        <Card className="bg-[#1c1c1c] border-white/5 rounded-sm p-6 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-[#888] font-mono text-[10px] uppercase tracking-widest mb-2">
            <Calendar className="w-3 h-3" /> Client Since
          </div>
          <div className="text-white/90 text-sm leading-relaxed">
            {new Date(client.created_at).toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
          </div>
        </Card>
      </div>

      <ClientTabs
        clientId={client.id}
        clientName={client.name}
        hoursBalance={client.hours_balance || 0}
        contactName={client.contact_name ?? null}
        contactEmail={client.contact_email ?? null}
        contactPhone={client.contact_phone ?? null}
        documents={documents ?? []}
        proposals={proposals}
        assessments={assessments}
        reports={reports}
        hoursLog={hoursLog}
        assignments={assignments}
        publishedTemplates={publishedTemplates ?? []}
        clientUsers={clientUsers ?? []}
        clientTemplates={clientTemplates}
        active={!isInactive}
        dangerZone={
          <ClientDangerZone
            clientId={client.id}
            clientName={client.name}
            active={client.active ?? true}
            counts={{
              assessments: assessments.length,
              proposals: proposals.length,
              documents: documents?.length ?? 0,
              portalUsers: clientUsers?.length ?? 0,
            }}
          />
        }
      />
    </div>
  )
}
