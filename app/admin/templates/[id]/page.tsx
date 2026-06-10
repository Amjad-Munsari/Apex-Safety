import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { BuilderLoader } from "./builder-loader";
import { saveDraftAction, publishTemplateAction } from "../actions";
import { adminClient } from "@/lib/supabase/admin";
import { AssignTemplateModal } from "@/components/admin/assign-template-modal";

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
    .select("id, name, template_type, is_published, owner_type")
    .eq("id", id)
    .single();

  if (!template) notFound();

  // Customer-owned templates (built from scratch or forked from a master) are
  // visible to Matt read-only: viewing the structure is fine, but editing,
  // publishing, deleting, or assigning a client's own template is not. The
  // server actions also reject mutations on owner_type='customer' rows — this
  // flag keeps the UI honest about it.
  const readOnly = template.owner_type === "customer";

  // Load all versions ordered by version_number desc (latest first)
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

  // Fetch clients for the assign modal (service-role — admin page). Skipped in
  // read-only mode: admin can't assign a customer's own template.
  const { data: clients } = readOnly
    ? { data: null }
    : await adminClient
        .from("clients")
        .select("id, name")
        .is("deleted_at", null)
        // Deactivated clients are frozen — keep them out of the assign picker
        // (createAssignments also blocks them server-side).
        .eq("active", true)
        .order("name");

  return (
    <BuilderLoader
      templateId={template.id}
      initialName={template.name}
      templateType={template.template_type}
      isPublished={template.is_published}
      initialSchema={latestVersion?.schema_json ?? null}
      versionNumber={currentVersionNumber}
      hasDraft={hasDraft}
      publishedVersionNumber={latestPublished?.version_number ?? null}
      surface="dark"
      readOnly={readOnly}
      readOnlyNotice="Client-owned template"
      saveDraftAction={saveDraftAction}
      publishTemplateAction={publishTemplateAction}
      assignButton={
        readOnly ? undefined : (
          <AssignTemplateModal
            templateId={id}
            clients={clients ?? []}
            triggerLabel="Assign to clients"
          />
        )
      }
    />
  );
}
