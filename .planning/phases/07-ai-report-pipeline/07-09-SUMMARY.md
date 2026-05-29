---
phase: 07-ai-report-pipeline
plan: 09
subsystem: review-page-fallback
tags: [review, field-media, ai-report-pipeline, gap-closure, REPORT-08]
requires: []
provides:
  - Review page fallback when `field_media` table absent (placeholder STT row in D-04 panel)
affects:
  - app/admin/assessments/[id]/review/page.tsx
  - supabase/migrations/017_phase07_field_media_transcript.sql (deleted — never applied)
tech-stack:
  added: []
  patterns:
    - prod-as-source-of-truth fallback
key-files:
  created: []
  modified:
    - app/admin/assessments/[id]/review/page.tsx
  deleted:
    - supabase/migrations/017_phase07_field_media_transcript.sql
decisions:
  - Original plan called for `ALTER TABLE field_media ADD COLUMN transcript TEXT;` migration.
  - Live-DB inspection revealed `field_media` table does not exist in prod at all (no DROP TABLE in any migration history; partial initial bootstrap suspected).
  - Per `db_as_source_of_truth.md` memory, prod is canonical when local migration history diverges. Treating the absent table as the intentional product state.
  - Option C selected (user confirmation, 2026-05-29) — drop the page-level `field_media` query, hardcode `audioMedia = []`, let review-client's existing "(audio attached, no transcript yet)" placeholder render. STT panel becomes a no-op until field_media is intentionally added.
metrics:
  duration: ~5 minutes
  completed: 2026-05-29
  tasks_completed: 1
  files_modified: 1
  files_deleted: 1
---

# Plan 07-09 — Review Page field_media Fallback (gap closure)

## Goal
Close the REPORT-08 gap from `07-VERIFICATION.md` by stopping the PostgREST 400 that fires every time `/admin/assessments/[id]/review/page.tsx` loads.

## Outcome
- `app/admin/assessments/[id]/review/page.tsx` — removed the `from("field_media")` select. Replaced with a typed empty `audioMedia` literal. ReviewClient's prop shape and the D-04 panel placeholder rendering require no changes.
- `supabase/migrations/017_phase07_field_media_transcript.sql` — deleted. Never applied to prod (`apply_migration` errored: `relation "field_media" does not exist`); no value in keeping an orphan migration in repo.

## Deviation from planner's plan
Planner picked option (a) migration over option (b) fallback because (b) "would silently undermine D-04 STT verbatim intent." That reasoning held only if `field_media` existed on prod — it doesn't. With no source data anywhere, the migration would have added a column to a non-existent table. User confirmed Option C interactively after the orchestrator detected the drift via Supabase MCP `list_tables`.

## Truth resolved
- **REPORT-08** truth: "Admin review UI shows the generated draft alongside the raw STT transcript verbatim" — partially resolved. The fetch no longer 400s. STT is structurally unreachable on the current prod schema; downgraded to deferred until audio-capture ships.

## Self-Check
- `npx tsc --noEmit` filtered to `app/admin/assessments/[id]/review/`: 0 errors
- Page no longer queries a non-existent table — no more PostgREST 400 on Review page load
- D-04 panel placeholder logic unchanged in review-client.tsx; renders as designed when `audioMedia` is empty

## Carry-forward
When audio capture ships intentionally, a future migration must CREATE the `field_media` table per `001_initial_schema.sql:100-108` + RLS policies at `001_initial_schema.sql:385-397` + add `transcript TEXT`. Restore the original page-level query at that point.
