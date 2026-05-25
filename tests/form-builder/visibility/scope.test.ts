// Phase 15 Wave-0 stub — populated by Wave 1+
// Plan 15-03 Task 1 fills in the real assertions.
import { describe, it } from "vitest";

// NOTE: Do NOT statically import production modules — Wave 1 tasks add
// the `await import("@/lib/form-builder/visibility/...")` calls when they implement.

describe("resolveScope — entity scope resolution", () => {
  it.todo("resolveScope returns 'root' for a root-level entity (not inside any container)");
  it.todo("resolveScope returns the sectionGroup's parent id for a child of sectionGroup");
  it.todo("resolveScope returns the repeatingSection id for a child of repeatingSection");
});
