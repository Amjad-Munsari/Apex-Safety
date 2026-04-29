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

  // Demo mode: allow unauthenticated access to /client for frictionless demos
  if (pathname.startsWith("/client") && request.cookies.get("demo_mode")?.value === "1") {
    return supabaseResponse
  }

  if (pathname === "/login") {
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
    // Allow demo mode cookie to bypass auth on /client
    const isDemoMode = request.cookies.get("demo_mode")?.value === "1"
    if (isDemoMode && pathname.startsWith("/client")) {
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
