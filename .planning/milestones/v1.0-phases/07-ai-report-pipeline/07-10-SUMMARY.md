---
phase: 07-ai-report-pipeline
plan: 10
subsystem: ui
tags: [next.js, supabase, admin-dashboard, workflow_errors, observability, d-09, d-11]

# Dependency graph
requires:
  - phase: 07-ai-report-pipeline
    provides: "workflow_errors INSERT path with workflow_name='ai_report_draft' / 'report_delivery_email' (07-02, 07-04); D-09 canonical status taxonomy written by runReportDraftGeneration + finalizeReport"
provides:
  - "Row-level workflow_errors list section at /admin/month-summary (workflow_name, error_message, severity, submission_id deep-link, created_at)"
  - "D-09 canonical statusLabel/statusColor maps on the assessments table render (completed, ai_draft_failed, in_progress added)"
  - "Closes 07-VERIFICATION.md gap #3 (REPORT-12 / CONTEXT D-11(c) acceptance — admin dashboard shows the error row, not just a count)"
affects: [phase-07-reverify, future-observability-passes]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single-Promise.all fetch for stat-card-count + row-list pair against the same table (preserves round-trip count, avoids waterfall)"
    - "25-row admin-surface cap with cap-hit hint instead of pagination v1"
    - "JSX text-node rendering for untrusted error_message (T-07-10-01 mitigation; zero dangerouslySetInnerHTML)"

key-files:
  created:
    - ".planning/phases/07-ai-report-pipeline/07-10-SUMMARY.md"
  modified:
    - "app/admin/month-summary/page.tsx"

key-decisions:
  - "Used `text-danger` Tailwind utility (backed by `--color-danger` in app/globals.css :26 / :137 / :179) rather than the `text-red-400` fallback — token IS present in the v4 @theme block, so the primary path applies."
  - "Cap recent error rows at 25; render a cap-hit hint when length === 25 ('Showing 25 most recent — see direct DB query for full month') instead of building pagination or a separate /admin/workflow-errors route in v1."
  - "Legacy `draft` / `delivered` keys retained in both statusLabel and statusColor for backward-compat with pre-D-09 rows. New D-09 keys (`in_progress`, `submitted`, `draft_ready_for_review`, `completed`, `ai_draft_failed`) added alongside them."
  - "Kept `errorsRes` count fetch unchanged — both the stat-card (`04 Workflow Errors`) total AND the row list are required surfaces per D-11(c)."

patterns-established:
  - "Workflow-errors row-list section: same Card wrapper / header-bar / native <table> / empty-state language as the existing assessments table — no new dep, no shadcn Table import."
  - "Severity → color mapping via local `severityColor: Record<string, string>` const (high=danger / medium=gold / low=white/40) with case-insensitive lookup."

requirements-completed: [REPORT-12]

# Metrics
duration: ~12min
completed: 2026-05-29
---

# Phase 7 Plan 10: Workflow Errors row-list + D-09 status maps on /admin/month-summary Summary

**Adds a row-level Workflow Errors list section to /admin/month-summary (workflow_name + error_message + severity + submission deep-link + created_at) and updates statusLabel/statusColor maps to the D-09 canonical taxonomy, closing 07-VERIFICATION gap #3 (REPORT-12 / D-11(c) acceptance).**

## Performance

- **Duration:** ~12 minutes
- **Started:** 2026-05-29T (plan execution start)
- **Completed:** 2026-05-29
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- New "Workflow Errors This Month" Card section visible immediately below the four stat cards on /admin/month-summary
- Each row renders workflow_name (mono), truncated error_message (max-w-md truncate, JSX text only), severity pill (high → text-danger, medium → text-gold, low/null → text-white/40), a deep-link to /admin/assessments/{submission_id}/review when scoped (first 8 UUID chars), and an en-GB short timestamp (day, month, hour:min)
- statusLabel / statusColor maps extended with the full D-09 canonical taxonomy (`in_progress`, `submitted`, `draft_ready_for_review`, `completed`, `ai_draft_failed`) — assessments table no longer renders `completed` / `ai_draft_failed` as raw lowercase strings
- Cap-hit hint surfaces when the 25-row cap is reached, directing Matt to a direct DB query for the full audit
- Empty-state copy `"No workflow errors this month"` mirrors the assessments empty state convention
- Stat card row UNCHANGED (num 04, label "Workflow Errors") — both the count badge AND the row-list section are present

## Task Commits

Each task was committed atomically on `main`:

1. **Task 1: Add row-level workflow_errors list section and update D-09 status maps in /admin/month-summary** — `b7c42ca` (feat)

## Files Created/Modified
- `app/admin/month-summary/page.tsx` — Added 5th `Promise.all` entry that fetches `workflow_errors` rows (id, workflow_name, error_message, submission_id, severity, created_at) capped at 25, ordered by created_at desc, scoped to startOfMonth. Added local `severityColor` Record. Extended `statusLabel` / `statusColor` maps with D-09 canonical keys. Inserted a new `<Card>` section between the stat-cards `<div>` and the existing "Recent Assessments" Card. Net diff: +97 / -5.

### Diff scope (line ranges)

- Promise.all (originally lines 13-30): expanded to include `errorRowsRes` and a `recentErrors` array (~10 added lines)
- statusLabel / statusColor maps (originally lines 77-89): expanded to include 5 D-09 canonical keys; legacy `draft` / `delivered` retained; new `severityColor` map added (~15 added lines)
- New `Workflow Errors This Month` Card section: ~67 added lines, inserted between the stat-cards grid and the "Recent Assessments" Card

## Decisions Made
- **Tailwind severity token:** Used `text-danger` (not the `text-red-400` fallback). Verified via `grep "danger" app/globals.css` — `--color-danger` is defined in the `@theme` block at lines 26, 137 (light), and 179 (dark, brick red). Tailwind v4 exposes `text-danger` automatically. No fallback path was needed.
- **Severity case-insensitivity:** `(e.severity ?? "").toLowerCase()` is used as the lookup key into `severityColor` so future writes that send `"High"` or `"HIGH"` still render with the correct token.
- **25-row cap:** Admin-surface bound, not pagination. Reasonable for one month of error volume; cap-hit hint covers the edge case where a runaway loop floods the table.

## Deviations from Plan

None — plan executed exactly as written. All four edits applied per spec, all eight `<automated>` gates green, all `<acceptance_criteria>` met.

(Notes: the plan offered a `text-danger` → `text-red-400` fallback if the danger token was unavailable; I verified the token IS present in `app/globals.css` and used the primary path, which is the plan's preferred branch.)

---

**Total deviations:** 0
**Impact on plan:** Plan shipped as authored.

## Issues Encountered

None during the task itself. During the post-edit `tsc --noEmit` sweep I observed a batch of pre-existing TypeScript errors in `tests/form-builder/*` (incompatible builder-attribute typing in test fixtures). These are unrelated to month-summary and predate this plan; per the scope-boundary rule in the executor protocol, they are out of scope and have not been touched. The modified file (`app/admin/month-summary/page.tsx`) emits zero TypeScript errors.

## Behaviour Confirmations

- **Zero workflow_errors this month:** `recentErrors.length === 0` → empty-state copy `"No workflow errors this month"` renders inside the new Card.
- **1–24 workflow_errors this month:** Rows render; no cap-hit hint shown.
- **25+ workflow_errors this month:** Exactly 25 rows shown (the most recent); cap-hit hint `"Showing 25 most recent — see direct DB query for full month"` renders below the table.
- **`submission_id` null (non-submission-scoped errors from other phases):** Em-dash placeholder renders instead of a broken link.
- **Severity null / unknown:** Falls back to `text-white/40`; em-dash placeholder renders.
- **Stat card (`04 Workflow Errors`):** Untouched. Still drives off `errorsRes.count` (the original count-only fetch).
- **Recent Assessments table:** Untouched. Now renders `Completed` / `AI Draft Failed` / `In Progress` for D-09 rows that previously displayed as raw lowercase strings.
- **Legacy taxonomy compat:** Pre-D-09 rows with `draft` or `delivered` status still resolve via the retained legacy keys.

## Security Notes (Threat-Model Mitigations Applied)

- **T-07-10-01 (Tampering / XSS):** `error_message` rendered via JSX text node `{e.error_message}` — React's default escaping applies. ZERO `dangerouslySetInnerHTML` (verified by `<automated>` gate `! grep -q "dangerouslySetInnerHTML"`).
- **T-07-10-02 (Information Disclosure):** Page is admin-only (`/admin/*` middleware-gated, `adminClient` server-side fetch). `payload` JSONB column is NOT rendered (defensive minimisation).
- **T-07-10-03 (Repudiation via 25-row cap):** Cap-hit hint instructs the operator to drop into DB tooling for the full audit; stat-card retains the EXACT month-total count, so the total is never hidden.
- **T-07-10-04 (DoS via long messages):** `max-w-md truncate` Tailwind utility caps per-row width without bypassing escaping.
- **T-07-10-05 (Cross-org submission_id link):** Target route enforces its own admin-only auth + RLS — stale or cross-org clicks resolve to the route's own response, not a bypass.

## User Setup Required

None — no external service configuration required. The new section reads existing `workflow_errors` rows; no env vars, migrations, or secrets.

## Next Phase Readiness

- 07-VERIFICATION.md gap #3 (REPORT-12 / D-11(c)) is observably closed: row-level rendering of workflow_name, error_message, severity, submission_id deep-link, and created_at is now present on /admin/month-summary. The CONTEXT D-10 truth "Row is visible in `/admin/month-summary`" is satisfied.
- The two remaining 07-VERIFICATION gaps (REPORT-05/06 PDF renderer dep + REPORT-08 field_media.transcript schema) are addressed by sibling plans 07-08 and 07-09 respectively (07-09 ships in commit `307cf08` immediately before this plan).
- Phase 7 is one step closer to a green re-verification. Recommend re-running gsd-verify against 07-VERIFICATION.md once 07-08 lands.

## Self-Check: PASSED

- File `app/admin/month-summary/page.tsx` exists and contains the row-list section ✓
- Commit `b7c42ca` present in `git log` ✓
- SUMMARY file at `.planning/phases/07-ai-report-pipeline/07-10-SUMMARY.md` (this file) ✓

---
*Phase: 07-ai-report-pipeline*
*Completed: 2026-05-29*
