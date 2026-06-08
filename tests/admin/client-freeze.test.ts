// Tests for the deactivated-client write freeze (lib/clients/require-active.ts)
// and that a representative write action (updateClientHours) refuses to run for a
// deactivated client. A deactivated client is frozen for writes but its data
// stays readable — these tests pin the "active flag gates writes" contract.

import { describe, it, expect, vi, beforeEach } from "vitest"

// Configurable per-test: what `select("active")` returns for the client row.
let activeValue: boolean | null | undefined
let clientExists: boolean
const updateArgs: Record<string, unknown>[] = []

vi.mock("@/lib/auth-helpers", () => ({
  requireAdmin: vi.fn().mockResolvedValue("admin-1"),
  isAdmin: vi.fn().mockResolvedValue(true),
}))

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))

vi.mock("@/lib/supabase/admin", () => ({
  adminClient: {
    from: (table: string) => {
      if (table === "clients") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: clientExists ? { active: activeValue } : null,
                  error: null,
                }),
              single: () =>
                Promise.resolve({
                  data: clientExists ? { hours_balance: 5 } : null,
                  error: null,
                }),
            }),
          }),
          update: (arg: Record<string, unknown>) => {
            updateArgs.push(arg)
            return { eq: () => Promise.resolve({ error: null }) }
          },
        }
      }
      return {}
    },
  },
}))

const CLIENT_ID = "11111111-1111-1111-1111-111111111111"

beforeEach(() => {
  vi.clearAllMocks()
  activeValue = true
  clientExists = true
  updateArgs.length = 0
})

describe("clientIsActive / assertClientActive", () => {
  it("treats active=true as active", async () => {
    activeValue = true
    const { clientIsActive } = await import("@/lib/clients/require-active")
    expect(await clientIsActive(CLIENT_ID)).toBe(true)
  })

  it("treats active=false as inactive", async () => {
    activeValue = false
    const { clientIsActive } = await import("@/lib/clients/require-active")
    expect(await clientIsActive(CLIENT_ID)).toBe(false)
  })

  it("treats a missing client as active (existence is the caller's concern)", async () => {
    clientExists = false
    const { clientIsActive } = await import("@/lib/clients/require-active")
    expect(await clientIsActive(CLIENT_ID)).toBe(true)
  })

  it("assertClientActive throws the deactivated message when inactive", async () => {
    activeValue = false
    const { assertClientActive, CLIENT_DEACTIVATED_MESSAGE } = await import(
      "@/lib/clients/require-active"
    )
    await expect(assertClientActive(CLIENT_ID)).rejects.toThrow(CLIENT_DEACTIVATED_MESSAGE)
  })

  it("assertClientActive resolves when active", async () => {
    activeValue = true
    const { assertClientActive } = await import("@/lib/clients/require-active")
    await expect(assertClientActive(CLIENT_ID)).resolves.toBeUndefined()
  })
})

describe("write action respects the freeze", () => {
  it("updateClientHours refuses to write when the client is deactivated", async () => {
    activeValue = false
    const { updateClientHours } = await import("@/app/admin/clients/actions")
    await expect(updateClientHours(CLIENT_ID, 5)).rejects.toThrow(/deactivated/i)
    expect(updateArgs).toHaveLength(0) // no balance write happened
  })

  it("updateClientHours proceeds when the client is active", async () => {
    activeValue = true
    const { updateClientHours } = await import("@/app/admin/clients/actions")
    const res = await updateClientHours(CLIENT_ID, 5)
    expect(res).toMatchObject({ success: true })
    expect(updateArgs.some((a) => "hours_balance" in a)).toBe(true)
  })
})
