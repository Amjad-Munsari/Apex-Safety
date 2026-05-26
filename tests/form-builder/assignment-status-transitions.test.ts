// Wave-0 scaffold for Phase 16 D-08/D-10/D-11 — full assertions land in Plan 04
//
// D-08: form_assignments.status transitions: pending → in_progress on first
//       draft create or Fill-as-is click.
// D-10: form_assignments.status transitions: in_progress → completed on submit.
// D-11: backwards transition (completed → in_progress) is rejected by an
//       optimistic .eq("status", previous) guard before the UPDATE.
//
// Phase 16 Plan 16-01 (scaffold) → Plan 04 (implementation)

import { describe, it } from "vitest";

describe("assignment status transitions — Phase 16 D-08/D-10/D-11", () => {
  it.todo("pending → in_progress on first draft create or Fill-as-is click");
  it.todo("in_progress → completed on submit");
  it.todo("backwards transition completed → in_progress is rejected by optimistic .eq('status', previous)");
});
