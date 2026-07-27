"use server"

import { redirect } from "next/navigation"
import type { EmailOtpType } from "@supabase/supabase-js"

import { createClient } from "@/lib/supabase/server"
import { logAppError } from "@/lib/observability/log"

/**
 * Consumes an emailed auth link.
 *
 * This is a server ACTION, not a GET handler, and that is the whole point.
 * Supabase's `verifyOtp` token is single-use, so whatever touches it first
 * spends it. Mail providers — Gmail, Outlook Safe Links, corporate scanning
 * proxies — fetch every URL in a message to scan it, which burned the token
 * before the recipient ever clicked and left them looking at "Link expired"
 * while a bot silently held the session.
 *
 * Scanners issue GET requests. They do not submit forms. Moving the
 * verification behind a POST means only a deliberate click can spend the token.
 */

const ALLOWED_TYPES: ReadonlyArray<EmailOtpType> = [
  "invite",
  "recovery",
  "signup",
  "magiclink",
  "email",
  "email_change",
]

function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return "/"
  }
  return next
}

export async function confirmEmailLink(formData: FormData): Promise<void> {
  const tokenHash = String(formData.get("token_hash") ?? "")
  const rawType = String(formData.get("type") ?? "")
  const next = safeNextPath(String(formData.get("next") ?? ""))

  // The hidden fields are attacker-controlled exactly like the query string was,
  // so they get the same validation rather than being trusted because they came
  // from our own form.
  const type = ALLOWED_TYPES.includes(rawType as EmailOtpType)
    ? (rawType as EmailOtpType)
    : null

  if (!tokenHash || !type) {
    redirect("/auth/auth-code-error")
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })

  if (error) {
    // Expected outcomes — an expired or already-used link — are the reason this
    // page exists, so they are recorded at warning level rather than as faults.
    await logAppError({
      area: "auth.confirm",
      source: "action",
      severity: "warning",
      error,
      actorType: "anon",
      context: { type, next, reason: "verifyOtp rejected the emailed link" },
    })
    redirect("/auth/auth-code-error")
  }

  // redirect() throws, so it must sit outside the try/catch above.
  redirect(next)
}
