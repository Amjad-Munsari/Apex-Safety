// Regression spec for the expiry alert window ladder.
//
// The bug this pins: the cron matched three EXACT calendar dates, so an alert
// was a single-shot on one day. A document uploaded fewer than 7 days before
// expiry matched no window and was never alerted at all; one missed run lost
// that window permanently; and nothing fired once a document was actually past
// its expiry date. The ladder below is what makes a range query safe — it picks
// only the smallest crossed window, so catching up never back-fills.

import { describe, it, expect } from "vitest"
import { daysUntilExpiry, selectExpiryAlertWindow } from "@/lib/notifications/expiry-window"

describe("daysUntilExpiry", () => {
  it("counts whole days forward", () => {
    expect(daysUntilExpiry("2026-08-01", "2026-07-25")).toBe(7)
    expect(daysUntilExpiry("2026-08-24", "2026-07-25")).toBe(30)
  })

  it("returns 0 on the expiry day and negatives once past", () => {
    expect(daysUntilExpiry("2026-07-25", "2026-07-25")).toBe(0)
    expect(daysUntilExpiry("2026-07-20", "2026-07-25")).toBe(-5)
  })

  it("does not drift across a month or year boundary", () => {
    expect(daysUntilExpiry("2026-08-01", "2026-07-31")).toBe(1)
    expect(daysUntilExpiry("2027-01-01", "2026-12-31")).toBe(1)
  })

  it("does not drift across a BST→GMT transition (UTC-pinned)", () => {
    // 25 Oct 2026 is the UK clock change; a local-time implementation would
    // return 0 or 2 here depending on the host.
    expect(daysUntilExpiry("2026-10-26", "2026-10-25")).toBe(1)
  })

  it("throws on an unparseable date rather than silently bucketing wrongly", () => {
    expect(() => daysUntilExpiry("not-a-date", "2026-07-25")).toThrow()
  })
})

describe("selectExpiryAlertWindow", () => {
  it("buckets a normal countdown into 30 → 14 → 7", () => {
    expect(selectExpiryAlertWindow(30)).toBe(30)
    expect(selectExpiryAlertWindow(20)).toBe(30)
    expect(selectExpiryAlertWindow(15)).toBe(30)
    expect(selectExpiryAlertWindow(14)).toBe(14)
    expect(selectExpiryAlertWindow(8)).toBe(14)
    expect(selectExpiryAlertWindow(7)).toBe(7)
    expect(selectExpiryAlertWindow(1)).toBe(7)
  })

  it("gives a document first seen inside 7 days an alert at all (was zero)", () => {
    // The old exact-date match never equalled day30/day14/day7 for these, so
    // they expired in silence.
    expect(selectExpiryAlertWindow(5)).toBe(7)
    expect(selectExpiryAlertWindow(3)).toBe(7)
  })

  it("fires the post-expiry final notice on and after the expiry day", () => {
    expect(selectExpiryAlertWindow(0)).toBe(0)
    expect(selectExpiryAlertWindow(-1)).toBe(0)
    expect(selectExpiryAlertWindow(-29)).toBe(0)
  })

  it("picks only the smallest crossed window, so a late run never back-fills", () => {
    // A run that missed the 30- and 14-day marks and first sees the doc at 6
    // days must send ONE notice (7), not three.
    expect(selectExpiryAlertWindow(6)).toBe(7)
    expect(selectExpiryAlertWindow(6)).not.toBe(30)
    expect(selectExpiryAlertWindow(6)).not.toBe(14)
  })

  it("is stable across a whole countdown: one window per band, in order", () => {
    const seen = [40, 30, 21, 14, 10, 7, 4, 1, 0, -2].map(selectExpiryAlertWindow)
    expect(seen).toEqual([30, 30, 30, 14, 14, 7, 7, 7, 0, 0])
    // Monotonically non-increasing — a document can never move back to a wider
    // window and re-alert.
    for (let i = 1; i < seen.length; i++) {
      expect(seen[i]).toBeLessThanOrEqual(seen[i - 1])
    }
  })
})
