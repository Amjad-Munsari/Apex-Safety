// Route: POST /api/paypal/capture-order
import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

const isEnabledSpy = vi.fn()
const captureSpy = vi.fn()
const getOrderSpy = vi.fn()
const getClientContextSpy = vi.fn()

// adminClient query spies
const txMaybeSingleSpy = vi.fn()
const clientSingleSpy = vi.fn()
const rpcSpy = vi.fn()

vi.mock("server-only", () => ({}))

vi.mock("@/lib/auth-helpers", () => ({
  getClientContext: (...a: unknown[]) => getClientContextSpy(...a),
}))

vi.mock("@/lib/paypal", () => ({
  isPayPalEnabled: () => isEnabledSpy(),
  capturePayPalOrder: (...a: unknown[]) => captureSpy(...a),
  getPayPalOrder: (...a: unknown[]) => getOrderSpy(...a),
}))

vi.mock("@/lib/supabase/admin", () => ({
  adminClient: {
    from: (table: string) => {
      if (table === "hours_transactions") {
        return {
          select: (_c: string) => ({
            eq: (_col: string, _v: string) => ({ maybeSingle: () => txMaybeSingleSpy() }),
          }),
        }
      }
      if (table === "clients") {
        return {
          select: (_c: string) => ({
            eq: (_col: string, _v: string) => ({ single: () => clientSingleSpy() }),
          }),
        }
      }
      return {}
    },
    rpc: (...a: unknown[]) => rpcSpy(...a),
  },
}))

import { POST } from "@/app/api/paypal/capture-order/route"

const CLIENT_ID = "client-uuid-1"
const ORDER_ID = "ORDER123"

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/paypal/capture-order", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

function completedCapture(value = "495.00", customId = CLIENT_ID, referenceId = "5h") {
  return {
    id: ORDER_ID,
    status: "COMPLETED",
    purchase_units: [
      {
        reference_id: referenceId,
        custom_id: customId,
        payments: {
          captures: [{ id: "CAP1", status: "COMPLETED", amount: { currency_code: "GBP", value } }],
        },
      },
    ],
  }
}

describe("POST /api/paypal/capture-order", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    isEnabledSpy.mockReturnValue(true)
    getClientContextSpy.mockResolvedValue({ client_id: CLIENT_ID, role: "owner" })
    txMaybeSingleSpy.mockResolvedValue({ data: null, error: null }) // no prior tx
    captureSpy.mockResolvedValue(completedCapture())
    rpcSpy.mockResolvedValue({ error: null })
    clientSingleSpy.mockResolvedValue({ data: { hours_balance: 9.5 }, error: null })
  })

  it("returns 403 and captures nothing when the feature flag is off", async () => {
    isEnabledSpy.mockReturnValue(false)
    const res = await POST(makeRequest({ orderId: ORDER_ID }))
    expect(res.status).toBe(403)
    expect(captureSpy).not.toHaveBeenCalled()
    expect(rpcSpy).not.toHaveBeenCalled()
  })

  it("returns 401 for an unauthenticated caller", async () => {
    getClientContextSpy.mockResolvedValue(null)
    const res = await POST(makeRequest({ orderId: ORDER_ID }))
    expect(res.status).toBe(401)
    expect(captureSpy).not.toHaveBeenCalled()
  })

  it("returns 400 when orderId is missing", async () => {
    const res = await POST(makeRequest({}))
    expect(res.status).toBe(400)
    expect(captureSpy).not.toHaveBeenCalled()
  })

  it("is idempotent: if the order is already in the ledger, returns success WITHOUT re-capturing or re-crediting", async () => {
    txMaybeSingleSpy.mockResolvedValue({
      data: { id: "tx-1", client_id: CLIENT_ID },
      error: null,
    })

    const res = await POST(makeRequest({ orderId: ORDER_ID }))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({ success: true, balance: 9.5, alreadyProcessed: true })
    expect(captureSpy).not.toHaveBeenCalled()
    expect(rpcSpy).not.toHaveBeenCalled()
  })

  it("returns 403 when the order was already credited to a DIFFERENT client", async () => {
    txMaybeSingleSpy.mockResolvedValue({
      data: { id: "tx-1", client_id: "someone-else" },
      error: null,
    })

    const res = await POST(makeRequest({ orderId: ORDER_ID }))

    expect(res.status).toBe(403)
    expect(captureSpy).not.toHaveBeenCalled()
    expect(rpcSpy).not.toHaveBeenCalled()
  })

  it("happy path: captures, credits via credit_hours_from_paypal RPC, returns new balance", async () => {
    const res = await POST(makeRequest({ orderId: ORDER_ID }))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({ success: true, balance: 9.5 })

    expect(captureSpy).toHaveBeenCalledWith(ORDER_ID)
    expect(rpcSpy).toHaveBeenCalledTimes(1)
    expect(rpcSpy).toHaveBeenCalledWith("credit_hours_from_paypal", {
      p_client_id: CLIENT_ID,
      p_order_id: ORDER_ID,
      p_hours: 5,
      p_gbp: 495,
    })
  })

  it("rejects a tampered amount: captured value != package price → 400, no credit", async () => {
    captureSpy.mockResolvedValue(completedCapture("1.00"))

    const res = await POST(makeRequest({ orderId: ORDER_ID }))

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe("amount_mismatch")
    expect(rpcSpy).not.toHaveBeenCalled()
  })

  it("rejects an order whose custom_id is not the caller → 403, no credit", async () => {
    captureSpy.mockResolvedValue(completedCapture("495.00", "attacker-client"))

    const res = await POST(makeRequest({ orderId: ORDER_ID }))

    expect(res.status).toBe(403)
    expect(rpcSpy).not.toHaveBeenCalled()
  })

  it("treats a unique-violation on the ledger insert as already-credited (idempotent), returns success", async () => {
    rpcSpy.mockResolvedValue({ error: { code: "23505", message: "duplicate key value" } })

    const res = await POST(makeRequest({ orderId: ORDER_ID }))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })

  it("returns 500 on a non-idempotent RPC failure", async () => {
    rpcSpy.mockResolvedValue({ error: { code: "XXYYZ", message: "db exploded" } })

    const res = await POST(makeRequest({ orderId: ORDER_ID }))

    expect(res.status).toBe(500)
  })

  it("recovers from ORDER_ALREADY_CAPTURED at PayPal by re-fetching the order, then credits once", async () => {
    captureSpy.mockResolvedValue({
      name: "UNPROCESSABLE_ENTITY",
      details: [{ issue: "ORDER_ALREADY_CAPTURED" }],
    })
    getOrderSpy.mockResolvedValue(completedCapture())

    const res = await POST(makeRequest({ orderId: ORDER_ID }))

    expect(res.status).toBe(200)
    expect(getOrderSpy).toHaveBeenCalledWith(ORDER_ID)
    expect(rpcSpy).toHaveBeenCalledWith(
      "credit_hours_from_paypal",
      expect.objectContaining({ p_hours: 5, p_order_id: ORDER_ID })
    )
  })

  it("returns 502 when capture neither completes nor reports already-captured", async () => {
    captureSpy.mockResolvedValue({ name: "INTERNAL_SERVER_ERROR" })

    const res = await POST(makeRequest({ orderId: ORDER_ID }))

    expect(res.status).toBe(502)
    expect(rpcSpy).not.toHaveBeenCalled()
  })
})
