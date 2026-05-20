import { createClient } from "./server"
import type { FormBuilderSchema } from "@/lib/form-builder"

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
  return data
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
  return data
}

/**
 * Get the latest version of a template (published or draft).
 * schema_json is a coltorapps FormBuilderSchema ({ entities, root }).
 */
export async function getLatestPublishedVersion(templateId: string): Promise<{
  id: string;
  template_id: string;
  version_number: number;
  schema_json: FormBuilderSchema;
  published_at: string | null;
  created_by: string | null;
} | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("template_versions")
    .select("*")
    .eq("template_id", templateId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return data as {
    id: string;
    template_id: string;
    version_number: number;
    schema_json: FormBuilderSchema;
    published_at: string | null;
    created_by: string | null;
  } | null
}
