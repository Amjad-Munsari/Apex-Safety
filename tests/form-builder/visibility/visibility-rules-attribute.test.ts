// Phase 15 Wave-0 stub — populated by Wave 1+
// Plan 15-01 Task 1 fills in the real assertions.
import { describe, it } from "vitest";

// NOTE: Do NOT statically import production modules — Wave 1 tasks add
// the `await import("@/lib/form-builder/visibility/...")` calls when they implement.

describe("visibilityRulesAttribute.validate — default coercion", () => {
  it.todo("undefined coerces to { rules: [], logic: 'and' } without throwing");
  it.todo("null coerces to { rules: [], logic: 'and' } without throwing");
  it.todo("wrong-shape root (non-object) throws a descriptive Error");
  it.todo("rule with bad operator throws Error with message containing 'Rule #i'");
  it.todo("rule with bad action throws Error with message containing 'Rule #i'");
});
