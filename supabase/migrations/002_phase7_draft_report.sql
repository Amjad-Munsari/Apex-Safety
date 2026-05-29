-- Phase 7: Add draft_report_json, status, and report_storage_path to form_submissions
--
-- VESTIGIAL (kept for migration-history continuity, not applied to live DB):
--
-- All three columns (draft_report_json, status, report_storage_path) are
-- already defined in 001_initial_schema.sql, so every ADD COLUMN IF NOT
-- EXISTS below is a no-op against the canonical schema. The earlier
-- `status text DEFAULT 'Draft'` here used a capital D that does NOT match
-- 001's `status TEXT NOT NULL DEFAULT 'draft'` (lowercase) — code paths
-- in actions.ts always set status explicitly, so the default is
-- unreachable from product code, but the casing mismatch is misleading.
--
-- Do NOT extend this file. New schema changes go in a fresh migration.
-- See `.planning/phases/07-ai-report-pipeline/07-CONTEXT.md` D-09 for the
-- canonical status taxonomy (in_progress / submitted / draft_ready_for_review
-- / completed / ai_draft_failed).
--
-- Surfaced by code audit 2026-05-29.

ALTER TABLE public.form_submissions
ADD COLUMN IF NOT EXISTS draft_report_json jsonb,
ADD COLUMN IF NOT EXISTS status text DEFAULT 'Draft',
ADD COLUMN IF NOT EXISTS report_storage_path text;
