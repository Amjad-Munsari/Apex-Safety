// Phase 15 Wave-0 stub — populated by Wave 1+
// Plan 15-03 Task 1 fills in the real assertions.
import { describe, it } from "vitest";

// NOTE: Do NOT statically import production modules — Wave 1 tasks add
// the `await import("@/lib/form-builder/visibility/...")` calls when they implement.

describe("buildDependencyMap — edge construction", () => {
  it.todo("direct edges: each entity's visibilityRules sources map to direct sourceEntityId → dependentEntityId edges");
  it.todo("computed edges: computedField's computedInputs create input → computedFieldId → dependent edges (D-02)");
});
