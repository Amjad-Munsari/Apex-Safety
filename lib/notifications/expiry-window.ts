// Pure date/window helpers for the expiry alert cron (app/api/cron/expiry).
//
// Extracted so the decision ladder is testable without standing up the whole
// handler. No I/O, no clock reads — the caller passes today's date in.
//
// History: the cron used to match three EXACT calendar dates
// (`.in("expiry_date", [day30, day14, day7])`), which made every alert a
// single-shot. A document uploaded fewer than 7 days before expiry matched no
// window at all, one missed run lost that window permanently, and nothing ever
// fired once a document was actually past its expiry date. The cron now matches
// a range and uses these helpers to pick one window per run, leaning on
// notifications_sent's UNIQUE (document_id, alert_window, notification_type) to
// keep it to one send per window.

/** Alert buckets. 0 is the post-expiry final notice. */
export type ExpiryAlertWindow = 0 | 7 | 14 | 30

export { daysUntilExpiry } from "@/lib/compliance/expiry-status"

/**
 * The SMALLEST window this document has already crossed.
 *
 * Returning only the smallest is what stops back-fill spam: a document first
 * seen 5 days out gets the 7-day notice and is never also sent the 30- and
 * 14-day notices it slept through. Because each window is a distinct dedup key,
 * a document counting down normally still receives 30 → 14 → 7 → expired, one
 * of each.
 */
export function selectExpiryAlertWindow(days: number): ExpiryAlertWindow {
  if (days <= 0) return 0
  if (days <= 7) return 7
  if (days <= 14) return 14
  return 30
}
