"use server";

import { createClient } from "@/lib/supabase/server";
import { requireActorUserId, getClientContext } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

async function requireClientContext() {
  const ctx = await getClientContext();
  if (!ctx) throw new Error("Not a client user");
  return ctx;
}

/**
 * Verifies a customer-owned template exists and is owned by the requesting
 * client. Returns the template row on success, throws on miss.
 *
 * RLS already blocks unauthorized writes silently; this surfaces them as
 * loud errors so the client UI can react and we don't ship false success
 * states to multi-tenant customers.
 */
async function requireOwnedTemplate(templateId: string, clientId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("form_templates")
    .select("id, owner_id, owner_type")
    .eq("id", templateId)
    .single();
  if (error || !data) throw new Error("Template not found");
  if (data.owner_type !== "customer" || data.owner_id !== clientId) {
    throw new Error("Forbidden: not your template");
  }
  return data;
}

export async function createClientTemplate(name: string, templateType: string) {
  const supabase = await createClient();
  const ctx = await requireClientContext();
  const userId = await requireActorUserId("client");

  const { data, error } = await supabase
    .from("form_templates")
    .insert({
      name,
      template_type: templateType,
      owner_id: ctx.client_id,
      owner_type: "customer",
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  await supabase.from("template_versions").insert({
    template_id: data.id,
    version_number: 1,
    schema_json: { entities: {}, root: [] },
    created_by: userId,
  });

  revalidatePath("/client/templates");
  return data.id;
}

// ── saveClientDraftAction (coltorapps schema, always inserts new version) ───

export async function saveClientDraftAction(
  templateId: string,
  rawSchema: unknown,
  templateName: string
) {
  const supabase = await createClient();
  const ctx = await requireClientContext();
  await requireOwnedTemplate(templateId, ctx.client_id);
  const userId = await requireActorUserId("client");

  // Update template name
  await supabase
    .from("form_templates")
    .update({ name: templateName })
    .eq("id", templateId);

  // Server-side schema validation (T-13-04)
  const { validateSchema } = await import("@coltorapps/builder");
  const { formBuilder } = await import("@/lib/form-builder");
  const result = await validateSchema(rawSchema, formBuilder);
  if (!result.success) {
    throw new Error(`Invalid schema: ${result.reason.code}`);
  }

  // Phase 15 — reject cyclic rule graphs (D-08, Pitfall 2)
  // Customer surfaces receive the IDENTICAL guard as admin — asymmetry = exploit class (COND-03)
  const { validateRuleGraph } = await import("@/lib/form-builder/visibility/validate-rule-graph");
  const graphResult = validateRuleGraph(result.data as Parameters<typeof validateRuleGraph>[0]);
  if (!graphResult.ok) {
    throw new Error(JSON.stringify({
      kind: "RuleGraphInvalid",
      cycles: graphResult.cycles.map(c => ({ entityIds: c.path, labels: c.labels })),
      scopeErrors: graphResult.scopeErrors,
    }));
  }

  // Insert new immutable version row (owner_type = "customer", owner_id = org UUID — T-13-06)
  const { data: max } = await supabase
    .from("template_versions")
    .select("version_number")
    .eq("template_id", templateId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  await supabase.from("template_versions").insert({
    template_id: templateId,
    version_number: (max?.version_number ?? 0) + 1,
    schema_json: result.data,
    created_by: userId,
  });

  revalidatePath(`/client/templates/${templateId}`);
}

// ── publishClientTemplateAction ──────────────────────────────────────────────

export async function publishClientTemplateAction(
  templateId: string,
  rawSchema: unknown,
  templateName: string
) {
  const supabase = await createClient();
  const ctx = await requireClientContext();
  await requireOwnedTemplate(templateId, ctx.client_id);
  const userId = await requireActorUserId("client");

  await supabase
    .from("form_templates")
    .update({ name: templateName })
    .eq("id", templateId);

  // Server-side schema validation (T-13-04)
  const { validateSchema } = await import("@coltorapps/builder");
  const { formBuilder } = await import("@/lib/form-builder");
  const result = await validateSchema(rawSchema, formBuilder);
  if (!result.success) {
    throw new Error(`Invalid schema: ${result.reason.code}`);
  }

  // Phase 15 — reject cyclic rule graphs (D-08, Pitfall 2)
  // Customer surfaces receive the IDENTICAL guard as admin — asymmetry = exploit class (COND-03)
  const { validateRuleGraph } = await import("@/lib/form-builder/visibility/validate-rule-graph");
  const graphResult = validateRuleGraph(result.data as Parameters<typeof validateRuleGraph>[0]);
  if (!graphResult.ok) {
    throw new Error(JSON.stringify({
      kind: "RuleGraphInvalid",
      cycles: graphResult.cycles.map(c => ({ entityIds: c.path, labels: c.labels })),
      scopeErrors: graphResult.scopeErrors,
    }));
  }

  const { data: max } = await supabase
    .from("template_versions")
    .select("version_number")
    .eq("template_id", templateId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  await supabase.from("template_versions").insert({
    template_id: templateId,
    version_number: (max?.version_number ?? 0) + 1,
    schema_json: result.data,
    published_at: new Date().toISOString(),
    created_by: userId,
  });

  await supabase
    .from("form_templates")
    .update({ is_published: true })
    .eq("id", templateId);

  revalidatePath("/client/templates");
  revalidatePath(`/client/templates/${templateId}`);
}

export async function deleteClientTemplate(templateId: string) {
  const supabase = await createClient();
  const ctx = await requireClientContext();
  await requireOwnedTemplate(templateId, ctx.client_id);
  await supabase.from("form_templates").delete().eq("id", templateId);
  revalidatePath("/client/templates");
}

/**
 * Submit a customer-built template fill (D-16).
 *
 * Inserts a form_submissions row with assignment_id=NULL (no assignment for
 * customer-built templates). client_id comes ONLY from server context (T-16-04
 * mitigation — never a client-supplied parameter).
 *
 * Security:
 *   - requireClientContext() → throws if not authenticated as client user
 *   - requireOwnedTemplate() → throws on cross-org template id
 *   - Uses RLS-aware createClient (T-16-06: never lib/supabase/admin)
 *   - client_id: ctx.client_id (server context), NEVER a function parameter
 */
export async function submitCustomerTemplateFillAction(
  templateId: string,
  answers: Record<string, unknown>
): Promise<void> {
  const ctx = await requireClientContext();
  const supabase = await createClient();

  await requireOwnedTemplate(templateId, ctx.client_id);

  // Fetch the latest published version for this template (D-16)
  const { data: latestVersion } = await supabase
    .from("template_versions")
    .select("id")
    .eq("template_id", templateId)
    .not("published_at", "is", null)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!latestVersion) {
    throw new Error("Template has no published version");
  }

  // INSERT form_submissions with assignment_id=NULL (D-16 contract, enabled by migration 014).
  // client_id: ctx.client_id — taken from server context, NEVER from function parameter (T-16-04).
  const { error } = await supabase.from("form_submissions").insert({
    template_version_id: latestVersion.id,
    client_id: ctx.client_id,
    assignment_id: null,
    status: "submitted",
    answers_json: answers,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/client/templates");
  revalidatePath(`/client/templates/${templateId}`);

  // redirect() MUST be the last statement — it throws NEXT_REDIRECT which the
  // framework catches. Wrapping in try/catch would swallow it (RESEARCH Pitfall 1).
  redirect("/client/templates");
}
