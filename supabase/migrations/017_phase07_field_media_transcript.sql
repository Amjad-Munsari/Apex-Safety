-- 017_phase07_field_media_transcript.sql
-- Phase 07 gap closure (plan 07-09): add the `transcript` column that the
-- Review page (app/admin/assessments/[id]/review/page.tsx) and the D-04
-- Raw Answers & STT panel (review-client.tsx buildRawAnswerRows) both
-- already select from. Backs the locked CONTEXT D-04 decision:
-- "STT transcripts pulled from `field_media` rows where media_type='audio'".
--
-- Idempotent — safe to re-run. Nullable — existing rows (which never had
-- a transcript) remain valid; the UI already tolerates NULL via the
-- "(audio attached, no transcript yet)" placeholder in review-client.tsx.

ALTER TABLE field_media
  ADD COLUMN IF NOT EXISTS transcript TEXT;
