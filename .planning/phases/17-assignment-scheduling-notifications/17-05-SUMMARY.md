---
phase: 17
plan: "05"
subsystem: assignment-scheduling
tags: [vitest, cron, idempotency, scheduler, regression]
dependency_graph:
  requires: [17-02, 17-04]
  provides: [cron-regression-spec]
  affects: [tests/scheduler/cron-reminder-decision.spec.ts]
tech_stack:
  added: []
  patterns:
    - Vitest 3 hoisting-safe vi.mock pattern (spies declared before vi.mock, factory wraps via arrow)
    - Thenable chainable Supabase stub (`.then(onFulfilled)` method for direct-await PostgREST chains)
    - Per-test supabaseFromSpy.mockImplementation routing by table name + consumed-flag
key_files:
  created: []
  modified:
    - tests/scheduler/cron-reminder-decision.spec.ts
decisions:
  - "Thenable chainable pattern: each stub exposes .then(onFulfilled) so `await supabase.from(X).select()...` resolves to {data, error} without a terminal method"
  - "consumed-flag routing: supabaseFromSpy.mockImplementation checks `passAConsumed` boolean to distinguish first PASS A SELECT from the subsequent UPDATE call on the same table"
  - "Test 5 idempotency uses two separate chain captures: workflowErrorsChain (asserted called) + updateChain (asserted NOT called) to make the two-part contract explicit"
  - "Pre-existing specialty-entities.test.ts failures (4 tests) are out-of-scope — confirmed pre-existing before Plan 17-05 changes, logged to deferred-items.md"
metrics:
  duration: "~20 minutes"
  completed: "2026-05-27"
  tasks_completed: 1
  files_changed: 1
---

# Phase 17 Plan 05: Cron Reminder Decision Spec Summary

**One-liner:** Vitest regression spec for the cron route handler filling 7 filled `it()` blocks that cover auth gate, PASS A filter chain (Pitfall 5), cadence decision ladder (7d/1d/overdue), and the idempotency-on-failure contract (workflow_errors inserted + last_reminder_sent NOT written).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Fill cron-reminder-decision spec with 7 assertions | e2b6d4d | tests/scheduler/cron-reminder-decision.spec.ts (REWRITE) |

## Spy / Mock Topology

### vi.mock factories (hoisting-safe pattern)

```ts
const sendReminderSpy = vi.fn();
const generatorSpy = vi.fn();
const supabaseFromSpy = vi.fn();

vi.mock("@/lib/scheduler/send-reminder", () => ({
  sendAssignmentReminder: (...a: unknown[]) => sendReminderSpy(...a),
}));
vi.mock("@/lib/scheduler/generate-next-occurrence", () => ({
  generateNextOccurrence: (...a: unknown[]) => generatorSpy(...a),
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ from: (t: string) => supabaseFromSpy(t) }),
}));
```

All spies are declared before `vi.mock` calls. Factory wrappers are arrow functions that close over the spy at call time — safe for Vitest hoisting.

### Chainable Supabase stub strategy

The cron route awaits the PostgREST builder chain directly (e.g. `await supabase.from("form_assignments").select(...).is(...).neq(...).not(...)`). The stub's `.then(onFulfilled)` method makes the chain thenable, resolving to per-test `{ data, error }`.

All chainable methods (`.select`, `.is`, `.neq`, `.not`, `.eq`, `.limit`, `.update`, `.insert`, `.order`) are `vi.fn()` instances that return `this`, enabling arbitrary chaining depth with assertion support.

Per-test `supabaseFromSpy.mockImplementation((table) => ...)` routes calls by table name using consumed-flag booleans to distinguish PASS A SELECT (first `form_assignments` call) from subsequent UPDATE / PASS B SELECT calls.

## Test Names and Assertions

| Test | Name | What it asserts |
|------|------|-----------------|
| 1 | Auth gate — 401 on missing header | Response status 401, body `{ error: "Unauthorized" }` when CRON_SECRET set and no Authorization header |
| 2 | Auth gate passes with correct header | Response status 200, body `{ success: true, remindersSent: 0, recurrencesGenerated: 0 }` on empty run |
| 3 | Cadence "7d" | `sendReminderSpy` called with `cadence: "7d"` + `.update({ last_reminder_sent: "7d" }).eq("id", "asg-1")` |
| 4 | Cadence "overdue" + idempotency on success | `sendReminderSpy` called with `cadence: "overdue"` + dedup `.update({ last_reminder_sent: "overdue" })` |
| 5 | Idempotency on failure (T-17-23) | (a) `workflowErrorsChain.insert` called with `{ workflow_name: "assignment_reminder", error_message: "webhook 500" }` AND (b) `updateChain.update` was NOT called |
| 6 | Filter chain (T-17-21 Pitfall 5) | `passAChain.is("deleted_at", null)`, `.neq("status", "completed")`, `.not("due_date", "is", null)` all invoked |
| 7 | Cadence "1d" | `sendReminderSpy` called with `cadence: "1d"` when `due_date === today+1` and `last_reminder_sent === null` |

## Phase 17 Vitest Test Count (running total)

| Spec file | Tests | Plan |
|-----------|-------|------|
| tests/scheduler/is-overdue.test.ts | 4 | 17-01/17-02 |
| tests/scheduler/recurrence-generator.spec.ts | 6 | 17-02 |
| tests/scheduler/send-reminder.spec.ts | 3 | 17-02 |
| tests/scheduler/cron-reminder-decision.spec.ts | 7 | 17-05 (this plan) |
| tests/form-builder/overdue-pill.test.ts | 4 | 17-03 |
| tests/form-builder/assignments-query.test.ts | 3 | 17-03 |
| **Total Phase 17 new tests** | **27** | |

## Deviations from Plan

### Pre-existing failures logged (out of scope)

**1. [Out of scope] specialty-entities.test.ts — 4 pre-existing failures**
- **Found during:** form-builder regression sweep
- **Issue:** 4 tests in `tests/form-builder/specialty-entities.test.ts` assert `toHaveLength(4)` on attribute arrays, but the entities have 5 attributes. These failures exist on the base commit (9e67413) before any Plan 17-05 changes — confirmed via `git stash` + re-run.
- **Fix:** None — out of scope for Plan 17-05 (plan modifies only scheduler spec). Logged to deferred-items.md.
- **Files modified:** None

No other deviations — plan executed exactly as written.

## Blocker: Plan 17-06 is the BLOCKING gate

Plan 17-06 owns the BLOCKING gate for Phase 17:
- Pushes migration 015 (new columns: `recurrence_rule`, `last_reminder_sent`, `recurrence_generated_at`, `parent_assignment_id`)
- Regenerates TypeScript types from the updated schema
- Runs the full Phase-17 + Phase-16 spec sweep (24+ tests) to confirm zero regressions
- Produces UAT.md for Matt/Finley sign-off on the n8n webhook and cron schedule

**Plan 17-05 does NOT push migration or regen types.** The cron handler currently runs with type-loose column access. Plan 17-06 is the gate that makes Phase 17 production-ready.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. This plan modifies only a test file — no production code changes.

## Self-Check: PASSED

- [x] `tests/scheduler/cron-reminder-decision.spec.ts` exists with 7 `it()` blocks and zero `it.todo` entries
- [x] Commit e2b6d4d exists in git log
- [x] `npm test -- tests/scheduler/ --run` exits 0 (20 passing tests across 4 spec files)
- [x] `npm test -- tests/scheduler/cron-reminder-decision.spec.ts --run` exits 0 (7 passing tests)
- [x] Pre-existing `specialty-entities.test.ts` failures confirmed pre-existing (not introduced by this plan)
- [x] No modifications to STATE.md or ROADMAP.md
- [x] No writes to main repo path
