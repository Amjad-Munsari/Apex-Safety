import { notFound } from "next/navigation"
import { adminClient } from "@/lib/supabase/admin"
import { AssessmentClient } from "./assessment-client"

export default async function AssessmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  
  const { data: submission, error } = await adminClient
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
    
  if (error || !submission) {
    notFound()
  }
  
  return <AssessmentClient submission={submission} />
}
