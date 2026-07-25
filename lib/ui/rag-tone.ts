// Static class strings for the compliance RAG pill and proposal-status badge.
//
// WHY THIS EXISTS: these were previously built by interpolation —
// `border-${ragColor}/40 text-${ragColor} bg-${ragColor}/5`. Tailwind scans
// source *text* for class candidates, so an interpolated name is never seen by
// the compiler. Such a utility renders only when some unrelated file happens to
// use the identical literal, which made the styling silently dependent on other
// files: `bg-success/5` and `text-gold/60` had ZERO static occurrences anywhere,
// so the green RAG pill had no background tint and the gold proposal badge had
// no text colour at all. There is no safelist (Tailwind v4, CSS-first), so the
// pattern was also one unrelated deletion away from breaking further.
//
// Callers now pass a semantic tone and get complete literal class strings. This
// also collapses a divergence between the two RAG producers, which used
// different neutral tokens for the same "no documents" state (`[#555]` on the
// clients list — an arbitrary value that could never be generated — versus
// `muted-foreground` on the dashboard).

/** Compliance state of a client's nearest document expiry. */
export type RagTone = "ok" | "expiring" | "expired" | "none"

export const RAG_TONE_CLASSES: Record<RagTone, { pill: string; dot: string }> = {
  ok: { pill: "border-success/40 text-success bg-success/5", dot: "bg-success" },
  expiring: { pill: "border-gold/40 text-gold bg-gold/5", dot: "bg-gold" },
  expired: { pill: "border-danger/40 text-danger bg-danger/5", dot: "bg-danger" },
  none: {
    pill: "border-border text-muted-foreground bg-muted/40",
    dot: "bg-muted-foreground",
  },
}

/** Proposal pipeline state as shown in the clients table. */
export type ProposalTone = "signed" | "open" | "none"

export const PROPOSAL_TONE_CLASSES: Record<ProposalTone, string> = {
  // Was the arbitrary literal `[#3b8273]` inside an interpolation — that is the
  // teal brand hex, so it uses the theme token and now tracks dark mode.
  signed: "border-teal/40 text-teal/60",
  open: "border-gold/40 text-gold/60",
  none: "border-foreground/40 text-foreground/60",
}

/** Map a proposals.status value to its badge tone. */
export function proposalTone(status: string | null): ProposalTone {
  if (!status) return "none"
  return status === "Signed" ? "signed" : "open"
}

/**
 * Derive the RAG tone from days until the nearest expiry.
 *
 * `null` means the client has no dated documents at all. Thresholds match what
 * both producers open-coded: past due → expired, inside 30 days → expiring.
 */
export function ragToneFromDays(daysUntil: number | null): RagTone {
  if (daysUntil === null) return "none"
  if (daysUntil < 0) return "expired"
  if (daysUntil < 30) return "expiring"
  return "ok"
}
