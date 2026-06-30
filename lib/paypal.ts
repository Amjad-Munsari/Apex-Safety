import "server-only"

/**
 * Server-side PayPal REST (Orders API v2) client.
 *
 * Secrets (PAYPAL_CLIENT_SECRET) live only here and in the route handlers that
 * import this module — never in the browser bundle. The whole feature is gated
 * behind PAYPAL_ENABLED so it can be toggled off in production without a deploy.
 *
 * Auth uses the OAuth2 client_credentials grant; the access token is cached at
 * module scope for its lifetime so we don't re-auth on every order call.
 */

const SANDBOX_BASE = "https://api-m.sandbox.paypal.com"
const LIVE_BASE = "https://api-m.paypal.com"

/** Refresh the token this many ms before its real expiry to avoid edge races. */
const TOKEN_SAFETY_MARGIN_MS = 60_000

/** True only when the integration is explicitly switched on. */
export function isPayPalEnabled(): boolean {
  return process.env.PAYPAL_ENABLED === "true"
}

/** Live host only when PAYPAL_MODE === 'live'; sandbox otherwise (incl. unset). */
export function paypalApiBase(): string {
  return process.env.PAYPAL_MODE === "live" ? LIVE_BASE : SANDBOX_BASE
}

// Module-scoped token cache. Reset implicitly on each cold start / module reload.
let cachedToken: { token: string; expiresAt: number } | null = null

/**
 * Returns a valid OAuth2 access token, reusing the cached one until shortly
 * before it expires. Throws if credentials are missing or PayPal rejects them.
 */
export async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token
  }

  const clientId = process.env.PAYPAL_CLIENT_ID
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error("PayPal credentials are not configured (PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET)")
  }

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64")
  const res = await fetch(`${paypalApiBase()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`PayPal token request failed (${res.status}): ${text}`)
  }

  const data = (await res.json()) as { access_token: string; expires_in?: number }
  const lifetimeMs = (data.expires_in ?? 0) * 1000
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + Math.max(0, lifetimeMs - TOKEN_SAFETY_MARGIN_MS),
  }
  return cachedToken.token
}

export interface CreateOrderParams {
  /** 2-decimal amount string, e.g. "495.00". */
  amount: string
  /** ISO 4217 currency code, e.g. "GBP". */
  currency: string
  /** purchase_unit description shown on PayPal, e.g. "888 Safety — 5 Consulting Hours". */
  description: string
  /** Bound to the order so capture can re-derive the package — we use the packageId. */
  referenceId: string
  /** Bound to the order so capture can verify the buyer — we use the client_id. */
  customId: string
  returnUrl: string
  cancelUrl: string
}

/**
 * Creates an intent=CAPTURE order and returns its id plus the buyer approval
 * URL (the `approve` HATEOAS link) the client redirects to.
 */
export async function createPayPalOrder(
  params: CreateOrderParams
): Promise<{ id: string; approveUrl: string | null }> {
  const token = await getAccessToken()
  const res = await fetch(`${paypalApiBase()}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: params.referenceId,
          custom_id: params.customId,
          description: params.description,
          amount: { currency_code: params.currency, value: params.amount },
        },
      ],
      application_context: {
        brand_name: "888 Safety",
        shipping_preference: "NO_SHIPPING",
        user_action: "PAY_NOW",
        return_url: params.returnUrl,
        cancel_url: params.cancelUrl,
      },
    }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`PayPal create order failed (${res.status}): ${text}`)
  }

  const data = (await res.json()) as { id: string; links?: { rel: string; href: string }[] }
  const approveUrl = data.links?.find((l) => l.rel === "approve")?.href ?? null
  return { id: data.id, approveUrl }
}

/** Loosely-typed PayPal order/capture payload. Callers read known fields defensively. */
export type PayPalOrderPayload = Record<string, unknown>

/**
 * Captures an approved order. Intentionally returns the parsed body for ANY
 * HTTP status (does not throw on non-2xx): a 422 with ORDER_ALREADY_CAPTURED is
 * an idempotency signal the caller must inspect, not a hard error.
 */
export async function capturePayPalOrder(orderId: string): Promise<PayPalOrderPayload> {
  const token = await getAccessToken()
  const res = await fetch(
    `${paypalApiBase()}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    }
  )
  return (await res.json()) as PayPalOrderPayload
}

/** Fetches the current state of an order. Throws on non-2xx. */
export async function getPayPalOrder(orderId: string): Promise<PayPalOrderPayload> {
  const token = await getAccessToken()
  const res = await fetch(`${paypalApiBase()}/v2/checkout/orders/${encodeURIComponent(orderId)}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`PayPal get order failed (${res.status}): ${text}`)
  }
  return (await res.json()) as PayPalOrderPayload
}
