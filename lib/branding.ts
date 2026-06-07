// Single source of truth for the two brand accent colours: teal (primary) and
// gold/orange (secondary).
//
// CSS-driven surfaces read these through the `--teal` / `--gold` custom
// properties declared in app/globals.css, so the Tailwind `*-teal` / `*-gold`
// utilities all resolve to them. Non-CSS contexts that can't read custom
// properties — @react-pdf documents, canvas confetti — import the BRAND hexes
// directly.
//
// The admin Settings → Branding form lets Matt override the live `--teal` /
// `--gold` variables at runtime via applyBranding(); the choice is persisted to
// localStorage and re-applied on every load by <BrandingProvider>. Server-
// rendered PDFs keep the static defaults below.

export const BRAND = {
  teal: "#3b8273",
  gold: "#d97706",
} as const

export type Branding = { primary: string; secondary: string }

export const DEFAULT_BRANDING: Branding = {
  primary: BRAND.teal,
  secondary: BRAND.gold,
}

const STORAGE_KEY = "branding"

/** The operator's saved brand colours, or null if they've never customised. */
export function loadBranding(): Branding | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<Branding>
    return {
      primary: parsed.primary || DEFAULT_BRANDING.primary,
      secondary: parsed.secondary || DEFAULT_BRANDING.secondary,
    }
  } catch {
    return null
  }
}

export function saveBranding(branding: Branding): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(branding))
  } catch {
    /* ignore quota / private-mode write failures */
  }
}

/**
 * Push colours onto the live `--teal` / `--gold` custom properties. An inline
 * style on the `[data-surface]` element outranks the stylesheet's per-surface
 * declaration, so this wins without `!important`. Falls back to <html> if no
 * surface element is mounted yet.
 */
export function applyBranding(branding: Partial<Branding>): void {
  if (typeof document === "undefined") return
  const surfaces = document.querySelectorAll<HTMLElement>("[data-surface]")
  const targets = surfaces.length ? Array.from(surfaces) : [document.documentElement]
  for (const el of targets) {
    if (branding.primary) el.style.setProperty("--teal", branding.primary)
    if (branding.secondary) el.style.setProperty("--gold", branding.secondary)
  }
}
