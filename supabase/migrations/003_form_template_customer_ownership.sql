-- 003_form_template_customer_ownership.sql
-- Decision 2026-04-17 (Finley → Matt): customers can build/fork form templates.
-- Two use cases the schema must support:
--   A. Matt builds master template; customer amends structure on fill (fork-on-fill).
--   B. Customer with the right role builds their own template from scratch.
-- See AGENTS.md "Form template ownership" for the full decision context.

-- ─────────────────────────────────────────────────────────────
-- SCHEMA: drop admin-only FK, add discriminator + parent link
-- ─────────────────────────────────────────────────────────────

-- owner_id was previously FK → admin_users(id). It's now a polymorphic
-- reference: admin_users.id when owner_type='admin', clients.id (org)
-- when owner_type='customer'. The discriminator is owner_type.
ALTER TABLE form_templates
  DROP CONSTRAINT IF EXISTS form_templates_owner_id_fkey;

ALTER TABLE form_templates
  ADD COLUMN IF NOT EXISTS parent_template_id UUID
    REFERENCES form_templates(id) ON DELETE SET NULL;

ALTER TABLE form_templates
  DROP CONSTRAINT IF EXISTS form_templates_owner_type_check;

ALTER TABLE form_templates
  ADD CONSTRAINT form_templates_owner_type_check
    CHECK (owner_type IN ('admin', 'customer'));

CREATE INDEX IF NOT EXISTS idx_form_templates_parent_template_id
  ON form_templates(parent_template_id);

CREATE INDEX IF NOT EXISTS idx_form_templates_owner
  ON form_templates(owner_type, owner_id);

-- ─────────────────────────────────────────────────────────────
-- RLS: customers manage their own templates; published masters stay readable
-- ─────────────────────────────────────────────────────────────

-- Existing "form_templates_client_published" only granted SELECT on published
-- masters. We keep that, and add full CRUD for customer-owned rows scoped to
-- the requesting user's client_id.

DROP POLICY IF EXISTS "form_templates_client_own_select" ON form_templates;
CREATE POLICY "form_templates_client_own_select" ON form_templates
  FOR SELECT USING (
    owner_type = 'customer'
    AND owner_id IN (SELECT client_id FROM client_users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "form_templates_client_own_insert" ON form_templates;
CREATE POLICY "form_templates_client_own_insert" ON form_templates
  FOR INSERT WITH CHECK (
    owner_type = 'customer'
    AND owner_id IN (SELECT client_id FROM client_users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "form_templates_client_own_update" ON form_templates;
CREATE POLICY "form_templates_client_own_update" ON form_templates
  FOR UPDATE USING (
    owner_type = 'customer'
    AND owner_id IN (SELECT client_id FROM client_users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "form_templates_client_own_delete" ON form_templates;
CREATE POLICY "form_templates_client_own_delete" ON form_templates
  FOR DELETE USING (
    owner_type = 'customer'
    AND owner_id IN (SELECT client_id FROM client_users WHERE id = auth.uid())
  );

-- template_versions inherits ownership through template_id. Customers need
-- to read/write versions of templates they own (forked or built-from-scratch).

DROP POLICY IF EXISTS "template_versions_client_own_select" ON template_versions;
CREATE POLICY "template_versions_client_own_select" ON template_versions
  FOR SELECT USING (
    template_id IN (
      SELECT id FROM form_templates
      WHERE owner_type = 'customer'
        AND owner_id IN (SELECT client_id FROM client_users WHERE id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "template_versions_client_own_write" ON template_versions;
CREATE POLICY "template_versions_client_own_write" ON template_versions
  FOR INSERT WITH CHECK (
    template_id IN (
      SELECT id FROM form_templates
      WHERE owner_type = 'customer'
        AND owner_id IN (SELECT client_id FROM client_users WHERE id = auth.uid())
    )
  );
