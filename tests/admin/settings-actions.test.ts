// Tests for saveNotificationSettings (app/admin/settings/actions.ts) — focused
// on the credits_per_hour reference-rate validation (must be a positive
// integer, matching the DB CHECK >= 1). All I/O is mocked.

import { describe, it, expect, vi, beforeEach } from "vitest"

const updateArgs: Record<string, unknown>[] = []
let updateError: { message: string } | null

vi.mock("@/lib/auth-helpers", () => ({
  requireAdmin: vi.fn().mockResolvedValue("admin-1"),
}))

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))

vi.mock("@/lib/supabase/admin", () => ({
  adminClient: {
    from: (_table: string) => ({
      update: (arg: Record<string, unknown>) => {
        updateArgs.push(arg)
        return { eq: () => Promise.resolve({ error: updateError }) }
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
