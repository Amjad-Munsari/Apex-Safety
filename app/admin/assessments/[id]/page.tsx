import { notFound } from "next/navigation"
import { adminClient } from "@/lib/supabase/admin"
import { AssessmentClient } from "./assessment-client"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function AssessmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  // Reject non-UUIDs at the gate so Postgres doesn't throw `invalid input
  // syntax for type uuid` on the lookup.
  if (!UUID_RE.test(id)) {
    notFound()
  }

  const { data: submission } = await adminClient
    .from("form_submissions")
    .select(`
      *,
      client:clients(name),
      template:template_versions(
        schema_json,
        template_id,
        form_template:form_templates(name)
      )
    `)
    .eq("id", id)
    .maybeSingle()

  if (!submission) {
    notFound()
  }

  return <AssessmentClient submission={submission} />
}
