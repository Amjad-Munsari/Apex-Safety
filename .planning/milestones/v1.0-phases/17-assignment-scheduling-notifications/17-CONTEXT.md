# Phase 17 — Assignment Scheduling + Notifications — CONTEXT

**Authored:** 2026-05-27 (skipping discuss-phase Q&A; context derived from ROADMAP success criteria + repo memory + Phase 16 schema state)
**Depends on:** Phase 16 (form_assignments / form_submissions / multi-tenancy schema)

---

## Locked decisions (treat as inputs, not open questions)

### Notification infrastructure — LOCKED
- **All reminders route through n8n** to **Proton Mail** (`888FST@proton.me`). The n8n→Proton bridge is the only outbound email surface for this phase.
- **NO direct Twilio / Resend integration** in Phase 17 — those are explicitly deferred per `memory/deferred_work.md`. If a Phase 17 success criterion needs SMS, treat it as out-of-scope and surface as a deviation.
- The cron lives on **Vercel Cron** (`vercel.json` / Vercel Functions). No third-party scheduler.

### Recurrence semantics — LOCKED
- **When a prior occurrence completes** (assignment.status='completed') AND the parent assignment has a recurrence rule → generate the next occurrence pinned to the *latest published* template_version of the master template (per ROADMAP §1). Customer-forked templates: the fork's *own* latest published version (Phase 16 D-08 polymorphism).
- Generated assignments inherit: `client_id`, `template_id` (the master OR fork the prior occurrence pointed at), `assigned_by`, `instructions` (Phase 16 D-04 column).
- Recurrence frequency vocabulary: at minimum `weekly`, `monthly`, `quarterly`, `annually`. Custom RRULE expressions out-of-scope for v1.

### Overdue semantics — LOCKED
- An assignment is **overdue** when `due_date < CURRENT_DATE` AND `status != 'completed'` AND `deleted_at IS NULL`.
- Overdue surfaces as a **visual flag** on both `/admin/clients/[id]` (Assigned Forms tab from Plan 16-03) and `/client/assignments` (the tabs from Plan 16-04). The flag is a derived state — NOT a separate database column.

### Reminder schedule — LOCKED
- Schedule cadence: **7 days before due**, **1 day before due**, **on overdue (transition day)**.
- **Deduplication:** a new column `form_assignments.last_reminder_sent TEXT NULL` records the last cadence that fired (`'7d'`, `'1d'`, `'overdue'`). The cron skips any cadence already recorded for that assignment.
- A revoked assignment (`deleted_at IS NOT NULL`) NEVER sends reminders.
- A completed assignment NEVER sends reminders.

### Multi-tenancy invariants — INHERITED FROM PHASE 16
- All new tables/columns honor cross-org RLS — the same isolation contract Phase 16 proved via `tests/rls/multi-tenancy.spec.ts`.
- `client_id` MUST always derive from `requireClientContext()` (or `auth.uid()` for admin-triggered paths) — never accepted from a client payload (Phase 16 T-16-04 invariant carries forward).

---

## Open questions for the researcher / planner (use repo + web research, NOT user Q&A)

These are unknowns that the gsd-phase-researcher should resolve via codebase + docs research, not by asking the user:

1. **Vercel Cron syntax + Next.js 16 integration** — the right place to declare the daily cron, how it authenticates (`CRON_SECRET` env var pattern), and the recommended handler signature in App Router.
2. **n8n webhook contract** — how Phase 5 (`Document Upload + Expiry Alerts`) currently triggers n8n (which the recurrence reminders should mirror exactly). The phase-researcher must read the Phase 5 SUMMARY + n8n bridge code to match the existing pattern.
3. **Recurrence rule storage shape** — column on `form_assignments` vs. a child table. The researcher should compare: nullable JSONB `recurrence_rule` on form_assignments OR a separate `assignment_schedules` table. Decide based on query patterns (list overdue, list upcoming, generate next occurrence).
4. **Schema migrations** — new migration `015_phase17_*` likely needed. Confirm next migration number from `supabase/migrations/` directory.
5. **Latest-published lookup** — when generating a recurrence, the lookup is `template_versions WHERE template_id = X AND published_at IS NOT NULL ORDER BY version_number DESC LIMIT 1`. Confirm this matches Phase 16's pattern in `app/client/templates/[id]/fill/page.tsx`.
6. **Time zone handling** — `form_assignments.due_date` is a DATE. The cron runs at UTC midnight by default. Confirm whether the "overdue today" check needs UK locale handling (Matt/Yellow Broom are UK-based).

---

## Scope boundaries

### IN SCOPE for Phase 17
- New migration adding columns/tables for recurrence + reminder dedup.
- Vercel daily cron handler (`app/api/cron/assignment-scheduler/route.ts` or similar).
- n8n webhook integration for outbound reminders (no direct email send from the Vercel function).
- Overdue badge UI on `/admin/clients/[id]` Assigned Forms tab and `/client/assignments` tabs.
- Vitest coverage: recurrence rule generation, dedup logic, overdue derivation, RLS regression on any new tables.

### OUT OF SCOPE for Phase 17 (push to a later phase or backlog)
- SMS reminders (Twilio explicitly deferred per memory).
- Custom RRULE / RFC 5545 — only the 4 frequency vocab values.
- Bulk reschedule / pause-all admin UI.
- Per-user reminder preferences.
- Calendar sync (iCal export).
- Phase 18 FRA seed template work — separate dependency tree.

---

## Success Criteria (from ROADMAP — verbatim)

1. Recurring assignments auto-generate when the prior occurrence is completed, referencing the latest published version.
2. Overdue assignments are flagged in both admin and client dashboards.
3. A daily cron processes recurrences and overdue marking.
4. Reminder notifications send at 7 days, 1 day, and on overdue, deduped via `last_reminder_sent`.

---

## Threat-model anchors (for the planner to extend)

| Trust boundary | Note |
|----------------|------|
| Vercel cron → DB | Cron handler MUST verify `CRON_SECRET` (Vercel's mechanism) before reading/writing. |
| Cron → n8n | Webhook signed (HMAC) to prevent replay. Match the pattern Phase 5 already uses. |
| Recurrence generation → multi-tenancy | The generated assignment row's `client_id` MUST be sourced from the *prior* assignment row (server-side carryover), NEVER from the webhook payload. |
| Reminder dedup | `last_reminder_sent` is updated **after** the n8n call succeeds — otherwise a network blip would skip the actual send. Idempotency: re-running the cron after a transient failure must re-send. |

---

## Reference points the planner should read

- `.planning/phases/16-multi-tenancy-fork-on-fill/16-CONTEXT.md` — multi-tenancy invariants this phase inherits.
- `.planning/phases/16-multi-tenancy-fork-on-fill/16-04-SUMMARY.md` — `/client/assignments` query shape (the overdue badge mounts here).
- `.planning/phases/16-multi-tenancy-fork-on-fill/16-03-SUMMARY.md` — `/admin/clients/[id]` Assigned Forms tab (the other overdue mount point).
- `.planning/phases/5-document-upload-expiry-alerts/*-SUMMARY.md` — existing n8n bridge pattern (Phase 5 set the precedent; Phase 17 must mirror it).
- `supabase/migrations/013_phase16_assignments_instructions.sql` — most recent migration shape (the next migration is `015_*`).
- `memory/email_infra.md` — Proton Mail constraint.
- `memory/deferred_work.md` — Twilio/Resend deferral.
