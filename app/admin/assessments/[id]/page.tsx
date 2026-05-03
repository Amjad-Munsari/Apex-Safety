import { adminClient } from "@/lib/supabase/admin"
import { AssessmentClient } from "./assessment-client"
import { MockAssessmentReport } from "./mock-assessment-report"
import { GenericAssessmentReport } from "./generic-assessment-report"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MOCK_ID_RE = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})-([0-3])$/i

export default async function AssessmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  // Real submission: only attempt when the id is a well-formed UUID, otherwise
  // postgres rejects it with `invalid input syntax for type uuid` and the
  // entire route blows up before we can fall back to the mock view.
  if (UUID_RE.test(id)) {
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

    if (submission) {
      return <AssessmentClient submission={submission} />
    }
  }

  // Mock IDs from client-tabs use `<clientUuid>-<digit>`. Render the rich mock report.
  const mockMatch = MOCK_ID_RE.exec(id)
  if (mockMatch) {
    const [, clientId, indexStr] = mockMatch
    const { data: client } = await adminClient
      .from("clients")
      .select("id, name")
      .eq("id", clientId)
      .maybeSingle()

    if (client) {
      return <MockAssessmentReport clientId={client.id} clientName={client.name} index={Number(indexStr)} />
    }
  }

  // Last-resort generic report so links never 404.
  return <GenericAssessmentReport id={id} />
}
