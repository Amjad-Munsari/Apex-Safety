// Phase 14-06 focus-loss invariant — these tests guard `[surface]` useMemo deps
// Phase 15 Wave-0 stub — populated by Wave 1+
// Plan 15-04 Task 1 fills in the real assertions.
import { describe, it } from "vitest";

// NOTE: Do NOT statically import production modules — Wave 1 tasks add
// the `await import("@/...")` calls when they implement.
// This file uses .tsx extension so the TSX/JSX collector picks it up.

describe("visibility-renderer — entity hide/show integration", () => {
  it.todo("entity returning shouldBeProcessed=false is NOT in the DOM after a setEntityValue triggers a hide rule");
  it.todo("focus is retained on a neighbouring text input across a hide/show flip (the Phase 14-06 focus-loss invariant)");
  it.todo("Select field stays controlled (value does not reset to undefined) when its source entity value flips between defined and undefined");
  it.todo("dynamicRequired prop drives the asterisk and submit-block UX for fields with a require rule");
});
