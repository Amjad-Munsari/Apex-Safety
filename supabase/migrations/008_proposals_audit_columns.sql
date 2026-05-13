-- 008_proposals_audit_columns.sql
-- Audit trail for the proposal lifecycle: when did it leave admin, and
-- when did the client first open it? `created_at` / `updated_at` already
-- exist on the table; this adds the two transitional timestamps.

ALTER TABLE proposals
  ADD COLUMN IF NOT EXISTS sent_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS viewed_at TIMESTAMPTZ;

-- Keep updated_at honest on every UPDATE.
CREATE OR REPLACE FUNCTION proposals_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS proposals_updated_at ON proposals;
CREATE TRIGGER proposals_updated_at
  BEFORE UPDATE ON proposals
  FOR EACH ROW
  EXECUTE FUNCTION proposals_set_updated_at();
