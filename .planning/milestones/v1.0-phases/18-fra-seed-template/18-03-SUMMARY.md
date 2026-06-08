# 18-03 — BLOCKING db push + types + cleanup + UAT (BLOCKING) — SUMMARY

**Plan:** 18-03
**Status:** Completed
**Wave:** 2 (BLOCKING, sequential)
**Executed:** 2026-05-27

---

## What was delivered

### Task 1a — Live DB migration push (via supabase-888 MCP)

Per user authorisation, migration 016 applied to the live `888fst` Supabase project. Two rows inserted (ON CONFLICT DO NOTHING):

- **`form_templates`** row `00000000-0000-4000-a000-000000000018` — name: "Fire Risk Assessment (Type 3) — Single Premises", `template_type='fra'`, `owner_type='admin'`, `is_published=true` (Pitfall P2 satisfied), `owner_id` resolved via `SELECT id FROM admin_users LIMIT 1` (Pitfall P3 satisfied).
- **`template_versions`** row `00000000-0000-4000-a000-000000000118` — `version_number=1`, `published_at=NOW()` (Pitfall P2 satisfied), full FormBuilderSchema in `schema_json`.

Verified via `execute_sql`:
```
root_len=6, entity_count=40
is_published=true, is_published_version=true
```

40 entities = 6 sectionGroups (§01–§06) + 3 conditional sub-sections (§02a, §03a, §04a) + 5 §01 children + 3 §02 + 2 §02a + 3 §03 + 2 §03a + 4 §04 + 2 §04a + 5 §05 + 4 Action Plan children + 1 §06.

### Task 1b — Types regeneration

`mcp__supabase-888__generate_typescript_types` invoked. Result: **no diff** — Migration 016 is data-only (inserted two rows; no DDL on tables). The Phase 17-generated types are still current. `lib/supabase/database.types.ts` left untouched.

### Task 2 — Legacy cleanup (Pitfall P4)

`lib/forms/fra-template.ts` (186 lines, the pre-builder hardcoded baseline) deleted after grep-confirming zero references:

```
grep -rln "HARDCODED_FRA_TEMPLATE" app/ components/ lib/ tests/ scripts/  →  zero results
grep -rln "from.*fra-template" app/ components/ lib/ tests/ scripts/      →  zero results
```

Post-deletion `npm run build` count unchanged at 7 (pre-existing leaflet + react-pdf only — zero Phase 18 contribution). Post-deletion `npm test --run` count: 405 passed (+16 net new Phase 18 tests, 0 regressions, 4 pre-existing baseline failures unchanged).

### Task 3 — UAT authoring

`.planning/phases/18-fra-seed-template/18-UAT.md` written with §A–§G:
- §A — Builder renders the FRA structure
- §B — End-to-end fill on the client surface (covers SC#2 + SC#3 + SC#4)
- §C — PAS 79 risk-score band verification (8-combination table)
- §D — n8n webhook fires on admin submission (covers SC#5)
- §E — Customer submission does NOT fire AI (P7 regression)
- §F — Accepted trade-offs (PAS 79 band confirmation, Phase 16/17 integration notes)
- §G — Acceptance + open questions for Matt

### Task 4 — ROADMAP update

`.planning/ROADMAP.md` Phase 18 entry updated: status `[x]` with completion date, Plans enumerated (3 plans), Progress Table row updated.

---

## Phase-level commits (this plan)

- Migration 016 applied via MCP (the file was committed in Plan 18-01).
- `3f13907` — chore(18-03): delete legacy lib/forms/fra-template.ts
- (this commit) — docs(18-03): close phase 18 — migration 016 live, UAT + ROADMAP

---

## Self-Check

- **Schema push:** PASSED — migration 016 live, verified via `execute_sql`.
- **Types regen:** PASSED — no diff (data-only migration; existing types remain canonical).
- **P4 cleanup:** PASSED — `lib/forms/fra-template.ts` deleted; zero stale references; build/test gates at same baseline.
- **Vitest sweep:** PASSED — 405 tests passing (+16 net from Phase 18 across 18-01 / 18-02); 4 baseline failures unchanged.
- **`npm run build`:** 7 errors (pre-existing leaflet + react-pdf only; Phase 18 contributed zero).
- **UAT walkthroughs:** §A, §B, §C, §E ready to run; §D needs `N8N_ASSESSMENT_WEBHOOK_URL` set to a request-bin.
- **ROADMAP update:** done.

---

## All 5 ROADMAP success criteria delivered

| SC | Owning plan(s) | UAT section |
|----|----------------|-------------|
| #1 — Blank FRA built via form builder, matches Yellow Broom structure | 18-01 (migration 016) | §A |
| #2 — Conditional sub-sections (Yes/No → show/hide) | 18-01 (3 conditional sectionGroups, `operator: 'equals'` rules) | §B |
| #3 — Per-field photo + STT on text fields | 18-01 + Phase 14 (MicButton in text/textarea renderers) | §B |
| #4 — PAS 79 risk matrix + Action Plan repeating | 18-01 (computedField formula='pas79' + repeatingSection with basic-type children only) | §B + §C |
| #5 — n8n webhook fires for AI report pipeline | 18-02 (inline port into `submitAssessmentAction` via `after()`) | §D |

Site Risk template stays BLOCKED until Matt provides the blank (per ROADMAP scope-lock, honored throughout the phase — zero references to "Site Risk" created).

---

## Pitfall enforcement summary (from 18-RESEARCH.md)

| Pitfall | Status |
|---------|--------|
| P1 (no riskMatrixField — use computedField) | Enforced by 18-01 Task 1 SQL + Task 2 spec Test 4 |
| P2 (is_published=true + published_at=NOW) | Enforced by 18-01 Task 1 SQL + Task 2 spec Tests 1+2; verified live via execute_sql |
| P3 (resolve real admin via SELECT, never NULL) | Enforced by 18-01 Task 1 PL/pgSQL RAISE EXCEPTION; verified live (owner_id populated) |
| P4 (verify HARDCODED_FRA_TEMPLATE refs before delete) | Enforced by 18-03 Task 2 grep-then-delete |
| P5 (no form_submissions in seed migration) | Enforced by 18-01 Task 2 spec Test 9 |
| P6 (Yes/No = selectField, `operator: 'equals'` not 'contains') | Enforced by 18-01 Task 1 SQL + Task 2 spec Test 7 |
| P7 (customer submit never fires AI) | Enforced by 18-02 Task 1 behavior lock + 18-UAT §E regression test |
