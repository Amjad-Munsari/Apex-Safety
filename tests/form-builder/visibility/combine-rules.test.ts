// Phase 15 Wave-0 stub — populated by Wave 1+
// Plan 15-02 Task 1 fills in the real assertions.
import { describe, it } from "vitest";

// NOTE: Do NOT statically import production modules — Wave 1 tasks add
// the `await import("@/lib/form-builder/visibility/...")` calls when they implement.

describe("combineShowHide — AND/OR truth table", () => {
  it.todo("AND logic: all show rules fire → entity is visible");
  it.todo("AND logic: one show rule does not fire → entity is not shown");
  it.todo("OR logic: at least one show rule fires → entity is visible");
  it.todo("OR logic: no show rules fire → entity is not visible");
});

describe("combineShowHide — hide-wins-over-show (D-07)", () => {
  it.todo("when both show and hide rules fire for the same entity, hide wins");
});
