---
phase: 17
plan: "04"
subsystem: assignment-scheduling
tags: [cron, vercel, n8n, scheduler, multi-tenancy, idempotency]
dependency_graph:
  requires: [17-01, 17-02]
  provides: [cron-route, vercel-schedule, inline-recurrence-trigger]
  affects: [app/api/cron/assignment-scheduler/route.ts, vercel.json, app/client/assignments/actions.ts]
tech_stack:
  added: []
  patterns:
    - Vercel cron GET handler (mirrors app/api/cron/expiry/route.ts auth+service-role pattern)
    - Monotonic reminder cadence state machine via last_reminder_sent TEXT column
    - Idempotency guard via recurrence_generated_at timestamp column
    - Inline recurrence trigger + cron safety net (two-site pattern)
key_files:
  created:
    - app/api/cron/assignment-scheduler/route.ts
  modified:
    - vercel.json
    - app/client/assignments/actions.ts
    - tests/form-builder/assignment-status-transitions.test.ts
decisions:
  - "Auth gate mirrors expiry/route.ts lines 7-20 exactly: cronSecret check with dev pass-through and production 401"
  - "PASS A cadence ladder: 7d (last_reminder_sent null), 1d (not 1d/overdue), overdue (not overdue) — monotonic state machine"
  - "workflow_errors insert on dispatch failure; dedup write skipped so next tick retries (Pattern 4)"
  - "PASS B four-filter chain: completed + deleted_at null + recurrence_rule not null + recurrence_generated_at null"
  - "Inline trigger uses same RLS-aware supabase client (not service-role) since calling user owns the assignment"
  - "Test mock extended with .single() on form_assignments select chain and generate-next-occurrence mock"
metrics:
  duration: "~25 minutes"
  completed: "2026-05-27"
  tasks_completed: 3
  files_changed: 4
---

# Phase 17 Plan 04: Cron Handler + vercel.json + Inline Recurrence Trigger Summary

**One-liner:** Daily Vercel cron implementing PASS A reminder cadence (7d/1d/overdue deduped via last_reminder_sent) and PASS B recurrence generation (idempotent via recurrence_generated_at), with an inline trigger in submitAssignedFillByIdAction for instant UX.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create cron route handler | fb95171 | app/api/cron/assignment-scheduler/route.ts (NEW) |
| 2 | Register cron in vercel.json | a33dcf3 | vercel.json |
| 3 | Add inline recurrence trigger | 18ecfb1 | app/client/assignments/actions.ts, tests/form-builder/assignment-status-transitions.test.ts |

## Key Implementation Details

### Auth Gate (mirrors expiry/route.ts:7-20)

```ts
const cronSecret = process.env.CRON_SECRET

if (!cronSecret) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 })
  }
  // dev/preview without a secret: allow unauthenticated curl for manual testing
} else if (authHeader !== `Bearer ${cronSecret}` && querySecret !== cronSecret) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
}
```

This is byte-for-byte identical to `app/api/cron/expiry/route.ts:7-20`. Same `cronSecret` env read, same dev/preview pass-through, same 401 in production.

### PASS A Cadence Decision Ladder

```ts
let cadence: "7d" | "1d" | "overdue" | null = null

if (row.due_date === iso(day7) && row.last_reminder_sent === null) {
  cadence = "7d"
} else if (
  row.due_date === iso(day1) &&
  row.last_reminder_sent !== "1d" &&
  row.last_reminder_sent !== "overdue"
) {
  cadence = "1d"
} else if (row.due_date < iso(today) && row.last_reminder_sent !== "overdue") {
  cadence = "overdue"
}
```

Order matters: 7d is checked first (only when null), then 1d (not already at 1d/overdue), then overdue. The dedup write (`last_reminder_sent: cadence`) only happens AFTER `sendAssignmentReminder` returns `ok: true`. On failure, `workflow_errors` is inserted and the write is skipped so the next tick retries.

### PASS A Three Required Filters (Pitfall 5)

```ts
.from("form_assignments")
.select("id, client_id, due_date, status, instructions, last_reminder_sent, template:form_templates(name)")
.is("deleted_at", null)       // never remind on revoked assignments
.neq("status", "completed")   // never remind on completed assignments
.not("due_date", "is", null)  // skip assignments without a due date
```

### PASS B Four-Filter SELECT Chain

```ts
.from("form_assignments")
.select("id, client_id, template_id, assigned_by, instructions, due_date, recurrence_rule, recurrence_generated_at")
.eq("status", "completed")
.is("deleted_at", null)
.not("recurrence_rule", "is", null)
.is("recurrence_generated_at", null)  // idempotency guard — only unprocessed rows
```

On successful `generateNextOccurrence`, the cron immediately UPDATEs `recurrence_generated_at = now()` so the same row is not processed on the next tick.

### vercel.json Before/After

**Before:**
```json
{
  "framework": "nextjs",
  "crons": [
    { "path": "/api/cron/expiry", "schedule": "0 6 * * *" }
  ]
}
```

**After:**
```json
{
  "framework": "nextjs",
  "crons": [
    { "path": "/api/cron/expiry", "schedule": "0 6 * * *" },
    { "path": "/api/cron/assignment-scheduler", "schedule": "0 7 * * *" }
  ]
}
```

One hour gap between crons prevents function quota competition.

### Inline Trigger Insertion Point in actions.ts

The trigger is inserted between `transitionAssignmentStatus(supabase, updated.assignment_id, "completed")` (line ~181 pre-edit) and `revalidatePath("/client/assignments")` (line ~182 pre-edit). The redirect remains the last statement (NEXT_REDIRECT pattern preserved).

```ts
// After: transitionAssignmentStatus(supabase, updated.assignment_id, "completed");

const { data: completedRow } = await supabase
  .from("form_assignments")
  .select("id, client_id, template_id, assigned_by, instructions, due_date, recurrence_rule, recurrence_generated_at")
  .eq("id", updated.assignment_id)
  .single();

if (completedRow && completedRow.recurrence_rule !== null && completedRow.recurrence_generated_at === null) {
  const res = await generateNextOccurrence(supabase, completedRow);
  if (res.ok) {
    await supabase.from("form_assignments").update({ recurrence_generated_at: new Date().toISOString() }).eq("id", updated.assignment_id);
  } else {
    console.error("inline recurrence failed", { assignmentId: updated.assignment_id, reason: res.reason });
  }
}

// Before: revalidatePath("/client/assignments");
// Before: redirect(`/client/assignments/${updated.assignment_id}`);
```

Uses the SAME `supabase` client already created by the action (RLS-aware, not service-role). The `recurrence_generated_at` idempotency column is the serialization point shared with the cron PASS B.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test mock missing .single() on form_assignments select chain**
- **Found during:** Task 3 test run
- **Issue:** `makeAssignmentsChain()` in `assignment-status-transitions.test.ts` returned `{ maybeSingle }` from the select eq chain but the new inline trigger calls `.single()` on the same chain, causing `TypeError: supabase.from(...).select(...).eq(...).single is not a function`
- **Fix:** Extended `eqForSelectSpy` to expose both `maybeSingle` and `single` methods. Added `singleForAssignmentSpy` with `recurrence_rule: null` data (skips generator call, test logic unchanged). Added `vi.mock("@/lib/scheduler/generate-next-occurrence", ...)` to prevent real DB calls from the imported module.
- **Files modified:** `tests/form-builder/assignment-status-transitions.test.ts`
- **Commit:** 18ecfb1

## Future Plans

- **Plan 17-05** owns the cron unit test (`cron-reminder-decision.spec.ts`) — the scaffold from Plan 17-01 is waiting for the implementation to test.
- **Plan 17-06** owns the end-to-end smoke, `npm run build` + types regeneration (the new columns `recurrence_rule`, `last_reminder_sent`, `recurrence_generated_at` are currently type-loose pending types regen), and n8n UAT confirmation.

## Threat Surface Scan

No new network endpoints or auth paths beyond those documented in the plan's threat model. The cron handler at `/api/cron/assignment-scheduler` is the only new network surface and is protected by the same auth gate as `/api/cron/expiry`. All threats are documented in the plan's STRIDE register (T-17-AUTH, T-17-13, T-17-14, T-17-15, T-17-16).

## Self-Check: PASSED

- [x] `app/api/cron/assignment-scheduler/route.ts` exists
- [x] `vercel.json` has two cron entries
- [x] `app/client/assignments/actions.ts` contains `generateNextOccurrence(`
- [x] Commits fb95171, a33dcf3, 18ecfb1 exist in git log
- [x] All 5 Phase 16 tests pass (no regressions)
- [x] Zero redirect() calls in cron file
- [x] Zero next/navigation imports in cron file
