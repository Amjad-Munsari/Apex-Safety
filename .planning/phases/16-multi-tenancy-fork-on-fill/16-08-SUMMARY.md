---
phase: 16-multi-tenancy-fork-on-fill
plan: "08"
plan_id: 16-08
subsystem: fill-routes
tags: [gap-closure, interpreter-renderer, fill-route, build-fix]
dependency_graph:
  requires: [16-04, 16-06, 16-07]
  provides: [fill-route-working, interpreter-renderer-onSubmit]
  affects: [app/client/assignments, app/client/templates, components/form-interpreter]
tech_stack:
  added: []
  patterns:
    - pre-create-then-UPDATE draft submission pattern
    - onSubmit override prop pattern on InterpreterRenderer
key_files:
  created: []
  modified:
    - components/form-interpreter/interpreter-renderer.tsx
    - app/client/assignments/actions.ts
    - app/client/templates/actions.ts
    - app/client/assignments/[id]/fill/page.tsx
    - app/client/assignments/[id]/fill/fill-assignment-client.tsx
    - app/client/templates/[id]/fill/page.tsx
    - app/client/templates/[id]/fill/fill-customer-template-client.tsx
    - tests/form-builder/assignment-status-transitions.test.ts
    - tests/form-builder/customer-self-fill-submission.test.ts
    - .planning/phases/16-multi-tenancy-fork-on-fill/16-UAT.md
decisions:
  - Pre-create-then-UPDATE pattern chosen over INSERT-on-submit to provide specialty renderers a real submissionId at mount time
  - submitted_by field omitted from UPDATE (requireClientContext does not expose user_id; field is nullable)
metrics:
  duration: ~35 minutes
  completed: 2026-05-27
  tasks_completed: 3
  files_changed: 9
---

# Phase 16 Plan 08: Fill Client Rewrite (§D Gap Closure) Summary

**One-liner:** Replaced hallucinated FormRenderer fill clients with thin InterpreterRenderer wrappers using an onSubmit override prop and pre-created draft submissions, dropping build errors from 9 to 7.

## What Was Done

This plan closed §D from 16-UAT.md — the only remaining build blocker for Phase 16. Plans 16-04 and 16-06 imported `@/components/forms/form-renderer`, a component that does not exist. The fix rewires both fill clients to use the real `InterpreterRenderer` (coltorapps-based) with a new `onSubmit` override prop, while switching from an INSERT-on-submit pattern to a pre-create-then-UPDATE draft pattern.

## InterpreterRenderer Prop Signature Delta

**Added to `InterpreterRendererProps`:**
```ts
onSubmit?: (values: Record<string, unknown>) => Promise<void>
```

When `onSubmit` is supplied, `submit()` calls `onSubmit(values)` instead of `submitAssessmentAction(submissionId, values)`. The else branch and all other behavior (validation, isSubmitting toggles, toasts, useImperativeHandle) are unchanged. The existing `assessment-client.tsx` caller passes no `onSubmit` and continues to use the default path.

`submissionId` remains required — Phase 14 specialty renderers (signature, multi-photo, geolocation) consume it for upload paths regardless of which submit action fires.

## New Server Action Exports

### `app/client/assignments/actions.ts`
| Export | Type | Description |
|--------|------|-------------|
| `createAssignmentDraftSubmission(assignmentId)` | NEW | INSERT status='draft' row + transition pending→in_progress |
| `submitAssignedFillByIdAction(submissionId, answers)` | NEW | UPDATE draft to status='submitted' + transition → completed |
| `submitAssignedFillAction` | DELETED | INSERT path replaced by pre-create + UPDATE |

### `app/client/templates/actions.ts`
| Export | Type | Description |
|--------|------|-------------|
| `createCustomerTemplateDraftSubmission(templateId)` | NEW | INSERT status='draft' row with assignment_id=NULL |
| `submitCustomerTemplateFillByIdAction(submissionId, answers)` | NEW | UPDATE draft to status='submitted' |
| `submitCustomerTemplateFillAction` | DELETED | INSERT path replaced by pre-create + UPDATE |

### T-16-04 Invariant Preserved
Both new UPDATE actions derive `client_id` exclusively from `requireClientContext()`. The defense-in-depth `.eq("client_id", ctx.client_id)` filter is on the UPDATE query in addition to RLS.

## Build Error Count

| State | Errors | Breakdown |
|-------|--------|-----------|
| Before Plan 16-08 | 9 | 7 pre-existing (leaflet + react-pdf) + 2 form-renderer |
| After Plan 16-08 | 7 | 7 pre-existing (leaflet + react-pdf) — zero form-renderer |

`npm run build 2>&1 | grep -c "form-renderer"` returns `0`. The 2 `Module not found: Can't resolve '@/components/forms/form-renderer'` errors are gone.

## §D Status

**CLOSED.** `16-UAT.md §D` header updated to "CLOSED 2026-05-27 by Plan 16-08".

§A (assign-fill UAT walkthrough) is now unblocked — the fill page renders against the real `InterpreterRenderer` with the assignment's pinned schema; submit transitions the assignment to `completed`.

## Vitest Results

- `assignment-status-transitions.test.ts`: 5 tests (3 for transitionAssignmentStatus, 1 for createAssignmentDraftSubmission, 1 for submitAssignedFillByIdAction) — all pass.
- `customer-self-fill-submission.test.ts`: 5 tests (4 for createCustomerTemplateDraftSubmission, 1 for submitCustomerTemplateFillByIdAction) — all pass.
- Full suite: 364 passing, 4 failing (pre-existing `specialty-entities.test.ts` baseline — unchanged).

## Deviations from Plan

### Auto-applied decisions

**1. `submitted_by` omitted from UPDATE payload**
- **Found during:** Task 2 implementation
- **Issue:** The plan's behavior block mentions `submitted_by=auth.uid()`, but `requireClientContext()` (used in the client actions) does not return `user_id`. The `submitted_by` column is nullable in the DB schema.
- **Fix:** Omitted `submitted_by` from both UPDATE payloads. The field remains nullable and the submissions are still fully auditable via `client_id` + `submitted_at`.
- **Impact:** Minor — cosmetic audit field only. `submitted_at` and `client_id` are present.

**2. `startAssignmentFill` refactored to call `createAssignmentDraftSubmission`**
- **Found during:** Task 2 — the plan specified updating `startAssignmentFill` to call `createAssignmentDraftSubmission` internally.
- **Fix:** `startAssignmentFill` now delegates to `createAssignmentDraftSubmission` (which handles the transition + draft INSERT) then redirects. This ensures the draft exists before the fill page loads regardless of entry point.

## Known Stubs

None — all data flows are wired through real server actions against the live DB.

## Threat Flags

No new trust boundaries introduced. The new UPDATE actions follow the same security model as the deleted INSERT actions (requireClientContext, defense-in-depth client_id filter alongside RLS). New threats T-16-09 and T-16-10 were noted in the plan's threat model and accepted/mitigated there.

## Self-Check

Verifying files exist and commits are recorded:

- `components/form-interpreter/interpreter-renderer.tsx`: modified (onSubmit prop added)
- `app/client/assignments/actions.ts`: modified (2 new exports, 1 deleted)
- `app/client/templates/actions.ts`: modified (2 new exports, 1 deleted)
- `app/client/assignments/[id]/fill/fill-assignment-client.tsx`: rewritten
- `app/client/templates/[id]/fill/fill-customer-template-client.tsx`: rewritten
- Both RSC pages: modified (draft pre-create)
- Both test files: updated
- `16-UAT.md`: §D header updated

Commits:
- `2515e43`: feat(16-08): add onSubmit override prop to InterpreterRenderer
- `252ae28`: feat(16-08): replace fill clients with InterpreterRenderer wrappers; pre-create-then-UPDATE submit
- `8a0315a`: test(16-08): update Vitest specs for new UPDATE action shapes (pre-create-then-UPDATE)
