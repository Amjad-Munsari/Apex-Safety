"use server";

import { createClient } from "@/lib/supabase/server";
import { getClientContext } from "@/lib/auth-helpers";
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
