"use server"

import { revalidatePath } from "next/cache"

import { requireAdmin } from "@/lib/auth-helpers"
import { adminClient } from "@/lib/supabase/admin"
import { logAppError } from "@/lib/observability/log"

/**
 * Triage actions for the diagnostics page.
 *
 * Expected failures are returned as values rather than thrown, matching the
 * convention the rest of the server actions in this codebase use.
 */
export type TriageResult = { ok: true; affected: number } | { ok: false; error: string }

/**
 * Marks every occurrence of one fault as resolved, so it drops out of the
 * default view without deleting the evidence. Resolving is per-fingerprint
 * because that is the unit a person actually fixes — clearing one row of a
 * fault that fired 200 times is meaningless.
 */
export async function resolveFault(fingerprint: string): Promise<TriageResult> {
  const adminId = await requireAdmin()
  if (!adminId) return { ok: false, error: "Not authorised." }
  if (!fingerprint) return { ok: false, error: "Missing fingerprint." }

  try {
    const { data, error } = await adminClient
      .from("app_error_log")
      .update({
        resolved: true,
        resolved_at: new Date().toISOString(),
        resolved_by: adminId,
      })
      .eq("fingerprint", fingerprint)
      .eq("resolved", false)
      .select("id")

    if (error) return { ok: false, error: error.message }

    revalidatePath("/admin/diagnostics")
    return { ok: true, affected: data?.length ?? 0 }
  } catch (err) {
    await logAppError({
      area: "diagnostics.resolve",
      source: "action",
      error: err,
      actorType: "admin",
      actorId: adminId,
      context: { fingerprint },
    })
    return { ok: false, error: "Could not update. Try again." }
  }
}

/** Reopens a fault that turned out not to be fixed. */
export async function reopenFault(fingerprint: string): Promise<TriageResult> {
  const adminId = await requireAdmin()
  if (!adminId) return { ok: false, error: "Not authorised." }
  if (!fingerprint) return { ok: false, error: "Missing fingerprint." }

  try {
    const { data, error } = await adminClient
      .from("app_error_log")
      .update({ resolved: false, resolved_at: null, resolved_by: null })
      .eq("fingerprint", fingerprint)
      .eq("resolved", true)
      .select("id")

    if (error) return { ok: false, error: error.message }

    revalidatePath("/admin/diagnostics")
    return { ok: true, affected: data?.length ?? 0 }
  } catch (err) {
    await logAppError({
      area: "diagnostics.reopen",
      source: "action",
      error: err,
      actorType: "admin",
      actorId: adminId,
      context: { fingerprint },
    })
    return { ok: false, error: "Could not update. Try again." }
  }
}

/**
 * Writes a deliberate test row so an admin can prove the pipeline works
 * end to end without waiting for a real fault — the "is logging actually on?"
 * question, answered in one click.
 */
export async function emitDiagnosticProbe(): Promise<TriageResult> {
  const adminId = await requireAdmin()
  if (!adminId) return { ok: false, error: "Not authorised." }

  await logAppError({
    area: "diagnostics.probe",
    source: "action",
    severity: "info",
    message: "Diagnostic probe — logging pipeline reached the database.",
    actorType: "admin",
    actorId: adminId,
    context: { triggeredAt: new Date().toISOString() },
  })

  revalidatePath("/admin/diagnostics")
  return { ok: true, affected: 1 }
}
