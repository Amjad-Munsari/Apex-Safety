import { adminClient } from "@/lib/supabase/admin";
import { AdvancedAssessmentBuilder } from "@/components/assessments/advanced-assessment-builder";
import { PLATFORM_NAME } from "@/lib/public-identity";

export const metadata = {
  title: `New Assessment | ${PLATFORM_NAME}`,
};

export const dynamic = "force-dynamic";

/**
 * The `template:form_templates!inner(...)` embed on the template_versions query
 * below. PostgREST hands it back as either an object or a single-element array
 * depending on how it resolves the relation, hence the normalize step.
 */
type TemplateEmbed = {
  id: string
  name: string
  owner_type: string | null
  owner_id: string | null
  deleted_at: string | null
}

export default async function NewAssessmentPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string; templateVersionId?: string }>;
}) {
  const params = await searchParams;

  const [clientsResult, templatesResult] = await Promise.all([
    adminClient
      .from("clients")
      .select("id, name, site_address, contact_name, contact_email")
      .is("deleted_at", null)
      // Deactivated clients are frozen — keep them out of the picker so an
      // assessment can't be started for one (the server action also blocks it).
      .eq("active", true)
      .order("name", { ascending: true }),
    adminClient
      .from("template_versions")
      .select(`
        id,
        version_number,
        published_at,
        template:form_templates!inner(id, name, owner_type, owner_id, deleted_at)
      `)
      .not("published_at", "is", null)
      .order("published_at", { ascending: false }),
  ]);

  if (clientsResult.error) {
    console.error("Error fetching clients:", clientsResult.error);
  }
  if (templatesResult.error) {
    console.error("Error fetching templates:", templatesResult.error);
  }

  const clients = (clientsResult.data ?? []).map(row => ({
    id: row.id,
    name: row.name,
    address: row.site_address ?? undefined,
    contactName: row.contact_name ?? undefined,
    contactEmail: row.contact_email ?? undefined,
  }));

  // Dedupe to the latest published version per template. Admin masters are
  // always offered; customer-owned templates carry ownerClientId so the wizard
  // can offer them ONLY when their owning client is the one selected — Matt
  // can run an assessment on a client's own form, but one client's template
  // must never be offered for another client.
  const latestPerTemplate = new Map<string, {
    id: string;
    name: string;
    version: number;
    publishedAt: string | null;
    ownerClientId: string | null;
  }>();

  for (const row of templatesResult.data ?? []) {
    const tpl: TemplateEmbed | undefined = Array.isArray(row.template)
      ? row.template[0]
      : row.template;
    if (!tpl) continue;
    if (tpl.deleted_at) continue;
    // A customer-owned row with no owner org is corrupt data. Without this
    // guard it would fall through to ownerClientId=null and be offered as a
    // GLOBAL master — one client's template must never be offered for another
    // client, so hide it instead.
    if (tpl.owner_type === "customer" && !tpl.owner_id) continue;

    const templateId: string = tpl.id;
    const existing = latestPerTemplate.get(templateId);
    if (!existing || (row.version_number ?? 0) > existing.version) {
      latestPerTemplate.set(templateId, {
        id: row.id,
        name: tpl.name,
        version: row.version_number,
        publishedAt: row.published_at ?? null,
        ownerClientId: tpl.owner_type === "customer" ? tpl.owner_id : null,
      });
    }
  }

  const templates = Array.from(latestPerTemplate.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  return (
    <AdvancedAssessmentBuilder
      clients={clients}
      templates={templates}
      initialClientId={params.clientId ?? null}
      initialTemplateVersionId={params.templateVersionId ?? null}
    />
  );
}
