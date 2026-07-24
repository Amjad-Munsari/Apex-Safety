import { describe, it, expect } from "vitest"
import { hoursToCredits } from "@/lib/billing/credits"

describe("hoursToCredits", () => {
  it("converts whole hours at the reference rate", () => {
    expect(hoursToCredits(1, 4)).toBe(4)
    expect(hoursToCredits(5, 4)).toBe(20)
    expect(hoursToCredits(10, 4)).toBe(40)
  })

  it("rounds the magnitude to whole credits, symmetric across sign at odd rates", () => {
    // 1.5h × 5 = 7.5 → rounds to 8; the sign is reapplied AFTER rounding, so
    // +1.5h and −1.5h stay symmetric (a naive Math.round(-7.5) would give −7).
    expect(hoursToCredits(1.5, 5)).toBe(8)
    expect(hoursToCredits(-1.5, 5)).toBe(-8)
  })

  it("returns zero when the rounded magnitude is zero", () => {
    expect(hoursToCredits(0, 4)).toBe(0)
    // 0.1h × 4 = 0.4 → rounds to 0.
    expect(hoursToCredits(0.1, 4)).toBe(0)
  })

  it("rounds manually-typed off-step values", () => {
    // 0.5h × 5 = 2.5 → 3 (banker-free Math.round rounds .5 up).
    expect(hoursToCredits(0.5, 5)).toBe(3)
    // 2.3h × 4 = 9.2 → 9.
    expect(hoursToCredits(2.3, 4)).toBe(9)
  })
})
