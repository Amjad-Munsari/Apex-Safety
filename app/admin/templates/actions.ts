"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { FormSchema } from "@/lib/types/form-builder";
import type { FormSchema as LegacyFormSchema, TemplateVersion } from "@/types/forms";
import { getLatestPublishedVersion } from "@/lib/supabase/templates";
import { requireActorUserId } from "@/lib/auth-helpers";

export async function createTemplate(name: string, templateType: string) {
  const supabase = await createClient();
  const userId = await requireActorUserId("admin");
  

  const { data, error } = await supabase
    .from("form_templates")
    .insert({ name, template_type: templateType, owner_id: userId })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  // Create initial draft version with empty schema
  await supabase.from("template_versions").insert({
    template_id: data.id,
    version_number: 1,
    schema_json: { fields: [] },
    created_by: userId,
  });

  revalidatePath("/admin/templates");
  return data.id;
}

export async function saveDraft(templateId: string, schema: FormSchema, templateName: string) {
  const supabase = await createClient();
  const userId = await requireActorUserId("admin");
  

  // Update template name
  await supabase
    .from("form_templates")
    .update({ name: templateName })
    .eq("id", templateId);

  // Find latest unpublished version
  const { data: latest } = await supabase
    .from("template_versions")
    .select("id, published_at")
    .eq("template_id", templateId)
    .order("version_number", { ascending: false })
    .limit(1)
    .single();

  if (latest && !latest.published_at) {
    // Update the draft in place
    await supabase
      .from("template_versions")
      .update({ schema_json: schema })
      .eq("id", latest.id);
  } else {
    // All versions are published — create a new draft
    const { data: maxVersion } = await supabase
      .from("template_versions")
      .select("version_number")
      .eq("template_id", templateId)
      .order("version_number", { ascending: false })
      .limit(1)
      .single();

    await supabase.from("template_versions").insert({
      template_id: templateId,
      version_number: (maxVersion?.version_number ?? 0) + 1,
      schema_json: schema,
      created_by: userId,
    });
  }

  revalidatePath(`/admin/templates/${templateId}`);
}

export async function publishTemplate(templateId: string, schema: FormSchema, templateName: string) {
  const supabase = await createClient();
  const userId = await requireActorUserId("admin");
  

  // Save name
  await supabase
    .from("form_templates")
    .update({ name: templateName, is_published: true })
    .eq("id", templateId);

  // Find latest draft (unpublished)
  const { data: draft } = await supabase
    .from("template_versions")
    .select("id, version_number, published_at")
    .eq("template_id", templateId)
    .order("version_number", { ascending: false })
    .limit(1)
    .single();

  if (draft && !draft.published_at) {
    // Publish the existing draft
    await supabase
      .from("template_versions")
      .update({ schema_json: schema, published_at: new Date().toISOString() })
      .eq("id", draft.id);
  } else {
    // Create new version and publish immediately
    const newVersion = (draft?.version_number ?? 0) + 1;
    await supabase.from("template_versions").insert({
      template_id: templateId,
      version_number: newVersion,
      schema_json: schema,
      published_at: new Date().toISOString(),
      created_by: userId,
    });
  }

  revalidatePath("/admin/templates");
  revalidatePath(`/admin/templates/${templateId}`);
}

export async function deleteTemplate(templateId: string) {
  const supabase = await createClient();
  const userId = await requireActorUserId("admin");
  

  await supabase.from("form_templates").delete().eq("id", templateId);
  revalidatePath("/admin/templates");
}

// Aliases for editor-client.tsx compatibility
export async function updateTemplateDraftAction(templateId: string, schema: LegacyFormSchema) {
  const supabase = await createClient();
  const userId = await requireActorUserId("admin");
  

  const { data: latest } = await supabase
    .from("template_versions")
    .select("id, published_at")
    .eq("template_id", templateId)
    .order("version_number", { ascending: false })
    .limit(1)
    .single();

  if (latest && !latest.published_at) {
    await supabase.from("template_versions").update({ schema_json: schema }).eq("id", latest.id);
  } else {
    const { data: max } = await supabase
      .from("template_versions")
      .select("version_number")
      .eq("template_id", templateId)
      .order("version_number", { ascending: false })
      .limit(1)
      .single();
    await supabase.from("template_versions").insert({
      template_id: templateId,
      version_number: (max?.version_number ?? 0) + 1,
      schema_json: schema,
      created_by: userId,
    });
  }
  revalidatePath("/admin/templates");
}

export async function publishTemplateVersionAction(
  templateId: string,
  schema: LegacyFormSchema,
  userId: string
): Promise<TemplateVersion> {
  const supabase = await createClient();

  const latest = await getLatestPublishedVersion(templateId);
  const nextVersion = (latest?.version_number ?? 0) + 1;

  const { data: version, error } = await supabase
    .from("template_versions")
    .insert({
      template_id: templateId,
      version_number: nextVersion,
      schema_json: { ...schema, version: nextVersion },
      published_at: new Date().toISOString(),
      created_by: userId,
    })
    .select()
    .single();

  if (error) throw error;

  await supabase.from("form_templates").update({ is_published: true }).eq("id", templateId);

  revalidatePath("/admin/templates");
  return version as TemplateVersion;
}
