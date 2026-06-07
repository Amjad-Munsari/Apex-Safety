import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

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

  // Admin vs client routing is decided by the server-trusted admin_users table,
  // not a hardcoded email list. The admin_users self-select RLS policy permits
  // this lookup for the signed-in user.
  let isAdminUser = false
  if (user) {
    const { data: adminRow } = await supabase
      .from("admin_users")
      .select("id")
      .eq("id", user.id)
      .maybeSingle()
    isAdminUser = !!adminRow
  }

  if (pathname.startsWith("/login")) {
    if (user) {
      const url = request.nextUrl.clone()
      url.pathname = isAdminUser ? "/admin" : "/client"
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
    if (!isAdminUser) {
      const url = request.nextUrl.clone()
      url.pathname = "/client"
      return NextResponse.redirect(url)
    }
  }

  if (user && pathname.startsWith("/client")) {
    if (isAdminUser) {
      const url = request.nextUrl.clone()
      url.pathname = "/admin"
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}
