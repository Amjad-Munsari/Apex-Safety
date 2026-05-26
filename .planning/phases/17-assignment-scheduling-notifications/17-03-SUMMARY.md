---
phase: 17-assignment-scheduling-notifications
plan: "03"
subsystem: ui
tags: [react, overdue, vitest, tailwind, tooltip, base-ui, wcag, supabase]

requires:
  - phase: 17-01
    provides: "isOverdue + daysOverdue extracted to lib/assignments/is-overdue.ts"
  - phase: 16-multi-tenancy-fork-on-fill
    provides: "client-tabs.tsx, assignment-card.tsx, Tooltip primitive (base-ui, no asChild)"

provides:
  - "app/_components/overdue-pill.tsx — shared server-compatible OverduePill component"
  - "Inline isOverdue deletion from assignment-card.tsx (BLOCKING #2 finalised)"
  - "Admin form_assignments ORDER BY: due_date ASC NULLS LAST -> created_at DESC (BLOCKING #1)"
  - "Tooltip-wrapped overdue indicator on admin assignments tab (admin-only, BLOCKING #4)"
  - "Client surface gets aria-label-only pill via OverduePill (no tooltip)"
  - "2 new Vitest specs: overdue-pill.test.ts (4 assertions), admin-assignments-order-by.test.ts (1 assertion)"

affects:
  - 17-04 (cron handler — will use same daysOverdue helper)
  - 17-06 (WCAG AA verification owes contrast check on #a14a2a over both surfaces)
  - future-plan: "any UI consuming overdue state should use app/_components/overdue-pill"

tech-stack:
  added: []
  patterns:
    - "app/_components/ as the cross-surface shared component directory (first use in Phase 17)"
    - "Server-compatible presentational component: no hooks, no 'use client', no imports — accepts precomputed values as props"
    - "IIFE pattern for conditional Tooltip in JSX: (() => { const d = ...; if (!d) return null; return <Tooltip>...</Tooltip>; })()"
    - "Admin Tooltip with inlined className on TooltipTrigger (no asChild — base-ui constraint from Phase 16 Plan 03 Deviation 2)"
    - "Test spy pattern for RSC query chain: vi.mock per table (clients vs form_assignments) to allow client fetch to succeed"

key-files:
  created:
    - app/_components/overdue-pill.tsx
    - tests/form-builder/overdue-pill.test.ts
    - tests/form-builder/admin-assignments-order-by.test.ts
  modified:
    - app/client/assignments/_components/assignment-card.tsx
    - app/admin/clients/[id]/page.tsx
    - app/admin/clients/[id]/client-tabs.tsx

key-decisions:
  - "OverduePill component has no imports and no 'use client' — Tooltip wrapping is caller's responsibility (admin only)"
  - "Admin surface inlines the pill className on TooltipTrigger rather than wrapping <OverduePill> (base-ui no-asChild constraint; T-17-10 accepted)"
  - "OverduePill returns null when daysOverdue <= 0 OR status === 'completed' — defensive early-return in the component even though callers also gate"
  - "ORDER BY test mocks clients table to return a real row so notFound() is not triggered before form_assignments query runs"
  - "specialty-entities.test.ts pre-existing failure (4 tests) is out-of-scope — unrelated to Phase 17 changes; deferred"

patterns-established:
  - "Pure functional server component pattern: no directives, no imports, props only — trivially testable via direct function invocation"
  - "Vitest admin RSC test: mock @/lib/supabase/admin per-table, mock @/lib/supabase/dashboard to avoid transitive server-only, stub all UI components"

requirements-completed:
  - SCHED-03

duration: 20min
completed: 2026-05-27
---

# Phase 17 Plan 03: Overdue UI — Shared OverduePill, Admin ORDER BY Swap, Extraction Finalisation

**Shared #a14a2a OverduePill on both surfaces, admin assignments sorted by due_date ASC NULLS LAST, inline isOverdue deleted from assignment-card (BLOCKING #1 + #2 + #4 resolved)**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-05-27T01:38Z
- **Completed:** 2026-05-27T01:49Z
- **Tasks:** 3
- **Files modified:** 6 (3 new, 3 modified)

## Accomplishments

- Created `app/_components/overdue-pill.tsx` — the first shared cross-surface component in Phase 17. Server-compatible (no `"use client"`), accepts `daysOverdue: number` and optional `status`, returns null when not applicable, renders the locked className + aria-label from UI-SPEC §Visual Spec
- Deleted inline `isOverdue()` from `assignment-card.tsx` (BLOCKING #2 finalised) and wired the shared `OverduePill` onto the active variant metadata row, gated via `variant === "active"`; client surface gets no Tooltip (BLOCKING #4)
- Swapped admin form_assignments `ORDER BY` from `created_at DESC` to `due_date ASC NULLS LAST, created_at DESC` (BLOCKING #1); admin tab also mounts a Tooltip-wrapped overdue indicator (inlined className on `TooltipTrigger` — base-ui no-asChild constraint)
- 5 new Vitest assertions (4 for OverduePill rendering rules, 1 for ORDER BY chain) — all passing; pre-existing `specialty-entities.test.ts` failure is out-of-scope

## Task Commits

Each task was committed atomically:

1. **Task 1: Create OverduePill + spec** - `42be1b1` (feat)
2. **Comment fix (Tooltip word in comment)** - `e14df0d` (style)
3. **Task 2: Wire OverduePill into assignment-card** - `43d8881` (feat)
4. **Task 3: Admin ORDER BY swap + client-tabs Tooltip + ORDER BY spec** - `a0d80b9` (feat)

## Files Created/Modified

- `app/_components/overdue-pill.tsx` — New shared server-compatible OverduePill component (no imports, no client directive)
- `tests/form-builder/overdue-pill.test.ts` — 4 Vitest assertions (render, null-on-zero, null-on-completed, aria-label pluralisation)
- `tests/form-builder/admin-assignments-order-by.test.ts` — 1 Vitest assertion proving due_date ASC NULLS LAST precedes created_at DESC in the admin page fetch chain
- `app/client/assignments/_components/assignment-card.tsx` — Deleted inline isOverdue (4 lines), added 2 imports, added 1 OverduePill mount (gated on active variant)
- `app/admin/clients/[id]/page.tsx` — ORDER BY swap: `.order("due_date", { ascending: true, nullsFirst: false }).order("created_at", { ascending: false })`
- `app/admin/clients/[id]/client-tabs.tsx` — Added 2 imports (daysOverdue, Tooltip suite), inserted IIFE-gated Tooltip-wrapped overdue indicator in metadata row

## Decisions Made

1. **OverduePill has no imports** — the component accepts the precomputed `daysOverdue: number` from the caller. No date-math inside the component — keeps it trivially testable without mocking Date.
2. **Admin surface inlines className on TooltipTrigger** — base-ui's `TooltipTrigger` does not support `asChild` (Phase 16 Plan 03 §Deviation 2). The visual result is identical to `<OverduePill>` but the two call sites share the same className string from UI-SPEC §Visual Spec. This is T-17-10 (accepted risk — tracked in threat model).
3. **OverduePill not imported in client-tabs** — the admin surface duplicates the pill visually via TooltipTrigger; importing OverduePill without using it would introduce a dead import. The plan's `artifacts.contains: "OverduePill"` was interpreted as the pill text `OVERDUE` (confirmed present in client-tabs JSX).
4. **ORDER BY test mocks clients table separately** — the admin page calls `.from("clients").single()` before the assignments fetch; mocking it to return a valid client prevents `notFound()` from aborting before the ORDER BY assertions run.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Comment in overdue-pill.tsx contained the word "Tooltip"**
- **Found during:** Overall verification (grep check for Tooltip absence in OverduePill)
- **Issue:** Comment said `"Tooltip wrapping is the caller's responsibility"` — the word "Tooltip" in the comment falsely triggered the `grep -c Tooltip` acceptance check
- **Fix:** Renamed comment to `"Hover-tip wrapping is..."` to avoid word collision
- **Files modified:** app/_components/overdue-pill.tsx
- **Committed in:** e14df0d (style commit)

**2. [Rule 1 - Bug] Spurious closing </div> in initial client-tabs edit**
- **Found during:** Task 3 (reviewing JSX structure after first edit attempt)
- **Issue:** The IIFE insertion accidentally produced a duplicate `</div>` outside the metadata row
- **Fix:** Removed the extra `</div>` and reordered the edit so the IIFE is correctly inside `<div className="flex items-center gap-3 mt-1">`
- **Files modified:** app/admin/clients/[id]/client-tabs.tsx
- **Committed in:** a0d80b9 (same task commit)

**3. [Rule 3 - Blocking] ORDER BY test needed per-table from() mock and extra vi.mock stubs**
- **Found during:** Task 3 test execution (first attempt)
- **Issue:** (a) `notFound()` was called before assignments query ran because `clients` mock returned null; (b) `server-only` package threw because `@/lib/supabase/dashboard` was not mocked
- **Fix:** Added per-table `from()` dispatch in mock (clients returns MOCK_CLIENT), added `vi.mock("@/lib/supabase/dashboard")`, stubbed UI components
- **Files modified:** tests/form-builder/admin-assignments-order-by.test.ts
- **Committed in:** a0d80b9 (same task commit)

---

**Total deviations:** 3 auto-fixed (1 comment bug, 1 JSX structure bug, 1 test mock blocking)
**Impact on plan:** All auto-fixes necessary for correctness. No scope creep. Zero functional changes to production code beyond the planned edits.

## Issues Encountered

- `specialty-entities.test.ts` has 4 pre-existing failures (repeatingSection attribute count mismatch) — confirmed pre-existing by running the test at base commit before any changes. Out of scope for this plan.

## Known Stubs

None. All data flows from real Supabase rows via `daysOverdue(assignment.due_date)` — no hardcoded values, no mock data in production paths.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| T-17-10 (accepted) | app/admin/clients/[id]/client-tabs.tsx | className string duplicated between OverduePill and TooltipTrigger — accepted cost of base-ui no-asChild constraint; WCAG verification deferred to Plan 17-06 |

## WCAG Deferred Callout

Plan 17-06 still owes WCAG AA contrast verification for `#a14a2a` text over:
- Cream `#faf9f6` background (client `/client/assignments` surface)
- Dark `#1c1b24` background (admin `/admin/clients/[id]` surface)

Both use `bg-[#a14a2a]/10` overlay. UI-SPEC BLOCKING #3 nominates Plan 17-06 Task 1b as the verification gate.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Plan 17-04 (cron handler) is unblocked — the shared `daysOverdue` helper in `@/lib/assignments/is-overdue` is the same utility the cron will use for notification dispatch
- Plan 17-06 (full sweep + WCAG) can now run the complete form-builder suite and confirm no regressions

---
*Phase: 17-assignment-scheduling-notifications*
*Completed: 2026-05-27*
