// Phase 15 Wave-0 stub — populated by Wave 1+
// Plan 15-03 Task 2 fills in the real assertions.
import { describe, it } from "vitest";

// NOTE: Do NOT statically import production modules — Wave 1 tasks add
// the `await import("@/lib/form-builder/visibility/...")` calls when they implement.

describe("validateRuleGraph — cycle detection + scope validation (D-08/D-09)", () => {
  it.todo("linear chain (A→B→C with no back-edge) passes validation successfully");
  it.todo("direct cycle A→B→A is rejected with an error listing both entity IDs");
  it.todo("computed-mediated cycle (A→computedField→B→A) is rejected (Pitfall 8)");
  it.todo("ancestor-scope reference (field inside repeatingSection references root field) passes validation (D-03)");
  it.todo("cross-instance reference is rejected with reason='cross-instance'");
  it.todo("root field referencing a field inside a repeatingSection is rejected with reason='root-references-inside-repeating'");
  it.todo("orphan sourceEntityId (references non-existent entity) emits an advisory entry, does not hard-reject");
});
