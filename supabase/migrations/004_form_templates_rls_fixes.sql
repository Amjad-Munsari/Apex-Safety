-- 004_form_templates_rls_fixes.sql
-- Fixes from the 2026-05-03 audit, prerequisite for client-side form builder.
--
-- 1. Tighten "form_templates_client_published" so customers can only SELECT
--    Matt's published masters, not other customers' published rows.
-- 2. Same for "template_versions_client_published".
-- 3. Add UPDATE policy on template_versions for customer-owned templates so
--    the saveDraft action can rewrite an existing draft version in place.

-- ─────────────────────────────────────────────────────────────
-- form_templates: scope published-master read to owner_type='admin'
-- ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "form_templates_client_published" ON form_templates;
CREATE POLICY "form_templates_client_published" ON form_templates
  FOR SELECT USING (
    is_published = TRUE
    AND owner_type = 'admin'
  );

-- ─────────────────────────────────────────────────────────────
-- template_versions: scope published read to admin-owned templates
-- ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "template_versions_client_published" ON template_versions;
CREATE POLICY "template_versions_client_published" ON template_versions
  FOR SELECT USING (
    published_at IS NOT NULL
    AND template_id IN (
      SELECT id FROM form_templates WHERE owner_type = 'admin'
    )
  );

-- ─────────────────────────────────────────────────────────────
-- template_versions: allow customers to UPDATE drafts of their own templates
-- ─────────────────────────────────────────────────────────────

-- USING gates which rows are visible/updatable; WITH CHECK gates the post-update
-- row. Postgres defaults WITH CHECK to USING for FOR UPDATE, but make it explicit
-- so a customer attempting `UPDATE ... SET template_id = '<other-customer-template>'`
-- is rejected on the post-image, not just the pre-image.
DROP POLICY IF EXISTS "template_versions_client_own_update" ON template_versions;
CREATE POLICY "template_versions_client_own_update" ON template_versions
  FOR UPDATE
  USING (
    template_id IN (
      SELECT id FROM form_templates
      WHERE owner_type = 'customer'
        AND owner_id IN (SELECT client_id FROM client_users WHERE id = auth.uid())
    )
  )
  WITH CHECK (
    template_id IN (
      SELECT id FROM form_templates
      WHERE owner_type = 'customer'
        AND owner_id IN (SELECT client_id FROM client_users WHERE id = auth.uid())
    )
  );
