import { getFormTemplate, getLatestPublishedVersion } from "@/lib/supabase/templates"
import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import { EditorClient } from "./editor-client"
import { FormSchema } from "@/types/forms"

export default async function TemplateEditorPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const template = await getFormTemplate(params.id)
  if (!template) notFound()

  // For v1, we'll use the draft if it exists, otherwise the latest published version
  const latestVersion = await getLatestPublishedVersion(params.id)
  const initialSchema = (template.current_draft_json || latestVersion?.schema_json || {
    title: template.name,
    sections: [
      { id: 'sec_1', title: 'General Information', fields: [] }
    ],
    version: 0
  }) as FormSchema

  return (
    <EditorClient 
      template={template} 
      initialSchema={initialSchema} 
      userId={user.id} 
    />
  )
}
