-- 005_template_versions_polymorphic_created_by.sql
-- Mirror of migration 003's polymorphic owner_id pattern, applied to
-- template_versions.created_by.
--
-- Migration 001 declared created_by as REFERENCES admin_users(id), but
-- once 003 enabled customer-owned templates, customers also write versions
-- — and their auth user IDs aren't in admin_users. The previous FK would
-- throw a constraint violation on every customer save/publish/fork.
--
-- Discriminator: the parent template's owner_type. When the parent is
-- owner_type='admin', created_by points at admin_users; when 'customer',
-- it points at auth.users (specifically a row in client_users).

ALTER TABLE template_versions
  DROP CONSTRAINT IF EXISTS template_versions_created_by_fkey;
