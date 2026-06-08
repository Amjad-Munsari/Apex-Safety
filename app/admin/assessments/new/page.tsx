import { adminClient } from "@/lib/supabase/admin";
import { AdvancedAssessmentBuilder } from "@/components/assessments/advanced-assessment-builder";

export const metadata = {
  title: "New Assessment | 888 Safety Solutions",
};

export const dynamic = "force-dynamic";

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
        template:form_templates!inner(id, name, owner_type)
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

  // Dedupe to the latest version per template, and only surface admin-owned
  // masters in the assessment wizard (customer-owned templates aren't run
  // through admin's assessment builder).
  const latestPerTemplate = new Map<string, {
    id: string;
    name: string;
    version: number;
    publishedAt: string | null;
  }>();

  for (const row of templatesResult.data ?? []) {
    const tpl: any = Array.isArray(row.template) ? row.template[0] : row.template;
    if (!tpl) continue;
    if (tpl.owner_type && tpl.owner_type !== "admin") continue;

    const templateId: string = tpl.id;
    const existing = latestPerTemplate.get(templateId);
    if (!existing || (row.version_number ?? 0) > existing.version) {
      latestPerTemplate.set(templateId, {
        id: row.id,
        name: tpl.name,
        version: row.version_number,
        publishedAt: row.published_at ?? null,
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
