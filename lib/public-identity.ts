export const PLATFORM_NAME = "Merlin Safety System"

export const PUBLIC_CONTACT = {
  email: "info@888safetyandtraining.com",
  phone: "0333 049 8979",
  emailHref: "mailto:info@888safetyandtraining.com",
  phoneHref: "tel:+443330498979",
} as const

export const PUBLIC_CONTACT_LINE =
  `${PUBLIC_CONTACT.email} · ${PUBLIC_CONTACT.phone}` as const
