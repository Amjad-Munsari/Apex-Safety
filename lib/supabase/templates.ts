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
 * Get the latest PUBLISHED version of a template.
 *
 * Filters to rows with a non-null `published_at` so an unpublished draft is
 * never served to assessors — the name promises "published", and earlier this
 * function ordered by version_number alone and could return the latest draft
 * (audit finding #12). Use a separate helper if you ever need "latest of any
 * status".
 *
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
    .not("published_at", "is", null)
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
