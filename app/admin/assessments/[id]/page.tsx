import { notFound } from "next/navigation"
import { adminClient } from "@/lib/supabase/admin"
import { AssessmentClient } from "./assessment-client"
import { MockAssessmentReport } from "./mock-assessment-report"

// Mock-generated assessment IDs from client-tabs.tsx use the pattern `<clientUuid>-<digit>`,
// where `<digit>` is 0–3. These don't exist in `form_submissions`, so the DB lookup fails.
// When that happens we fall back to a static report preview built from the client row.
const MOCK_ID_RE = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})-([0-3])$/i

export default async function AssessmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

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
    .single()

  if (submission) {
    return <AssessmentClient submission={submission} />
  }

  const mockMatch = MOCK_ID_RE.exec(id)
  if (mockMatch) {
    const [, clientId, indexStr] = mockMatch
    const { data: client } = await adminClient
      .from("clients")
      .select("id, name")
      .eq("id", clientId)
      .single()

    if (client) {
      return <MockAssessmentReport clientId={client.id} clientName={client.name} index={Number(indexStr)} />
    }
  }

  notFound()
}
