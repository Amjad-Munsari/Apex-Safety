import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"

export async function getSession() {
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  return session
}

export async function getUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
}

export async function isDemoMode() {
  const cookieStore = await cookies()
  return cookieStore.get("demo_mode")?.value === "1"
}

export async function isAdmin() {
  const user = await getUser()
  if (!user) return false

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("admin_users")
    .select("id")
    .eq("id", user.id)
    .single()

  return !!data && !error
}

/**
 * Returns a user id usable as an actor in DB writes. In real-prod, returns the
 * authenticated user's id. In demo mode, returns null and skips the auth call
 * entirely — calling getUser() with a stale/expired demo-cookie token causes
 * supabase-js to set a bad Authorization header that overrides the service-role
 * apikey on subsequent writes, which the API rejects as "Invalid API key".
 *
 * Migrations 003/005 dropped the FKs on owner_id/created_by, so a null actor
 * is a valid value to write. Callers should treat "null actor in demo" as
 * authorized but unattributed.
 */
export async function requireActorUserId(_actorType: "admin" | "client"): Promise<string | null> {
  if (await isDemoMode()) return null

  const user = await getUser()
  if (user) return user.id
  throw new Error("Unauthorized")
}

// Backwards-compat alias — same behavior, never throws.
export async function getActorUserId(actorType: "admin" | "client"): Promise<string | null> {
  if (await isDemoMode()) return null
  const user = await getUser()
  return user?.id ?? null
}

/**
 * Admin-role gate for MUTATING server actions that write via the service-role
 * adminClient (which bypasses RLS). isAdmin() alone is the right *check*, but
 * many admin actions also have to run under the frictionless demo flow, where
 * there is NO real Supabase Auth user (getUser() → null, so isAdmin() → false).
 *
 * This wrapper mirrors requireActorUserId's contract:
 *  - Demo mode (dev/preview only — forced off in prod by lib/supabase/server.ts):
 *    authorized but unattributed. Returns null.
 *  - Real auth: must be a member of admin_users, else throws "Unauthorized".
 *    Returns the admin user's id so callers can attribute writes.
 *
 * Use this — not a bare isAdmin() — anywhere an admin action also needs to work
 * in the demo, so the privilege-escalation gate doesn't break the demo gate.
 */
export async function requireAdmin(): Promise<string | null> {
  if (await isDemoMode()) return null

  const user = await getUser()
  if (!user) throw new Error("Unauthorized")

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("admin_users")
    .select("id")
    .eq("id", user.id)
    .single()

  if (error || !data) throw new Error("Unauthorized")
  return user.id
}

export async function getClientContext() {
  const supabase = await createClient()

  if (await isDemoMode()) {
    // Demo cookie + service-role key bypasses RLS but the demo auth user has
    // no row in client_users. Synthesize a context by picking the first client
    // so server-rendered pages under /client work in the demo flow the same
    // way the hardcoded-fixture client pages do. Skip getUser() — calling it
    // poisons the supabase-js client with a stale Authorization header (see
    // requireActorUserId for the same workaround).
    const { data } = await supabase
      .from("client_users")
      .select("client_id, role")
      .limit(1)
      .single()
    return data ?? null
  }

  const user = await getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from("client_users")
    .select("client_id, role")
    .eq("id", user.id)
    .single()

  if (error || !data) return null
  return data
}
