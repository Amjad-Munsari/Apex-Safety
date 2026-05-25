// Phase 15 Wave-0 stub — populated by Wave 1+
// Plan 15-02 Task 2 fills in the real assertions.
import { describe, it } from "vitest";

// NOTE: Do NOT statically import production modules — Wave 1 tasks add
// the `await import("@/lib/form-builder/visibility/...")` calls when they implement.

describe("evaluateVisibility — integration (evaluate + combine + cascade)", () => {
  it.todo("basic integration: entity with matching show rule is visible in result");
  it.todo("require rule fires: entity with matching require rule has required=true in result");
  it.todo("hidden trumps required (D-07): entity hidden by a hide rule is not required even if a require rule fires");
});
