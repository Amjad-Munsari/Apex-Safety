import { redirect } from "next/navigation"
import { adminClient } from "@/lib/supabase/admin"
import { AssessmentSetup } from "@/components/assessments/assessment-setup"

export default async function NewAssessmentPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string; templateVersionId?: string }>
}) {
  const params = await searchParams
  
  if (!params.clientId || !params.templateVersionId) {
    redirect("/admin")
  }

  const { data: existingDraft } = await adminClient
    .from("form_submissions")
    .select("*")
    .eq("client_id", params.clientId)
    .eq("template_version_id", params.templateVersionId)
    .eq("status", "draft")
    .order("created_at", { ascending: false })
    .limit(1)
    .single()

  return (
    <AssessmentSetup 
      clientId={params.clientId} 
      templateVersionId={params.templateVersionId} 
      existingDraft={existingDraft || null} 
    />
  )
}
