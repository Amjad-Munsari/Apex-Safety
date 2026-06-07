import "server-only"

import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export async function createClient() {
  const cookieStore = await cookies()
  // Demo mode bypasses RLS via the service-role key. NEVER honor it in
  // production — a demo cookie there would disable row-level security for
  // every /client query (code review CR-03). Gated to non-production only.
  const isDemoMode =
    process.env.NODE_ENV !== "production" &&
    cookieStore.get("demo_mode")?.value === "1"

  // In demo mode, we use the service role key to bypass RLS since the user
  // doesn't have a real Supabase Auth session.
  const supabaseKey = isDemoMode
    ? process.env.SUPABASE_SERVICE_ROLE_KEY!
    : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    supabaseKey,
    {
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
    }
  )
}
