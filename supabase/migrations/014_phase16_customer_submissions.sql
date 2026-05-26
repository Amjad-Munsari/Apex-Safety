-- 014_phase16_customer_submissions.sql
-- 888 Safety & Training Platform
-- Phase 16 D-16: customer-built templates have no form_assignments row;
-- their submissions land with assignment_id IS NULL. Drop the NOT NULL
-- constraint set in migration 001. The FK itself is retained (still
-- REFERENCES form_assignments(id)) so admin-flow submissions remain valid.
--
-- Constraint enforcement: application-level.
--   - The fork-on-fill and assigned-fill paths always supply assignment_id.
--   - The customer-build self-fill path (new in Phase 16) is the ONLY emitter
--     of NULL assignment_id.
--   - A SQL CHECK enforcing "assignment_id IS NULL implies owner_type=customer"
--     would require a cross-table subquery (template_version → template), which
--     Postgres disallows in CHECK constraints. Application-level guard only.
--   - DO NOT add a TRIGGER for this constraint (adds latency + complexity).
--
-- NOT PUSHED in this migration file; push runs in Plan 07.

ALTER TABLE public.form_submissions
  ALTER COLUMN assignment_id DROP NOT NULL;

COMMENT ON COLUMN public.form_submissions.assignment_id IS
  'NULL only when this submission is against a customer-owned template (owner_type=customer) with no preceding assignment. All admin-assigned and admin-on-site flows MUST set this; enforcement is application-level (Postgres CHECK cannot subquery cross-table). Phase 16 D-16.';
