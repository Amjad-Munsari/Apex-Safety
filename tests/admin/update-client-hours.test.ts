// Tests for updateClientHours (app/admin/clients/actions.ts) — the server
// backstop for the adjust-balance dialog. It returns a typed
// { ok: true, balance } | { ok: false, error } union (expected errors as
// values, not throws), delegating the atomic balance move + ledger insert to the
// adjust_client_credits RPC (migration 026). Non-integer/NaN/zero shapes are
// rejected before the RPC; overdraft and other DB-side failures are mapped from
// the RPC's exception tokens. All I/O is mocked.

import { describe, it, expect, vi, beforeEach } from "vitest"

const rpcSpy = vi.fn()

vi.mock("@/lib/auth-helpers", () => ({
  requireAdmin: vi.fn().mockResolvedValue("admin-1"),
  isAdmin: vi.fn().mockResolvedValue(true),
}))

const clientIsActiveSpy = vi.fn()
vi.mock("@/lib/clients/require-active", () => ({
  clientIsActive: (...a: unknown[]) => clientIsActiveSpy(...a),
  assertClientActive: vi.fn().mockResolvedValue(undefined),
  CLIENT_DEACTIVATED_MESSAGE: "This client is deactivated.",
}))

vi.mock("@/lib/notifications/dispatch", () => ({ dispatchNotification: vi.fn() }))
vi.mock("@/lib/site-url", () => ({ getSiteUrl: () => "https://app.test" }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))

vi.mock("@/lib/supabase/admin", () => ({
  adminClient: {
    rpc: (...a: unknown[]) => rpcSpy(...a),
  },
}))

const CLIENT_ID = "11111111-1111-1111-1111-111111111111"

beforeEach(() => {
  vi.clearAllMocks()
  clientIsActiveSpy.mockResolvedValue(true)
  rpcSpy.mockResolvedValue({ data: 30, error: null })
})

describe("updateClientHours — typed rejections (no RPC call)", () => {
  it("rejects a non-integer adjustment", async () => {
    const { updateClientHours } = await import("@/app/admin/clients/actions")
    const res = await updateClientHours(CLIENT_ID, 1.5)
    expect(res).toEqual({ ok: false, error: expect.stringMatching(/whole number/) })
    expect(rpcSpy).not.toHaveBeenCalled()
  })

  it("rejects a NaN adjustment", async () => {
    const { updateClientHours } = await import("@/app/admin/clients/actions")
    const res = await updateClientHours(CLIENT_ID, NaN)
    expect(res.ok).toBe(false)
    expect(rpcSpy).not.toHaveBeenCalled()
  })

  it("rejects a zero adjustment", async () => {
    const { updateClientHours } = await import("@/app/admin/clients/actions")
    const res = await updateClientHours(CLIENT_ID, 0)
    expect(res.ok).toBe(false)
    expect(rpcSpy).not.toHaveBeenCalled()
  })

  it("rejects a deactivated client before touching the RPC", async () => {
    clientIsActiveSpy.mockResolvedValue(false)
    const { updateClientHours } = await import("@/app/admin/clients/actions")
    const res = await updateClientHours(CLIENT_ID, 20)
    expect(res).toEqual({ ok: false, error: "This client is deactivated." })
    expect(rpcSpy).not.toHaveBeenCalled()
  })
})

describe("updateClientHours — RPC exception mapping", () => {
  it("maps an overdraft exception to a typed error result", async () => {
    rpcSpy.mockResolvedValue({ data: null, error: { message: "credits_overdraft" } })
    const { updateClientHours } = await import("@/app/admin/clients/actions")
    const res = await updateClientHours(CLIENT_ID, -20)
    expect(res).toEqual({ ok: false, error: expect.stringMatching(/insufficient/) })
  })

  it("maps a client_not_found exception to a typed error result", async () => {
    rpcSpy.mockResolvedValue({ data: null, error: { message: "client_not_found" } })
    const { updateClientHours } = await import("@/app/admin/clients/actions")
    const res = await updateClientHours(CLIENT_ID, 20)
    expect(res).toEqual({ ok: false, error: "Client not found." })
  })

  it("maps a client_inactive exception (deactivation raced the RPC) to the deactivated message", async () => {
    // Fast-path clientIsActive() passed, but the row was deactivated before the
    // RPC's locked read — the RPC catches it and updateClientHours maps it.
    rpcSpy.mockResolvedValue({ data: null, error: { message: "client_inactive" } })
    const { updateClientHours } = await import("@/app/admin/clients/actions")
    const res = await updateClientHours(CLIENT_ID, 20)
    expect(res).toEqual({ ok: false, error: "This client is deactivated." })
  })
})

describe("updateClientHours — happy path via adjust_client_credits", () => {
  it("adds credits and returns the new balance from the RPC", async () => {
    rpcSpy.mockResolvedValue({ data: 30, error: null })
    const { updateClientHours } = await import("@/app/admin/clients/actions")
    const res = await updateClientHours(CLIENT_ID, 20)

    expect(res).toEqual({ ok: true, balance: 30 })
    expect(rpcSpy).toHaveBeenCalledWith("adjust_client_credits", {
      p_client_id: CLIENT_ID,
      p_adjustment: 20,
      p_description: "Manual top-up by admin",
    })
  })

  it("deducts credits with the deduction description", async () => {
    rpcSpy.mockResolvedValue({ data: 30, error: null })
    const { updateClientHours } = await import("@/app/admin/clients/actions")
    const res = await updateClientHours(CLIENT_ID, -10)

    expect(res).toEqual({ ok: true, balance: 30 })
    expect(rpcSpy).toHaveBeenCalledWith("adjust_client_credits", {
      p_client_id: CLIENT_ID,
      p_adjustment: -10,
      p_description: "Manual deduction by admin",
    })
  })
})
