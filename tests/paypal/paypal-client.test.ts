// Unit tests for the server-side PayPal Orders API client (lib/paypal.ts).
// fetch is stubbed; the module is re-imported per test so the module-level
// access-token cache starts empty each time.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

vi.mock("server-only", () => ({}))

type FetchResponse = {
  ok: boolean
  status: number
  json: () => Promise<unknown>
  text: () => Promise<string>
}

function jsonResponse(body: unknown, status = 200): FetchResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  }
}

const TOKEN_BODY = { access_token: "tok_ABC", token_type: "Bearer", expires_in: 32400 }

let fetchMock: ReturnType<typeof vi.fn>

async function importFresh() {
  vi.resetModules()
  return await import("@/lib/paypal")
}

beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal("fetch", fetchMock)
  vi.useFakeTimers()
  vi.setSystemTime(new Date("2026-06-30T12:00:00Z"))
  process.env.PAYPAL_CLIENT_ID = "cid_test"
  process.env.PAYPAL_CLIENT_SECRET = "secret_test"
  process.env.PAYPAL_MODE = "sandbox"
  process.env.PAYPAL_ENABLED = "true"
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe("isPayPalEnabled", () => {
  it("is true only when PAYPAL_ENABLED === 'true'", async () => {
    const { isPayPalEnabled } = await importFresh()
    process.env.PAYPAL_ENABLED = "true"
    expect(isPayPalEnabled()).toBe(true)
    process.env.PAYPAL_ENABLED = "false"
    expect(isPayPalEnabled()).toBe(false)
    delete process.env.PAYPAL_ENABLED
    expect(isPayPalEnabled()).toBe(false)
    process.env.PAYPAL_ENABLED = "1"
    expect(isPayPalEnabled()).toBe(false)
  })
})

describe("paypalApiBase", () => {
  it("uses the sandbox host unless PAYPAL_MODE is 'live'", async () => {
    const { paypalApiBase } = await importFresh()
    process.env.PAYPAL_MODE = "sandbox"
    expect(paypalApiBase()).toBe("https://api-m.sandbox.paypal.com")
    delete process.env.PAYPAL_MODE
    expect(paypalApiBase()).toBe("https://api-m.sandbox.paypal.com")
    process.env.PAYPAL_MODE = "live"
    expect(paypalApiBase()).toBe("https://api-m.paypal.com")
  })
})

describe("getAccessToken", () => {
  it("requests a client_credentials token with HTTP Basic auth", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(TOKEN_BODY))
    const { getAccessToken } = await importFresh()

    const token = await getAccessToken()

    expect(token).toBe("tok_ABC")
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe("https://api-m.sandbox.paypal.com/v1/oauth2/token")
    expect(init.method).toBe("POST")
    expect(init.headers.Authorization).toBe(
      "Basic " + Buffer.from("cid_test:secret_test").toString("base64")
    )
    expect(init.headers["Content-Type"]).toBe("application/x-www-form-urlencoded")
    expect(init.body).toBe("grant_type=client_credentials")
  })

  it("caches the token and does not re-auth on the next call", async () => {
    fetchMock.mockResolvedValue(jsonResponse(TOKEN_BODY))
    const { getAccessToken } = await importFresh()

    await getAccessToken()
    await getAccessToken()

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("re-auths once the cached token has expired", async () => {
    fetchMock.mockResolvedValue(jsonResponse(TOKEN_BODY))
    const { getAccessToken } = await importFresh()

    await getAccessToken()
    // Advance past expires_in (32400s) → cache is stale.
    vi.setSystemTime(new Date("2026-06-30T22:00:00Z"))
    await getAccessToken()

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("throws when the token endpoint rejects the credentials", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: "invalid_client" }, 401))
    const { getAccessToken } = await importFresh()

    await expect(getAccessToken()).rejects.toThrow()
  })
})

describe("createPayPalOrder", () => {
  const CREATE_BODY = {
    id: "ORDER123",
    status: "CREATED",
    links: [
      { rel: "self", href: "https://api-m.sandbox.paypal.com/v2/checkout/orders/ORDER123" },
      { rel: "approve", href: "https://www.sandbox.paypal.com/checkoutnow?token=ORDER123" },
    ],
  }

  it("POSTs an intent=CAPTURE order with the GBP amount, description and binding ids", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(TOKEN_BODY))
      .mockResolvedValueOnce(jsonResponse(CREATE_BODY, 201))
    const { createPayPalOrder } = await importFresh()

    const result = await createPayPalOrder({
      amount: "495.00",
      currency: "GBP",
      description: "888 Safety — 5 Consulting Hours",
      referenceId: "5h",
      customId: "client-uuid-1",
      returnUrl: "https://app.test/client/billing?paypal=return",
      cancelUrl: "https://app.test/client/billing?paypal=cancel",
    })

    expect(result).toEqual({
      id: "ORDER123",
      approveUrl: "https://www.sandbox.paypal.com/checkoutnow?token=ORDER123",
    })

    const [url, init] = fetchMock.mock.calls[1]
    expect(url).toBe("https://api-m.sandbox.paypal.com/v2/checkout/orders")
    expect(init.method).toBe("POST")
    expect(init.headers.Authorization).toBe("Bearer tok_ABC")
    expect(init.headers["Content-Type"]).toBe("application/json")

    const sent = JSON.parse(init.body)
    expect(sent.intent).toBe("CAPTURE")
    expect(sent.purchase_units).toHaveLength(1)
    const pu = sent.purchase_units[0]
    expect(pu.amount).toEqual({ currency_code: "GBP", value: "495.00" })
    expect(pu.description).toBe("888 Safety — 5 Consulting Hours")
    expect(pu.reference_id).toBe("5h")
    expect(pu.custom_id).toBe("client-uuid-1")

    const ctx = sent.application_context
    expect(ctx.return_url).toBe("https://app.test/client/billing?paypal=return")
    expect(ctx.cancel_url).toBe("https://app.test/client/billing?paypal=cancel")
  })

  it("throws when order creation fails", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(TOKEN_BODY))
      .mockResolvedValueOnce(jsonResponse({ name: "INVALID_REQUEST" }, 400))
    const { createPayPalOrder } = await importFresh()

    await expect(
      createPayPalOrder({
        amount: "495.00",
        currency: "GBP",
        description: "x",
        referenceId: "5h",
        customId: "c1",
        returnUrl: "r",
        cancelUrl: "c",
      })
    ).rejects.toThrow()
  })
})

describe("capturePayPalOrder", () => {
  const CAPTURE_BODY = {
    id: "ORDER123",
    status: "COMPLETED",
    purchase_units: [
      {
        reference_id: "5h",
        custom_id: "client-uuid-1",
        payments: { captures: [{ id: "CAP1", amount: { currency_code: "GBP", value: "495.00" } }] },
      },
    ],
  }

  it("POSTs to the order capture endpoint and returns the parsed body", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(TOKEN_BODY))
      .mockResolvedValueOnce(jsonResponse(CAPTURE_BODY, 201))
    const { capturePayPalOrder } = await importFresh()

    const body = await capturePayPalOrder("ORDER123")

    expect(body).toEqual(CAPTURE_BODY)
    const [url, init] = fetchMock.mock.calls[1]
    expect(url).toBe("https://api-m.sandbox.paypal.com/v2/checkout/orders/ORDER123/capture")
    expect(init.method).toBe("POST")
    expect(init.headers.Authorization).toBe("Bearer tok_ABC")
  })

  it("surfaces the parsed body even on a 422 ALREADY_CAPTURED (for idempotent handling)", async () => {
    const already = {
      name: "UNPROCESSABLE_ENTITY",
      details: [{ issue: "ORDER_ALREADY_CAPTURED" }],
    }
    fetchMock
      .mockResolvedValueOnce(jsonResponse(TOKEN_BODY))
      .mockResolvedValueOnce(jsonResponse(already, 422))
    const { capturePayPalOrder } = await importFresh()

    const result = await capturePayPalOrder("ORDER123")
    expect(result).toMatchObject({ name: "UNPROCESSABLE_ENTITY" })
  })
})

describe("getPayPalOrder", () => {
  it("GETs the order by id with a bearer token", async () => {
    const ORDER = { id: "ORDER123", status: "APPROVED" }
    fetchMock
      .mockResolvedValueOnce(jsonResponse(TOKEN_BODY))
      .mockResolvedValueOnce(jsonResponse(ORDER))
    const { getPayPalOrder } = await importFresh()

    const body = await getPayPalOrder("ORDER123")

    expect(body).toEqual(ORDER)
    const [url, init] = fetchMock.mock.calls[1]
    expect(url).toBe("https://api-m.sandbox.paypal.com/v2/checkout/orders/ORDER123")
    expect(init.method ?? "GET").toBe("GET")
    expect(init.headers.Authorization).toBe("Bearer tok_ABC")
  })
})
