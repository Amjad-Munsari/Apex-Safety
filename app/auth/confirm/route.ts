import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import type { EmailOtpType } from "@supabase/supabase-js"

/**
 * Server-side email-link confirmation (Supabase SSR pattern).
 *
 * Admin-generated invite / recovery links (auth.admin.generateLink) deliver
 * their session in the URL *fragment* via the legacy /auth/v1/verify endpoint —
 * the fragment never reaches the server, so the PKCE-only /auth/callback route
 * (exchangeCodeForSession) can't see it and always errored. Instead we mint our
 * own link carrying the `token_hash`, and verify it here with verifyOtp, which
 * sets the auth cookies through the SSR client. The invitee then lands on
 * `next` (e.g. /auth/set-password) already signed in.
 */

function safeNextPath(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return "/"
  }
  return next
}

// Only the email-OTP types we actually mint links for. Guards against a crafted
// `type` param being passed straight into verifyOtp.
const ALLOWED_TYPES: ReadonlyArray<EmailOtpType> = [
  "invite",
  "recovery",
  "signup",
  "magiclink",
  "email",
  "email_change",
]

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const tokenHash = searchParams.get("token_hash")
  const type = searchParams.get("type") as EmailOtpType | null
  const next = safeNextPath(searchParams.get("next"))

  if (tokenHash && type && ALLOWED_TYPES.includes(type)) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    if (!error) {
      // Redirect only to the canonical site (configured) or this request's own
      // origin — never a client-supplied host header (open-redirect vector).
      const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || origin
      return NextResponse.redirect(`${base}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/auth/auth-code-error`)
}
