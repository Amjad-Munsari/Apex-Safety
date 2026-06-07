import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

const ADMIN_EMAILS = ["admin@test.com"]

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  // Demo mode: allow unauthenticated access for frictionless demos.
  // NEVER honor the client-set demo_mode cookie in production — there it would
  // wave any request straight past auth into /admin (which renders via the
  // service-role client = full data disclosure). Gated to non-production only.
  const demoBypass =
    process.env.NODE_ENV !== "production" && request.cookies.get("demo_mode")?.value === "1"

  if ((pathname.startsWith("/client") || pathname.startsWith("/admin")) && demoBypass) {
    return supabaseResponse
  }

  if (pathname.startsWith("/login")) {
    if (user) {
      const isAdmin = ADMIN_EMAILS.includes(user.email ?? "")
      const url = request.nextUrl.clone()
      url.pathname = isAdmin ? "/admin" : "/client"
      return NextResponse.redirect(url)
    }
    return supabaseResponse
  }

  const isProtected =
    pathname.startsWith("/admin") || pathname.startsWith("/client") || pathname.startsWith("/proposals")

  if (isProtected && !user) {
    // Allow demo mode cookie to bypass auth — non-production only (see above).
    if (demoBypass && (pathname.startsWith("/client") || pathname.startsWith("/admin"))) {
      return supabaseResponse
    }

    const url = request.nextUrl.clone()
    url.pathname = "/login"
    return NextResponse.redirect(url)
  }

  if (user && pathname.startsWith("/admin")) {
    const isAdmin = ADMIN_EMAILS.includes(user.email ?? "")
    if (!isAdmin) {
      const url = request.nextUrl.clone()
      url.pathname = "/client"
      return NextResponse.redirect(url)
    }
  }

  if (user && pathname.startsWith("/client")) {
    const isAdmin = ADMIN_EMAILS.includes(user.email ?? "")
    if (isAdmin) {
      const url = request.nextUrl.clone()
      url.pathname = "/admin"
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}
