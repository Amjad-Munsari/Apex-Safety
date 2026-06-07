"use client"

import { useEffect } from "react"
import { applyBranding, loadBranding } from "@/lib/branding"

/**
 * Re-applies the operator's saved brand colours on every load so the runtime
 * `--teal` / `--gold` overrides survive navigation and refresh. Does nothing
 * (leaving the per-surface defaults from globals.css intact) until Matt saves a
 * custom palette in Settings → Branding. Renders no DOM.
 */
export function BrandingProvider() {
  useEffect(() => {
    const saved = loadBranding()
    if (saved) applyBranding(saved)
  }, [])
  return null
}
