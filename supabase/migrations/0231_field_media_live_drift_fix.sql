-- 023: field_media live-DB drift fix
--
-- The live database was missing the field_media table entirely (PGRST205:
-- "Could not find the table 'public.field_media' in the schema cache"),
-- even though migration 001 defines it. Every photo/signature upload via
-- uploadMediaAction succeeded into the form-media bucket, then threw on the
-- audit-row INSERT — surfacing as the "Failed / Dismiss" overlay in the
-- multi-photo field.
--
-- APPLIED TO LIVE 2026-06-11 via Management API. This file records the DDL
-- so migrations match the live schema.
--
-- Note: field_media_admin_all uses the live admin_users membership check
-- (the 001 version used the dead app_metadata.role='admin' JWT claim that
-- migration 022 retired everywhere else).

CREATE TABLE IF NOT EXISTS public.field_media (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id  UUID NOT NULL REFERENCES public.form_submissions(id) ON DELETE CASCADE,
  field_id       TEXT NOT NULL,
  storage_path   TEXT NOT NULL,
  media_type     TEXT NOT NULL, -- 'image', 'audio'
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at     TIMESTAMPTZ
);

ALTER TABLE public.field_media ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS field_media_admin_all ON public.field_media;
CREATE POLICY field_media_admin_all ON public.field_media
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.admin_users au WHERE au.id = auth.uid())
  );

DROP POLICY IF EXISTS field_media_client_select ON public.field_media;
CREATE POLICY field_media_client_select ON public.field_media
  FOR SELECT USING (
    submission_id IN (
      SELECT id FROM public.form_submissions WHERE client_id IN (
        SELECT client_id FROM public.client_users WHERE id = auth.uid()
      )
    )
  );

CREATE INDEX IF NOT EXISTS idx_field_media_submission ON public.field_media(submission_id);
