import { adminClient } from "@/lib/supabase/admin"

/**
 * Guard for client-scoped WRITE actions. A deactivated client (clients.active =
 * false) is frozen: no new documents, proposals, assessments, assignments,
 * template builds/fills, hours adjustments, or invites — on either the admin or
 * the client-portal surface. Existing data stays fully readable; only writes are
 * blocked, and reactivating lifts the freeze.
 *
 * Use `assertClientActive` in actions that throw on failure, and `clientIsActive`
 * in actions that return a `{ ok: false }` result shape instead of throwing.
 */
export const CLIENT_DEACTIVATED_MESSAGE =
  "This client is deactivated. Reactivate them to make changes."

/**
 * Returns false only when the client row explicitly has active = false. A
 * missing/unknown client is treated as active here — the calling action's own
 * existence checks own that case; this guard's single job is the active flag.
 */
export async function clientIsActive(clientId: string): Promise<boolean> {
  const { data } = await adminClient
    .from("clients")
    .select("active")
    .eq("id", clientId)
    .maybeSingle()
  return data?.active !== false
}

/** Throws CLIENT_DEACTIVATED_MESSAGE when the client is deactivated. */
export async function assertClientActive(clientId: string): Promise<void> {
  if (!(await clientIsActive(clientId))) {
    throw new Error(CLIENT_DEACTIVATED_MESSAGE)
  }
}
