"use server";

import { createClient } from "@/lib/supabase/server";
import { requireActorUserId, getClientContext } from "@/lib/auth-helpers";
import { assertClientActive } from "@/lib/clients/require-active";
import { dispatchClientFormEvent } from "@/lib/notifications/client-form-events";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

// Every export in this file is a WRITE (create/save/publish/delete/fill a
// customer-owned template), so the deactivated-client freeze belongs here in the
// shared context resolver — a deactivated client's users can't build or fill.
async function requireClientContext() {
  const ctx = await getClientContext();
  if (!ctx) throw new Error("Not a client user");
  await assertClientActive(ctx.client_id);
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

  // Notify n8n that a client built a new template from scratch (best-effort).
  await dispatchClientFormEvent({
    type: "client_form_created",
    client_id: ctx.client_id,
    template_id: data.id,
    template_name: name,
    template_type: templateType,
    created_at: new Date().toISOString(),
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
 * Creates a draft form_submissions row for a customer template self-fill (D-16).
 *
 * Called from the RSC (fill/page.tsx) before mounting FillCustomerTemplateClient.
 * The draft row gives Phase 14 specialty renderers a real submissionId for
 * their upload paths at mount time.
 *
 * Security invariants (T-16-04, T-16-09):
 *   - client_id is NEVER accepted from the caller — always from requireClientContext()
 *   - requireOwnedTemplate() verifies owner_type='customer' AND owner_id=ctx.client_id
 *   - assignment_id: null (D-16 contract — customer-built templates have no assignment row)
 */
export async function createCustomerTemplateDraftSubmission(
  templateId: string
): Promise<{ id: string; versionId: string }> {
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

  // INSERT draft form_submissions with assignment_id=NULL (D-16 contract).
  // client_id: ctx.client_id — taken from server context, NEVER from function parameter (T-16-04).
  const { data: draft, error } = await supabase
    .from("form_submissions")
    .insert({
      template_version_id: latestVersion.id,
      client_id: ctx.client_id,
      assignment_id: null,
      status: "draft",
      answers_json: {},
    })
    .select("id")
    .single();

  if (error || !draft) {
    throw new Error(error?.message ?? "Failed to create draft submission");
  }

  return { id: draft.id, versionId: latestVersion.id };
}

/**
 * Server action: submit the pre-created draft for a customer template fill (D-16).
 *
 * Pre-create-then-UPDATE pattern (replaces the INSERT path of submitCustomerTemplateFillAction).
 * The RSC creates a draft submission before mounting FillCustomerTemplateClient;
 * this action UPDATEs that draft to status='submitted' on final submit.
 *
 * Security invariants (T-16-04, T-16-09):
 *   - client_id comes ONLY from server-side requireClientContext() — never from params
 *   - .eq("client_id", ctx.client_id) is a defense-in-depth filter alongside RLS
 *
 * Submit sequence:
 *   1. Auth context + supabase
 *   2. UPDATE form_submissions SET answers_json, status='submitted', submitted_at
 *      WHERE id=submissionId AND client_id=ctx.client_id (defense-in-depth)
 *   3. revalidatePath /client/templates
 *   4. redirect /client/templates (LAST, outside try/catch)
 */
export async function submitCustomerTemplateFillByIdAction(
  submissionId: string,
  answers: Record<string, unknown>
): Promise<void> {
  const ctx = await requireClientContext();
  const supabase = await createClient();

  const { error: updateError } = await supabase
    .from("form_submissions")
    .update({
      answers_json: answers,
      status: "submitted",
      submitted_at: new Date().toISOString(),
    })
    .eq("id", submissionId)
    .eq("client_id", ctx.client_id);

  if (updateError) {
    throw new Error(updateError.message ?? "Failed to submit form");
  }

  // Notify n8n of a customer-built template self-fill submission (best-effort).
  // assignment_id is null per the D-16 contract (no assignment row).
  await dispatchClientFormEvent({
    type: "client_form_submitted",
    client_id: ctx.client_id,
    submission_id: submissionId,
    assignment_id: null,
    submitted_at: new Date().toISOString(),
  });

  revalidatePath("/client/templates");

  // redirect() MUST be the last statement — it throws NEXT_REDIRECT which the
  // framework catches. Wrapping in try/catch would swallow it (RESEARCH Pitfall 1).
  redirect("/client/templates");
}
