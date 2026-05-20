-- 009_clients_contact_columns.sql
-- Bring the clients table in line with the application contract:
--  * `contact_name` / `contact_email` / `contact_phone` — primary contact at the org,
--    captured by the New Client dialog and displayed on the proposal pages.
--  * `deleted_at` — soft-delete column for future parity with the rest of the schema.
--  * `updated_at` — audit column with trigger, matching services / proposals.
--
-- Safe to apply: all columns nullable or with defaults; existing rows backfill cleanly.

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS contact_name  TEXT,
  ADD COLUMN IF NOT EXISTS contact_email TEXT,
  ADD COLUMN IF NOT EXISTS contact_phone TEXT,
  ADD COLUMN IF NOT EXISTS deleted_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE OR REPLACE FUNCTION clients_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS clients_updated_at ON clients;
CREATE TRIGGER clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW
  EXECUTE FUNCTION clients_set_updated_at();
