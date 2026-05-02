import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { TemplateBuilder } from "./_components/template-builder";
import type { FormSchema, FormField } from "@/lib/types/form-builder";

interface Props {
  params: Promise<{ id: string }>;
}

// Older templates persist `{ sections: [{ fields: [...] }] }`. The builder expects the
// flat `{ fields: [...] }` shape, so flatten while preserving order, and tolerate any
// other malformed payloads instead of crashing the editor.
function normaliseSchema(raw: unknown): FormSchema {
  if (!raw || typeof raw !== "object") return { fields: [] };
  const obj = raw as Record<string, unknown>;
  if (Array.isArray(obj.fields)) return { fields: obj.fields as FormField[] };
  if (Array.isArray(obj.sections)) {
    const flat: FormField[] = [];
    for (const section of obj.sections as Array<{ fields?: FormField[] }>) {
      if (Array.isArray(section?.fields)) flat.push(...section.fields);
    }
    return { fields: flat };
  }
  return { fields: [] };
}

export default async function TemplateBuilderPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: template } = await supabase
    .from("form_templates")
    .select("id, name, template_type, is_published")
    .eq("id", id)
    .single();

  if (!template) notFound();

  // Load latest version (draft preferred)
  const { data: versions } = await supabase
    .from("template_versions")
    .select("id, version_number, schema_json, published_at")
    .eq("template_id", id)
    .order("version_number", { ascending: false });

  const latestVersion = versions?.[0];
  const publishedVersions = versions?.filter(v => v.published_at) ?? [];
  const latestPublished = publishedVersions[0];

  const initialSchema: FormSchema = normaliseSchema(latestVersion?.schema_json);
  const currentVersionNumber = latestVersion?.version_number ?? 1;
  const hasDraft = latestVersion && !latestVersion.published_at;

  return (
    <TemplateBuilder
      templateId={template.id}
      initialName={template.name}
      templateType={template.template_type}
      isPublished={template.is_published}
      initialSchema={initialSchema}
      versionNumber={currentVersionNumber}
      hasDraft={!!hasDraft}
      publishedVersionNumber={latestPublished?.version_number ?? null}
    />
  );
}
