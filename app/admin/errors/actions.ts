"use server"

import { revalidatePath } from "next/cache"

import { requireAdmin } from "@/lib/auth-helpers"
import { adminClient } from "@/lib/supabase/admin"
import { logAppError } from "@/lib/observability/log"
import { retryOutboxEntry, type RetryRefusal } from "@/lib/notifications/outbox"

/**
 * Triage actions for the operational Workflow Errors page.
 *
 * Unlike /admin/diagnostics, which resolves a whole fingerprint at once, this
 * page is one row per business event ("this client's report email failed"), so
 * triage is per row — each failure is a separate thing Matt has to chase.
 *
 * Expected failures are returned as values rather than thrown, matching the
 * convention the rest of the server actions in this codebase use.
 */
export type WorkflowErrorActionResult =
  | { ok: true; affected: number }
  | { ok: false; error: string }

/**
 * Marks one workflow error as handled so it drops out of the default view and
 * off the dashboard, without deleting the record.
 *
 * The `resolved` guard in the filter makes a double-click idempotent: the second
 * update matches nothing and reports 0 affected rather than rewriting the row.
 */
export async function resolveWorkflowError(id: string): Promise<WorkflowErrorActionResult> {
  const adminId = await requireAdmin()
  if (!adminId) return { ok: false, error: "Not authorised." }
  if (!id) return { ok: false, error: "Missing error id." }

  try {
    const { data, error } = await adminClient
      .from("workflow_errors")
      .update({ resolved: true })
      .eq("id", id)
      .not("resolved", "is", true)
      .select("id")

    if (error) return { ok: false, error: error.message }

    revalidatePath("/admin/errors")
    // The dashboard counts unresolved failures, so it goes stale too.
    revalidatePath("/admin")
    return { ok: true, affected: data?.length ?? 0 }
  } catch (err) {
    await logAppError({
      area: "workflow-errors.resolve",
      source: "action",
      error: err,
      actorType: "admin",
      actorId: adminId,
      context: { workflowErrorId: id },
    })
    return { ok: false, error: "Could not update. Try again." }
  }
}

/**
 * Result of an explicit re-send. `affected` counts emails actually sent, so a
 * row the outbox had already delivered comes back ok with 0 — the admin needs to
 * know nothing new went out, and `message` says which of the two happened.
 */
export type RetryWorkflowErrorResult =
  | { ok: true; affected: number; message: string }
  | { ok: false; error: string }

/**
 * Human wording for every way the outbox can decline to re-send. Each one is a
 * different next step for Matt, which is why they aren't collapsed into one
 * "couldn't re-send" string.
 */
const REFUSAL_MESSAGES: Record<Exclude<RetryRefusal, "already_sent">, string> = {
  in_progress:
    "A send for this email is already in progress. Give it a minute, then refresh before trying again.",
  resend_not_allowed:
    "This email carries a single-use link that may already be spent, so it can't be re-sent from here. Send a fresh invite or reset instead.",
  payload_unavailable:
    "The stored contents of this email are no longer usable, so it can't be rebuilt. Trigger the original action again.",
  not_found:
    "The outbox record for this failure no longer exists — it may have aged out. Trigger the original action again.",
  not_retryable: "This email is not in a state that can be re-sent.",
}

/** Reads `payload.outboxId` off a workflow error row, tolerating any JSON shape. */
function outboxIdFromPayload(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null
  const value = (payload as { outboxId?: unknown }).outboxId
  return typeof value === "string" && value.length > 0 ? value : null
}

/**
 * Re-sends the email behind one workflow error, then marks the error handled.
 *
 * Only failures logged since the email outbox existed carry an `outboxId`, and
 * without one there is nothing to re-send — the payload was never kept. Those
 * are reported plainly rather than silently doing nothing.
 *
 * `retryOutboxEntry` has no auth of its own, so requireAdmin here is the only
 * thing standing between a public request and sending mail.
 */
export async function retryWorkflowError(id: string): Promise<RetryWorkflowErrorResult> {
  const adminId = await requireAdmin()
  if (!adminId) return { ok: false, error: "Not authorised." }
  if (!id) return { ok: false, error: "Missing error id." }

  try {
    const { data: row, error } = await adminClient
      .from("workflow_errors")
      .select("id, payload")
      .eq("id", id)
      .maybeSingle<{ id: string; payload: unknown }>()

    if (error) return { ok: false, error: error.message }
    if (!row) return { ok: false, error: "That error record no longer exists." }

    const outboxId = outboxIdFromPayload(row.payload)
    if (!outboxId) {
      return {
        ok: false,
        error:
          "This failure predates the email outbox, so there is no saved email to re-send. Trigger the original action again.",
      }
    }

    const retry = await retryOutboxEntry(outboxId)

    if (!retry.ok) {
      const refusal = retry.refusal
      if (refusal && refusal !== "already_sent") {
        return { ok: false, error: REFUSAL_MESSAGES[refusal] }
      }
      return { ok: false, error: retry.error ?? "The email failed again. Check the outbox for details." }
    }

    // Sent, or already sent by someone else — either way the failure is handled,
    // so it drops out of the default view exactly as Resolve would leave it.
    const alreadySent = retry.refusal === "already_sent"
    const { error: resolveError } = await adminClient
      .from("workflow_errors")
      .update({ resolved: true })
      .eq("id", id)
      .not("resolved", "is", true)

    if (resolveError) {
      return {
        ok: false,
        error: "Email was re-sent, but the workflow error could not be marked resolved. Refresh and resolve it manually.",
      }
    }

    revalidatePath("/admin/errors")
    revalidatePath("/admin")
    return {
      ok: true,
      affected: alreadySent ? 0 : 1,
      message: alreadySent
        ? "That email had already been sent, so nothing was sent again. Marked as resolved."
        : "Email re-sent and the error marked as resolved.",
    }
  } catch (err) {
    await logAppError({
      area: "workflow-errors.retry",
      source: "action",
      error: err,
      actorType: "admin",
      actorId: adminId,
      context: { workflowErrorId: id },
    })
    return { ok: false, error: "Could not re-send. Try again." }
  }
}

/** Reopens a workflow error that turned out not to be handled after all. */
export async function reopenWorkflowError(id: string): Promise<WorkflowErrorActionResult> {
  const adminId = await requireAdmin()
  if (!adminId) return { ok: false, error: "Not authorised." }
  if (!id) return { ok: false, error: "Missing error id." }

  try {
    const { data, error } = await adminClient
      .from("workflow_errors")
      .update({ resolved: false })
      .eq("id", id)
      .eq("resolved", true)
      .select("id")

    if (error) return { ok: false, error: error.message }

    revalidatePath("/admin/errors")
    revalidatePath("/admin")
    return { ok: true, affected: data?.length ?? 0 }
  } catch (err) {
    await logAppError({
      area: "workflow-errors.reopen",
      source: "action",
      error: err,
      actorType: "admin",
      actorId: adminId,
      context: { workflowErrorId: id },
    })
    return { ok: false, error: "Could not update. Try again." }
  }
}
