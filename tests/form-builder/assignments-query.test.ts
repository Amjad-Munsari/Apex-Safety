// Wave-0 scaffold for Phase 16 D-08 (query shape) — full assertions land in Plan 04
//
// The /client/assignments page query must:
//   - Filter .is("deleted_at", null) to exclude soft-deleted assignments
//   - Filter .eq("client_id", ctx.client_id) for org-scoped results
//
// Phase 16 Plan 16-01 (scaffold) → Plan 04 (implementation)

import { describe, it } from "vitest";

describe("assignments list query — Phase 16 D-08", () => {
  it.todo("/client/assignments page query includes .is('deleted_at', null) and .eq('client_id', ctx.client_id)");
});
