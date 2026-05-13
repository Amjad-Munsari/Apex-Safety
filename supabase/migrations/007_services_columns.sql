-- 007_services_columns.sql
-- Bring the services table in line with the application contract:
--  * `unit` — pricing unit shown next to the amount ("each", "course", "month", …)
--  * `created_at` / `updated_at` — audit timestamps the admin actions already try to write
--
-- These columns are added with safe defaults so existing rows backfill cleanly,
-- and `services` is small enough that the DEFAULT NOW() backfill is fine in one shot.

ALTER TABLE services
  ADD COLUMN IF NOT EXISTS unit       TEXT        NOT NULL DEFAULT 'each',
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Keep updated_at honest on every UPDATE.
CREATE OR REPLACE FUNCTION services_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS services_updated_at ON services;
CREATE TRIGGER services_updated_at
  BEFORE UPDATE ON services
  FOR EACH ROW
  EXECUTE FUNCTION services_set_updated_at();
