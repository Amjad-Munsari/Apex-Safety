"use server"

import { createClient } from "@/lib/supabase/server"
import { FormSchema, TemplateVersion } from "@/types/forms"
import { getLatestPublishedVersion } from "@/lib/supabase/templates"
import { revalidatePath } from "next/cache"

/**
 * Update the current draft of a template (Server Action)
 */
export async function updateTemplateDraftAction(templateId: string, schema: FormSchema) {
  const supabase = await createClient()
  const { error } = await supabase
    .from("form_templates")
    .update({ current_draft_json: schema })
    .eq("id", templateId)

  if (error) throw error
  revalidatePath("/admin/templates")
}

/**
 * Publish a new template version (Server Action)
 */
export async function publishTemplateVersionAction(templateId: string, schema: FormSchema, userId: string) {
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
    })
    .eq("id", templateId)

  if (tError) throw tError

  revalidatePath("/admin/templates")
  return version as TemplateVersion
}
