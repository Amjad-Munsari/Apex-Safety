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
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
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

  // Admin vs client is decided by the `admin_users` table — the same mechanism
  // the app uses everywhere else (see lib/auth-helpers.ts `isAdmin`). A user is
  // an admin iff they have a row in admin_users keyed on their auth id. This is
  // a single primary-key lookup, only run when there's an authenticated user.
  let adminChecked = false
  let userIsAdmin = false
  async function isAdminUser() {
    if (!user) return false
    if (adminChecked) return userIsAdmin
    const { data, error } = await supabase
      .from("admin_users")
      .select("id")
      .eq("id", user.id)
      .single()
    userIsAdmin = !!data && !error
    adminChecked = true
    return userIsAdmin
  }

  // Demo mode: allow unauthenticated access for frictionless demos.
  // NEVER honor the client-set demo_mode cookie in production — there it would
  // wave any request straight past auth into /admin (which renders via the
  // service-role client = full data disclosure). Gated to non-production only.
  const demoBypass =
    process.env.NODE_ENV !== "production" && request.cookies.get("demo_mode")?.value === "1"

  if ((pathname.startsWith("/client") || pathname.startsWith("/admin")) && demoBypass) {
    return supabaseResponse
  }

  // Already-authenticated users hitting any /login surface are bounced to their
  // home surface. Send admins to /admin, clients to /client.
  if (pathname.startsWith("/login")) {
    if (user) {
      const url = request.nextUrl.clone()
      url.pathname = (await isAdminUser()) ? "/admin" : "/client"
      url.search = ""
      return NextResponse.redirect(url)
    }
    return supabaseResponse
  }

  const isAdminPath = pathname.startsWith("/admin")
  const isClientPath = pathname.startsWith("/client")
  // `/proposals` is admin-authored content; gate it like an admin surface.
  const isProposalsPath = pathname.startsWith("/proposals")

  // Unauthenticated access to any gated surface → the relevant login page.
  // Admin/proposals → /login/admin, client → /login (gateway).
  if (!user && (isAdminPath || isClientPath || isProposalsPath)) {
    const url = request.nextUrl.clone()
    url.pathname = isAdminPath || isProposalsPath ? "/login/admin" : "/login"
    url.search = ""
    return NextResponse.redirect(url)
  }

  // Authenticated but non-admin trying to reach an admin surface → admin login.
  if (user && (isAdminPath || isProposalsPath) && !(await isAdminUser())) {
    const url = request.nextUrl.clone()
    url.pathname = "/login/admin"
    url.search = ""
    return NextResponse.redirect(url)
  }

  // Admin landing on a client surface → back to the admin console.
  if (user && isClientPath && (await isAdminUser())) {
    const url = request.nextUrl.clone()
    url.pathname = "/admin"
    url.search = ""
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
