-- 019_soft_delete_columns_drift_fix.sql
-- Continuation of the 018 schema-drift fix — found 2026-06-01 during E2E prod UAT.
--
-- The project-wide soft-delete convention and the Phase 16/17 code filter (.is
-- "deleted_at", null) and SET (revokeAssignment) deleted_at on several tables,
-- but the columns were never migrated onto prod. Reads errored in PostgREST and
-- the callers fell back to [] silently. Most visible symptom: assignments were
-- created successfully (insert has no deleted_at) so the UI showed a success
-- toast, but every assignment-list query errored on the missing column → the
-- assignment never appeared ("shows success but nothing is assigned"). Soft-delete
-- writes (revokeAssignment → .update deleted_at) would also have errored.
--
-- Full audit (2026-06-01) of tables the code filters/selects deleted_at on:
--   already present: clients, services, form_templates (added in 018)
--   MISSING → added here: form_assignments, documents, form_submissions
--   (proposals / template_versions / field_media are NOT filtered on deleted_at
--    anywhere in code, so they are intentionally left untouched.)
--
-- All additive + idempotent. Reversible via DROP COLUMN.

ALTER TABLE form_assignments ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;
ALTER TABLE documents        ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;
ALTER TABLE form_submissions ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;

-- Keep the common "not deleted" filters fast.
CREATE INDEX IF NOT EXISTS idx_form_assignments_deleted_at
  ON form_assignments (deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_documents_deleted_at
  ON documents (deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_form_submissions_deleted_at
  ON form_submissions (deleted_at) WHERE deleted_at IS NULL;
