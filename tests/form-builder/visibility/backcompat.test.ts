// Phase 15 Wave-0 stub — populated by Wave 1+
// Plan 15-01 Task 2 fills in the real assertions.
import { describe, it } from "vitest";

// NOTE: Do NOT statically import production modules — Wave 1 tasks add
// the `await import("@/lib/form-builder/visibility/...")` calls when they implement.

describe("backcompat — pre-Phase-15 schema validation (Pitfall 1)", () => {
  it.todo("load migration 011 seed schema via validateSchema and expect success AND every entity now has visibilityRules: { rules: [], logic: 'and' } post-validation");
});
