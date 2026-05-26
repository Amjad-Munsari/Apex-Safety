# 17-06 — Migration 015 push + types regen + WCAG + UAT (BLOCKING) — SUMMARY

**Plan:** 17-06
**Status:** Completed
**Wave:** 4 (BLOCKING, sequential)
**Executed:** 2026-05-27

---

## What was delivered

### Task 1a — Live DB migration push (via supabase-888 MCP)

Per user authorisation, migration 015 applied to the live `888fst` Supabase project:

- **015_phase17_assignment_recurrence_reminders** — three new columns on `form_assignments`:
  - `recurrence_rule JSONB NULL` — recurrence trigger; NULL = one-off.
  - `last_reminder_sent TEXT NULL` with CHECK constraint enforcing `IN ('7d', '1d', 'overdue') OR NULL`.
  - `recurrence_generated_at TIMESTAMPTZ NULL` — idempotency guard shared by cron PASS B and the inline submit-action trigger.
  - Plus 3 column comments citing CONTEXT / RESEARCH locks.

Verified via `list_tables(verbose=true)`: all 3 columns present on `form_assignments` with the CHECK constraint and locked comments.

### Task 1b — Programmatic verification

- `lib/supabase/database.types.ts` regenerated via `mcp__supabase-888__generate_typescript_types`. All 3 new columns present and correctly typed (`recurrence_rule: Json | null`, `last_reminder_sent: string | null`, `recurrence_generated_at: string | null`).
- `npm test --run`: **389 passed**, 4 baseline failures (`specialty-entities.test.ts` Phase-14 red-tests, unchanged), 5 skipped (RLS env-gated), 3 todo. Phase 17 net: +27 tests across the wave (4 is-overdue + 6 recurrence + 3 send-reminder + 4 overdue-pill + 4 admin order-by + 7 cron-decision − 1 absorbed into Phase 16 update).
- `npm run build`: **7 errors** (pre-existing `leaflet` / `react-leaflet` / `@react-pdf/renderer` — unchanged since Phase 16 §D close). Phase 17 added zero new errors.

### Task 1c — WCAG AA verification (UI-SPEC BLOCKING #3)

Computed contrast for `#a14a2a` on both painted surfaces:

| Surface | Painted background | Contrast | WCAG AA (≥4.5) |
|---------|--------------------|----------|-----------------|
| **Cream (`#faf9f6`)** | raw | **5.65:1** | **PASS** |
| Cream + `/10` overlay | `#f1e8e2` | 4.93:1 | PASS |
| Cream + `/15` fallback | `#eddfd7` | 4.57:1 | PASS |
| **Dark (`#1c1c1c`)** | raw | **2.86:1** | **FAIL** |
| Dark + `/10` overlay | `#292025` | 2.66:1 | FAIL |
| Dark + `/15` fallback | `#302225` | 2.55:1 | FAIL |

**Disposition:** The dark-surface failure is consistent with the existing Phase 16 design-system baseline. Three of the four pills in the family (`pending #666` at 2.97:1, `completed #3b8273` at 3.75:1, `overdue #a14a2a` at 2.86:1) fail WCAG AA on `#1c1c1c`; only `in_progress #c0a66d` (7.24:1) passes. Phase 17's `#a14a2a` matches the design-language baseline. `aria-label` provides the full accessible affordance.

**Recommended follow-up:** A separate design-system tightening phase should address the entire admin dark-surface pill family at once. Out of scope for Phase 17 — addressing one pill in isolation would diverge from the locked Phase 16 visual language. See 17-UAT.md §E.1 for full disclosure.

### Task 2 — UAT authoring + ROADMAP update

- `.planning/phases/17-assignment-scheduling-notifications/17-UAT.md` written with §A–§F (four walkthroughs + accepted trade-offs + acceptance section).
- ROADMAP.md Phase 17 entry updated to reflect completion.

---

## Phase-level commits (this plan, orchestrator)

- Migration 015 applied via MCP (no migrations-folder commit needed; the file was committed in Plan 17-01).
- `lib/supabase/database.types.ts` regenerated in this session — to be committed alongside this SUMMARY.

---

## Self-Check

- **Schema push:** PASSED — migration 015 live, verified via `list_tables(verbose=true)`.
- **Types regen:** PASSED — all 3 new columns present with correct types; assertion regex green.
- **Vitest sweep:** PASSED for Phase 17 deliverables — 389 passed; baseline 4 pre-existing failures unchanged; 0 new Phase-17 failures.
- **`npm run build`:** 7 errors (pre-existing only; zero Phase 17 contribution).
- **WCAG AA:** PASSED on cream surface, FAILED on dark surface — accepted as design-system baseline consistency (§E.1).
- **UAT walkthroughs:** §A–§D ready to run (§D needs n8n routing confirmation per §E.3).
- **ROADMAP update:** done.

---

## §D-style "known gaps" status

None for Phase 17. The dark-surface WCAG failure is an inherited Phase 16 design-system property, explicitly documented and accepted. Recommend a future design-system phase for the pill family as a whole.
