"use server";

import { createClient } from "@/lib/supabase/server";
import { requireActorUserId, getClientContext } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";
import type { FormBuilderSchema } from "@/lib/form-builder";
import { hasStructuralChanges } from "@/lib/forms/schema-diff";

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
 * Fork a master template for the current customer when they've changed its
 * structure during fill.
 *
 * NOT YET WIRED INTO ANY UI — the client-side form-fill page is a separate
 * task. When that page is built, it should call this on save:
 *
 *   const result = await forkOnFill(masterTemplateId, originalSchema, currentSchema);
 *   const versionIdToSubmitAgainst = result.versionId;
 *   // then write form_submissions row with template_version_id = versionIdToSubmitAgainst
 *
 * Returns `{ forked: true, templateId, versionId }` if structure changed and a
 * fork was created. Returns `{ forked: false, templateId, versionId }` (the
 * master's published version) if no structural change — caller should submit
 * against the master version directly.
 *
 * Structural change detection uses `hasStructuralChanges` (lib/forms/schema-diff.ts):
 * field id/order, key, type, label, required, options. Presentation-only edits
 * (helpText, placeholder, maxPhotos, maxRating) do NOT trigger a fork.
 *
 * Contract preserved per AGENTS.md "Form template ownership" decision (2026-04-17).
 */
export async function forkOnFill(
  masterTemplateId: string,
  originalSchema: FormBuilderSchema,
  modifiedSchema: FormBuilderSchema
): Promise<{ forked: boolean; templateId: string; versionId: string }> {
  const supabase = await createClient();
  const ctx = await requireClientContext();
  const userId = await requireActorUserId("client");

  // Customers can only fork admin-owned (Matt's) published masters — never
  // another customer's template. RLS scopes the read to admin-owned anyway,
  // but be loud about violations so the future fill-UI surfaces a real error.
  const { data: masterCheck, error: masterCheckErr } = await supabase
    .from("form_templates")
    .select("owner_type, is_published")
    .eq("id", masterTemplateId)
    .single();
  if (masterCheckErr || !masterCheck) throw new Error("Master template not found");
  if (masterCheck.owner_type !== "admin") throw new Error("Forbidden: can only fork admin-owned masters");
  if (!masterCheck.is_published) throw new Error("Cannot fork an unpublished master");

  if (!hasStructuralChanges(originalSchema, modifiedSchema)) {
    const { data: masterVersion, error } = await supabase
      .from("template_versions")
      .select("id")
      .eq("template_id", masterTemplateId)
      .not("published_at", "is", null)
      .order("version_number", { ascending: false })
      .limit(1)
      .single();
    if (error || !masterVersion) throw new Error("Master template has no published version to bind to");
    return { forked: false, templateId: masterTemplateId, versionId: masterVersion.id };
  }

  const { data: master, error: masterErr } = await supabase
    .from("form_templates")
    .select("name, template_type")
    .eq("id", masterTemplateId)
    .single();
  if (masterErr || !master) throw new Error("Master template not found");

  const { data: forkRow, error: forkErr } = await supabase
    .from("form_templates")
    .insert({
      name: master.name,
      template_type: master.template_type,
      owner_id: ctx.client_id,
      owner_type: "customer",
      parent_template_id: masterTemplateId,
      is_published: true,
    })
    .select("id")
    .single();
  if (forkErr || !forkRow) throw new Error(forkErr?.message ?? "Fork insert failed");

  const { data: versionRow, error: versionErr } = await supabase
    .from("template_versions")
    .insert({
      template_id: forkRow.id,
      version_number: 1,
      schema_json: modifiedSchema,
      published_at: new Date().toISOString(),
      created_by: userId,
    })
    .select("id")
    .single();
  if (versionErr || !versionRow) throw new Error(versionErr?.message ?? "Fork version insert failed");

  return { forked: true, templateId: forkRow.id, versionId: versionRow.id };
}
