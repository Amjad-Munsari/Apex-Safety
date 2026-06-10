"use server";

import { createClient } from "@/lib/supabase/server";
import { getClientContext, requireActorUserId } from "@/lib/auth-helpers";
import { assertClientActive } from "@/lib/clients/require-active";
import { dispatchClientFormEvent } from "@/lib/notifications/client-form-events";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { generateNextOccurrence } from "@/lib/scheduler/generate-next-occurrence";

// ── Internal auth helpers ────────────────────────────────────────────────────

/**
 * Resolves the signed-in client_user's context. Throws "Not a client user" if
 * there is no authenticated client session.
 *
 * RLS is the primary trust boundary; this provides loud early-exit errors
 * so client UI can react and we don't silently ship false success states.
 */
export async function requireClientContext() {
  const ctx = await getClientContext();
  if (!ctx) throw new Error("Not a client user");
  return ctx;
}

/**
 * Reads a form_assignment row and verifies:
 *   1. It exists (throws "Assignment not found")
 *   2. It belongs to the requesting client org (throws "Forbidden: not your assignment")
 *   3. It has not been soft-deleted (throws "Cannot use a revoked assignment")
 *
 * Returns the full assignment row (including template_version_id for downstream use).
 *
 * T-16-08: every write path checks deleted_at so revoked assignments cannot be filled.
 * T-16-07: ownership check ensures only the assigned org can act on the row.
 */
export async function requireOwnedAssignment(
  assignmentId: string,
  clientId: string
) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("form_assignments")
    .select(
      "id, client_id, template_id, template_version_id, status, deleted_at, instructions, due_date"
    )
    .eq("id", assignmentId)
    .maybeSingle();

  if (error || !data) throw new Error("Assignment not found");
  if (data.client_id !== clientId)
    throw new Error("Forbidden: not your assignment");
  if (data.deleted_at !== null)
    throw new Error("Cannot use a revoked assignment");

  return data;
}

/**
 * Transitions an assignment's status with an optimistic guard.
 *
 * Uses `.eq("status", previous)` so a backwards transition (e.g., completed →
 * in_progress) will silently no-op at the DB level — the guard prevents it.
 *
 * T-16-05: optimistic guard prevents forged backwards transitions.
 *
 * Never throws — a status glitch must not revert the submission write that
 * called us (per RESEARCH Pattern 4).
 */
export async function transitionAssignmentStatus(
  supabase: SupabaseClient,
  assignmentId: string,
  next: "in_progress" | "completed"
) {
  // Two admin code paths create assignments with different status values:
  //   - app/admin/assessments/actions.ts → "assigned" (matches DB default in 001:79)
  //   - app/admin/assignments/actions.ts + lib/scheduler/* → "pending" (legacy)
  // Both are "client hasn't started" semantically. Accept either to avoid silent
  // no-ops; the earlier "pending"-only guard left every customer fill stuck.
  const { error } = next === "in_progress"
    ? await supabase
        .from("form_assignments")
        .update({ status: next })
        .eq("id", assignmentId)
        .in("status", ["assigned", "pending"])
    : await supabase
        .from("form_assignments")
        .update({ status: next })
        .eq("id", assignmentId)
        .eq("status", "in_progress");

  if (error) {
    console.error("Status transition failed", { assignmentId, next, error });
  }
}

/**
 * Creates (or resumes) a draft form_submissions row for an assignment fill.
 *
 * Called from the RSC (fill/page.tsx) before mounting FillAssignmentClient.
 * The draft row gives Phase 14 specialty renderers (signature, multi-photo,
 * geolocation) a real submissionId for their upload paths at mount time.
 *
 * IDEMPOTENT (orphan-draft fix): a fresh INSERT on every call leaked a draft row
 * per /fill render — startAssignmentFill creates one, then fill/page.tsx creates
 * another, and every refresh added more. Worse, specialty-renderer data (signatures,
 * photos) is keyed by submissionId, so a new id on resume silently orphaned the
 * partially-uploaded media. We now SELECT the most recent matching draft first and
 * reuse it; only INSERT when none exists.
 *
 * The reuse query pins template_version_id = assignment.template_version_id: a
 * fork (forkAssignedTemplate) rewires the assignment to a new version, and a draft
 * captured against the OLD version must not be resumed against the new schema —
 * the version mismatch forces a fresh draft.
 *
 * Security invariants (T-16-04, T-16-08):
 *   - client_id is NEVER accepted from the caller — always from requireClientContext()
 *   - requireOwnedAssignment verifies org ownership and deleted_at before any DB write
 *   - a completed assignment is rejected outright (fill/page.tsx redirects before
 *     calling, so this only guards direct server-action invocations)
 */
export async function createAssignmentDraftSubmission(
  assignmentId: string
): Promise<{ id: string }> {
  const ctx = await requireClientContext();
  await assertClientActive(ctx.client_id); // frozen-client guard — no new fills
  const supabase = await createClient();
  const assignment = await requireOwnedAssignment(assignmentId, ctx.client_id);

  if (assignment.status === "completed") {
    throw new Error("Assignment already completed");
  }

  // Resume an existing draft if one is already pinned to the current version.
  // Most-recent-first so a fork's stale draft (older version) is never selected here
  // anyway — the version filter excludes it — and the freshest valid draft wins.
  const { data: existing } = await supabase
    .from("form_submissions")
    .select("id")
    .eq("assignment_id", assignmentId)
    .eq("client_id", ctx.client_id)
    .eq("status", "draft")
    .eq("template_version_id", assignment.template_version_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    // Resume: still nudge the assignment forward in case it lapsed back.
    await transitionAssignmentStatus(supabase, assignmentId, "in_progress");
    return { id: existing.id };
  }

  await transitionAssignmentStatus(supabase, assignmentId, "in_progress");

  const { data: draft, error } = await supabase
    .from("form_submissions")
    .insert({
      assignment_id: assignmentId,
      client_id: ctx.client_id,
      template_version_id: assignment.template_version_id,
      status: "draft",
      answers_json: {},
    })
    .select("id")
    .single();

  if (error || !draft) {
    throw new Error(error?.message ?? "Failed to create draft submission");
  }

  return { id: draft.id };
}

/**
 * Server action invoked by FillAsIsButton.
 *
 * Pre-creates a draft submission, flips assignment status from pending →
 * in_progress, then redirects to the fill route.
 * Redirect is the last statement, outside try/catch, so NEXT_REDIRECT
 * propagates correctly to the Next.js runtime.
 */
export async function startAssignmentFill(assignmentId: string) {
  await createAssignmentDraftSubmission(assignmentId);
  revalidatePath("/client/assignments");
  redirect(`/client/assignments/${assignmentId}/fill`);
}

/**
 * Server action: submit the pre-created draft and transition assignment to "completed".
 *
 * Pre-create-then-UPDATE pattern (replaces the INSERT path of submitAssignedFillAction).
 * The RSC creates a draft submission before mounting FillAssignmentClient;
 * this action UPDATEs that draft to status='submitted' on final submit.
 *
 * Security invariants (T-16-04, T-16-09):
 *   - client_id comes ONLY from server-side requireClientContext() — never from params
 *   - .eq("client_id", ctx.client_id) is a defense-in-depth filter alongside RLS
 *
 * Submit sequence:
 *   1. Auth context + supabase
 *   2. Fetch the draft's pinned template_version_id → load schema_json →
 *      server-side validation pipeline (sanitize → prune → validateEntitiesValues
 *      → validateInstanceRequired → evaluateVisibility → stripHiddenAnswers) —
 *      identical to submitCustomerTemplateFillByIdAction / admin path (COND-03
 *      surface parity). Only SCRUBBED answers are ever written.
 *   3. UPDATE form_submissions SET answers_json, status='submitted', submitted_at
 *      WHERE id=submissionId AND client_id=ctx.client_id AND status='draft' —
 *      the status filter is the double-submit guard: a second submit matches
 *      zero rows and throws BEFORE the n8n dispatch.
 *   4. Read assignment_id from updated row → transitionAssignmentStatus → completed
 *   5. revalidatePaths
 *   6. redirect (LAST, outside try/catch)
 */
export async function submitAssignedFillByIdAction(
  submissionId: string,
  answers: Record<string, unknown>
): Promise<void> {
  const ctx = await requireClientContext();
  await assertClientActive(ctx.client_id); // frozen-client guard — no submits
  const supabase = await createClient();

  // Step 1: fetch the draft row (client_id-scoped, defense-in-depth alongside
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

  // Step 3: server-side validation — the IDENTICAL pipeline as
  // submitCustomerTemplateFillByIdAction and the admin submitAssessmentAction.
  // Raw client answers were previously written straight to answers_json with no
  // validation and no hidden-answer scrub; this closes that gap (COND-03).
  const { validateEntitiesValues } = await import("@coltorapps/builder");
  const { formBuilder } = await import("@/lib/form-builder");
  const { sanitizeSchema } = await import("@/lib/form-builder/sanitize-schema");
  const { pruneSchemaForValidation } = await import("@/lib/form-builder/prune-schema-for-validation");
  const { setCurrentFormSchema } = await import("@/lib/form-builder/visibility/compute-computed-values");

  const schemaJson = sanitizeSchema(version.schema_json as Parameters<typeof sanitizeSchema>[0]);
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
  const scrubbedAnswers = stripHiddenAnswers(schemaJson as Parameters<typeof stripHiddenAnswers>[0], result.data as Record<string, unknown>, visibility);

  // Step 4: write SCRUBBED answers. The .eq("status","draft") filter +
  // .maybeSingle() are the double-submit guard: a second submit of an
  // already-submitted row matches zero rows (updated = null, NO error) and we
  // bail BEFORE dispatching the n8n event — the webhook must fire at most once
  // per submission, or downstream automations (report generation, billing)
  // double-fire. updateError is checked first so genuine DB failures surface
  // as themselves rather than masquerading as duplicate submits.
  const { data: updated, error: updateError } = await supabase
    .from("form_submissions")
    .update({
      answers_json: scrubbedAnswers,
      status: "submitted",
      submitted_at: new Date().toISOString(),
    })
    .eq("id", submissionId)
    .eq("client_id", ctx.client_id)
    .eq("status", "draft")
    .select("assignment_id")
    .maybeSingle();

  if (updateError) {
    throw new Error(updateError.message ?? "Failed to submit form");
  }

  if (!updated) {
    // No draft row matched → already submitted (status flipped) or the row
    // vanished. Treat as a duplicate submit; do NOT dispatch the webhook.
    throw new Error("This form has already been submitted");
  }

  // Notify n8n of an assignment fill submission (best-effort, non-blocking).
  await dispatchClientFormEvent({
    type: "client_form_submitted",
    client_id: ctx.client_id,
    submission_id: submissionId,
    assignment_id: updated.assignment_id,
    submitted_at: new Date().toISOString(),
  });

  if (updated.assignment_id) {
    await transitionAssignmentStatus(supabase, updated.assignment_id, "completed");

    // Inline recurrence trigger (RESEARCH §Pattern 2). Cron PASS B is the safety net —
    // this path makes recurrence feel instant. Idempotency: recurrence_generated_at column.
    //
    // CLAIM-FIRST (TOCTOU fix): the old read-check-generate-stamp sequence had a
    // race — two concurrent submits (or this path racing cron PASS B) could BOTH
    // read recurrence_generated_at = NULL, both pass the check, and both generate a
    // duplicate next occurrence. We now atomically claim the row by stamping
    // recurrence_generated_at in the WHERE-guarded UPDATE: only the writer whose
    // UPDATE matches a row (recurrence_generated_at still NULL) owns the claim.
    // If generation then fails, we clear the stamp back to NULL so cron PASS B retries.
    const { data: claimed } = await supabase
      .from("form_assignments")
      .update({ recurrence_generated_at: new Date().toISOString() })
      .eq("id", updated.assignment_id)
      .not("recurrence_rule", "is", null)
      .is("recurrence_generated_at", null)
      .select(
        "id, client_id, template_id, assigned_by, instructions, due_date, recurrence_rule"
      )
      .maybeSingle();

    if (claimed) {
      // We own the claim — generate exactly once.
      const res = await generateNextOccurrence(supabase, claimed);
      if (!res.ok) {
        // Roll the stamp back so cron PASS B picks this row up next tick.
        await supabase
          .from("form_assignments")
          .update({ recurrence_generated_at: null })
          .eq("id", updated.assignment_id);
        console.error("inline recurrence failed", {
          assignmentId: updated.assignment_id,
          reason: res.reason,
        });
      }
    }

    revalidatePath("/client/assignments");
    revalidatePath(`/client/assignments/${updated.assignment_id}`);
    redirect(`/client/assignments/${updated.assignment_id}`);
  } else {
    revalidatePath("/client/assignments");
    redirect("/client/assignments");
  }
}

/**
 * Server action: fork an assignment's pinned template into a new customer-owned
 * template and redirect to the builder.
 *
 * Security invariants (T-16-03, T-16-06, T-16-07):
 *   - requireClientContext() throws if no client session (T-16-07)
 *   - assignment.client_id === ctx.client_id check (T-16-03, defense-in-depth alongside RLS)
 *   - createClient() is the RLS-aware client — NOT lib/supabase/admin (T-16-06)
 *
 * Fork sequence (D-05, D-06, D-08):
 *   1. Validate ctx + actorUserId
 *   2. Read assignment row → verify org ownership + not revoked
 *   3. Read pinned template_version_id BY ID (D-05 — NOT latest published)
 *   4. Read master template metadata (name/type)
 *   5. INSERT fork form_templates row (owner_type='customer', D-08)
 *   6. INSERT fork v1 template_versions row (published_at=now(), D-08)
 *   7. UPDATE form_assignments to point at fork (D-06)
 *   8. revalidatePath both lists
 *   9. redirect to builder (LAST statement — outside any try/catch)
 *
 * PITFALL: redirect() throws a NEXT_REDIRECT error internally. It MUST be the
 * last statement, never wrapped in try/catch, so Next.js runtime handles it.
 */
export async function forkAssignedTemplate(
  assignmentId: string
): Promise<never> {
  // Step 1: auth
  const ctx = await requireClientContext();
  await assertClientActive(ctx.client_id); // frozen-client guard — no forking
  const userId = await requireActorUserId("client");

  // Step 3: RLS-aware supabase client (never admin client — T-16-06)
  const supabase = await createClient();

  // Step 4: Read the assignment row
  const { data: assignment, error: asgError } = await supabase
    .from("form_assignments")
    .select("id, client_id, template_id, template_version_id, deleted_at")
    .eq("id", assignmentId)
    .single();

  if (asgError || !assignment) throw new Error("Assignment not found");
  if (assignment.client_id !== ctx.client_id)
    throw new Error("Forbidden: not your assignment");
  if (assignment.deleted_at !== null)
    throw new Error("Cannot fork a revoked assignment");

  // Step 5: Read the PINNED version by its exact ID (D-05 — not latest published)
  const { data: pinned, error: pinError } = await supabase
    .from("template_versions")
    .select("schema_json")
    .eq("id", assignment.template_version_id)
    .single();

  if (pinError || !pinned) throw new Error("Pinned version missing");

  // Step 6: Read master template metadata for name/type carry-over
  const { data: master, error: masterError } = await supabase
    .from("form_templates")
    .select("name, template_type")
    .eq("id", assignment.template_id)
    .single();

  if (masterError || !master) throw new Error("Master template not found");

  // Step 7: Insert the fork form_templates row (D-08 polymorphic owner contract)
  const { data: fork, error: forkError } = await supabase
    .from("form_templates")
    .insert({
      name: master.name,
      template_type: master.template_type,
      owner_type: "customer",
      owner_id: ctx.client_id,
      parent_template_id: assignment.template_id,
      is_published: true,
    })
    .select("id")
    .single();

  if (forkError || !fork) throw new Error(forkError?.message ?? "Fork insert failed");

  // Step 8: Insert fork v1 template_versions (auto-published per D-08)
  const { data: v1, error: v1Error } = await supabase
    .from("template_versions")
    .insert({
      template_id: fork.id,
      version_number: 1,
      schema_json: pinned.schema_json,
      published_at: new Date().toISOString(),
      created_by: userId,
    })
    .select("id")
    .single();

  if (v1Error || !v1) throw new Error(v1Error?.message ?? "Fork version insert failed");

  // Step 9: Rewrite the originating assignment to point at the fork (D-06)
  const { error: updateError } = await supabase
    .from("form_assignments")
    .update({
      template_id: fork.id,
      template_version_id: v1.id,
    })
    .eq("id", assignmentId);

  if (updateError) throw new Error(updateError.message ?? "Assignment rewire failed");

  // Notify n8n that a client cloned a master template (best-effort, non-blocking).
  // Fired before the redirect — dispatchClientFormEvent never throws, so it
  // cannot interpose on the NEXT_REDIRECT below.
  await dispatchClientFormEvent({
    type: "client_template_cloned",
    client_id: ctx.client_id,
    template_id: fork.id,
    template_name: master.name,
    parent_template_id: assignment.template_id,
    cloned_at: new Date().toISOString(),
  });

  // Step 10: Invalidate both list caches
  revalidatePath("/client/assignments");
  revalidatePath("/client/templates");

  // Step 11: Redirect to builder — LAST statement, outside try/catch (PITFALL 1)
  // The customer template builder lives at /client/templates/[id] (page.tsx mounts
  // TemplateBuilderClient). There is no /edit subroute — the prior `/edit` suffix
  // 404'd. "Customise first" is structure-editing, so the builder is the correct
  // continuation: the user adjusts fields, publishes, then fills the fork.
  redirect(`/client/templates/${fork.id}`);
}
