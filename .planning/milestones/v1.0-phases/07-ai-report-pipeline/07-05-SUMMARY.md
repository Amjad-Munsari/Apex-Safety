---
phase: 07-ai-report-pipeline
plan: 05
subsystem: admin-review-ui
tags: [server-component, data-fetch, ai-report-pipeline, review-page]
requires:
  - form_submissions.template_version_id (existing — migration 001)
  - template_versions.schema_json (existing — migration 001)
  - field_media table (existing — migration 001)
provides:
  - schemaJson prop on ReviewClient (consumed by Plan 06)
  - audioMedia prop on ReviewClient (consumed by Plan 06)
affects:
  - app/admin/assessments/[id]/review/page.tsx
tech-stack:
  added: []
  patterns:
    - two-step-pinned-template-fetch
    - null-tolerant-secondary-fetch
key-files:
  created: []
  modified:
    - app/admin/assessments/[id]/review/page.tsx
decisions:
  - Used spread+cast (`as any`) for the transient Wave 1→2 prop-type gap, per plan's "optional mitigation" option. Plan 06 removes the cast when it widens ReviewClient's signature.
  - Followed plan literally on field_media `transcript` column selection despite the column not existing in migrations 001–009. See Deviations.
metrics:
  duration: ~10 minutes
  completed: 2026-05-29
  tasks_completed: 1
  files_modified: 1
---

# Phase 07 Plan 05: Extend Review Page Server-Component Fetch — Summary

Adds two server-side Supabase reads (pinned `template_versions.schema_json` + `field_media` audio rows) to the existing `ReviewPage` Server Component and forwards them as new props to `ReviewClient`, satisfying REPORT-08's data-dependency for the D-04 raw-answers panel that Plan 06 will render.

## What Changed

`app/admin/assessments/[id]/review/page.tsx` now executes three queries instead of one:

1. **`form_submissions`** — existing, unchanged. `notFound()` on a missing row remains the only fatal exit (per the plan's explicit constraint).
2. **`template_versions`** — new. Two-step pattern keyed on `submission.template_version_id` (the PINNED version — never the live template). Selects `schema_json` only. Missing version is tolerated (`?? null`) — Plan 06's panel renders empty state in that case.
3. **`field_media`** — new. Filters `submission_id == id` AND `media_type == 'audio'`. Selects `field_id, storage_path, transcript`. Coerced to `[]` on null so Plan 06's `.map()` never throws.

The `<ReviewClient>` invocation now receives `schemaJson` and `audioMedia` props in addition to `submission`. Because Plan 06 (Wave 2) is the file owner that widens `ReviewClient`'s prop signature, Plan 05 forwards the new props via a `{...({ ... } as any)}` spread cast. This is the plan's documented "optional mitigation" option, chosen here so `npm run build` stays clean during Wave 1 instead of intentionally introducing a transient TS error.

## Tasks

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Extend Review page fetch with template_versions.schema_json + field_media audio rows | 665ede8 | app/admin/assessments/[id]/review/page.tsx |

## Acceptance Criteria — Verification

All five required greps return matches:

- `from("template_versions")` → line 21
- `from("field_media")` → line 29
- `media_type` filter → line 32 (`.eq("media_type", "audio")`)
- `schemaJson` prop → line 40 (and code comment line 34)
- `audioMedia` binding + prop → lines 28, 41

No FK-join introduced: `grep -c "template_versions("` inside the `form_submissions` select returns 0.

`notFound()` still triggers only on missing submission — the missing-version branch returns `schemaJson: null` instead of 404.

## Deviations from Plan

### Auto-noted Issues (not auto-fixed — plan-author awareness needed)

**1. [Rule 1 candidate — schema gap] `field_media.transcript` column does not exist in current migrations**

- **Found during:** Task 1 (column verification against `supabase/migrations/`)
- **Issue:** Plan 05's `<interfaces>` block and `<action>` step both instruct selecting `field_id, storage_path, transcript` from `field_media`. Migration `001_initial_schema.sql:100-108` defines only `id, submission_id, field_id, storage_path, media_type, created_at, deleted_at` — there is **no `transcript` column** anywhere in `supabase/migrations/001` through `009`. PostgREST will reject the query at runtime with a 400 (`column field_media.transcript does not exist`), so the Review page will currently throw whenever `audioMedia` is fetched against a real DB.
- **Decision:** Followed the plan literally (selected the column as specified). The plan's `<interfaces>` block treats `transcript` as a precondition ("STT transcripts in the `transcript` column"), implying an upstream migration is expected to land before Plan 06 renders the panel against a live DB. Adding the column unilaterally from Plan 05 would be an architectural change (Rule 4 territory) and exceeds the plan's single-file scope.
- **Action required (planner/orchestrator):** Either (a) add a migration adding `transcript TEXT` to `field_media` before Plan 06 ships, or (b) revise Plan 06 to render a placeholder when the column is absent. Phase 14 may already do this — flagged here for confirmation.
- **Files modified:** none beyond the spec.
- **Commit:** (this plan's commit — comment in-source notes only the REPORT-08 mitigation rationale, not the column gap)

### Auto-fixed Issues

None — no Rules 1/2/3 bugs encountered during the single-file edit.

## Transient Type Error Closure

The plan documented an expected transient TypeScript error of the form `Property 'schemaJson' does not exist on type ...` if props were passed positionally. I instead used the plan's documented "optional mitigation" — a `{...({...} as any)}` spread cast — so **no TS error is emitted in Wave 1**. Plan 06 should:

1. Widen `ReviewClient`'s prop interface to `{ submission, schemaJson, audioMedia }` (typed properly, not `any`).
2. Replace the cast in `page.tsx` with a plain JSX call: `<ReviewClient submission={...} schemaJson={...} audioMedia={...} />`.

## Threat-Model Check

All four threats in Plan 05's STRIDE register are mitigated as planned:

- **T-07-05-01** (cross-org info disclosure via adminClient on field_media): admin-only route + submission_id scope filter both present.
- **T-07-05-02** (schema leakage): accepted; admin-only surface.
- **T-07-05-03** (stale schema): two-step fetch keyed on `submission.template_version_id` — no FK-join. Confirmed by `grep -c "template_versions("` returning 0 inside any `form_submissions` select.
- **T-07-05-04** (null/empty field_media): `?? []` coercion applied at the prop site.

No new threat surface introduced beyond the plan's register — omitting Threat Flags section.

## Known Stubs

None — `page.tsx` now does real fetches and forwards real props. The "empty state" for `schemaJson == null` is Plan 06's render concern, not a stub on this side.

## Decisions Made

- **Cast over transient error.** Chose the spread+`as any` cast option (plan-permitted) instead of letting the TS error stand. Keeps the wave build green, leaves a single-line removal for Plan 06.
- **Followed plan on `transcript` column.** Did not silently drop the missing column from the select — the plan author's intent is explicit, and dropping it would mask the schema gap from downstream awareness.
- **Did not call `notFound()` on missing version.** Per plan: "do NOT call `notFound()` on a missing version, only on the submission."

## Self-Check: PASSED

- File `app/admin/assessments/[id]/review/page.tsx` exists and contains all five required string anchors (template_versions, field_media, media_type, schemaJson, audioMedia).
- No FK-join present.
- Per-task commit hash recorded below.
