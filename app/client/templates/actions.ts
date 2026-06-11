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

// Client-built templates default to a single "custom" type. The type dropdown was
// removed from the client New Template dialog (Bug #6): the category never changed
// builder behaviour — every type shares one field palette and canvas — so it was
// pure cognitive load at the handful-of-templates scale clients operate at. Admin
// template creation keeps its own type selector (Matt may want categories later).
const CLIENT_TEMPLATE_TYPE = "custom";

export async function createClientTemplate(name: string) {
  const supabase = await createClient();
  const ctx = await requireClientContext();
  const userId = await requireActorUserId("client");

  const { data, error } = await supabase
    .from("form_templates")
    .insert({
      name,
      template_type: CLIENT_TEMPLATE_TYPE,
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
    template_type: CLIENT_TEMPLATE_TYPE,
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

  // Insert new immutable version row (owner_type = "customer", owner_id = org UUID — T-13-06).
  // UNIQUE(template_id, version_number) means two concurrent saves both reading the
  // same max(version_number) collide on insert — the loser gets a 23505. Retry by
  // re-reading max and bumping again. Previously the insert error was silently
  // ignored, so a collided save returned "success" having written nothing; a failed
  // insert MUST now throw.
  await insertTemplateVersionWithRetry(supabase, {
    templateId,
    schemaJson: result.data,
    createdBy: userId,
  });

  revalidatePath(`/client/templates/${templateId}`);
}

/**
 * Insert the next template_versions row for a template, retrying on the
 * UNIQUE(template_id, version_number) violation that two concurrent saves race
 * into. Up to 3 attempts: on a 23505 we re-read max(version_number) and bump.
 * Any other error, or exhausting the retries, throws — a failed version insert
 * must never silently succeed.
 *
 * Shared by saveClientDraftAction (no publish) and publishClientTemplateAction
 * (sets published_at) — opts.publishedAt distinguishes the two.
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
  let lastError: { message?: string } | null = null;
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
    // 23505 = unique_violation: another save took our version_number. Re-read + retry.
    if (error.code !== "23505") {
      throw new Error(error.message ?? "Failed to insert template version");
    }
  }
  throw new Error(
    lastError?.message ?? "Failed to insert template version after 3 attempts (version-number race)"
  );
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

  // Same UNIQUE(template_id, version_number) race as saveClientDraftAction —
  // retry on 23505, throw on any other error or exhaustion (was silently ignored).
  await insertTemplateVersionWithRetry(supabase, {
    templateId,
    schemaJson: result.data,
    createdBy: userId,
    publishedAt: new Date().toISOString(),
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
): Promise<{ id: string; versionId: string; answersJson: Record<string, unknown> }> {
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

  // Idempotency guard — orphan-draft prevention. The RSC pre-creates a draft on
  // every fill/page.tsx render; without this, a customer re-opening (or refreshing)
  // the fill route would spawn a fresh orphan draft each time. Reuse the most
  // recent open draft for this (client, version) self-fill — assignment_id IS NULL
  // distinguishes customer self-fills from admin-assigned drafts on the same version.
  // answers_json is returned so the RSC can seed InterpreterRenderer.initialValues
  // and a resumed self-fill draft rehydrates every field (incl. repeating-section rows).
  const { data: existingDraft } = await supabase
    .from("form_submissions")
    .select("id, answers_json")
    .eq("client_id", ctx.client_id)
    .eq("template_version_id", latestVersion.id)
    .eq("status", "draft")
    .is("assignment_id", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingDraft) {
    return {
      id: existingDraft.id,
      versionId: latestVersion.id,
      answersJson: (existingDraft.answers_json as Record<string, unknown>) ?? {},
    };
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

  return { id: draft.id, versionId: latestVersion.id, answersJson: {} };
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
 *   2. Fetch the submission row (id + client_id scoped) to read its PINNED
 *      template_version_id — the client cannot supply a weaker version.
 *   3. Load that version's schema_json and run the IDENTICAL server-side
 *      validation pipeline the admin path uses (submitAssessmentAction):
 *      sanitize → prune → validateEntitiesValues → per-instance required →
 *      evaluate visibility → strip hidden answers. Customer surfaces MUST get
 *      the same guard as admin — asymmetry is an exploit class (COND-03).
 *   4. UPDATE form_submissions SET answers_json (SCRUBBED), status='submitted',
 *      submitted_at WHERE id=submissionId AND client_id=ctx.client_id
 *      AND status='draft' — the status filter + .select() double-submit guard
 *      makes a second concurrent submit match zero rows (NOT silent success).
 *   5. revalidatePath /client/templates
 *   6. redirect /client/templates (LAST, outside try/catch)
 */
export async function submitCustomerTemplateFillByIdAction(
  submissionId: string,
  answers: Record<string, unknown>
): Promise<void> {
  const ctx = await requireClientContext();
  const supabase = await createClient();

  // Step 1: fetch the submission row (client_id-scoped, defense-in-depth alongside
  // RLS) to read the pinned template_version_id. The client never supplies it.
  const { data: submission, error: subError } = await supabase
    .from("form_submissions")
    .select("template_version_id")
    .eq("id", submissionId)
    .eq("client_id", ctx.client_id)
    .single();

  if (subError || !submission) {
    throw new Error(subError?.message ?? "Submission not found");
  }

  // Step 2: fetch the PINNED version schema via the stored FK — never the
  // template's latest version (mirrors admin T-13-10).
  const { data: version, error: versionError } = await supabase
    .from("template_versions")
    .select("schema_json")
    .eq("id", submission.template_version_id)
    .single();

  if (versionError || !version) {
    throw new Error(versionError?.message ?? "Failed to fetch pinned template version");
  }

  // Step 3: server-side validation — the IDENTICAL pipeline as the admin
  // submitAssessmentAction (app/admin/assessments/actions.ts). Until now the raw
  // client answers were written straight to answers_json with no validation and
  // no hidden-answer scrub; this closes that gap (COND-03 — surface parity).
  const { validateEntitiesValues } = await import("@coltorapps/builder");
  const { formBuilder } = await import("@/lib/form-builder");
  const { sanitizeSchema } = await import("@/lib/form-builder/sanitize-schema");
  const { pruneSchemaForValidation } = await import("@/lib/form-builder/prune-schema-for-validation");
  const { setCurrentFormSchema } = await import("@/lib/form-builder/visibility/compute-computed-values");

  // Sanitize once and reuse for every consumer below so the server validates
  // exactly what the client validated — feeding the raw schema into coltorapps
  // throws on since-removed entity types (admin path comment for detail).
  const schemaJson = sanitizeSchema(version.schema_json as Parameters<typeof sanitizeSchema>[0]);

  // Prune to stop the coltorapps walk at repeatingSection — nested instance child
  // values would otherwise fail a root-level `required: true` check.
  const prunedSchema = pruneSchemaForValidation(schemaJson);

  // Register the schema in the module-level slot so computedField-sourced
  // visibility rules can derive their values during the coltorapps eligibility
  // walk (D-02). Cleared in the finally. Same racy-slot caveat as the admin path.
  setCurrentFormSchema(schemaJson as Parameters<typeof setCurrentFormSchema>[0]);
  let result: Awaited<ReturnType<typeof validateEntitiesValues>>;
  try {
    result = await validateEntitiesValues(answers, formBuilder, prunedSchema as Parameters<typeof validateEntitiesValues>[2]);
  } finally {
    setCurrentFormSchema(null);
  }
  if (!result.success) {
    throw new Error("Form validation failed server-side. Please check your answers and try again.");
  }

  // Per-instance required enforcement — mirrors the client guard and the admin path.
  const { validateInstanceRequired } = await import("@/lib/form-builder/validate-instance-required");
  const instanceFailures = validateInstanceRequired(
    schemaJson as Parameters<typeof validateInstanceRequired>[0],
    result.data as Record<string, unknown>
  );
  if (instanceFailures.length > 0) {
    const first = instanceFailures[0];
    throw new Error(
      `Missing required field "${first.childLabel}" in ${first.repSectionLabel} #${first.instanceIndex + 1}` +
        (instanceFailures.length > 1 ? ` (and ${instanceFailures.length - 1} more)` : "")
    );
  }

  // Visibility evaluation + hidden-subtree scrub (D-01, COND-01). Order is
  // load-bearing: validate FIRST (coerced types feed operator semantics), THEN
  // evaluate visibility against validated values, THEN strip hidden entities.
  const { evaluateVisibility } = await import("@/lib/form-builder/visibility/evaluate-visibility");
  const { stripHiddenAnswers } = await import("@/lib/form-builder/visibility/strip-hidden-answers");
  const visibility = evaluateVisibility(schemaJson as Parameters<typeof evaluateVisibility>[0], result.data as Record<string, unknown>);

  // BUG A — root-level DYNAMIC required enforcement. validateEntitiesValues only
  // catches STATIC required and validateInstanceRequired only walks repeatingSection
  // children, so a top-level field made required ONLY by a fired `require` rule could
  // be submitted empty. Run against the SAME visibility map computed above, before
  // the scrub/DB write. Surface parity with admin + assignment paths (COND-03).
  const { validateRootRequired } = await import("@/lib/form-builder/validate-instance-required");
  const rootFailures = validateRootRequired(
    schemaJson as Parameters<typeof validateRootRequired>[0],
    result.data as Record<string, unknown>,
    visibility
  );
  if (rootFailures.length > 0) {
    const first = rootFailures[0];
    throw new Error(
      `Missing required field "${first.label}"` +
        (rootFailures.length > 1 ? ` (and ${rootFailures.length - 1} more)` : "")
    );
  }

  const scrubbedAnswers = stripHiddenAnswers(schemaJson as Parameters<typeof stripHiddenAnswers>[0], result.data as Record<string, unknown>, visibility);

  // Step 4: write SCRUBBED answers. The .eq("status","draft") filter +
  // .select("id").maybeSingle() are the double-submit guard: a second concurrent
  // submit (the draft already flipped to 'submitted') matches zero rows, so we
  // throw BEFORE dispatching the n8n event. Previously a 0-row update was treated
  // as success and the webhook fired — that is now impossible.
  const { data: updatedRow, error: updateError } = await supabase
    .from("form_submissions")
    .update({
      answers_json: scrubbedAnswers,
      status: "submitted",
      submitted_at: new Date().toISOString(),
    })
    .eq("id", submissionId)
    .eq("client_id", ctx.client_id)
    .eq("status", "draft")
    .select("id")
    .maybeSingle();

  if (updateError) {
    throw new Error(updateError.message ?? "Failed to submit form");
  }
  if (!updatedRow) {
    throw new Error("This form has already been submitted");
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
