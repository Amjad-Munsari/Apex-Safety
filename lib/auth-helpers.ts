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
  // Never honor the demo cookie in production. Demo mode synthesizes a client
  // context by picking an arbitrary org (limit(1)) and rides on the service-role
  // RLS bypass — both unacceptable in prod (code review CR-02/CR-03). Gating
  // here disables every demo path (context resolvers, actor id) in one place.
  if (process.env.NODE_ENV === "production") return false
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
 * Identity shape returned by getClientContextWithIdentity().
 * Consumed by the client layout server shell (Plan 02) to populate the portal
 * header with the real org name and signed-in person.
 */
export interface ClientIdentity {
  client_id: string
  role: string
  /** Org name from clients.name, or "—" when the join is null/missing. */
  orgName: string
  /** Display name from client_users.name, fallback to email, then "—". */
  userName: string
}

/**
 * Sibling to getClientContext() that additionally resolves the org name and
 * user display name in a single query join (clients.name via FK).
 *
 * Demo-mode contract (T-19-02): guards with isDemoMode() BEFORE calling
 * getUser() to avoid poisoning the supabase-js Authorization header with a
 * stale demo-cookie token (same invariant as requireActorUserId / getClientContext).
 *
 * Security contract (T-19-01): prod path scopes the client_users lookup by
 * auth.uid() — never by a user-supplied client_id.
 */
export async function getClientContextWithIdentity(): Promise<ClientIdentity | null> {
  const supabase = await createClient()

  if (await isDemoMode()) {
    // Skip getUser() in demo mode — stale auth token poisons the client.
    const { data, error } = await supabase
      .from("client_users")
      .select("client_id, role, name, email, client:clients(name)")
      .limit(1)
      .single()

    if (error || !data) return null

    const clientRow = Array.isArray(data.client) ? data.client[0] : data.client
    return {
      client_id: data.client_id,
      role: data.role,
      orgName: (clientRow as { name?: string } | null)?.name ?? "—",
      userName: (data.name as string) || (data.email as string) || "—",
    }
  }

  const user = await getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from("client_users")
    .select("client_id, role, name, email, client:clients(name)")
    .eq("id", user.id)
    .single()

  if (error || !data) return null

  const clientRow = Array.isArray(data.client) ? data.client[0] : data.client
  return {
    client_id: data.client_id,
    role: data.role,
    orgName: (clientRow as { name?: string } | null)?.name ?? "—",
    userName: (data.name as string) || (data.email as string) || "—",
  }
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
