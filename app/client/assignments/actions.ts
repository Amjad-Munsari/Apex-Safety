"use server";

import { createClient } from "@/lib/supabase/server";
import { getClientContext, requireActorUserId } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";

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
  const previous = next === "in_progress" ? "pending" : "in_progress";
  const { error } = await supabase
    .from("form_assignments")
    .update({ status: next })
    .eq("id", assignmentId)
    .eq("status", previous);

  if (error) {
    console.error("Status transition failed", { assignmentId, next, error });
  }
}

/**
 * Server action invoked by FillAsIsButton.
 *
 * Flips assignment status from pending → in_progress, then redirects to the
 * fill route. Redirect is the last statement, outside try/catch, so NEXT_REDIRECT
 * propagates correctly to the Next.js runtime.
 */
export async function startAssignmentFill(assignmentId: string) {
  const ctx = await requireClientContext();
  const supabase = await createClient();
  await requireOwnedAssignment(assignmentId, ctx.client_id);
  await transitionAssignmentStatus(supabase, assignmentId, "in_progress");
  revalidatePath("/client/assignments");
  redirect(`/client/assignments/${assignmentId}/fill`);
}

/**
 * Server action: submit the completed form and transition status to "completed".
 *
 * Security invariants (T-16-04):
 *   - client_id comes ONLY from server-side requireClientContext(); it is never
 *     accepted from the client payload.
 *   - requireOwnedAssignment verifies org ownership before any DB write.
 *
 * Submission sequence:
 *   1. Validate ctx + supabase
 *   2. Ownership check
 *   3. INSERT form_submissions (pinned to template_version_id from assignment row)
 *   4. transitionAssignmentStatus → completed (after insert; non-throwing per Pattern 4)
 *   5. revalidatePaths
 *   6. redirect (LAST, outside try/catch)
 */
export async function submitAssignedFillAction(
  assignmentId: string,
  answers: Record<string, unknown>
): Promise<void> {
  const ctx = await requireClientContext();
  const supabase = await createClient();
  const assignment = await requireOwnedAssignment(assignmentId, ctx.client_id);

  const { error: insertError } = await supabase
    .from("form_submissions")
    .insert({
      assignment_id: assignmentId,
      client_id: ctx.client_id,
      template_version_id: assignment.template_version_id,
      status: "submitted",
      answers_json: answers,
    });

  if (insertError) {
    throw new Error(insertError.message ?? "Failed to submit form");
  }

  await transitionAssignmentStatus(supabase, assignmentId, "completed");

  revalidatePath("/client/assignments");
  revalidatePath(`/client/assignments/${assignmentId}`);
  redirect(`/client/assignments/${assignmentId}`);
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

  // Step 10: Invalidate both list caches
  revalidatePath("/client/assignments");
  revalidatePath("/client/templates");

  // Step 11: Redirect to builder — LAST statement, outside try/catch (PITFALL 1)
  redirect(`/client/templates/${fork.id}/edit`);
}
