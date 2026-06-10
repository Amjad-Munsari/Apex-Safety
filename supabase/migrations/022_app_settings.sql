-- 022_app_settings.sql
-- Singleton settings row backing the admin Settings page: notification defaults
-- (sign-off / sender names, expiry-reminder + upload-notification toggles) and a
-- branding logo. All reads/writes go through the service-role adminClient, so the
-- table is RLS-enabled with no policies (service role bypasses RLS).

CREATE TABLE IF NOT EXISTS app_settings (
  id                       integer     PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  sign_off_name            text        NOT NULL DEFAULT 'Matt Robinson',
  sender_name              text        NOT NULL DEFAULT '888 Safety & Training',
  expiry_reminders_enabled boolean     NOT NULL DEFAULT true,
  notify_on_upload         boolean     NOT NULL DEFAULT true,
  logo_path                text,
  updated_at               timestamptz NOT NULL DEFAULT now()
);

-- Seed the single row so callers can always UPDATE id=1.
INSERT INTO app_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON app_settings FROM anon, authenticated;

-- Public branding bucket for the org logo (rendered on the client portal). The
-- logo is non-sensitive and needs a stable public URL, so the bucket is public.
INSERT INTO storage.buckets (id, name, public)
VALUES ('branding', 'branding', true)
ON CONFLICT (id) DO NOTHING;

-- Anyone may read branding assets; writes are service-role only (adminClient).
DROP POLICY IF EXISTS "branding_public_read" ON storage.objects;
CREATE POLICY "branding_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'branding');
