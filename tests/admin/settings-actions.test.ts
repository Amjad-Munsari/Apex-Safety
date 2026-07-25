// Tests for saveNotificationSettings (app/admin/settings/actions.ts) — the
// credits_per_hour reference-rate validation (must be a positive integer,
// matching the DB CHECK >= 1) and the singleton-row write contract. All I/O is
// mocked.

import { describe, it, expect, vi, beforeEach } from "vitest"

const updateArgs: Record<string, unknown>[] = []
const upsertOptions: (Record<string, unknown> | undefined)[] = []
let updateError: { message: string } | null

vi.mock("@/lib/auth-helpers", () => ({
  requireAdmin: vi.fn().mockResolvedValue("admin-1"),
}))

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))

// Only `upsert` is exposed: the action must not fall back to `update`, which
// silently matches zero rows when the singleton row is absent.
vi.mock("@/lib/supabase/admin", () => ({
  adminClient: {
    from: (_table: string) => ({
      upsert: (arg: Record<string, unknown>, opts?: Record<string, unknown>) => {
        updateArgs.push(arg)
        upsertOptions.push(opts)
        return Promise.resolve({ error: updateError })
      },
    }),
  },
}))

const base = {
  signOffName: "Matt Robinson",
  senderName: "888 Safety & Training",
  expiryRemindersEnabled: true,
  notifyOnUpload: true,
}

beforeEach(() => {
  vi.clearAllMocks()
  updateArgs.length = 0
  upsertOptions.length = 0
  updateError = null
})

describe("saveNotificationSettings — credits_per_hour validation", () => {
  it("rejects a zero rate without writing", async () => {
    const { saveNotificationSettings } = await import("@/app/admin/settings/actions")
    const res = await saveNotificationSettings({ ...base, creditsPerHour: 0 })
    expect(res.ok).toBe(false)
    expect(res.error).toMatch(/whole number of 1 or more/)
    expect(updateArgs).toHaveLength(0)
  })

  it("rejects a non-integer rate without writing", async () => {
    const { saveNotificationSettings } = await import("@/app/admin/settings/actions")
    const res = await saveNotificationSettings({ ...base, creditsPerHour: 2.5 })
    expect(res.ok).toBe(false)
    expect(updateArgs).toHaveLength(0)
  })

  it("persists a valid positive-integer rate", async () => {
    const { saveNotificationSettings } = await import("@/app/admin/settings/actions")
    const res = await saveNotificationSettings({ ...base, creditsPerHour: 4 })
    expect(res.ok).toBe(true)
    expect(updateArgs[0]).toMatchObject({ credits_per_hour: 4 })
  })
})

describe("saveNotificationSettings — singleton row write", () => {
  // Regression guard: app_settings is a singleton seeded by migration 023, but
  // the row was deleted from prod by a test-data sweep (Jul 2026). The old
  // `.update().eq("id", 1)` matched zero rows, which Postgres does not treat as
  // an error, so every save reported success and persisted nothing while
  // getAppSettings masked it with DEFAULT_APP_SETTINGS. The write must carry
  // id=1 and upsert so a missing row is recreated.
  it("writes id=1 and upserts on the id conflict target", async () => {
    const { saveNotificationSettings } = await import("@/app/admin/settings/actions")
    const res = await saveNotificationSettings({ ...base, creditsPerHour: 4 })
    expect(res.ok).toBe(true)
    expect(updateArgs[0]).toMatchObject({ id: 1 })
    expect(upsertOptions[0]).toMatchObject({ onConflict: "id" })
  })

  it("surfaces a write error instead of reporting success", async () => {
    updateError = { message: "permission denied" }
    const { saveNotificationSettings } = await import("@/app/admin/settings/actions")
    const res = await saveNotificationSettings({ ...base, creditsPerHour: 4 })
    expect(res.ok).toBe(false)
    expect(res.error).toBe("permission denied")
  })
})
