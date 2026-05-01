import { createClient } from "./server"
import { FormSchema, FormTemplate, TemplateVersion } from "@/types/forms"

/**
 * Fetch all form templates (Admin View)
 */
export async function getFormTemplates() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("form_templates")
    .select("*")
    .order("created_at", { ascending: false })

  if (error) throw error
  return data as FormTemplate[]
}

/**
 * Fetch a specific template by ID
 */
export async function getFormTemplate(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("form_templates")
    .select("*")
    .eq("id", id)
    .single()

  if (error) throw error
  return data as FormTemplate
}

/**
 * Get the latest published version of a template
 */
export async function getLatestPublishedVersion(templateId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("template_versions")
    .select("*")
    .eq("template_id", templateId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return data as TemplateVersion | null
}

/**
 * Update the current draft of a template
 */
export async function updateTemplateDraft(templateId: string, schema: FormSchema) {
  const supabase = await createClient()
  const { error } = await supabase
    .from("form_templates")
    .update({ current_draft_json: schema })
    .eq("id", templateId)

  if (error) throw error
}

/**
 * Publish a new template version
 */
export async function publishTemplateVersion(templateId: string, schema: FormSchema, userId: string) {
  const supabase = await createClient()
  
  // 1. Get current max version
  const latest = await getLatestPublishedVersion(templateId)
  const nextVersion = (latest?.version_number || 0) + 1

  // 2. Insert into template_versions
  const { data: version, error: vError } = await supabase
    .from("template_versions")
    .insert({
      template_id: templateId,
      version_number: nextVersion,
      schema_json: { ...schema, version: nextVersion },
      published_at: new Date().toISOString(),
      created_by: userId
    })
    .select()
    .single()

  if (vError) throw vError

  // 3. Update form_templates to mark as published
  const { error: tError } = await supabase
    .from("form_templates")
    .update({ 
      is_published: true,
      // We keep the draft synced or clear it
    })
    .eq("id", templateId)

  if (tError) throw tError

  return version as TemplateVersion
}
