import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

/**
 * Only allow internal, single-slash absolute paths as the post-login redirect.
 * Rejects absolute URLs, protocol-relative (//evil.com) and backslash tricks —
 * otherwise `next` is an open-redirect vector.
 */
function safeNextPath(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return "/"
  }
  return next
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const next = safeNextPath(searchParams.get("next"))

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // Redirect only to the canonical site (configured) or this request's own
      // origin. NEVER derive the redirect host from the client-supplied
      // x-forwarded-host header — that was an open-redirect vector.
      const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || origin
      return NextResponse.redirect(`${base}${next}`)
    }
  }

  // return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/auth/auth-code-error`)
}
