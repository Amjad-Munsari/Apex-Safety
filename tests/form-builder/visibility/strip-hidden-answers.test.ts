// Phase 15 Wave-0 stub — populated by Wave 1+
// Plan 15-02 Task 3 fills in the real assertions.
import { describe, it } from "vitest";

// NOTE: Do NOT statically import production modules — Wave 1 tasks add
// the `await import("@/lib/form-builder/visibility/...")` calls when they implement.

describe("stripHiddenAnswers — server-side scrub", () => {
  it.todo("hidden field is stripped from answers output");
  it.todo("cascade strip: hidden parent (sectionGroup) causes all children to be stripped");
  it.todo("per-instance repeatingSection scrub: each instance is evaluated independently and hidden instances are stripped");
  it.todo("hidden-but-required field is silently dropped without throwing an error");
});
