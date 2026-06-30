// Route: POST /api/paypal/create-order
import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

const isEnabledSpy = vi.fn()
const createOrderSpy = vi.fn()
const getClientContextSpy = vi.fn()

vi.mock("server-only", () => ({}))

vi.mock("@/lib/auth-helpers", () => ({
  getClientContext: (...a: unknown[]) => getClientContextSpy(...a),
}))

vi.mock("@/lib/paypal", () => ({
  isPayPalEnabled: () => isEnabledSpy(),
  createPayPalOrder: (...a: unknown[]) => createOrderSpy(...a),
}))

// lib/billing/packages is pure data — used for real (no mock).

import { POST } from "@/app/api/paypal/create-order/route"

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/paypal/create-order", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

const CLIENT_ID = "client-uuid-1"

describe("POST /api/paypal/create-order", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    isEnabledSpy.mockReturnValue(true)
    getClientContextSpy.mockResolvedValue({ client_id: CLIENT_ID, role: "owner" })
    createOrderSpy.mockResolvedValue({
      id: "ORDER123",
      approveUrl: "https://www.sandbox.paypal.com/checkoutnow?token=ORDER123",
    })
    process.env.NEXT_PUBLIC_SITE_URL = "https://app.test"
  })

  it("returns 403 and makes no PayPal call when the feature flag is off", async () => {
    isEnabledSpy.mockReturnValue(false)

    const res = await POST(makeRequest({ packageId: "5h" }))

    expect(res.status).toBe(403)
    expect(createOrderSpy).not.toHaveBeenCalled()
  })

  it("returns 401 when there is no authenticated client", async () => {
    getClientContextSpy.mockResolvedValue(null)

    const res = await POST(makeRequest({ packageId: "5h" }))

    expect(res.status).toBe(401)
    expect(createOrderSpy).not.toHaveBeenCalled()
  })

  it("returns 400 for an unknown packageId (price-tamper guard)", async () => {
    const res = await POST(makeRequest({ packageId: "999h" }))

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe("invalid_package")
    expect(createOrderSpy).not.toHaveBeenCalled()
  })

  it("returns 400 when packageId is missing", async () => {
    const res = await POST(makeRequest({}))

    expect(res.status).toBe(400)
    expect(createOrderSpy).not.toHaveBeenCalled()
  })

  it("creates a £495.00 GBP order for the 5h package bound to the client, returns orderId + approveUrl", async () => {
    const res = await POST(makeRequest({ packageId: "5h" }))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({
      orderId: "ORDER123",
      approveUrl: "https://www.sandbox.paypal.com/checkoutnow?token=ORDER123",
    })

    expect(createOrderSpy).toHaveBeenCalledTimes(1)
    // Clean redirect URLs (no query): PayPal appends ?token=…&PayerID=… itself,
    // and the client distinguishes return vs cancel by PayerID presence.
    expect(createOrderSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: "495.00",
        currency: "GBP",
        description: "888 Safety — 5 Consulting Hours",
        referenceId: "5h",
        customId: CLIENT_ID,
        returnUrl: "https://app.test/client/billing",
        cancelUrl: "https://app.test/client/billing",
      })
    )
  })

  it("prices the 20h package at £1,800.00", async () => {
    await POST(makeRequest({ packageId: "20h" }))

    expect(createOrderSpy).toHaveBeenCalledWith(
      expect.objectContaining({ amount: "1800.00", referenceId: "20h" })
    )
  })

  it("returns 500 (not a crash) when PayPal order creation throws", async () => {
    createOrderSpy.mockRejectedValueOnce(new Error("paypal down"))

    const res = await POST(makeRequest({ packageId: "5h" }))

    expect(res.status).toBe(500)
  })
})
