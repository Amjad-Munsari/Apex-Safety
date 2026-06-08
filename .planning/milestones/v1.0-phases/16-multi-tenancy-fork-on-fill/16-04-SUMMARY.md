---
phase: 16-multi-tenancy-fork-on-fill
plan: "04"
plan_id: 16-04
subsystem: client-assignments
tags: [client, assignments, lifecycle, server-action, rsc, vitest]
dependency_graph:
  requires: [16-01, 16-02]
  provides: [ClientAssignmentsPage, AssignmentCard, startAssignmentFill, transitionAssignmentStatus, requireOwnedAssignment, submitAssignedFillAction, FillAsIsButton, FillAssignmentClient]
  affects: [app/client/assignments/, tests/form-builder/]
tech_stack:
  added: [vitest.config.ts (added to worktree), "test" script in package.json (added to worktree)]
  patterns: [optimistic status guard (.eq("status", previous)), two-step pinned-version fetch, NEXT_REDIRECT bubble pattern, defense-in-depth client_id filter, soft-delete is(deleted_at,null) filter]
key_files:
  created:
    - app/client/assignments/page.tsx
    - app/client/assignments/_components/assignment-card.tsx
    - app/client/assignments/actions.ts
    - app/client/assignments/[id]/page.tsx
    - app/client/assignments/[id]/fill-as-is-button.tsx
    - app/client/assignments/[id]/fill/page.tsx
    - app/client/assignments/[id]/fill/fill-assignment-client.tsx
    - tests/form-builder/assignments-query.test.ts
    - tests/form-builder/assignment-status-transitions.test.ts
    - vitest.config.ts
decisions:
  - "Supabase join returns array type not single object — normalised via getTemplateName() helper and any-type cast with eslint-disable comments"
  - "submitAssignedFillAction written in Task 2a (not 2b) since actions.ts file was created in one pass — plan's task split was for commit ordering guidance"
  - "vitest.config.ts added to worktree (Rule 3 deviation) — worktree was based on older commit that predates the vitest infrastructure in the main repo"
  - "Completed tab in /client/assignments links to /client/assignments/${id} not /submission (submission viewer route deferred to a future plan, per plan spec)"
  - "Customise first button is a disabled placeholder — Plan 05 wires CustomiseFirstButton"
metrics:
  duration_minutes: 35
  tasks_completed: 3
  files_created: 10
  files_modified: 1
  completed_date: "2026-05-26"
---

# Phase 16 Plan 04: Client Assignments Lifecycle UI Summary

**One-liner:** Active+Completed tab listing with defense-in-depth client_id filter, assignment landing page with instructions block, fill route against pinned template version, optimistic status-transition helper with backwards-guard, and 7 passing Vitest assertions replacing Wave-0 scaffolds.

---

## What Was Delivered

### Task 1: /client/assignments page + AssignmentCard + assignments-query test

**app/client/assignments/page.tsx** — Async RSC. Fetches `form_assignments` with:
- `.eq("client_id", ctx.client_id)` — defense-in-depth on top of RLS (T-16-01)
- `.is("deleted_at", null)` — soft-deleted rows excluded (T-16-08)
- Dual `.order()` chain: due_date ascending (nulls last), created_at descending

Page header: mono `05 · Assigned Forms` teal, serif h2 "Forms assigned to you." at `text-[28px]` (unified client heading scale per UI-SPEC).

Renders shadcn `<Tabs defaultValue="active">` with Active + Completed tabs. Empty states use locked UI-SPEC copy.

**app/client/assignments/_components/assignment-card.tsx** — Pure server component. Props: `assignment`, `variant`. Three-row layout: 18px Newsreader template name, mono 9px due date + status pill, 14px Inter instructions clamp-2 (active only). Status pill colours: pending `text-[#666] bg-[#555]/10`, in_progress `text-[#c0a66d] bg-[#c0a66d]/10`, completed `text-[#3b8273] bg-[#3b8273]/10`.

**tests/form-builder/assignments-query.test.ts** — Replaces Wave-0 `it.todo` with 3 real assertions verifying `.eq("client_id", "client-org-001")` and `.is("deleted_at", null)` are called in the page's query chain. Uses dual-call-chainable orderSpy pattern.

### Task 2a: actions.ts + landing page + FillAsIsButton

**app/client/assignments/actions.ts** (`"use server"`) exports:
- `requireClientContext()` — throws "Not a client user" if no client session
- `requireOwnedAssignment(assignmentId, clientId)` — throws on not-found, cross-org, or revoked
- `transitionAssignmentStatus(supabase, assignmentId, next)` — optimistic `.eq("status", previous)` guard; logs on error, never throws (RESEARCH Pattern 4)
- `startAssignmentFill(assignmentId)` — ctx → supabase → requireOwnedAssignment → transition → revalidate → `redirect()` as last statement
- `submitAssignedFillAction(assignmentId, answers)` — INSERT form_submissions with `client_id: ctx.client_id` (T-16-04), transition to "completed", revalidate, redirect as last statement

**app/client/assignments/[id]/page.tsx** — RSC. UUID guard, maybeSingle fetch, defense-in-depth `client_id !== ctx.client_id` check. Renders instructions block with `bg-[#f5f3ee]` + `border-l-2 border-[#c0a66d]` + "From your assessor" label. CTA row: FillAsIsButton (black fill) + disabled Customise placeholder.

**app/client/assignments/[id]/fill-as-is-button.tsx** — `"use client"`. `useTransition` + NEXT_REDIRECT bubble pattern + toast on real errors.

### Task 2b: fill route + FillAssignmentClient + status-transitions test

**app/client/assignments/[id]/fill/page.tsx** — RSC. Two-step fetch: 
1. `form_assignments` by id (assignment row with template_version_id)
2. `template_versions` by `.eq("id", assignment.template_version_id).single()` (pinned, never latest)

Redirects to landing if `status === "completed"` or `deleted_at` is set. Mounts `<FillAssignmentClient>`.

**app/client/assignments/[id]/fill/fill-assignment-client.tsx** — `"use client"`. Uses `FormRenderer` (the project's interpreter component) with `surface="cream"`. Progress bar. Full-width "Submit form" button (black fill, per UI-SPEC Route F). Submit handler wraps `submitAssignedFillAction` with NEXT_REDIRECT bubble.

**tests/form-builder/assignment-status-transitions.test.ts** — Replaces Wave-0 `it.todo` with 4 tests:
1. `pending → in_progress` — verifies `.update({status:"in_progress"}).eq("id",id).eq("status","pending")`
2. `in_progress → completed` — verifies `.update({status:"completed"}).eq("id",id).eq("status","in_progress")`
3. Error no-throw — console.error spy fires, function resolves (Pattern 4)
4. `submitAssignedFillAction` INSERT shape — asserts `assignment_id`, `client_id: "client-org-001"` (T-16-04), `template_version_id`, `status: "submitted"`, `answers_json`; plus the follow-up completed transition and redirect target

---

## Deviations from Plan

### Auto-fixed / Rule 3 Deviations

**1. [Rule 3 - Blocking] vitest.config.ts + test script missing from worktree**
- **Found during:** Task 1 verification
- **Issue:** Worktree is based on commit 8e53d44 which predates Phase 13 vitest infrastructure. Running `npm test` failed with config not found.
- **Fix:** Added `vitest.config.ts` (identical to main repo) and `"test": "vitest run"` script to `package.json`. Also ran `npm install --prefer-offline` to populate `node_modules`.
- **Files modified:** `vitest.config.ts` (new), `package.json`
- **Commits:** f0bbb08

**2. [Rule 1 - Bug] Supabase join returns array type, not object**
- **Found during:** Task 2a TypeScript build check
- **Issue:** `.select("template:form_templates(name)")` in supabase returns `{ name: any }[]` (array), not `{ name: string } | null`. Caused TS2352 type errors on both the page and the card.
- **Fix:** Added `getTemplateName(template: any)` helper in AssignmentCard that normalises array/object/null. Added `as unknown as` cast in the landing page completed-view branch.
- **Files modified:** `app/client/assignments/_components/assignment-card.tsx`, `app/client/assignments/[id]/page.tsx`
- **Commits:** 7d2e38c

**3. [Rule 1 - Bug] `redirectSpy` referenced before initialization in vi.mock factory**
- **Found during:** Task 2b test run
- **Issue:** Vitest hoists `vi.mock()` calls, so `redirectSpy = vi.fn()` declared after the mock factory caused `ReferenceError: Cannot access 'redirectSpy' before initialization`.
- **Fix:** Moved redirect mock inline in the `vi.mock("next/navigation", ...)` factory. Access the mock via `import { redirect } from "next/navigation"` (the mocked version) in tests.
- **Files modified:** `tests/form-builder/assignment-status-transitions.test.ts`
- **Commits:** 7ec21b0

### Design Adaptations (per plan spec)

**4. Completed tab link points to /client/assignments/${id} not /submission**
- The submission viewer route (`/client/assignments/[id]/submission`) is built in a future plan. Per plan spec: "link still rendered for the spec; if the submission viewer doesn't exist yet, link to `/client/assignments/${a.id}` instead and document in summary."
- `// TODO(plan-future): update to /client/assignments/${a.id}/submission` comment added.

**5. "Customise first" button is a disabled placeholder**
- Plan explicitly states: "Plan 05 replaces it with the real CustomiseFirstButton." Code comment added.

---

## Known Stubs

| Stub | File | Line | Reason |
|------|------|------|--------|
| Completed tab links to landing (not submission viewer) | `app/client/assignments/page.tsx` | 95 | Submission viewer route deferred to future plan; plan spec allows this fallback |
| "Customise first" is a disabled button | `app/client/assignments/[id]/page.tsx` | 147 | Fork action is Plan 05 scope; Plan 05 wires `CustomiseFirstButton` |

---

## Threat Surface Scan

All threats from the plan's threat register are mitigated:

| Threat | Mitigation | Verified |
|--------|-----------|---------|
| T-16-01 Cross-tenant read | `.eq("client_id", ctx.client_id)` in every fetch | grep gate + test |
| T-16-05 Backwards status transition | `.eq("status", previous)` in transitionAssignmentStatus | Test 1+2 |
| T-16-08 Soft-deleted assignment leak | `.is("deleted_at", null)` + requireOwnedAssignment check | grep gate + test |
| T-16-06 Service-role import on client surface | Zero `lib/supabase/admin` imports | grep gate (0 matches) |
| T-16-07 No client claim on startAssignmentFill | requireClientContext + requireOwnedAssignment | code review |
| T-16-04 client_id from server context only | `client_id: ctx.client_id` (never from params) | Test 4 + grep gate |

No new threat surface was introduced beyond what the plan declared.

---

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| `app/client/assignments/page.tsx` exists | PASS |
| `app/client/assignments/_components/assignment-card.tsx` exists | PASS |
| `app/client/assignments/actions.ts` exists | PASS |
| `app/client/assignments/[id]/page.tsx` exists | PASS |
| `app/client/assignments/[id]/fill-as-is-button.tsx` exists | PASS |
| `app/client/assignments/[id]/fill/page.tsx` exists | PASS |
| `app/client/assignments/[id]/fill/fill-assignment-client.tsx` exists | PASS |
| `tests/form-builder/assignments-query.test.ts` exists (3 passing tests) | PASS |
| `tests/form-builder/assignment-status-transitions.test.ts` exists (4 passing tests) | PASS |
| Commit f0bbb08 exists | PASS |
| Commit 7d2e38c exists | PASS |
| Commit 7ec21b0 exists | PASS |
| Zero `it.todo` in both test files | PASS |
| `grep -r "from \"@/lib/supabase/admin\"" app/client/assignments/ | wc -l` = 0 (T-16-06) | PASS |
| TypeScript check passes (Finished TypeScript, no type errors) | PASS |
