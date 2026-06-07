---
phase: 17
plan: "02"
subsystem: scheduler
tags: [scheduler, recurrence, n8n, vitest, multi-tenancy, pure-functions]
dependency_graph:
  requires: [17-01]
  provides: [lib/scheduler/generate-next-occurrence.ts, lib/scheduler/send-reminder.ts]
  affects: [17-04, 17-05]
tech_stack:
  added: []
  patterns:
    - SupabaseClient stub (chainable builder objects, no vi.mock for Supabase)
    - vi.mock hoisting-safe pattern for dispatchNotification
    - Pure-module TDD with injected SupabaseClient
key_files:
  created:
    - lib/scheduler/generate-next-occurrence.ts
    - lib/scheduler/send-reminder.ts
  modified:
    - tests/scheduler/recurrence-generator.spec.ts
    - tests/scheduler/send-reminder.spec.ts
decisions:
  - "Pure modules (no next/* imports, no process.env in generator) so cron handler and Vitest can both import without HTTP harness"
  - "SupabaseClient injected as parameter — tests build chainable stub objects instead of vi.mock(supabase)"
  - "Frequency validation against 4-value vocab at runtime per T-17-06 mitigation"
metrics:
  duration: "~8 minutes"
  completed: "2026-05-27"
  tasks: 2
  files: 4
---

# Phase 17 Plan 02: Pure Scheduler Functions Summary

**One-liner:** Pure async `generateNextOccurrence` (Supabase-client-injected recurrence generator) and `sendAssignmentReminder` (n8n dispatch wrapper), both fully unit-tested with stub Supabase clients and vi.mock hoisting.

---

## Exported Surface

### `lib/scheduler/generate-next-occurrence.ts`

```ts
export type Frequency = "weekly" | "monthly" | "quarterly" | "annually";
export interface RecurrenceRule { frequency: Frequency }
export interface SourceAssignment {
  id: string; client_id: string; template_id: string;
  assigned_by: string | null; instructions: string | null;
  due_date: string | null; recurrence_rule: unknown;
}
export type GenerateResult =
  | { ok: true; newAssignmentId: string }
  | { ok: false; reason: string };
export async function generateNextOccurrence(
  supabase: SupabaseClient, src: SourceAssignment
): Promise<GenerateResult>
```

Short-circuits: `no_recurrence_rule` (null or unknown frequency), `no_due_date`, `no_published_version` (maybeSingle miss), `insert_failed` (DB error or null data).

Re-pins `template_version_id` to latest published version via the canonical `.not("published_at","is",null).order("version_number",{ascending:false}).limit(1).maybeSingle()` chain (mirrors `app/client/templates/[id]/fill/page.tsx:52-59`).

Computes `new due_date` by adding frequency to **prior** `due_date` (not today). Inherits `client_id`, `template_id`, `assigned_by`, `instructions`, `recurrence_rule` from source row (server-side carryover, T-16-04).

**Pure module invariants:** zero `process.env` reads, zero `next/*` imports.

### `lib/scheduler/send-reminder.ts`

```ts
export async function sendAssignmentReminder(args: {
  cadence: "7d" | "1d" | "overdue";
  client_email: string; client_name: string;
  template_name: string; due_date: string;
  assignmentId: string; instructions: string | null;
}): Promise<DispatchResult>
```

Builds `base` via `NEXT_PUBLIC_SITE_URL ?? (VERCEL_URL ? "https://" + VERCEL_URL : "")` (RESEARCH §Pattern 5). Calls `dispatchNotification` with `type:"assignment_reminder"` and returns the result verbatim — never swallows `ok:false`.

No `"use server"` directive, no `next/*` imports — runtime-agnostic.

---

## SupabaseClient Stub Idiom (recurrence-generator.spec.ts)

The generator accepts `SupabaseClient` as a parameter, so tests build lightweight chainable stubs instead of `vi.mock`-ing Supabase. Each chain method returns `this` until the terminal method returns a `Promise`:

```ts
const versionsChain = {
  select: () => versionsChain,
  eq:     () => versionsChain,
  not:    () => versionsChain,
  order:  () => versionsChain,
  limit:  () => versionsChain,
  maybeSingle: () => Promise.resolve(opts.versionsResult),
};
```

`form_assignments` insert chain: `.insert(payload)` records the payload via `insertSpy`, then `.select().single()` resolves to `opts.insertResult`. No HTTP harness, no `createClient` mock needed.

---

## vi.mock Hoisting Pattern (send-reminder.spec.ts)

Mirrors Plan 16-04 Task 2b §Deviation 3. The spy is declared **before** the `vi.mock` factory so the hoisted factory can close over it:

```ts
const dispatchSpy = vi.fn();

vi.mock("@/lib/notifications/n8n-dispatch", () => ({
  dispatchNotification: (...args) => dispatchSpy(...args),
}));

import { sendAssignmentReminder } from "@/lib/scheduler/send-reminder";
```

`beforeEach`/`afterEach` snapshot and restore `process.env.NEXT_PUBLIC_SITE_URL` and `process.env.VERCEL_URL` to prevent env bleed between tests.

---

## Vitest Output — tests/scheduler/

```
tests/scheduler/cron-reminder-decision.spec.ts  [ 6 todo — Plan 17-05 scaffold, untouched ]
tests/scheduler/is-overdue.test.ts              ✓ 4 passing
tests/scheduler/send-reminder.spec.ts           ✓ 3 passing
tests/scheduler/recurrence-generator.spec.ts    ✓ 6 passing

Test Files  3 passed | 1 skipped (4)
Tests       13 passed | 6 todo (19)
```

Total passing in the scheduler suite: **13** (4 is-overdue + 6 recurrence-generator + 3 send-reminder).

---

## Plan 17-04 Dependency

Plan 17-04 will import both functions into the cron handler and the inline submit trigger:

- **`generateNextOccurrence`** — called in PASS B of `app/api/cron/assignment-scheduler/route.ts` AND inline inside `submitAssignedFillByIdAction` (after `transitionAssignmentStatus(...,"completed")`). The inline call provides immediate recurrence for the client; PASS B is the idempotency safety net.
- **`sendAssignmentReminder`** — called in PASS A of the cron handler per assignment cadence decision. Caller (Plan 17-04) is responsible for NOT writing `last_reminder_sent` when this returns `ok:false`.

---

## Deviations from Plan

None — plan executed exactly as written. Both functions match the byte-faithful reference implementations from RESEARCH §Example 2 and §Example 3.

---

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. Both files are pure computation modules. The trust boundary analysis in the plan's `<threat_model>` (T-17-04 through T-17-07) is fully honoured:

- T-17-04: `client_id` is inherited from `src` (server-side row), never from a request payload.
- T-17-06: frequency vocab validated at runtime; unknown strings return `{ok:false, reason:"no_recurrence_rule"}`.
- T-17-07: URL construction tested in Test 1 of send-reminder spec.

## Self-Check: PASSED

Files verified to exist:
- `lib/scheduler/generate-next-occurrence.ts` — FOUND
- `lib/scheduler/send-reminder.ts` — FOUND
- `tests/scheduler/recurrence-generator.spec.ts` — FOUND (6 it blocks, 0 todos)
- `tests/scheduler/send-reminder.spec.ts` — FOUND (3 it blocks, 0 todos)

Commits verified:
- `8c6bf16` — feat(17-02): implement generateNextOccurrence + fill recurrence-generator spec
- `4c05914` — feat(17-02): implement sendAssignmentReminder + fill send-reminder spec
