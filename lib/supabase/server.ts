import "server-only"

import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export async function createClient() {
  const cookieStore = await cookies()
  const demoModeRequested = cookieStore.get("demo_mode")?.value === "1"

  // Demo mode bypasses ALL RLS via the service-role key, so it must never be
  // active in production. Force it off regardless of the cookie, and warn if a
  // request actually attempted to use it.
  const isProduction =
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL_ENV === "production"
  if (demoModeRequested && isProduction) {
    console.warn(
      "[supabase/server] demo_mode request blocked in production — RLS bypass denied."
    )
  }
  const isDemoMode = demoModeRequested && !isProduction

  // In demo mode, we use the service role key to bypass RLS since the user
  // doesn't have a real Supabase Auth session.
  const supabaseKey = isDemoMode
    ? process.env.SUPABASE_SERVICE_ROLE_KEY
    : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

  if (!supabaseUrl || !supabaseKey) {
    console.warn("[supabase/server] Missing env vars during build - using placeholder")
    return createServerClient("https://placeholder.supabase.co", "placeholder-key", {
      cookies: {
        getAll() {
          return []
        },
        setAll() {},
      },
    })
  }

  return createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll() {
          // In demo mode, hide any leftover sb-*-auth-token cookies from
          // supabase-js. Otherwise it picks up a stale/expired user JWT and
          // sets it as the Authorization header, which overrides the
          // service-role apikey and causes "Invalid API key" on writes.
          const all = cookieStore.getAll()
          return isDemoMode
            ? all.filter(c => !c.name.startsWith("sb-"))
            : all
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // called from Server Component — ignore
          }
        },
      },
    })
}
