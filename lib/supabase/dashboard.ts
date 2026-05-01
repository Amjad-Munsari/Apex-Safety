import { adminClient } from "./admin"

export async function getDashboardStats() {
  const now = new Date().toISOString()
  const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

  // 1. Overdue Docs
  const { count: overdueCount, error: e1 } = await adminClient
    .from("documents")
    .select("*", { count: "exact", head: true })
    .lt("expiry_date", now)

  // 2. Expiring Docs (next 30 days)
  const { count: expiringCount, error: e2 } = await adminClient
    .from("documents")
    .select("*", { count: "exact", head: true })
    .gte("expiry_date", now)
    .lt("expiry_date", thirtyDaysFromNow)

  // 3. Drafts to Review
  const { count: reviewCount, error: e3 } = await adminClient
    .from("form_submissions")
    .select("*", { count: "exact", head: true })
    .eq("status", "draft_ready_for_review")

  // 4. Workflow Errors (last 24h)
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { count: errorCount, error: e4 } = await adminClient
    .from("workflow_errors")
    .select("*", { count: "exact", head: true })
    .gte("created_at", yesterday)

  // 5. Total Clients
  const { count: clientCount, error: e5 } = await adminClient
    .from("clients")
    .select("*", { count: "exact", head: true })

  // 6. Total Proposals
  const { count: proposalCount, error: e6 } = await adminClient
    .from("proposals")
    .select("*", { count: "exact", head: true })

  if (e1) console.error(`Dashboard stats error (overdue): ${e1.message}`)
  if (e2) console.error(`Dashboard stats error (expiring): ${e2.message}`)
  if (e3) console.error(`Dashboard stats error (review): ${e3.message}`)
  if (e4) console.error(`Dashboard stats error (errors): ${e4.message}`)
  if (e5) console.error(`Dashboard stats error (clients): ${e5.message}`)
  if (e6) console.error(`Dashboard stats error (proposals): ${e6.message}`)

  // 7. Total Documents (for compliance badge)
  const { count: totalDocCount } = await adminClient
    .from("documents")
    .select("*", { count: "exact", head: true })

  return {
    overdueCount: overdueCount || 0,
    expiringCount: expiringCount || 0,
    reviewCount: reviewCount || 0,
    errorCount: errorCount || 0,
    clientCount: clientCount || 0,
    proposalCount: proposalCount || 0,
    totalDocCount: totalDocCount || 0,
    totalItemsNeeded: (overdueCount || 0) + (reviewCount || 0)
  }
}

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

export async function getUpcomingExpiries() {
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
    .gte("expiry_date", now)
    .lt("expiry_date", thirtyDaysFromNow)
    .order("expiry_date", { ascending: true })
    .limit(10)

  if (error) {
    console.error("getUpcomingExpiries error:", { code: error.code, message: error.message })
    return []
  }
  return data || []
}

export async function getComplianceAggregates() {
  const now = new Date().toISOString()
  const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

  // Run counts in parallel
  const [expiredRes, expiringRes, totalRes] = await Promise.all([
    adminClient.from("documents").select("*", { count: "exact", head: true }).lt("expiry_date", now),
    adminClient.from("documents").select("*", { count: "exact", head: true }).gte("expiry_date", now).lt("expiry_date", thirtyDaysFromNow),
    adminClient.from("documents").select("*", { count: "exact", head: true })
  ])

  const expired = expiredRes.count || 0
  const expiring = expiringRes.count || 0
  const total = totalRes.count || 0
  const current = total - expired - expiring

  if (expiredRes.error || expiringRes.error || totalRes.error) {
    console.error("getComplianceAggregates error:", { 
      expired: expiredRes.error?.message, 
      expiring: expiringRes.error?.message, 
      total: totalRes.error?.message 
    })
  }

  return { current, expiring, expired, total }
}

export async function getWorkflowErrors() {
  const { data, error } = await adminClient
    .from("workflow_errors")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(5)

  if (error) {
    console.error(`getWorkflowErrors failure: ${error.message} (Code: ${error.code})`)
    return []
  }
  return data || []
}

export function calculateProposalTotal(servicesJson: any): number {
  if (!servicesJson || !Array.isArray(servicesJson)) return 0
  return servicesJson.reduce((acc: number, item: any) => {
    // Check both 'price' and 'unit_price' for robustness
    const price = Number(item.price || item.unit_price) || 0
    const qty = Number(item.quantity) || 1
    return acc + (price * qty)
  }, 0)
}
