---
phase: 19-client-portal-productionization
plan: "03"
subsystem: ui
tags: [next.js, supabase, form-interpreter, rls, idor, read-only, submission-viewer]

# Dependency graph
requires:
  - phase: 16-multi-tenancy-fork-on-fill
    provides: form_assignments, form_submissions tables and assignment fill flow
  - phase: 14-custom-field-types
    provides: InterpreterRenderer with specialty renderers (multi-photo, geolocation, signature)
  - phase: 13-form-builder-foundation
    provides: InterpreterRenderer base, FormBuilderSchema, template_versions pinned fetch pattern

provides:
  - Read-only completed-submission viewer at /client/assignments/[id]/submission
  - IDOR-scoped server route with UUID guard + defense-in-depth client_id check
  - Completed-tab Link repointed to /submission (TODO(plan-future) removed)

affects: [19-client-portal-productionization, client-assignments, form-submissions]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Read-only renderer: pointer-events-none + select-none wrapper + no submit/ref/callbacks"
    - "Two-step pinned-schema fetch: form_submissions → template_versions (no join)"
    - "IDOR defense: UUID_RE guard + RLS primary + explicit client_id ownership check"

key-files:
  created:
    - app/client/assignments/[id]/submission/submission-viewer-client.tsx
    - app/client/assignments/[id]/submission/page.tsx
  modified:
    - app/client/assignments/page.tsx

key-decisions:
  - "Read-only affordance is belt-and-suspenders: CSS pointer-events-none overlay + no onSubmit/ref wired + no submit button"
  - "Two-step fetch mirrors fill/page.tsx (Phase 13 RESEARCH Pitfall 2 — never join template_versions)"
  - "IDOR defense: UUID_RE rejects malformed IDs, RLS is primary, explicit client_id comparison is defense-in-depth"

patterns-established:
  - "Submission viewer pattern: SubmissionViewerClient receives schemaJson/answersJson/submittedAt/clientId/submissionId from RSC"

requirements-completed: [D-07, D-08]

# Metrics
duration: 15min
completed: 2026-06-07
---

# Phase 19 Plan 03: Completed-Submission Viewer Summary

**Read-only IDOR-scoped submission viewer at /client/assignments/[id]/submission — InterpreterRenderer seeded with pinned schema + submitted answers, wrapped pointer-events-none; Completed-tab links updated.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-06-07T07:34:00Z
- **Completed:** 2026-06-07T07:49:00Z
- **Tasks:** 3
- **Files modified:** 3 (2 created, 1 modified)

## Accomplishments
- Built `SubmissionViewerClient` — a "use client" wrapper around `InterpreterRenderer` with belt-and-suspenders read-only enforcement (CSS overlay + no submit wiring + no ref)
- Built `SubmissionViewerPage` server route — UUID guard, IDOR-scoped two-step DB fetch (form_submissions → template_versions), defense-in-depth client_id ownership check
- Repointed Completed-tab Link in `app/client/assignments/page.tsx` from the assignment landing page to `/submission`; removed three TODO(plan-future) comment lines

## Task Commits

Each task was committed atomically:

1. **Task 1: Create the read-only submission viewer client wrapper** - `86082f1` (feat)
2. **Task 2: Create the IDOR-scoped submission server route** - `5a49b98` (feat)
3. **Task 3: Repoint the Completed-tab Link to the submission viewer** - `9a3b913` (feat)

## Files Created/Modified
- `app/client/assignments/[id]/submission/submission-viewer-client.tsx` — "use client" wrapper; InterpreterRenderer in pointer-events-none div; header with back link and submitted timestamp
- `app/client/assignments/[id]/submission/page.tsx` — server route; UUID_RE guard; two-step IDOR-scoped fetch; renders SubmissionViewerClient
- `app/client/assignments/page.tsx` — Completed-tab Link href updated to /submission; three TODO comment lines removed

## Decisions Made
- Belt-and-suspenders read-only: CSS `pointer-events-none select-none` overlay is the primary UX barrier; omitting all submit/progress/values callbacks and any ref is belt (T-19-08).
- Two-step fetch (not join): mirrors `fill/page.tsx` pattern exactly per Phase 13 Pitfall 2. `form_submissions` row fetched first, then `template_versions.schema_json` fetched by the pinned `template_version_id`.
- Defense-in-depth IDOR: UUID_RE guard fires before any DB query (T-19-10); RLS provides primary access control; explicit `submission.client_id !== ctx.client_id → notFound()` adds belt (T-19-07).

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

- Build verification (`npm run build`) in the isolated worktree fails at page data collection for `/admin/clients/[id]` due to missing Supabase env vars (`.env.local` not present in worktree). This is a pre-existing worktree environment limitation — the Turbopack compilation step completed successfully (`Compiled successfully in 18.3s`) and TypeScript type-check showed no errors in the new submission files. Pre-existing test file TS errors are unrelated to this plan.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness
- `/client/assignments/[id]/submission` is live and IDOR-scoped; ready for UAT (open a completed assignment → read-only render; attempt edit → blocked; foreign org ID → 404)
- No blockers for remaining Phase 19 plans (Plans 01, 02, 04 are parallel)

---
*Phase: 19-client-portal-productionization*
*Completed: 2026-06-07*
