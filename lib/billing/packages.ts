/**
 * Canonical consulting-hours package catalogue.
 *
 * Single source of truth shared by the client billing UI and the server-side
 * PayPal routes. Contains NO secrets, so it is safe to import in both the
 * browser bundle and server code. The server routes validate an incoming
 * `packageId` against this list and derive the GBP amount from it — the browser
 * never gets to name its own price (price-manipulation guard, see
 * app/api/paypal/create-order + capture-order).
 */

export type PackageId = "5h" | "10h" | "20h"

export interface HoursPackage {
  id: PackageId
  /** Consulting hours credited to the client's balance on purchase. */
  hours: number
  /** Price in whole GBP pounds. Formatted for PayPal via formatPayPalAmount(). */
  priceGBP: number
  /** Display-only effective per-hour rate (UI badge). */
  perHour: number
  /** Display-only savings badge. */
  saveLabel?: string
  /** Display-only "most popular" flag. */
  popular?: boolean
}

export const HOURS_PACKAGES: HoursPackage[] = [
  { id: "5h", hours: 5, priceGBP: 495, perHour: 99 },
  { id: "10h", hours: 10, priceGBP: 950, perHour: 95, saveLabel: "Save £40", popular: true },
  { id: "20h", hours: 20, priceGBP: 1800, perHour: 90, saveLabel: "Save £180" },
]

/** ISO 4217 currency PayPal orders are denominated in. */
export const PAYPAL_CURRENCY = "GBP"

/**
 * Looks up a package by id. Returns undefined for anything not in the catalogue
 * so callers can reject tampered/unknown ids with a 400 rather than charging an
 * arbitrary amount.
 */
export function getPackage(id: string): HoursPackage | undefined {
  return HOURS_PACKAGES.find((p) => p.id === id)
}

/**
 * Formats a whole-pound price as the 2-decimal string PayPal's Orders API
 * requires for an amount value (e.g. 495 → "495.00").
 */
export function formatPayPalAmount(priceGBP: number): string {
  return priceGBP.toFixed(2)
}

/** Builds the PayPal purchase_unit description, e.g. "888 Safety — 5 Consulting Hours". */
export function packageDescription(pkg: HoursPackage): string {
  return `888 Safety — ${pkg.hours} Consulting Hours`
}
