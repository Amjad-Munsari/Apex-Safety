// Phase 17 Plan 03 — OverduePill rendering rules
//
// Asserts: (a) renders when daysOverdue >= 1, (b) returns null when
// daysOverdue < 1, (c) returns null when status === "completed",
// (d) aria-label pluralisation.
//
// Pattern: call component as a pure function (no hooks) and inspect
// the returned ReactElement. No @testing-library/react required.

import { describe, it, expect } from "vitest";
import { OverduePill } from "@/app/_components/overdue-pill";

describe("OverduePill — rendering rules", () => {
  it("renders when daysOverdue >= 1 (e.g. 5 days overdue)", () => {
    const result = OverduePill({ daysOverdue: 5 });

    expect(result).not.toBeNull();
    expect(result!.props.className).toContain("text-danger");
    expect(result!.props.className).toContain("bg-danger/10");
    expect(result!.props.children).toBe("OVERDUE");
  });

  it("returns null when daysOverdue <= 0 (e.g. 0 days)", () => {
    const result = OverduePill({ daysOverdue: 0 });
    expect(result).toBeNull();
  });

  it("returns null when status === 'completed' even if daysOverdue >= 1", () => {
    const result = OverduePill({ daysOverdue: 5, status: "completed" });
    expect(result).toBeNull();
  });

  it("produces correct aria-label pluralisation", () => {
    const singular = OverduePill({ daysOverdue: 1 });
    const plural = OverduePill({ daysOverdue: 2 });

    expect(singular).not.toBeNull();
    expect(plural).not.toBeNull();

    expect(singular!.props["aria-label"]).toContain("1 day ago");
    expect(plural!.props["aria-label"]).toContain("2 days ago");
  });
});
