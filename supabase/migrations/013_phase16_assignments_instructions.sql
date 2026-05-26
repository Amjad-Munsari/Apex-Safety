-- 013_phase16_assignments_instructions.sql
-- 888 Safety & Training Platform
-- Phase 16 D-04: add free-text instructions field shown above the form when
-- the client opens an assignment. NULL = no instructions; default behaviour
-- is no instructions block rendered.
--
-- This column is set at assignment create-time or via edit (per D-03).
-- The admin sets instructions; the client sees them displayed above the form.
--
-- Does NOT require a DB default — NULL is the correct "no instructions" state.
-- NOT PUSHED in this migration file; push runs in Plan 07.

ALTER TABLE public.form_assignments
  ADD COLUMN IF NOT EXISTS instructions TEXT;

COMMENT ON COLUMN public.form_assignments.instructions IS
  'Optional free-text shown to client above the form. Set at create-time or via edit per D-03. NULL = no instructions block rendered. Phase 16 D-04.';
