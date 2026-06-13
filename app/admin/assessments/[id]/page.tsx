import { notFound, redirect } from "next/navigation"
import { adminClient } from "@/lib/supabase/admin"
import { AssessmentClient } from "./assessment-client"
import type { FormBuilderSchema } from "@/lib/form-builder"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function AssessmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  // Reject non-UUIDs at the gate so Postgres doesn't throw `invalid input
  // syntax for type uuid` on the lookup.
  if (!UUID_RE.test(id)) {
    notFound()
  }

  // Step 1: fetch the submission row (with client name for the header).
  // Do NOT join to template_versions here — the join would fetch the version
  // the DB decided to use, which may not be the pinned version. We fetch it
  // explicitly in Step 2 using submission.template_version_id (RESEARCH.md Pitfall 2).
  const { data: submission } = await adminClient
    .from("form_submissions")
    .select("*, client:clients(name)")
    .eq("id", id)
    .maybeSingle()

  if (!submission) {
    notFound()
  }

  // Once past draft, the fill UI is no longer the right surface — its
  // "Submit assessment" CTA runs the draft-only submit, which can only fail
  // on a submitted row. Route by status instead:
  //   - completed → read-only answers view
  //   - submitted / draft_ready_for_review / ai_draft_failed (or anything
  //     else non-draft) → the AI review workspace, which handles all three.
  if (submission.status === "completed") {
    redirect(`/admin/assessments/${id}/view`)
  }
  if (submission.status !== "draft") {
    redirect(`/admin/assessments/${id}/review`)
  }

  // Step 2: fetch the PINNED template version by submission.template_version_id.
  // This is the exact schema the submission was created against — never the
  // template's current/latest version.
  const { data: version } = await adminClient
    .from("template_versions")
    .select("schema_json, template_id, form_template:form_templates(name)")
    .eq("id", submission.template_version_id)
    .single()

  if (!version) {
    notFound()
  }

  return (
    <AssessmentClient
      submission={submission}
      schema={version.schema_json as FormBuilderSchema}
      templateName={(version.form_template as { name?: string } | null)?.name ?? "Unknown Template"}
      clientId={submission.client_id ?? ""}
    />
  )
}
