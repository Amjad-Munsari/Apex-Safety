"use client"

import { useState } from "react"
import { applyBranding, loadBranding } from "@/lib/branding"

/**
 * Re-applies the operator's saved brand colours on every load so the runtime
 * `--teal` / `--gold` overrides survive navigation and refresh. Does nothing
 * (leaving the per-surface defaults from globals.css intact) until Matt saves a
 * custom palette in Settings → Branding. Renders no DOM.
 *
 * Branding is applied synchronously via a lazy useState initializer so CSS vars
 * are set before the first paint, eliminating the brief default-colour flash on
 * navigation that the old useEffect approach caused.
 */
export function BrandingProvider() {
  // Lazy initializer: runs once on the client during the first render, before
  // the browser paints. typeof-window guard makes it SSR-safe even though this
  // component is 'use client' (Next.js can still SSR client components).
  useState(() => {
    if (typeof window === "undefined") return
    const saved = loadBranding()
    if (saved) applyBranding(saved)
  })
  return null
}
