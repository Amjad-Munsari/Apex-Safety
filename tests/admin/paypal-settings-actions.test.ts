import { beforeEach, describe, expect, it, vi } from "vitest"

const requireAdminSpy = vi.fn()
const verifySpy = vi.fn()
const verifyCurrentSpy = vi.fn()
const rpcSpy = vi.fn()
const revalidatePathSpy = vi.fn()

vi.mock("@/lib/auth-helpers", () => ({ requireAdmin: (...args: unknown[]) => requireAdminSpy(...args) }))
vi.mock("@/lib/paypal", () => ({
  verifyPayPalCredentials: (...args: unknown[]) => verifySpy(...args),
  verifyCurrentPayPalConnection: (...args: unknown[]) => verifyCurrentSpy(...args),
}))
vi.mock("@/lib/supabase/admin", () => ({
  adminClient: { rpc: (...args: unknown[]) => rpcSpy(...args) },
}))
vi.mock("next/cache", () => ({ revalidatePath: (...args: unknown[]) => revalidatePathSpy(...args) }))

const validInput = {
  clientId: "live_client_id",
  clientSecret: "live_client_secret",
  mode: "live" as const,
}

beforeEach(() => {
  vi.clearAllMocks()
  requireAdminSpy.mockResolvedValue("admin-1")
  verifySpy.mockResolvedValue({ ok: true })
  verifyCurrentSpy.mockResolvedValue({ ok: true })
  rpcSpy.mockResolvedValue({
    data: [{
      enabled: true,
      paypal_mode: "live",
      client_id_hint: "…_abc",
      verified_at: "2026-07-26T12:00:00.000Z",
    }],
    error: null,
  })
})

describe("savePayPalCredentials", () => {
  it("requires an admin session before accepting credentials", async () => {
    requireAdminSpy.mockRejectedValue(new Error("Unauthorized"))
    const { savePayPalCredentials } = await import("@/app/admin/settings/actions")

    await expect(savePayPalCredentials(validInput)).rejects.toThrow("Unauthorized")
    expect(verifySpy).not.toHaveBeenCalled()
    expect(rpcSpy).not.toHaveBeenCalled()
  })

  it("rejects incomplete or malformed input before verification or storage", async () => {
    const { savePayPalCredentials } = await import("@/app/admin/settings/actions")
    const result = await savePayPalCredentials({ ...validInput, clientSecret: "", mode: "live" })

    expect(result).toMatchObject({ ok: false })
    expect(verifySpy).not.toHaveBeenCalled()
    expect(rpcSpy).not.toHaveBeenCalled()
  })

  it("does not store credentials when PayPal verification fails", async () => {
    verifySpy.mockResolvedValue({ ok: false, error: "PayPal rejected these credentials." })
    const { savePayPalCredentials } = await import("@/app/admin/settings/actions")
    const result = await savePayPalCredentials(validInput)

    expect(result).toEqual({ ok: false, error: "PayPal rejected these credentials." })
    expect(rpcSpy).not.toHaveBeenCalled()
  })

  it("writes verified values through the restricted RPC and returns status only", async () => {
    const { savePayPalCredentials } = await import("@/app/admin/settings/actions")
    const result = await savePayPalCredentials(validInput)

    expect(verifySpy).toHaveBeenCalledWith(validInput)
    expect(rpcSpy).toHaveBeenCalledWith("set_paypal_runtime_credentials", {
      p_client_id: "live_client_id",
      p_client_secret: "live_client_secret",
      p_mode: "live",
    })
    expect(result).toEqual({
      ok: true,
      status: {
        health: "connected",
        mode: "live",
        clientIdHint: "…_abc",
        verifiedAt: "2026-07-26T12:00:00.000Z",
      },
    })
    expect(JSON.stringify(result)).not.toContain("live_client_secret")
    expect(revalidatePathSpy).toHaveBeenCalledWith("/admin/settings")
    expect(revalidatePathSpy).toHaveBeenCalledWith("/client/billing")
  })

  it("does not report success when the Vault RPC fails", async () => {
    rpcSpy.mockResolvedValue({ data: null, error: { message: "database failure" } })
    const { savePayPalCredentials } = await import("@/app/admin/settings/actions")
    const result = await savePayPalCredentials(validInput)

    expect(result).toEqual({ ok: false, error: "Could not save the PayPal connection. Try again." })
    expect(revalidatePathSpy).not.toHaveBeenCalled()
  })

  it("keeps the UI paused when a credential rotation reports that new payments remain paused", async () => {
    rpcSpy.mockResolvedValue({
      data: [{
        enabled: false,
        paypal_mode: "live",
        client_id_hint: "…_new",
        verified_at: "2026-07-26T12:00:00.000Z",
      }],
      error: null,
    })
    const { savePayPalCredentials } = await import("@/app/admin/settings/actions")
    const result = await savePayPalCredentials(validInput)

    expect(result).toMatchObject({ ok: true, status: { health: "paused", clientIdHint: "…_new" } })
  })

  it("requires an admin session to pause or resume new payments", async () => {
    requireAdminSpy.mockRejectedValue(new Error("Unauthorized"))
    const { setPayPalPaymentsEnabled } = await import("@/app/admin/settings/actions")

    await expect(setPayPalPaymentsEnabled(false)).rejects.toThrow("Unauthorized")
    expect(rpcSpy).not.toHaveBeenCalled()
  })

  it("pauses only new payments and returns a safe paused status", async () => {
    rpcSpy.mockResolvedValue({
      data: [{
        enabled: false,
        paypal_mode: "live",
        client_id_hint: "…_abc",
        verified_at: "2026-07-26T12:00:00.000Z",
      }],
      error: null,
    })
    const { setPayPalPaymentsEnabled } = await import("@/app/admin/settings/actions")
    const result = await setPayPalPaymentsEnabled(false)

    expect(rpcSpy).toHaveBeenCalledWith("set_paypal_payments_enabled", { p_enabled: false })
    expect(verifyCurrentSpy).not.toHaveBeenCalled()
    expect(result).toEqual({
      ok: true,
      status: {
        health: "paused",
        mode: "live",
        clientIdHint: "…_abc",
        verifiedAt: "2026-07-26T12:00:00.000Z",
      },
    })
  })

  it("re-verifies the stored pair before resuming new payments", async () => {
    rpcSpy.mockResolvedValue({
      data: [{
        enabled: true,
        paypal_mode: "live",
        client_id_hint: "…_abc",
        verified_at: "2026-07-26T12:00:00.000Z",
      }],
      error: null,
    })
    const { setPayPalPaymentsEnabled } = await import("@/app/admin/settings/actions")
    const result = await setPayPalPaymentsEnabled(true)

    expect(verifyCurrentSpy).toHaveBeenCalledTimes(1)
    expect(rpcSpy).toHaveBeenCalledWith("set_paypal_payments_enabled", { p_enabled: true })
    expect(result).toMatchObject({ ok: true, status: { health: "connected" } })
  })

  it("does not resume when the stored pair is rejected or times out", async () => {
    verifyCurrentSpy.mockResolvedValue({ ok: false, error: "PayPal could not be reached. Check the connection and try again." })
    const { setPayPalPaymentsEnabled } = await import("@/app/admin/settings/actions")
    const result = await setPayPalPaymentsEnabled(true)

    expect(result).toEqual({ ok: false, error: "PayPal could not be reached. Check the connection and try again." })
    expect(rpcSpy).not.toHaveBeenCalled()
  })
})
