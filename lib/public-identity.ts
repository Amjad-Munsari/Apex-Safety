export const PLATFORM_NAME = "Apex Safety OS"

/**
 * Letterhead brand on client-facing generated documents (proposals, contracts,
 * reports) and the on-screen proposal preview. Split so the wordmark renders
 * with two weights: "Apex" + "Safety & Compliance".
 */
export const DOCUMENT_BRAND = {
  lead: "Apex",
  rest: "Safety & Compliance",
  full: "Apex Safety & Compliance",
} as const

export const PUBLIC_CONTACT = {
  email: "contact@apexsafety.demo",
  phone: "+44 20 7946 0912",
  emailHref: "mailto:contact@apexsafety.demo",
  phoneHref: "tel:+442079460912",
} as const

export const PUBLIC_CONTACT_LINE =
  `${PUBLIC_CONTACT.email} · ${PUBLIC_CONTACT.phone}` as const

