import { describe, it, expect } from "vitest";
import { isOverdue, daysOverdue } from "@/lib/assignments/is-overdue";

describe("isOverdue / daysOverdue (Phase 17)", () => {
  it("returns false for null due date", () => {
    expect(isOverdue(null)).toBe(false);
    expect(daysOverdue(null)).toBe(0);
  });

  it("returns false for a far-future date (2099-12-31 is not overdue)", () => {
    expect(isOverdue("2099-12-31")).toBe(false);
    expect(daysOverdue("2099-12-31")).toBe(0);
  });

  it("returns true for a far-past date (2000-01-01 is overdue) and daysOverdue is >= 9000", () => {
    expect(isOverdue("2000-01-01")).toBe(true);
    expect(daysOverdue("2000-01-01")).toBeGreaterThanOrEqual(9000);
  });

  it("returns false for today's date string (today is NOT overdue — < semantics, not <=)", () => {
    // Build today's date string from local date components (not UTC) to match the
    // "today at local midnight" anchor in todayMidnight(). Using toISOString().slice(0,10)
    // would give the UTC calendar date, which differs from the local date in non-UTC
    // timezones and causes a false positive (Rule 1 auto-fix — timezone correctness).
    const d = new Date();
    const todayLocal = [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, "0"),
      String(d.getDate()).padStart(2, "0"),
    ].join("-");
    expect(isOverdue(todayLocal)).toBe(false);
    expect(daysOverdue(todayLocal)).toBe(0);
  });
});
