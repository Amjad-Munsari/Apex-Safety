export type ComplianceStatus = "current" | "expiring" | "expired" | "undated"

export const EXPIRING_WINDOW_DAYS = 30
export const COMPLIANCE_TIME_ZONE = "Europe/London"

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function assertIsoDate(value: string): void {
  if (!ISO_DATE_RE.test(value)) {
    throw new Error(`Expected an ISO calendar date, received "${value}"`)
  }
  const parsed = new Date(`${value}T00:00:00Z`)
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
  ) {
    throw new Error(`Expected a valid ISO calendar date, received "${value}"`)
  }
}

/** The current business date, independent of the server's local time zone. */
export function todayIsoInTimeZone(
  now: Date = new Date(),
  timeZone: string = COMPLIANCE_TIME_ZONE
): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

export function addDaysToIsoDate(isoDate: string, days: number): string {
  assertIsoDate(isoDate)
  const date = new Date(`${isoDate}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

/** Whole calendar days until expiry. Zero means the expiry date is today. */
export function daysUntilExpiry(
  expiryIso: string,
  todayIso: string
): number {
  assertIsoDate(expiryIso)
  assertIsoDate(todayIso)
  const expiry = Date.parse(`${expiryIso}T00:00:00Z`)
  const today = Date.parse(`${todayIso}T00:00:00Z`)
  return Math.round((expiry - today) / 86_400_000)
}

/**
 * Compliance uses calendar dates, not instants. The existing alert contract
 * treats the expiry date itself as expired, 1–30 days as expiring, and more
 * than 30 days as current.
 */
export function complianceStatusForDate(
  expiryIso: string | null,
  todayIso: string
): ComplianceStatus {
  if (!expiryIso) return "undated"
  const days = daysUntilExpiry(expiryIso, todayIso)
  if (days <= 0) return "expired"
  if (days <= EXPIRING_WINDOW_DAYS) return "expiring"
  return "current"
}
