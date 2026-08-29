import { cache } from "react"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"

export async function getSession() {
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  return session
}

export const getUser = cache(async () => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
})

export async function isDemoMode() {
  // Portfolio demo: allow NEXT_PUBLIC_DEMO_BYPASS=1 to enable demo mode in
  // production/preview without a real Supabase Auth session. Otherwise, never
  // honor the demo cookie in production (RLS bypass would leak data).
  if (process.env.NEXT_PUBLIC_DEMO_BYPASS === "1") return true
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
  void _actorType
  if (await isDemoMode()) return null

  const user = await getUser()
  if (user) return user.id
  throw new Error("Unauthorized")
}

// Backwards-compat alias — same behavior, never throws.
export async function getActorUserId(actorType: "admin" | "client"): Promise<string | null> {
  void actorType
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

export interface ClientContext {
  client_id: string
  role: string
  /** Authoritative organisation name used in server-to-server activity events. */
  client_name: string
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
export const getClientContextWithIdentity = cache(async (): Promise<ClientIdentity | null> => {
  const supabase = await createClient()

  if (await isDemoMode()) {
    // Skip getUser() in demo mode — stale auth token poisons the client.
    const { data, error } = await supabase
      .from("client_users")
      .select("client_id, role, name, email, client:clients(name)")
      .limit(1)
      .single()

    if (error || !data) {
      return {
        client_id: "demo-client-1",
        role: "primary_contact",
        orgName: "Grand Horizon Hotel",
        userName: "Sarah Jenkins",
      }
    }

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
})

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

export const getClientContext = cache(async (): Promise<ClientContext | null> => {
  const identity = await getClientContextWithIdentity()
  if (!identity) return null
  return {
    client_id: identity.client_id,
    role: identity.role,
    client_name: identity.orgName,
  }
})
