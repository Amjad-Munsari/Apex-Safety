-- 018_form_templates_soft_delete.sql
-- Schema-drift fix — found 2026-06-01 during end-to-end production UAT (test 12 / 46 / 47 / 48).
--
-- The app code and generated types (lib/supabase/database.types.ts) assume a
-- `deleted_at` column on form_templates for soft-delete — matching the project
-- convention (soft-delete for services / clients / templates; see AGENTS.md and
-- the Phase 16 multi-tenancy work). No migration ever created the column, so the
-- prod form_templates table never had it. PostgREST queries that filter or select
-- form_templates.deleted_at errored; the calling code did not check the error and
-- silently fell back to []. Observable symptoms:
--   * /admin/clients/[id] — the "Assign Template" picker showed no templates
--     (publishedTemplates query: .eq("is_published", true).is("deleted_at", null)).
--   * /client/templates/[id]/fill — fork-on-fill / client fill broke
--     (selects deleted_at and checks template.deleted_at !== null).
--
-- The data was always present (4 templates, 3 published incl. the FRA seed).
-- Adding the column aligns prod with the code + types and fixes every affected
-- screen at once. Reversible via DROP COLUMN.

ALTER TABLE form_templates
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;

-- Keep the common "not deleted" filter fast.
CREATE INDEX IF NOT EXISTS idx_form_templates_deleted_at
  ON form_templates (deleted_at)
  WHERE deleted_at IS NULL;
