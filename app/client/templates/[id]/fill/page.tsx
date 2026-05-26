import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getClientContext } from "@/lib/auth-helpers";
import { createCustomerTemplateDraftSubmission } from "@/app/client/templates/actions";
import { FillCustomerTemplateClient } from "./fill-customer-template-client";
import Link from "next/link";
import type { FormBuilderSchema } from "@/lib/form-builder";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Props {
  params: Promise<{ id: string }>;
}

/**
 * Customer-built template fill route (D-16).
 *
 * Mounts the form interpreter against the template's latest published version.
 * Ownership check before fetching schema_json (T-16-01 mitigation).
 * Soft-deleted templates return 404 (T-16-08 mitigation).
 */
export default async function FillCustomerTemplatePage({ params }: Props) {
  const { id } = await params;

  // UUID guard — reject non-UUIDs before hitting Postgres
  if (!UUID_RE.test(id)) {
    notFound();
  }

  const supabase = await createClient();
  const ctx = await getClientContext();
  if (!ctx) notFound();

  // Step 1: Verify ownership (T-16-01: check before fetching schema_json)
  const { data: template } = await supabase
    .from("form_templates")
    .select("id, name, owner_id, owner_type, deleted_at")
    .eq("id", id)
    .maybeSingle();

  // 404 if: not found, soft-deleted, or not a customer template owned by this org
  if (
    !template ||
    template.deleted_at !== null ||
    template.owner_type !== "customer" ||
    template.owner_id !== ctx.client_id
  ) {
    notFound();
  }

  // Step 2: Fetch the latest published version (two-step fetch — never via join)
  const { data: version } = await supabase
    .from("template_versions")
    .select("id, schema_json")
    .eq("template_id", id)
    .not("published_at", "is", null)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  // 404 if no published version (template must be published before filling)
  if (!version) {
    notFound();
  }

  // Step 3: Pre-create the draft submission row so specialty renderers
  // (signature, multi-photo, geolocation) have a real submissionId at mount time.
  const draft = await createCustomerTemplateDraftSubmission(id);

  return (
    <div className="min-h-screen" data-surface="client">
      {/* Back link */}
      <div className="max-w-3xl mx-auto pt-6 px-4">
        <Link
          href="/client/templates"
          className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#8a857f] hover:text-[#1a1a1a] transition-colors"
        >
          ← Back to My Templates
        </Link>
        <h2 className="font-serif text-[28px] text-[#1a1a1a] font-medium tracking-tight leading-[1.1] mt-4">
          {template.name}
        </h2>
      </div>

      <FillCustomerTemplateClient
        templateId={id}
        templateName={template.name}
        schemaJson={version.schema_json as FormBuilderSchema}
        submissionId={draft.id}
        clientId={ctx.client_id}
      />
    </div>
  );
}
