// Wave-0 scaffold for Phase 16 D-16 — full assertions land in Plan 06
//
// D-16: customer-built template fill inserts form_submissions with
//       assignment_id: null (no assignment row for customer-built templates).
//       client_id is taken from server context (getClientContext), never
//       from client-supplied input.
//
// Phase 16 Plan 16-01 (scaffold) → Plan 06 (implementation)

import { describe, it } from "vitest";

describe("customer self-fill submission — Phase 16 D-16", () => {
  it.todo("customer-built fill INSERTs form_submissions with assignment_id: null");
  it.todo("client_id is taken from server context, never client-supplied");
});
