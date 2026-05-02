-- Phase 7: Add draft_report_json, status, and report_storage_path to form_submissions

ALTER TABLE public.form_submissions
ADD COLUMN IF NOT EXISTS draft_report_json jsonb,
ADD COLUMN IF NOT EXISTS status text DEFAULT 'Draft',
ADD COLUMN IF NOT EXISTS report_storage_path text;
