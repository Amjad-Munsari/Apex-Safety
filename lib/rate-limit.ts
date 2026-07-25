import "server-only"

import { adminClient } from "@/lib/supabase/admin"
import { createHash } from "node:crypto"

/**
 * Fixed-window rate limiting for public endpoints, backed by the
 * check_rate_limit RPC (migration 030).
 *
 * Postgres rather than a third-party limiter: the database is already in the
 * request path, the volumes are trivial, and it keeps an external dependency
 * (and its outage mode) off the password-reset flow.
 */

/** Result of a limit check. `allowed: false` means the window is exhausted. */
export interface RateLimitResult {
  allowed: boolean
  /** True when the check could not run and the call was let through. */
  degraded?: boolean
}

/** Build a non-PII database key so email addresses and IPs are not stored raw. */
export function rateLimitKey(namespace: string, value: string): string {
  const digest = createHash("sha256").update(value).digest("hex")
  return `${namespace}:${digest}`
}

/**
 * Consume one unit against `key`.
 *
 * FAILS OPEN. If the RPC errors, the caller is allowed through and the failure
 * is logged. The trade is deliberate: a limiter outage must not lock legitimate
 * users out of password reset, and anything that can break this check (the
 * database) has already broken the rest of the app. The abuse this guards
 * against is nuisance-grade — inbox flooding and enumeration speed — not
 * privilege escalation, so availability wins.
 */
export async function consumeRateLimit(
  key: string,
  max: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  try {
    const { data, error } = await adminClient.rpc("check_rate_limit", {
      p_key: key,
      p_max: max,
      p_window_seconds: windowSeconds,
    })

    if (error) {
      console.error(`[rate-limit] check failed for ${key} — allowing:`, error.message)
      return { allowed: true, degraded: true }
    }

    return { allowed: data === true }
  } catch (err) {
    console.error(`[rate-limit] check threw for ${key} — allowing:`, err)
    return { allowed: true, degraded: true }
  }
}

/**
 * Best-effort client IP from the proxy headers Vercel sets.
 *
 * Spoofable in principle, which is why it is only ever a SECONDARY key: the
 * per-account limit is the one that actually protects a given user's inbox, and
 * this one raises the cost of a broad enumeration sweep.
 */
export function clientIpFrom(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for")
  const first = fwd?.split(",")[0]?.trim()
  return first || headers.get("x-real-ip")?.trim() || "unknown"
}
