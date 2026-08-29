import "server-only"

import { createClient, type SupabaseClient } from "@supabase/supabase-js"

let _adminClient: SupabaseClient | null = null

function getAdminClient(): SupabaseClient {
  if (_adminClient) return _adminClient
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  // During `next build` page-data collection, Vercel may build without env vars
  // set yet. Throwing at import time breaks the entire build. Defer the error
  // until runtime and use a placeholder during build to allow compilation.
  if (!url || !key) {
    if (process.env.NODE_ENV === "production" && typeof window === "undefined") {
      // Build-time placeholder - any actual DB call will fail at runtime with a clear error,
      // but the build itself can complete.
      console.warn("[supabase/admin] Missing env vars during build - using placeholder client")
      _adminClient = createClient("https://placeholder.supabase.co", "placeholder-key")
      return _adminClient
    }
    throw new Error("supabaseUrl is required - missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY")
  }
  _adminClient = createClient(url, key)
  return _adminClient
}

// Proxy preserves `adminClient.from(...)` etc. call-sites while deferring
// createClient() until first property access (not import time).
export const adminClient: SupabaseClient = new Proxy({} as unknown as SupabaseClient, {
  get(_target, prop) {
    const client = getAdminClient()
    const val = (client as unknown as Record<string | symbol, unknown>)[prop]
    return typeof val === "function" ? (val as Function).bind(client) : val
  },
})
