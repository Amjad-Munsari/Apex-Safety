import { notFound } from "next/navigation"
import { adminClient } from "@/lib/supabase/admin"
import { requireAdmin } from "@/lib/auth-helpers"
import { AssessmentAnswersView } from "./answers-view-client"

export const dynamic = "force-dynamic"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Admin read-only view of a submitted assessment's answers (the filled form).
 * Distinct from /review, which is the report-draft workspace.
 */
export default async function AssessmentAnswersPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireAdmin()
  const { id } = await params
  if (!UUID_RE.test(id)) notFound()

  const { data: sub } = await adminClient
    .from("form_submissions")
    .select(
      `id, client_id, status, answers_json, template_version_id, submitted_at, created_at,
       client:clients(name),
       template:template_versions(form_template:form_templates(name))`
    )
    .eq("id", id)
    .maybeSingle()

  if (!sub || !sub.template_version_id) notFound()

  const { data: version } = await adminClient
    .from("template_versions")
    .select("schema_json")
    .eq("id", sub.template_version_id)
    .single()

  if (!version) notFound()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const t = sub.template as any
  const templateName: string =
    t?.form_template?.name ??
    (Array.isArray(t) ? t[0]?.form_template?.name : null) ??
    "Assessment"
  const clientName = (sub.client as { name?: string } | null)?.name ?? "Client"

  return (
    <AssessmentAnswersView
      schemaJson={version.schema_json}
      answersJson={sub.answers_json}
      submittedAt={sub.submitted_at}
      clientId={sub.client_id as string}
      clientName={clientName}
      submissionId={sub.id as string}
      templateName={templateName}
      backHref={`/admin/clients/${sub.client_id}`}
    />
  )
}
