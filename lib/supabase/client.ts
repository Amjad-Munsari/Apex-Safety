"use client"

import { createBrowserClient } from "@supabase/ssr"

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    console.warn("[supabase/client] Missing env vars during build - using placeholder")
    return createBrowserClient("https://placeholder.supabase.co", "placeholder-key")
  }
  return createBrowserClient(url, key)
}
