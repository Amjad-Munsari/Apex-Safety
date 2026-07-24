/**
 * Canonical consulting-credits package catalogue.
 *
 * Single source of truth shared by the client billing UI and the server-side
 * PayPal routes. Contains NO secrets, so it is safe to import in both the
 * browser bundle and server code. The server routes validate an incoming
 * `packageId` against this list and derive the GBP amount from it — the browser
 * never gets to name its own price (price-manipulation guard, see
 * app/api/paypal/create-order + capture-order).
 */

export type PackageId = "20c" | "40c" | "80c"

export interface CreditsPackage {
  id: PackageId
  /** Consulting credits added to the client's balance on purchase. */
  credits: number
  /** Price in whole GBP pounds. Formatted for PayPal via formatPayPalAmount(). */
  priceGBP: number
  /** Display-only savings badge. */
  saveLabel?: string
  /** Display-only "most popular" flag. */
  popular?: boolean
}

export const CREDIT_PACKAGES: CreditsPackage[] = [
  { id: "20c", credits: 20, priceGBP: 495 },
  { id: "40c", credits: 40, priceGBP: 950, saveLabel: "Save £40", popular: true },
  { id: "80c", credits: 80, priceGBP: 1800, saveLabel: "Save £180" },
]

/**
 * Legacy hours-era package ids, mapped to their credit-pack equivalents. Even
 * though prod has zero clients at merge time, a checkout whose PayPal popup
 * opened pre-deploy carries the old `reference_id` (5h/10h/20h) and must still
 * capture correctly post-deploy — so getPackage() resolves these aliases too.
 * Safe to remove once the handover has settled (no in-flight legacy orders).
 */
const LEGACY_PACKAGE_ALIASES: Record<string, PackageId> = {
  "5h": "20c",
  "10h": "40c",
  "20h": "80c",
}

/** ISO 4217 currency PayPal orders are denominated in. */
export const PAYPAL_CURRENCY = "GBP"

/**
 * Looks up a package by id, resolving legacy hours-era aliases. Returns
 * undefined for anything not in the catalogue so callers can reject
 * tampered/unknown ids with a 400 rather than charging an arbitrary amount.
 */
export function getPackage(id: string): CreditsPackage | undefined {
  const canonical = LEGACY_PACKAGE_ALIASES[id] ?? id
  return CREDIT_PACKAGES.find((p) => p.id === canonical)
}

/**
 * Formats a whole-pound price as the 2-decimal string PayPal's Orders API
 * requires for an amount value (e.g. 495 → "495.00").
 */
export function formatPayPalAmount(priceGBP: number): string {
  return priceGBP.toFixed(2)
}

/** Builds the PayPal purchase_unit description, e.g. "888 Safety — 20 Consulting Credits". */
export function packageDescription(pkg: CreditsPackage): string {
  return `888 Safety — ${pkg.credits} Consulting Credits`
}
