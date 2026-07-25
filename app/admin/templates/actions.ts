"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { requireActorUserId, isAdmin } from "@/lib/auth-helpers";

// Admin-only template mutations. requireActorUserId only proves authentication;
// this adds the authorization check against the server-trusted admin_users table
// (defense-in-depth alongside RLS, since there is no route middleware).
async function assertAdmin() {
  if (!(await isAdmin())) throw new Error("Unauthorized");
}

/**
 * Verifies that a template exists and is admin-owned (owner_type = "admin").
 * Returns the template row on success, throws on miss or wrong owner_type.
 *
 * Mirrors the client path's requireOwnedTemplate guard. Without this, an admin
 * who navigates to a customer-owned template URL could append versions, flip
 * is_published, or delete it via the adminClient — violating the AGENTS.md
 * fork-ownership contract (customer masters must never be admin-mutated).
 */
async function requireAdminOwnedTemplate(templateId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("form_templates")
    .select("id, owner_type")
    .eq("id", templateId)
    .is("deleted_at", null)
    .single();
  if (error || !data) throw new Error("Template not found");
  if (data.owner_type !== "admin") {
    throw new Error("Forbidden: not an admin-owned template");
  }
  return data;
}

/**
 * Insert the next template_versions row for a template, retrying on the
 * UNIQUE(template_id, version_number) violation that two concurrent saves race
 * into. Up to 3 attempts: on a 23505 we re-read max(version_number) and bump.
 * Any other error, or exhausting the retries, throws — a failed version insert
 * must never silently succeed.
 *
 * Shared by saveDraftAction (no publish) and publishTemplateAction (sets
 * published_at) — opts.publishedAt distinguishes the two.
 *
 * Mirrors the client path's insertTemplateVersionWithRetry (app/client/templates/actions.ts).
 */
async function insertTemplateVersionWithRetry(
  supabase: Awaited<ReturnType<typeof createClient>>,
  opts: {
    templateId: string;
    schemaJson: unknown;
    createdBy: string | null;
    publishedAt?: string;
  }
): Promise<void> {
  let lastError: { code?: string; message?: string } | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data: max } = await supabase
      .from("template_versions")
      .select("version_number")
      .eq("template_id", opts.templateId)
      .order("version_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    const row: Record<string, unknown> = {
      template_id: opts.templateId,
      version_number: (max?.version_number ?? 0) + 1,
      schema_json: opts.schemaJson,
      created_by: opts.createdBy,
    };
    if (opts.publishedAt) row.published_at = opts.publishedAt;

    const { error } = await supabase.from("template_versions").insert(row);
    if (!error) return;

    lastError = error;
    // 23505 = unique_violation: another concurrent save took our version_number.
    // Re-read max and bump again. Any other error is unrecoverable — throw immediately.
    if (error.code !== "23505") {
      throw new Error(error.message ?? "Failed to insert template version");
    }
  }
  throw new Error(
    lastError?.message ?? "Failed to insert template version after 3 attempts (version-number race)"
  );
}

// Build a readable "attr@entityId: message" summary from a coltorapps
// SchemaValidationError reason (InvalidEntitiesAttributes), whose error values
// may be Error instances that JSON.stringify to "{}".
function describeAttributeErrors(reason: unknown): string {
  const errs = (
    reason as {
      payload?: { entitiesAttributesErrors?: Record<string, Record<string, unknown>> };
    }
  )?.payload?.entitiesAttributesErrors;
  if (!errs || typeof errs !== "object") return "";
  const parts: string[] = [];
  for (const [entityId, attrErrs] of Object.entries(errs)) {
    for (const [attr, e] of Object.entries(attrErrs ?? {})) {
      const msg =
        e instanceof Error
          ? e.message
          : typeof e === "string"
            ? e
            : JSON.stringify(e);
      parts.push(`${attr}@${entityId.slice(0, 8)}: ${msg}`);
    }
  }
  return parts.join("; ");
}

// ── createTemplate ──────────────────────────────────────────────────────────

export async function createTemplate(name: string, templateType: string) {
  const supabase = await createClient();
  await assertAdmin();
  const userId = await requireActorUserId("admin");

  const { data, error } = await supabase
    .from("form_templates")
    .insert({
      name,
      template_type: templateType,
      owner_id: userId,
      owner_type: "admin",
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  // Seed version 1 with an empty coltorapps schema
  await supabase.from("template_versions").insert({
    template_id: data.id,
    version_number: 1,
    schema_json: { entities: {}, root: [] },
    created_by: userId,
  });

  revalidatePath("/admin/templates");
  return data.id;
}

// ── saveDraftAction (BUILDER-05: admin gate) ────────────────────────────────
// Always inserts a NEW immutable template_versions row — never mutates existing rows.

export async function saveDraftAction(
  templateId: string,
  rawSchema: unknown,
  templateName: string
) {
  const supabase = await createClient();
  await assertAdmin();
  // Guard: only admin-owned templates may be mutated by this action. A customer-
  // owned template reachable by URL must not receive admin-appended versions
  // (AGENTS.md fork-ownership contract).
  await requireAdminOwnedTemplate(templateId);
  const userId = await requireActorUserId("admin");

  // 1. Update template name
  await supabase
    .from("form_templates")
    .update({ name: templateName })
    .eq("id", templateId);

  // 2. Server-side schema validation — NEVER trust client-supplied schema (T-13-04)
  const { validateSchema } = await import("@coltorapps/builder");
  const { formBuilder } = await import("@/lib/form-builder");
  const result = await validateSchema(rawSchema, formBuilder);
  if (!result.success) {
    // Surface which entities/attributes failed so the builder toast is actionable
    // instead of a bare "InvalidEntitiesAttributes".
    const detail = describeAttributeErrors(result.reason);
    console.error("[template save] schema validation failed:", result.reason.code, detail);
    throw new Error(`Invalid schema: ${result.reason.code}${detail ? ` — ${detail}` : ""}`);
  }

  // Phase 15 — reject cyclic rule graphs (D-08, Pitfall 2)
  const { validateRuleGraph } = await import("@/lib/form-builder/visibility/validate-rule-graph");
  const graphResult = validateRuleGraph(result.data as Parameters<typeof validateRuleGraph>[0]);
  if (!graphResult.ok) {
    throw new Error(JSON.stringify({
      kind: "RuleGraphInvalid",
      cycles: graphResult.cycles.map(c => ({ entityIds: c.path, labels: c.labels })),
      scopeErrors: graphResult.scopeErrors,
    }));
  }

  // Reject specialty/container fields nested inside a repeatingSection. The
  // builder now prevents creating these; this is the server backstop for any
  // schema that slips through (audit #10).
  const { findRepeatingNestingViolations } = await import("@/lib/form-builder/repeating-section-constraints");
  const nestingViolations = findRepeatingNestingViolations(
    result.data as Parameters<typeof findRepeatingNestingViolations>[0]
  );
  if (nestingViolations.length > 0) {
    throw new Error(JSON.stringify({ kind: "RepeatingNestingInvalid", violations: nestingViolations }));
  }

  // 3. Insert a new immutable version row with retry on UNIQUE(template_id,
  // version_number) collision (two concurrent saves race). Previously the insert
  // result was unchecked — a collision was silently swallowed and the caller
  // received false success. A failed insert MUST now throw.
  await insertTemplateVersionWithRetry(supabase, {
    templateId,
    schemaJson: result.data,
    createdBy: userId,
  });

  revalidatePath(`/admin/templates/${templateId}`);
}

// ── publishTemplateAction (BUILDER-03 + BUILDER-05) ─────────────────────────
// Same validate → insert pattern, plus sets published_at and is_published = true.

export async function publishTemplateAction(
  templateId: string,
  rawSchema: unknown,
  templateName: string
) {
  const supabase = await createClient();
  await assertAdmin();
  // Guard: only admin-owned templates may be published by this action. Publishing
  // a customer-owned template via admin URL would violate the AGENTS.md
  // fork-ownership contract (customer masters must never be admin-mutated).
  await requireAdminOwnedTemplate(templateId);
  const userId = await requireActorUserId("admin");

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
    // Surface which entities/attributes failed so the builder toast is actionable
    // instead of a bare "InvalidEntitiesAttributes".
    const detail = describeAttributeErrors(result.reason);
    console.error("[template save] schema validation failed:", result.reason.code, detail);
    throw new Error(`Invalid schema: ${result.reason.code}${detail ? ` — ${detail}` : ""}`);
  }

  // Phase 15 — reject cyclic rule graphs (D-08, Pitfall 2)
  const { validateRuleGraph } = await import("@/lib/form-builder/visibility/validate-rule-graph");
  const graphResult = validateRuleGraph(result.data as Parameters<typeof validateRuleGraph>[0]);
  if (!graphResult.ok) {
    throw new Error(JSON.stringify({
      kind: "RuleGraphInvalid",
      cycles: graphResult.cycles.map(c => ({ entityIds: c.path, labels: c.labels })),
      scopeErrors: graphResult.scopeErrors,
    }));
  }

  // Reject specialty/container fields nested inside a repeatingSection (audit #10).
  const { findRepeatingNestingViolations } = await import("@/lib/form-builder/repeating-section-constraints");
  const nestingViolations = findRepeatingNestingViolations(
    result.data as Parameters<typeof findRepeatingNestingViolations>[0]
  );
  if (nestingViolations.length > 0) {
    throw new Error(JSON.stringify({ kind: "RepeatingNestingInvalid", violations: nestingViolations }));
  }

  // Insert new immutable published version row with retry on UNIQUE(template_id,
  // version_number) collision. Previously the insert result was unchecked — a
  // collision was silently swallowed and the caller received false success. A
  // failed insert MUST now throw.
  await insertTemplateVersionWithRetry(supabase, {
    templateId,
    schemaJson: result.data,
    createdBy: userId,
    publishedAt: new Date().toISOString(),
  });

  // Mark template as published
  await supabase
    .from("form_templates")
    .update({ is_published: true })
    .eq("id", templateId);

  revalidatePath("/admin/templates");
  revalidatePath(`/admin/templates/${templateId}`);
}

// ── deleteTemplate ──────────────────────────────────────────────────────────

export async function deleteTemplate(templateId: string) {
  const supabase = await createClient();
  await assertAdmin();
  // Guard: only admin-owned templates may be deleted by this action. Deleting a
  // customer-owned template via admin URL violates the AGENTS.md fork-ownership
  // contract (customer masters must never be admin-mutated).
  await requireAdminOwnedTemplate(templateId);
  await requireActorUserId("admin");

  // Preserve every version that may already be pinned to an assignment or
  // submission. Removing the template row would cascade through its version
  // history; a soft delete hides it from new work without changing old records.
  const { error } = await supabase
    .from("form_templates")
    .update({
      deleted_at: new Date().toISOString(),
      is_published: false,
    })
    .eq("id", templateId);

  if (error) {
    throw new Error(error.message ?? "Failed to delete template");
  }

  revalidatePath("/admin/templates");
}
