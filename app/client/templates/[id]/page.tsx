import { createClient } from "@/lib/supabase/server";
import { getClientContext } from "@/lib/auth-helpers";
import { notFound, redirect } from "next/navigation";
import { TemplateBuilderClient } from "@/app/admin/templates/[id]/builder-client";
import { saveClientDraftAction, publishClientTemplateAction } from "../actions";

interface Props {
  params: Promise<{ id: string }>;
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

  const currentVersionNumber = latestVersion?.version_number ?? 1;
  const hasDraft = !!(latestVersion && !latestVersion.published_at);

  return (
    <TemplateBuilderClient
      templateId={template.id}
      initialName={template.name}
      templateType={template.template_type}
      isPublished={template.is_published}
      initialSchema={latestVersion?.schema_json ?? null}
      versionNumber={currentVersionNumber}
      hasDraft={hasDraft}
      publishedVersionNumber={latestPublished?.version_number ?? null}
      surface="cream"
      saveDraftAction={saveClientDraftAction}
      publishTemplateAction={publishClientTemplateAction}
    />
  );
}
