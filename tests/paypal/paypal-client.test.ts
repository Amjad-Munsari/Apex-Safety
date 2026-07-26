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
const rpcSpy = vi.fn()

async function importFresh() {
  vi.resetModules()
  return await import("@/lib/paypal")
}

vi.mock("@/lib/supabase/admin", () => ({
  adminClient: { rpc: (...args: unknown[]) => rpcSpy(...args) },
}))

beforeEach(() => {
  vi.clearAllMocks()
  fetchMock = vi.fn()
  vi.stubGlobal("fetch", fetchMock)
  vi.useFakeTimers()
  vi.setSystemTime(new Date("2026-06-30T12:00:00Z"))
  process.env.PAYPAL_CLIENT_ID = "cid_test"
  process.env.PAYPAL_CLIENT_SECRET = "secret_test"
  process.env.PAYPAL_MODE = "sandbox"
  process.env.PAYPAL_ENABLED = "true"
  rpcSpy.mockResolvedValue({ data: null, error: { code: "PGRST202" } })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe("isPayPalEnabled", () => {
  it("is true only when PAYPAL_ENABLED === 'true'", async () => {
    const { isPayPalEnabled } = await importFresh()
    process.env.PAYPAL_ENABLED = "true"
    await expect(isPayPalEnabled()).resolves.toBe(true)
    process.env.PAYPAL_ENABLED = "false"
    await expect(isPayPalEnabled()).resolves.toBe(false)
    delete process.env.PAYPAL_ENABLED
    await expect(isPayPalEnabled()).resolves.toBe(false)
    process.env.PAYPAL_ENABLED = "1"
    await expect(isPayPalEnabled()).resolves.toBe(false)
  })

  it("does not fall back to environment values once the database connection exists but is unconfigured", async () => {
    rpcSpy.mockResolvedValue({
      data: [{ configured: false, enabled: false, paypal_mode: "live" }],
      error: null,
    })
    const { isPayPalEnabled } = await importFresh()
    await expect(isPayPalEnabled()).resolves.toBe(false)
  })

  it("fails closed when the runtime configuration read fails", async () => {
    rpcSpy.mockResolvedValue({ data: null, error: { code: "XX000", message: "database offline" } })
    const { isPayPalEnabled } = await importFresh()
    await expect(isPayPalEnabled()).resolves.toBe(false)
  })
})

describe("getPayPalConnectionHealth", () => {
  it("reports paused only when the encrypted runtime connection is readable but disabled", async () => {
    rpcSpy.mockResolvedValue({
      data: [{
        configured: true,
        enabled: false,
        paypal_mode: "live",
        client_id: "cid_live",
        client_secret: "secret_live",
        revision: "2",
      }],
      error: null,
    })
    const { getPayPalConnectionHealth } = await importFresh()
    await expect(getPayPalConnectionHealth()).resolves.toBe("paused")
  })

  it("reports an error when Vault/RPC health cannot be established", async () => {
    rpcSpy.mockResolvedValue({ data: null, error: { code: "XX000", message: "vault unavailable" } })
    const { getPayPalConnectionHealth } = await importFresh()
    await expect(getPayPalConnectionHealth()).resolves.toBe("error")
  })
})

describe("paypalApiBase", () => {
  it("uses the host for the supplied mode", async () => {
    const { paypalApiBase } = await importFresh()
    expect(paypalApiBase("sandbox")).toBe("https://api-m.sandbox.paypal.com")
    expect(paypalApiBase("live")).toBe("https://api-m.paypal.com")
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

  it("invalidates the token cache when the stored credential revision changes", async () => {
    let revision = "1"
    let secret = "secret_one"
    rpcSpy.mockImplementation(async () => ({
      data: [{
        configured: true,
        enabled: true,
        paypal_mode: "live",
        client_id: "cid_live",
        client_secret: secret,
        revision,
      }],
      error: null,
    }))
    fetchMock.mockResolvedValue(jsonResponse(TOKEN_BODY))
    const { getAccessToken } = await importFresh()

    await getAccessToken()
    revision = "2"
    secret = "secret_two"
    await getAccessToken()

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[0][0]).toBe("https://api-m.paypal.com/v1/oauth2/token")
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe(
      "Basic " + Buffer.from("cid_live:secret_two").toString("base64")
    )
  })
})

describe("verifyPayPalCredentials", () => {
  it("uses the supplied live credentials without reading the runtime store", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(TOKEN_BODY))
    const { verifyPayPalCredentials } = await importFresh()

    const result = await verifyPayPalCredentials({
      clientId: "verify_id",
      clientSecret: "verify_secret",
      mode: "live",
    })

    expect(result).toEqual({ ok: true })
    expect(rpcSpy).not.toHaveBeenCalled()
    expect(fetchMock.mock.calls[0][0]).toBe("https://api-m.paypal.com/v1/oauth2/token")
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe(
      "Basic " + Buffer.from("verify_id:verify_secret").toString("base64")
    )
  })

  it("returns a sanitised failure without echoing the credential or PayPal body", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error_description: "verify_secret" }, 401))
    const { verifyPayPalCredentials } = await importFresh()
    const result = await verifyPayPalCredentials({
      clientId: "verify_id",
      clientSecret: "verify_secret",
      mode: "sandbox",
    })

    expect(result).toMatchObject({ ok: false })
    expect(JSON.stringify(result)).not.toContain("verify_secret")
  })
})

describe("credential-version checkout recovery", () => {
  it("captures with the mapped historical credential after the active connection has changed", async () => {
    rpcSpy.mockImplementation(async (name: string) => {
      if (name === "get_paypal_checkout_runtime_config") {
        return {
          data: [{
            mapped: true,
            pending_client_id: "client-uuid-1",
            pending_package_id: "20c",
            paypal_mode: "sandbox",
            config_version: 1,
            paypal_client_id: "old_client",
            paypal_client_secret: "old_secret",
          }],
          error: null,
        }
      }
      return { data: null, error: { code: "PGRST202" } }
    })
    fetchMock
      .mockResolvedValueOnce(jsonResponse(TOKEN_BODY))
      .mockResolvedValueOnce(jsonResponse({ id: "ORDER123", status: "COMPLETED" }, 201))
    const { capturePayPalOrder, getPayPalCheckoutContext } = await importFresh()

    const context = await getPayPalCheckoutContext("ORDER123")
    await capturePayPalOrder("ORDER123", context)

    expect(fetchMock.mock.calls[0][0]).toBe("https://api-m.sandbox.paypal.com/v1/oauth2/token")
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe(
      "Basic " + Buffer.from("old_client:old_secret").toString("base64")
    )
    expect(fetchMock.mock.calls[1][0]).toBe(
      "https://api-m.sandbox.paypal.com/v2/checkout/orders/ORDER123/capture"
    )
  })

  it("keeps documented env-backed checkouts unmapped before the runtime migration exists", async () => {
    const { recordPayPalPendingCheckout } = await importFresh()

    await expect(recordPayPalPendingCheckout({
      orderId: "ORDER123",
      clientId: "client-uuid-1",
      packageId: "20c",
      configVersion: null,
      mode: "sandbox",
    })).resolves.toBeUndefined()
    expect(rpcSpy).not.toHaveBeenCalled()
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

    expect(result).toMatchObject({
      id: "ORDER123",
      approveUrl: "https://www.sandbox.paypal.com/checkoutnow?token=ORDER123",
      configVersion: null,
      mode: "sandbox",
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
