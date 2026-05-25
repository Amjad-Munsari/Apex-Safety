// Phase 15 Wave-0 stub — populated by Wave 1+
// Plan 15-04 Task 2 fills in the real assertions.
import { describe, it } from "vitest";

// NOTE: Do NOT statically import production modules — Wave 1 tasks add
// the `await import("@/lib/form-builder/...")` calls when they implement.

describe("computeFormProgress — visibility-aware extension", () => {
  it.todo("computeFormProgress with visibility=undefined matches pre-Phase-15 behaviour (backward-compat)");
  it.todo("hidden entity is excluded from the required denominator when visibility is provided");
  it.todo("dynamic-required (require rule fired) is counted in denominator only when the entity is visible");
});
