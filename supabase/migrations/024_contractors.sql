-- 024_contractors.sql
-- Approved contractor directory. Matt curates the list on /admin/directory;
-- clients browse a read-only copy on /client/directory.
--
-- Writes go through the service-role adminClient behind requireAdmin() (same
-- pattern as the service catalog), but RLS still encodes the contract directly:
-- any authenticated user can read, only admin_users members can write.

CREATE TABLE IF NOT EXISTS contractors (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL,
  category     TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  phone        TEXT NOT NULL,
  email        TEXT NOT NULL,
  website      TEXT,
  address      TEXT,
  notes        TEXT,
  -- Inactive contractors stay in the admin list but are hidden from clients.
  active       BOOLEAN NOT NULL DEFAULT TRUE,
  deleted_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE contractors ENABLE ROW LEVEL SECURITY;

-- Any signed-in user (admin or client) can read the directory.
DROP POLICY IF EXISTS "contractors_authenticated_select" ON contractors;
CREATE POLICY "contractors_authenticated_select" ON contractors
  FOR SELECT USING (auth.role() = 'authenticated');

-- Writes are admin-only.
DROP POLICY IF EXISTS "contractors_admin_insert" ON contractors;
CREATE POLICY "contractors_admin_insert" ON contractors
  FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.id = auth.uid()));

DROP POLICY IF EXISTS "contractors_admin_update" ON contractors;
CREATE POLICY "contractors_admin_update" ON contractors
  FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.id = auth.uid()));

DROP POLICY IF EXISTS "contractors_admin_delete" ON contractors;
CREATE POLICY "contractors_admin_delete" ON contractors
  FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.id = auth.uid()));
