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
