import { createClient } from "@/lib/supabase/server";
import { getClientContext } from "@/lib/auth-helpers";
import { notFound, redirect } from "next/navigation";
import { TemplateBuilder } from "@/components/templates/template-builder";
import { saveClientDraft, publishClientTemplate } from "../actions";
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

export default async function ClientTemplateBuilderPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const ctx = await getClientContext();
  if (!ctx) redirect("/login");

  const { data: template } = await supabase
    .from("form_templates")
    .select("id, name, template_type, is_published, owner_type, owner_id")
    .eq("id", id)
    .single();

  // Belt-and-braces: RLS already enforces this, but if a client somehow lands
  // on an admin template's edit URL we want a clean 404 not a render attempt.
  if (!template || template.owner_type !== "customer" || template.owner_id !== ctx.client_id) {
    notFound();
  }

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
      surface="cream"
      saveAction={saveClientDraft}
      publishAction={publishClientTemplate}
    />
  );
}
