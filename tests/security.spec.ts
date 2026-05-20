/**
 * Security tests — RLS isolation for the client compliance surface.
 *
 * Audit summary (May 2026 milestone, Phase 1 Task 6):
 *
 *   Client portal — RLS-scoped via createClient() in lib/supabase/server.ts.
 *     - app/client/compliance/page.tsx
 *     - app/client/compliance/actions.ts
 *     Defense-in-depth: explicit .eq("client_id", ctx.client_id) on top of the
 *     documents_client_own policy.
 *
 *   Admin paths — service-role via adminClient (intentional, admins need
 *     cross-client visibility):
 *     - app/admin/compliance/page.tsx + actions.ts
 *     - app/admin/clients/[id]/page.tsx (admin policy on documents_admin_all)
 *     - app/api/cron/expiry/route.ts (cron sweeps across all clients)
 *     - lib/supabase/dashboard.ts aggregates
 *
 *   No client-portal query uses adminClient. No service-role calls happen
 *   from inside /app/client/*. Cross-tenant leakage is therefore gated by
 *   the documents_client_own RLS policy (see migration 001) which scopes
 *   reads to docs whose client_id matches the caller's client_users row.
 *
 *   The test below provisions two test clients with one doc each, signs in
 *   as each client user, and asserts: (a) each user sees only their own
 *   doc, (b) querying the other user's doc id by .eq("id", ...) returns
 *   nothing.
 *
 * Required env vars (set in a .env.test or CI secrets — NEVER in prod):
 *   NEXT_PUBLIC_SUPABASE_URL       — Supabase project URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY  — anon key (used for the actual queries)
 *   SUPABASE_SERVICE_ROLE_KEY      — service role (used by setup/teardown
 *                                     to create+delete test users and rows)
 *
 * If any of those are missing the test skips with a clear message so it
 * never produces a silent false-pass.
 */

import { test, expect } from "@playwright/test"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const hasEnv = Boolean(SUPABASE_URL && ANON_KEY && SERVICE_KEY)

interface TestUser {
  email: string
  password: string
  authUserId: string
  clientId: string
  documentId: string
}

type SeedContext = {
  admin: SupabaseClient
  userA: TestUser
  userB: TestUser
}

async function seedTwoTenants(): Promise<SeedContext> {
  const admin = createClient(SUPABASE_URL!, SERVICE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const stamp = Date.now()
  const provision = async (label: "a" | "b"): Promise<TestUser> => {
    const email = `rls-test-${label}-${stamp}@888test.invalid`
    const password = `rls-test-${label}-${stamp}-${Math.random().toString(36).slice(2)}`

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })
    if (createErr || !created.user) throw new Error(`createUser ${label}: ${createErr?.message}`)

    const { data: client, error: clientErr } = await admin
      .from("clients")
      .insert({ name: `RLS Test Tenant ${label.toUpperCase()} ${stamp}` })
      .select("id")
      .single()
    if (clientErr || !client) throw new Error(`insert client ${label}: ${clientErr?.message}`)

    const { error: cuErr } = await admin
      .from("client_users")
      .insert({ id: created.user.id, client_id: client.id, name: `Tenant ${label}`, email })
    if (cuErr) throw new Error(`insert client_user ${label}: ${cuErr.message}`)

    const { data: doc, error: docErr } = await admin
      .from("documents")
      .insert({
        client_id: client.id,
        filename: `tenant-${label}-secret.pdf`,
        document_category: "Fire Risk Assessment",
        storage_path: `${client.id}/tenant-${label}-secret.pdf`,
        active: true,
      })
      .select("id")
      .single()
    if (docErr || !doc) throw new Error(`insert document ${label}: ${docErr?.message}`)

    return {
      email,
      password,
      authUserId: created.user.id,
      clientId: client.id,
      documentId: doc.id,
    }
  }

  const userA = await provision("a")
  const userB = await provision("b")
  return { admin, userA, userB }
}

async function teardown(ctx: SeedContext) {
  const { admin, userA, userB } = ctx
  for (const u of [userA, userB]) {
    await admin.from("documents").delete().eq("id", u.documentId)
    await admin.from("client_users").delete().eq("id", u.authUserId)
    await admin.from("clients").delete().eq("id", u.clientId)
    await admin.auth.admin.deleteUser(u.authUserId)
  }
}

async function signedInClientFor(user: TestUser): Promise<SupabaseClient> {
  const client = createClient(SUPABASE_URL!, ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { error } = await client.auth.signInWithPassword({
    email: user.email,
    password: user.password,
  })
  if (error) throw new Error(`signIn ${user.email}: ${error.message}`)
  return client
}

test.describe("RLS — client documents", () => {
  test.skip(
    !hasEnv,
    "Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY in .env.test to run RLS isolation tests."
  )

  let ctx: SeedContext

  test.beforeAll(async () => {
    ctx = await seedTwoTenants()
  })

  test.afterAll(async () => {
    if (ctx) await teardown(ctx)
  })

  test("Client A sees only Client A's documents", async () => {
    const a = await signedInClientFor(ctx.userA)
    const { data, error } = await a.from("documents").select("id, client_id")
    expect(error).toBeNull()
    expect(data).not.toBeNull()
    expect(data!.length).toBeGreaterThan(0)
    for (const row of data!) {
      expect(row.client_id).toBe(ctx.userA.clientId)
    }
    const visibleIds = new Set(data!.map((r) => r.id))
    expect(visibleIds.has(ctx.userA.documentId)).toBe(true)
    expect(visibleIds.has(ctx.userB.documentId)).toBe(false)
  })

  test("Client B sees only Client B's documents", async () => {
    const b = await signedInClientFor(ctx.userB)
    const { data, error } = await b.from("documents").select("id, client_id")
    expect(error).toBeNull()
    expect(data).not.toBeNull()
    expect(data!.length).toBeGreaterThan(0)
    for (const row of data!) {
      expect(row.client_id).toBe(ctx.userB.clientId)
    }
    const visibleIds = new Set(data!.map((r) => r.id))
    expect(visibleIds.has(ctx.userB.documentId)).toBe(true)
    expect(visibleIds.has(ctx.userA.documentId)).toBe(false)
  })

  test("Client A cannot fetch Client B's document by id", async () => {
    const a = await signedInClientFor(ctx.userA)
    const { data, error } = await a
      .from("documents")
      .select("id, client_id")
      .eq("id", ctx.userB.documentId)
    expect(error).toBeNull()
    expect(data).toEqual([])
  })
})
