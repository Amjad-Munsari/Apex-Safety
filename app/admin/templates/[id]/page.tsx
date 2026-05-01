import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { TemplateBuilder } from "./_components/template-builder";
import type { FormSchema } from "@/lib/types/form-builder";

interface Props {
  params: Promise<{ id: string }>;
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

  const initialSchema: FormSchema = (latestVersion?.schema_json as FormSchema) ?? { fields: [] };
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
