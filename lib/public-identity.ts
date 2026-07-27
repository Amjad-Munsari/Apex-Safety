export const PLATFORM_NAME = "Merlin Safety System"

/**
 * Letterhead brand on client-facing generated documents (proposals, contracts,
 * reports) and the on-screen proposal preview. Split so the wordmark renders
 * with two weights: "888" + "Safety & Training".
 *
 * Client-facing documents carry the CONSULTANCY's identity, not the platform's.
 * Merlin Safety System (PLATFORM_NAME) is the system name only — it must never
 * appear on a proposal, contract or report. Confirmed by Finley, 27 Jul 2026:
 * "888 — the system is just called Merlin."
 *
 * The prototype string "888 Safety Solutions" was never a real trading name.
 *
 * NOT a legal entity. The contracting party named in a service agreement is a
 * separate, still-unconfirmed value — see contract-document.tsx.
 */
export const DOCUMENT_BRAND = {
  lead: "888",
  rest: "Safety & Training",
  full: "888 Safety & Training",
} as const

export const PUBLIC_CONTACT = {
  email: "info@888safetyandtraining.com",
  phone: "0333 049 8979",
  emailHref: "mailto:info@888safetyandtraining.com",
  phoneHref: "tel:+443330498979",
} as const

export const PUBLIC_CONTACT_LINE =
  `${PUBLIC_CONTACT.email} · ${PUBLIC_CONTACT.phone}` as const
