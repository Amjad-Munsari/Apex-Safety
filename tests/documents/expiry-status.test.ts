import { describe, expect, it } from "vitest"
import {
  addDaysToIsoDate,
  complianceStatusForDate,
  daysUntilExpiry,
  todayIsoInTimeZone,
} from "@/lib/compliance/expiry-status"
import { ragToneFromDays } from "@/lib/ui/rag-tone"

describe("compliance expiry status", () => {
  it("uses one explicit set of day thresholds", () => {
    const today = "2026-07-25"
    expect(complianceStatusForDate(null, today)).toBe("undated")
    expect(complianceStatusForDate("2026-07-25", today)).toBe("expired")
    expect(complianceStatusForDate("2026-07-26", today)).toBe("expiring")
    expect(complianceStatusForDate("2026-08-24", today)).toBe("expiring")
    expect(complianceStatusForDate("2026-08-25", today)).toBe("current")
    expect(ragToneFromDays(0)).toBe("expired")
    expect(ragToneFromDays(30)).toBe("expiring")
    expect(ragToneFromDays(31)).toBe("ok")
  })

  it("does not drift across month, year, or daylight-saving boundaries", () => {
    expect(daysUntilExpiry("2026-08-01", "2026-07-31")).toBe(1)
    expect(daysUntilExpiry("2027-01-01", "2026-12-31")).toBe(1)
    expect(daysUntilExpiry("2026-10-26", "2026-10-25")).toBe(1)
    expect(addDaysToIsoDate("2026-12-31", 1)).toBe("2027-01-01")
  })

  it("uses the UK business date rather than the deployment host date", () => {
    const nearMidnightUtc = new Date("2026-07-25T23:30:00Z")
    expect(todayIsoInTimeZone(nearMidnightUtc, "UTC")).toBe("2026-07-25")
    expect(todayIsoInTimeZone(nearMidnightUtc, "Europe/London")).toBe(
      "2026-07-26"
    )
  })
})
