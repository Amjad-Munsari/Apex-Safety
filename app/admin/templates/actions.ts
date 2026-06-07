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

  // 3. Insert a new immutable version row (NEVER .update() existing rows — Pitfall 5)
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

  // Insert new immutable published version row
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
  await requireActorUserId("admin");

  await supabase.from("form_templates").delete().eq("id", templateId);
  revalidatePath("/admin/templates");
}
