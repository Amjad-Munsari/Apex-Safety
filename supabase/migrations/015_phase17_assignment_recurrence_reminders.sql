-- 015_phase17_assignment_recurrence_reminders.sql
-- 888 Safety & Training Platform
-- Phase 17: add recurrence rule + reminder dedup + recurrence idempotency guard
-- columns to form_assignments.
--
-- Decision references:
--   CONTEXT §"Recurrence semantics": recurrence_rule JSONB (column, not child table;
--     per RESEARCH §Q3 — the only realistic query is a per-row lookup at completion time).
--   CONTEXT §"Reminder schedule": last_reminder_sent TEXT lifecycle is monotone
--     NULL → '7d' → '1d' → 'overdue' (RESEARCH §Q8 — JSONB struct buys nothing).
--   RESEARCH §Q4: next migration number is 015 (directory verified).
--   RESEARCH §Example 5 / §Q4: three columns + CHECK in a single migration file so
--     partial pushes never leave the cron crashing for one tick.
--   recurrence_generated_at: idempotency guard for cron PASS B — prevents a
--     completed row with a recurrence_rule being processed twice (RESEARCH §A4 /
--     CONTEXT Threat-model anchor "re-running the cron must NOT re-generate").
--
-- NOT PUSHED in this file; push runs in Plan 17-06 (Wave 4, BLOCKING).

ALTER TABLE public.form_assignments
  ADD COLUMN IF NOT EXISTS recurrence_rule JSONB;

ALTER TABLE public.form_assignments
  ADD COLUMN IF NOT EXISTS last_reminder_sent TEXT;

ALTER TABLE public.form_assignments
  ADD COLUMN IF NOT EXISTS recurrence_generated_at TIMESTAMPTZ;

-- Enforce cadence vocab at the DB level (RESEARCH §P4 anti-pattern guard +
-- STRIDE T-17-01 mitigation).
ALTER TABLE public.form_assignments
  ADD CONSTRAINT form_assignments_last_reminder_sent_check
  CHECK (last_reminder_sent IS NULL
         OR last_reminder_sent IN ('7d', '1d', 'overdue'));

COMMENT ON COLUMN public.form_assignments.recurrence_rule IS
  'Optional recurrence trigger. NULL = one-off assignment. Shape: { "frequency": "weekly" | "monthly" | "quarterly" | "annually" }. v1 vocab only; RFC 5545 RRULE out of scope. Phase 17 CONTEXT locked.';

COMMENT ON COLUMN public.form_assignments.last_reminder_sent IS
  'Latest reminder cadence dispatched. NULL → 7d → 1d → overdue. Updated AFTER successful n8n dispatch only — failure leaves the column unchanged so the next cron tick retries. Phase 17 CONTEXT locked.';

COMMENT ON COLUMN public.form_assignments.recurrence_generated_at IS
  'Timestamp when the successor row was generated for this completed assignment. NULL = not yet. Idempotency guard for cron PASS B AND the inline submit-action trigger (Plan 17-04). Phase 17 RESEARCH §Example 5.';
