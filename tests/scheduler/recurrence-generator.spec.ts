// Wave-0 scaffold for Phase 17 §Q3 + §Example 2 — full assertions land in Plan 17-02.

import { describe, it } from "vitest";

describe("generateNextOccurrence (Phase 17)", () => {
  it.todo("Plan 17-02: returns ok:false when recurrence_rule is null");
  it.todo("Plan 17-02: returns ok:false when due_date is null");
  it.todo("Plan 17-02: returns ok:false when template has no published version (latest-published lookup miss)");
  it.todo("Plan 17-02: computes new due_date by adding frequency to PRIOR due_date (not today)");
  it.todo("Plan 17-02: new row inherits client_id, template_id, assigned_by, instructions, recurrence_rule");
  it.todo("Plan 17-02: new row's template_version_id is re-pinned to LATEST published, not the prior occurrence's pin");
});
