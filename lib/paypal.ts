import "server-only"

import { createHash } from "node:crypto"
import { adminClient } from "@/lib/supabase/admin"

const SANDBOX_BASE = "https://api-m.sandbox.paypal.com"
const LIVE_BASE = "https://api-m.paypal.com"
const TOKEN_SAFETY_MARGIN_MS = 60_000
const PAYPAL_REQUEST_TIMEOUT_MS = 15_000

export type PayPalMode = "sandbox" | "live"
export type PayPalConnectionHealth = "connected" | "paused" | "not_connected" | "error"

export interface PayPalConfig {
  configured: boolean
  enabled: boolean
  mode: PayPalMode
  clientId: string
  clientSecret: string
  version: number | null
  fingerprint: string
}

interface RuntimeCredentialsRow {
  configured?: unknown
  enabled?: unknown
  paypal_mode?: unknown
  client_id?: unknown
  client_secret?: unknown
  revision?: unknown
}

interface CheckoutRuntimeRow {
  mapped?: unknown
  pending_client_id?: unknown
  pending_package_id?: unknown
  paypal_mode?: unknown
  config_version?: unknown
  paypal_client_id?: unknown
  paypal_client_secret?: unknown
}

export interface PayPalCheckoutContext {
  config: PayPalConfig
  mapping: { clientId: string; packageId: string } | null
}

export interface PayPalVerificationInput {
  clientId: string
  clientSecret: string
  mode: PayPalMode
}

export type PayPalVerificationResult = { ok: true } | { ok: false; error: string }

function isMode(value: unknown): value is PayPalMode {
  return value === "sandbox" || value === "live"
}

function asVersion(value: unknown): number | null {
  if (typeof value === "number" && Number.isSafeInteger(value) && value > 0) return value
  if (typeof value === "string" && /^\d+$/.test(value)) {
    const parsed = Number(value)
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null
  }
  return null
}

function configFingerprint(clientId: string, clientSecret: string, mode: PayPalMode, revision: string) {
  return createHash("sha256")
    .update(`${revision}\u0000${mode}\u0000${clientId}\u0000${clientSecret}`)
    .digest("hex")
}

function paypalApiBaseForMode(mode: PayPalMode): string {
  return mode === "live" ? LIVE_BASE : SANDBOX_BASE
}

export function paypalApiBase(mode: PayPalMode = "sandbox"): string {
  return paypalApiBaseForMode(mode)
}

function disabledConfig(mode: PayPalMode = "live"): PayPalConfig {
  return {
    configured: false,
    enabled: false,
    mode,
    clientId: "",
    clientSecret: "",
    version: null,
    fingerprint: configFingerprint("", "", mode, "unconfigured"),
  }
}

function envConfig(): PayPalConfig {
  const clientId = process.env.PAYPAL_CLIENT_ID ?? ""
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET ?? ""
  const mode: PayPalMode = process.env.PAYPAL_MODE === "live" ? "live" : "sandbox"
  const configured = Boolean(clientId && clientSecret)
  return {
    configured,
    enabled: process.env.PAYPAL_ENABLED === "true" && configured,
    mode,
    clientId,
    clientSecret,
    version: null,
    fingerprint: configFingerprint(clientId, clientSecret, mode, "environment"),
  }
}

function rpcIsUnavailable(error: { code?: string | null } | null): boolean {
  return error?.code === "PGRST202" || error?.code === "42883"
}

function rpcRow(data: unknown): Record<string, unknown> | null {
  const row = Array.isArray(data) ? data[0] : data
  return row && typeof row === "object" ? (row as Record<string, unknown>) : null
}

function configFromRuntimeRow(row: RuntimeCredentialsRow): PayPalConfig {
  if (row.configured !== true) return disabledConfig(isMode(row.paypal_mode) ? row.paypal_mode : "live")
  const version = asVersion(row.revision)
  if (
    typeof row.enabled !== "boolean" ||
    !isMode(row.paypal_mode) ||
    typeof row.client_id !== "string" ||
    typeof row.client_secret !== "string" ||
    !row.client_id ||
    !row.client_secret ||
    version === null
  ) {
    throw new Error("PayPal configuration is invalid.")
  }
  return {
    configured: true,
    enabled: row.enabled,
    mode: row.paypal_mode,
    clientId: row.client_id,
    clientSecret: row.client_secret,
    version,
    fingerprint: configFingerprint(row.client_id, row.client_secret, row.paypal_mode, String(version)),
  }
}

/** Current configuration. Only a genuinely absent pre-migration RPC can use env fallback. */
async function resolvePayPalConfig(): Promise<PayPalConfig> {
  const { data, error } = await adminClient.rpc("get_paypal_runtime_credentials")
  if (error) {
    if (rpcIsUnavailable(error)) return envConfig()
    throw new Error("PayPal configuration could not be read.")
  }
  const row = rpcRow(data) as RuntimeCredentialsRow | null
  return row ? configFromRuntimeRow(row) : disabledConfig()
}

/** Safe state for the admin Settings screen. Credentials never leave this module. */
export async function getPayPalConnectionHealth(): Promise<PayPalConnectionHealth> {
  try {
    const config = await resolvePayPalConfig()
    if (!config.configured) return "not_connected"
    return config.enabled ? "connected" : "paused"
  } catch {
    return "error"
  }
}

export async function isPayPalEnabled(): Promise<boolean> {
  try {
    const config = await resolvePayPalConfig()
    return config.configured && config.enabled
  } catch {
    return false
  }
}

let cachedToken: { fingerprint: string; token: string; expiresAt: number } | null = null

async function requestAccessToken(config: PayPalConfig): Promise<string> {
  const basic = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64")
  const res = await fetch(`${paypalApiBaseForMode(config.mode)}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
    signal: AbortSignal.timeout(PAYPAL_REQUEST_TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`PayPal token request failed (${res.status}).`)

  const data = (await res.json()) as { access_token?: unknown; expires_in?: unknown }
  if (typeof data.access_token !== "string" || !data.access_token) {
    throw new Error("PayPal token response was invalid.")
  }
  const expiresIn = typeof data.expires_in === "number" ? data.expires_in : 0
  cachedToken = {
    fingerprint: config.fingerprint,
    token: data.access_token,
    expiresAt: Date.now() + Math.max(0, expiresIn * 1000 - TOKEN_SAFETY_MARGIN_MS),
  }
  return cachedToken.token
}

async function getAccessTokenForConfig(config: PayPalConfig, allowPaused = false): Promise<string> {
  if (!config.configured || (!allowPaused && !config.enabled) || !config.clientId || !config.clientSecret) {
    throw new Error("PayPal payments are not configured.")
  }
  if (cachedToken && cachedToken.fingerprint === config.fingerprint && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token
  }
  return requestAccessToken(config)
}

export async function getAccessToken(): Promise<string> {
  return getAccessTokenForConfig(await resolvePayPalConfig())
}

export async function verifyPayPalCredentials(
  input: PayPalVerificationInput
): Promise<PayPalVerificationResult> {
  if (!input.clientId || !input.clientSecret || !isMode(input.mode)) {
    return { ok: false, error: "Enter a Client ID, secret, and connection mode." }
  }
  try {
    const basic = Buffer.from(`${input.clientId}:${input.clientSecret}`).toString("base64")
    const response = await fetch(`${paypalApiBaseForMode(input.mode)}/v1/oauth2/token`, {
      method: "POST",
      headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: "grant_type=client_credentials",
      signal: AbortSignal.timeout(10_000),
    })
    if (!response.ok) {
      return { ok: false, error: "PayPal rejected these credentials. Check the Client ID, secret, and selected mode." }
    }
    const body = (await response.json()) as { access_token?: unknown }
    return typeof body.access_token === "string" && body.access_token
      ? { ok: true }
      : { ok: false, error: "PayPal returned an incomplete verification response. Try again." }
  } catch {
    return { ok: false, error: "PayPal could not be reached. Check the connection and try again." }
  }
}

/** Re-check the stored active pair before Matt resumes new payment creation. */
export async function verifyCurrentPayPalConnection(): Promise<PayPalVerificationResult> {
  try {
    const config = await resolvePayPalConfig()
    if (!config.configured) {
      return { ok: false, error: "No saved PayPal connection is available to resume." }
    }
    return verifyPayPalCredentials({
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      mode: config.mode,
    })
  } catch {
    return { ok: false, error: "The saved PayPal connection could not be checked. Try again." }
  }
}

export interface CreateOrderParams {
  amount: string
  currency: string
  description: string
  referenceId: string
  customId: string
  returnUrl: string
  cancelUrl: string
}

export async function createPayPalOrder(
  params: CreateOrderParams
): Promise<{ id: string; approveUrl: string | null; configVersion: number | null; mode: PayPalMode }> {
  const config = await resolvePayPalConfig()
  const token = await getAccessTokenForConfig(config)
  const res = await fetch(`${paypalApiBaseForMode(config.mode)}/v2/checkout/orders`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [{
        reference_id: params.referenceId,
        custom_id: params.customId,
        description: params.description,
        amount: { currency_code: params.currency, value: params.amount },
      }],
      application_context: {
        brand_name: "888 Safety",
        shipping_preference: "NO_SHIPPING",
        user_action: "PAY_NOW",
        return_url: params.returnUrl,
        cancel_url: params.cancelUrl,
      },
    }),
    signal: AbortSignal.timeout(PAYPAL_REQUEST_TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`PayPal create order failed (${res.status}).`)
  const data = (await res.json()) as { id?: unknown; links?: { rel: string; href: string }[] }
  if (typeof data.id !== "string" || !data.id) throw new Error("PayPal order response was invalid.")
  return {
    id: data.id,
    approveUrl: data.links?.find((link) => link.rel === "approve")?.href ?? null,
    configVersion: config.version,
    mode: config.mode,
  }
}

/** Persisting this mapping is a mandatory part of starting a new checkout. */
export async function recordPayPalPendingCheckout(input: {
  orderId: string
  clientId: string
  packageId: string
  configVersion: number | null
  mode: PayPalMode
}): Promise<void> {
  if (input.configVersion === null) return
  const { error } = await adminClient.rpc("record_paypal_pending_checkout", {
    p_order_id: input.orderId,
    p_client_id: input.clientId,
    p_package_id: input.packageId,
    p_config_version: input.configVersion,
    p_paypal_mode: input.mode,
  })
  if (error) throw new Error("PayPal checkout could not be recorded.")
}

/** Resolve the original credential version for an order, with a legacy fallback for pre-036 orders. */
export async function getPayPalCheckoutContext(orderId: string): Promise<PayPalCheckoutContext> {
  const { data, error } = await adminClient.rpc("get_paypal_checkout_runtime_config", { p_order_id: orderId })
  if (error) {
    if (rpcIsUnavailable(error)) return { config: await resolvePayPalConfig(), mapping: null }
    throw new Error("PayPal checkout configuration could not be read.")
  }

  const row = rpcRow(data) as CheckoutRuntimeRow | null
  if (!row || row.mapped !== true) return { config: await resolvePayPalConfig(), mapping: null }
  const version = asVersion(row.config_version)
  if (
    typeof row.pending_client_id !== "string" ||
    typeof row.pending_package_id !== "string" ||
    !isMode(row.paypal_mode) ||
    typeof row.paypal_client_id !== "string" ||
    typeof row.paypal_client_secret !== "string" ||
    !row.paypal_client_id ||
    !row.paypal_client_secret ||
    version === null
  ) {
    throw new Error("PayPal checkout configuration is invalid.")
  }
  return {
    config: {
      configured: true,
      enabled: true,
      mode: row.paypal_mode,
      clientId: row.paypal_client_id,
      clientSecret: row.paypal_client_secret,
      version,
      fingerprint: configFingerprint(row.paypal_client_id, row.paypal_client_secret, row.paypal_mode, String(version)),
    },
    mapping: { clientId: row.pending_client_id, packageId: row.pending_package_id },
  }
}

/** Best-effort lifecycle marker; the immutable ledger remains the money authority. */
export async function markPayPalPendingCheckoutCredited(orderId: string): Promise<void> {
  const { error } = await adminClient.rpc("mark_paypal_pending_checkout_credited", { p_order_id: orderId })
  if (error && !rpcIsUnavailable(error)) throw new Error("PayPal checkout credit marker could not be updated.")
}

export type PayPalOrderPayload = Record<string, unknown>

export async function capturePayPalOrder(
  orderId: string,
  context?: PayPalCheckoutContext
): Promise<PayPalOrderPayload> {
  const checkout = context ?? (await getPayPalCheckoutContext(orderId))
  const token = await getAccessTokenForConfig(checkout.config, true)
  const res = await fetch(
    `${paypalApiBaseForMode(checkout.config.mode)}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(PAYPAL_REQUEST_TIMEOUT_MS),
    }
  )
  return (await res.json()) as PayPalOrderPayload
}

export async function getPayPalOrder(
  orderId: string,
  context?: PayPalCheckoutContext
): Promise<PayPalOrderPayload> {
  const checkout = context ?? (await getPayPalCheckoutContext(orderId))
  const token = await getAccessTokenForConfig(checkout.config, true)
  const res = await fetch(`${paypalApiBaseForMode(checkout.config.mode)}/v2/checkout/orders/${encodeURIComponent(orderId)}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(PAYPAL_REQUEST_TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`PayPal get order failed (${res.status}).`)
  return (await res.json()) as PayPalOrderPayload
}
