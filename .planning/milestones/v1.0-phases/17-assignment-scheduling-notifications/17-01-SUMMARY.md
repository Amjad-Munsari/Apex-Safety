---
phase: 17
plan: "01"
plan_id: 17-01
subsystem: scheduler
tags: [supabase, schema-migration, vitest, shared-lib, n8n, multi-tenancy]
dependency_graph:
  requires: [phase-16-schema]
  provides: [migration-015-file, lib/assignments/is-overdue, n8n-assignment_reminder-variant, tests/scheduler]
  affects: [plan-17-02, plan-17-03, plan-17-04, plan-17-05, plan-17-06]
tech_stack:
  added: [lib/assignments/is-overdue.ts]
  patterns: [discriminated-union-extension, extracted-pure-helper, wave-0-scaffold]
key_files:
  created:
    - supabase/migrations/015_phase17_assignment_recurrence_reminders.sql
    - lib/assignments/is-overdue.ts
    - tests/scheduler/is-overdue.test.ts
    - tests/scheduler/recurrence-generator.spec.ts
    - tests/scheduler/send-reminder.spec.ts
    - tests/scheduler/cron-reminder-decision.spec.ts
  modified:
    - lib/notifications/n8n-dispatch.ts
    - vitest.config.ts
decisions:
  - Migration 015 authored but NOT pushed (push deferred to Plan 17-06 Wave 4)
  - isOverdue uses local-midnight anchor not UTC midnight to match existing card semantics
  - Test today-date computed from local date components (not toISOString) for non-UTC timezone correctness
  - assignment_reminder union added to n8n-dispatch.ts; dispatchNotification unchanged
metrics:
  duration: 8m 16s
  completed: 2026-05-27
  tasks_completed: 3
  tasks_total: 3
  files_created: 6
  files_modified: 2
---

# Phase 17 Plan 01: Schema + Shared Lib + n8n Contract + Test Infrastructure Summary

**One-liner:** Migration 015 (recurrence_rule/last_reminder_sent/recurrence_generated_at), isOverdue/daysOverdue pure helper, n8n assignment_reminder union arm, and Wave-0 test scaffolds establishing the foundation for all downstream Phase 17 plans.

---

## What Was Built

### Migration 015: `supabase/migrations/015_phase17_assignment_recurrence_reminders.sql`

Three new columns added to `public.form_assignments` in a single migration (atomic — prevents partial-push cron crashes):

| Column | Type | Purpose |
|--------|------|---------|
| `recurrence_rule` | `JSONB` | Optional recurrence trigger. NULL = one-off. Shape: `{ "frequency": "weekly"\|"monthly"\|"quarterly"\|"annually" }` |
| `last_reminder_sent` | `TEXT` | Dedup state machine. Lifecycle: `NULL → '7d' → '1d' → 'overdue'`. Updated AFTER successful n8n dispatch only. |
| `recurrence_generated_at` | `TIMESTAMPTZ` | Idempotency guard for cron PASS B. NULL = successor not yet generated. Prevents double-generation. |

CHECK constraint `form_assignments_last_reminder_sent_check` enforces vocab: `last_reminder_sent IS NULL OR last_reminder_sent IN ('7d', '1d', 'overdue')`. Addresses STRIDE T-17-01 (tampering via invalid cadence strings).

COMMENT ON COLUMN entries for all three columns reference Phase 17 context + locked decisions.

**NOT pushed** — push runs in Plan 17-06 (Wave 4, BLOCKING). No triggers (project convention).

### lib/assignments/is-overdue.ts

Exported surface:
- `isOverdue(dateStr: string | null): boolean` — `false` for null; otherwise `new Date(dateStr) < new Date(new Date().toDateString())` (byte-for-byte semantics from `assignment-card.tsx:39-42`)
- `daysOverdue(dateStr: string | null): number` — `0` for null/future; `Math.max(0, Math.floor((todayLocalMidnight - dueDate) / 86_400_000))` for past dates

No `"use client"`, no `"server-only"`, no React imports — safe for RSC, client components, AND the server-side cron handler.

The inline `isOverdue` in `app/client/assignments/_components/assignment-card.tsx` is intentionally left in place — Plan 17-03 performs the swap.

### lib/notifications/n8n-dispatch.ts

New third arm added to `NotificationPayload` discriminated union:

```ts
| {
    type: "assignment_reminder"
    cadence: "7d" | "1d" | "overdue"
    client_email: string
    client_name: string
    template_name: string
    due_date: string           // ISO date yyyy-mm-dd
    assignment_url: string     // absolute URL to /client/assignments/[id]
    instructions: string | null
  }
```

`dispatchNotification` function body, `DispatchResult` interface, and env-var handling (`N8N_WEBHOOK_URL` / `N8N_WEBHOOK_SECRET`) are **unchanged**. n8n routes by `type` discriminator per Phase 5 precedent.

### Test Infrastructure

**Filled spec — `tests/scheduler/is-overdue.test.ts`** (4 passing assertions):
1. `isOverdue(null)` → `false`
2. `isOverdue("2099-12-31")` → `false`
3. `isOverdue("2000-01-01")` → `true` AND `daysOverdue("2000-01-01")` → ≥ 9000
4. `isOverdue(todayLocal)` → `false` (today is not overdue per `<` semantics)

**Wave-0 scaffolds (it.todo only):**
- `tests/scheduler/recurrence-generator.spec.ts` — 6 todos for Plan 17-02
- `tests/scheduler/send-reminder.spec.ts` — 3 todos for Plan 17-02
- `tests/scheduler/cron-reminder-decision.spec.ts` — 6 todos for Plan 17-05

**vitest.config.ts** extended with `"tests/scheduler/**/*.{test,spec}.{ts,tsx}"` as the fourth include entry.

---

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | `8129242` | `chore(17-01)`: author migration 015 + extend vitest scheduler glob |
| Task 2 | `621e6af` | `feat(17-01)`: extract isOverdue helper + extend n8n assignment_reminder union |
| Task 3 | `1637680` | `test(17-01)`: add is-overdue filled spec + three Wave-0 scheduler scaffolds |

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed today-date computation in is-overdue.test.ts for non-UTC timezones**

- **Found during:** Task 3 (first test run)
- **Issue:** The plan specified `new Date().toISOString().slice(0,10)` to compute "today" in the test. This gives the UTC calendar date. In non-UTC timezones (this system is UTC+3), the UTC date is behind the local date, causing `isOverdue(today)` to return `true` (the UTC date is earlier than the local-midnight anchor used by `todayMidnight()`).
- **Fix:** Compute today from local date components: `[d.getFullYear(), (d.getMonth()+1).padStart(2,'0'), d.getDate().padStart(2,'0')].join('-')`. This matches the local calendar date that `new Date(new Date().toDateString())` anchors to.
- **Files modified:** `tests/scheduler/is-overdue.test.ts`
- **Commit:** `1637680`

### Pre-existing Out-of-Scope Issues (not fixed)

`tests/form-builder/specialty-entities.test.ts` has 4 pre-existing failures (`signatureField`, `geolocationField`, `computedField`, `repeatingSection` attribute-count assertions). These exist on the baseline (confirmed by stashing vitest.config.ts changes and re-running). They are unrelated to Phase 17 changes and are outside the scope of this plan.

---

## Known Stubs

None. This plan delivers schema authoring, pure utilities, and test infrastructure — no UI components, no data fetching, no rendered output.

---

## Threat Flags

No new threat surface beyond what the plan's threat model covers. The three new columns sit on `form_assignments` which inherits Phase 16 RLS automatically. No new endpoints, auth paths, or schema at trust boundaries introduced.

---

## What Plan 17-06 Still Owes

- `supabase db push` to apply migration 015 to the live database
- Types regen: `lib/supabase/database.types.ts` must be regenerated after the push to expose `recurrence_rule`, `last_reminder_sent`, and `recurrence_generated_at` as typed columns

---

## Self-Check: PASSED

All files verified present on disk. All 3 task commits found in git log.

| Check | Result |
|-------|--------|
| supabase/migrations/015_phase17_assignment_recurrence_reminders.sql | FOUND |
| lib/assignments/is-overdue.ts | FOUND |
| lib/notifications/n8n-dispatch.ts | FOUND |
| tests/scheduler/is-overdue.test.ts | FOUND |
| tests/scheduler/recurrence-generator.spec.ts | FOUND |
| tests/scheduler/send-reminder.spec.ts | FOUND |
| tests/scheduler/cron-reminder-decision.spec.ts | FOUND |
| .planning/phases/17-assignment-scheduling-notifications/17-01-SUMMARY.md | FOUND |
| commit 8129242 (Task 1) | FOUND |
| commit 621e6af (Task 2) | FOUND |
| commit 1637680 (Task 3) | FOUND |
| Migration NOT pushed | CONFIRMED |
| STATE.md unchanged | CONFIRMED |
| ROADMAP.md unchanged | CONFIRMED |
