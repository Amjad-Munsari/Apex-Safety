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

  const { data: documents } = await adminClient
    .from("documents")
    .select("*")
    .eq("client_id", id)
    .order("uploaded_at", { ascending: false })

  const { data: proposalRows } = await adminClient
    .from("proposals")
    .select("*")
    .eq("client_id", id)
    .order("created_at", { ascending: false })

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

  // Hours transactions, oldest first so we can compute a running balance.
  const { data: hoursRows } = await adminClient
    .from("hours_transactions")
    .select("id, transaction_type, hours_amount, notes, created_at")
    .eq("client_id", id)
    .order("created_at", { ascending: true })

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

  // Assignments for this client — filtered by deleted_at IS NULL (T-16-08).
  const { data: assignmentRows } = await adminClient
    .from("form_assignments")
    .select("id, status, due_date, instructions, created_at, template_version_id, template:form_templates(id, name)")
    .eq("client_id", id)
    .is("deleted_at", null)
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false })

  // Portal users with access to this client org (Access tab).
  const { data: clientUsers } = await adminClient
    .from("client_users")
    .select("id, name, email, role, created_at")
    .eq("client_id", id)
    .order("created_at", { ascending: true })

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

  // Published templates — for the "Assign template" modal in the Assigned Forms tab.
  const { data: publishedTemplates, error: publishedTemplatesError } = await adminClient
    .from("form_templates")
    .select("id, name")
    .eq("is_published", true)
    .is("deleted_at", null)
    .order("name")

  // Don't fail silently: a query error here (e.g. schema drift) previously
  // emptied the picker with no signal. Surface it in logs so it's diagnosable.
  if (publishedTemplatesError) {
    console.error(
      "[admin/clients/[id]] publishedTemplates query failed — Assign-Template picker will be empty:",
      publishedTemplatesError.message
    )
  }

  // Client-built forms — templates this client owns (built from scratch or
  // forked from a master). The "Assigned forms" tab surfaces them read-only so
  // Matt has full visibility into self-serve activity (spec 2.6). Admin reads
  // are permitted by RLS form_templates_admin_all; adminClient bypasses RLS
  // anyway, so the explicit owner_type/owner_id filter is the scope guard.
  // parent:form_templates!parent_template_id(name) surfaces fork lineage.
  const { data: clientTemplateRows, error: clientTemplatesError } = await adminClient
    .from("form_templates")
    .select(
      "id, name, template_type, is_published, created_at, parent_template_id, parent:form_templates!parent_template_id(name)"
    )
    .eq("owner_type", "customer")
    .eq("owner_id", id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })

  if (clientTemplatesError) {
    console.error(
      "[admin/clients/[id]] clientTemplates query failed — Client-built forms panel will be empty:",
      clientTemplatesError.message
    )
  }

  const clientTemplates = normalizeClientTemplateRows(clientTemplateRows)

  // Assessments are form_submissions for this client. We join template_versions
  // → form_templates to surface the template name in the UI.
  const { data: submissionRows } = await adminClient
    .from("form_submissions")
    .select(`
      id,
      status,
      created_at,
      submitted_at,
      template:template_versions(
        form_template:form_templates(name)
      )
    `)
    .eq("client_id", id)
    .order("created_at", { ascending: false })

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

    // Drafts (incomplete forms) link back to the fill page; anything that's
    // been submitted goes to /review — that's where the AI draft is generated,
    // reviewed, and the final PDF is downloaded.
    const reportHref =
      uiStatus === "Draft"
        ? `/admin/assessments/${row.id}`
        : `/admin/assessments/${row.id}/review`

    return {
      id: `ASMT-${row.id.slice(0, 6).toUpperCase()}`,
      date: row.submitted_at ?? row.created_at,
      type: templateName,
      status: uiStatus,
      reportHref,
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
        hoursLog={hoursLog}
        assignments={assignments}
        publishedTemplates={publishedTemplates ?? []}
        clientUsers={clientUsers ?? []}
        clientTemplates={clientTemplates}
        active={!isInactive}
      />

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
    </div>
  )
}
