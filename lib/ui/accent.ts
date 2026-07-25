// Static class strings for the accent-coloured admin surfaces (compliance
// tables/badges, stat-card labels).
//
// Same root cause as lib/ui/rag-tone.ts: these were built by interpolation —
// `text-${color}`, `border-${color}/40`, `bg-${color}/5`, `ring-${color}/30`,
// `hover:bg-${color}/10`. Tailwind scans source *text* for class candidates, so
// none of those are ever seen by the compiler; they rendered only when an
// unrelated file happened to use the identical literal. `bg-teal/5` had ZERO
// static occurrences, so the "Current" compliance badges carried no background
// tint while the gold and danger ones did — a difference that looked
// deliberate and wasn't. There is no safelist (Tailwind v4, CSS-first), so any
// unrelated deletion could silently take more of these with it.

/** Accents used by the compliance and balance surfaces. */
export type Accent = "teal" | "gold" | "danger" | "neutral"

export interface AccentClasses {
  /** Label / heading text. */
  text: string
  /** Solid dot or swatch. */
  dot: string
  /** Outline badge: border + text + faint fill. */
  badge: string
  /** Ghost button: ring + text + hover fill. */
  button: string
}

export const ACCENT_CLASSES: Record<Accent, AccentClasses> = {
  teal: {
    text: "text-teal",
    dot: "bg-teal",
    badge: "border-teal/40 text-teal bg-teal/5",
    button: "ring-teal/30 text-teal hover:bg-teal/10",
  },
  gold: {
    text: "text-gold",
    dot: "bg-gold",
    badge: "border-gold/40 text-gold bg-gold/5",
    button: "ring-gold/30 text-gold hover:bg-gold/10",
  },
  danger: {
    text: "text-danger",
    dot: "bg-danger",
    badge: "border-danger/40 text-danger bg-danger/5",
    button: "ring-danger/30 text-danger hover:bg-danger/10",
  },
  neutral: {
    text: "text-muted-foreground",
    dot: "bg-muted-foreground",
    badge: "border-border text-muted-foreground bg-muted/40",
    button: "ring-border text-muted-foreground hover:bg-muted",
  },
}

/** Accent for a document's remaining lifetime. `null` days = undated. */
export function accentFromDaysLeft(daysLeft: number | null): Accent {
  if (daysLeft === null) return "neutral"
  if (daysLeft < 0) return "danger"
  if (daysLeft < 30) return "gold"
  return "teal"
}
