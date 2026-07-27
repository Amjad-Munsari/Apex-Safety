"use server"

import { revalidatePath } from "next/cache"

import { requireAdmin } from "@/lib/auth-helpers"
import { adminClient } from "@/lib/supabase/admin"
import { logAppError } from "@/lib/observability/log"

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
