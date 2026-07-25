"use server"

import { adminClient } from "@/lib/supabase/admin"
import { dispatchNotification } from "@/lib/notifications/dispatch"
import { getSiteUrl } from "@/lib/site-url"
import { clientIpFrom, consumeRateLimit, rateLimitKey } from "@/lib/rate-limit"
import { headers } from "next/headers"

const RESET_ACCOUNT_LIMIT = 3
const RESET_IP_LIMIT = 20
const RESET_WINDOW_SECONDS = 60 * 60

// Self-serve password reset. Mints a recovery link exactly the way admin
// invites do (generateLink → our own /auth/confirm?token_hash link, see
// app/admin/clients/actions.ts) and emails it via Resend. Always resolves
// { ok: true } for well-formed emails — whether an account exists is never
// disclosed to the caller.
export async function requestPasswordReset(rawEmail: string): Promise<{ ok: boolean }> {
  const email = rawEmail.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: true }

  const requestHeaders = await headers()
  const clientIp = clientIpFrom(requestHeaders)
  const [accountLimit, ipLimit] = await Promise.all([
    consumeRateLimit(
      rateLimitKey("password-reset-account", email),
      RESET_ACCOUNT_LIMIT,
      RESET_WINDOW_SECONDS
    ),
    consumeRateLimit(
      rateLimitKey("password-reset-ip", clientIp),
      RESET_IP_LIMIT,
      RESET_WINDOW_SECONDS
    ),
  ])

  // Keep the public response identical when either window is exhausted. This
  // prevents account discovery while stopping reset-email flooding and broad
  // enumeration from a single source.
  if (!accountLimit.allowed || !ipLimit.allowed) return { ok: true }

  const { data, error } = await adminClient.auth.admin.generateLink({
    type: "recovery",
    email,
  })

  // Unknown account: generateLink errors. Say nothing — same response either way.
  if (error || !data?.properties?.hashed_token) return { ok: true }

  const base = getSiteUrl()
  const params = new URLSearchParams({
    token_hash: data.properties.hashed_token,
    type: "recovery",
    next: "/auth/set-password",
  })
  const resetUrl = `${base}/auth/confirm?${params.toString()}`

  const result = await dispatchNotification({
    type: "password_reset",
    recipient_email: email,
    reset_url: resetUrl,
  })

  if (!result.ok) {
    await adminClient.from("workflow_errors").insert({
      workflow_name: "password_reset",
      error_message: result.error ?? "unknown dispatch failure",
      payload: { recipient_email: email },
    })
  }

  return { ok: true }
}
