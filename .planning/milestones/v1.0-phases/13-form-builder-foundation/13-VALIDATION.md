---
phase: 13
slug: form-builder-foundation
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-20
---

# Phase 13 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.0 (unit/integration) + Playwright 1.51 (e2e) — both installed |
| **Config file** | `playwright.config.ts` (exists); `vitest.config.ts` missing — created by Plan 13-01 Task 1 (Wave 0) |
| **Quick run command** | `npx vitest run tests/form-builder/` |
| **Full suite command** | `npx vitest run && npx playwright test tests/form-builder/` |
| **Estimated runtime** | ~30s quick (unit) · ~3 min full (with e2e) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/form-builder/`
- **After every plan wave:** Run `npx vitest run && npx playwright test tests/form-builder/`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds (quick run)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 13-01-01 | 01 | 1 | BUILDER-04 | T-13-01 | N/A — install + infra | unit | `npx vitest run tests/form-builder/ --reporter=verbose` | ❌ W0 (this task creates `tests/form-builder/` + `vitest.config.ts`) | ⬜ pending |
| 13-01-02 | 01 | 1 | BUILDER-04 | T-13-02 | N/A — attribute definitions | unit | `npx vitest run tests/form-builder/entities.test.ts --reporter=verbose` | ❌ W0 | ⬜ pending |
| 13-01-03 | 01 | 1 | BUILDER-04 | T-13-03 | `validateSchema` rejects unknown entity types | unit | `npx vitest run tests/form-builder/entities.test.ts tests/form-builder/validate-schema.test.ts tests/form-builder/section-reparent.spike.test.ts --reporter=verbose` | ❌ W0 | ⬜ pending |
| 13-02-01 | 02 | 2 | BUILDER-01, BUILDER-02 | T-13-04 | N/A — client-side builder UI | unit (tsc) | `npx tsc --noEmit` (scope `components/form-builder`) | ✅ N/A (tsc) | ⬜ pending |
| 13-02-02 | 02 | 2 | BUILDER-01 | T-13-05 | Builder reachable on admin + client surfaces — not admin-hardcoded (AGENTS.md) | unit (tsc) | `npx tsc --noEmit` (scope `app/admin/templates`, `app/client/templates`, `builder-client`) | ✅ N/A (tsc) | ⬜ pending |
| 13-02-03 | 02 | 2 | BUILDER-03, BUILDER-05 | T-13-06, T-13-07, T-13-08 | `requireActorUserId` admin gate + `validateSchema` before `template_versions` INSERT | integration | `npx vitest run tests/form-builder/save-draft.test.ts tests/form-builder/palette.test.ts tests/form-builder/properties.test.ts --reporter=verbose` | ✅ (stubs from 13-01-01) | ⬜ pending |
| 13-03-01 | 03 | 2 | BUILDER-05 | T-13-09 | N/A — client-side interpreter renderer | unit (tsc) | `npx tsc --noEmit` (scope `components/form-interpreter`) | ✅ N/A (tsc) | ⬜ pending |
| 13-03-02 | 03 | 2 | BUILDER-05 | T-13-10, T-13-11, T-13-12 | `validateEntitiesValues` server-side; submission pinned to `template_version_id` | integration | `npx vitest run tests/form-builder/validate-values.test.ts tests/form-builder/version-pin.test.ts --reporter=verbose` | ✅ (stubs from 13-01-01) | ⬜ pending |
| 13-03-03 | 03 | 2 | BUILDER-05 | T-13-13 | Historical submission renders its pinned version schema, never latest | unit (tsc) | `npx tsc --noEmit` (scope `app/admin/assessments`) | ✅ N/A (tsc) | ⬜ pending |
| 13-04-01 | 04 | 3 | BUILDER-03 | T-13-14 | Reseed truncates only after zero-production-rows pre-check | static analysis | `node -e "<SQL static analysis of migration 010>"` | ✅ N/A (SQL) | ⬜ pending |
| 13-04-02 | 04 | 3 | BUILDER-03 | T-13-15, T-13-16 | Dead pre-coltorapps code removed; no dangling imports | unit (tsc) | `npx tsc --noEmit` + dangling-ref grep | ✅ N/A (tsc) | ⬜ pending |
| 13-04-03 | 04 | 3 | BUILDER-03 | T-13-17 | Migration 010 applied to the live database | CLI | `npx supabase migration list \| grep -E "010"` | ✅ N/A (CLI) | ⬜ pending |
| 13-04-04 | 04 | 3 | BUILDER-03 | — | Full build→save→version→fill→submit loop verified by human | manual | `checkpoint:human-verify` (no automated command) | ✅ N/A (manual) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Delivered by Plan 13-01 Task 1 (`type: auto`, wave 1):

- [ ] `vitest.config.ts` — missing; add with Next.js-compatible config
- [ ] `tests/form-builder/` directory — does not exist; create with test stubs
- [ ] `tests/form-builder/palette.test.ts` — stubs for BUILDER-01 (filled by 13-02-03)
- [ ] `tests/form-builder/properties.test.ts` — stubs for BUILDER-02 (filled by 13-02-03)
- [ ] `tests/form-builder/save-draft.test.ts` — stubs for BUILDER-03 (filled by 13-02-03)
- [ ] `tests/form-builder/version-pin.test.ts` — stubs for submission pinning (filled by 13-03-02)
- [ ] `tests/form-builder/validate-schema.test.ts` — stubs for server-side schema validation (filled by 13-01-03)
- [ ] `tests/form-builder/validate-values.test.ts` — stubs for server-side value validation (filled by 13-03-02)
- [ ] `tests/form-builder/entities.test.ts` — entity/attribute definition coverage (filled by 13-01-02/03)
- [ ] `tests/form-builder/section-reparent.spike.test.ts` — proves `setEntityIndex` parentId API (13-01-03 spike)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Full build→save→version→fill→submit loop on the 7-basic-types smoke template | BUILDER-03 | End-to-end browser interaction with drag-and-drop and a live DB write/read; not reliably automatable without a heavy e2e harness for the dnd-kit pointer events | Task 13-04-04 `<how-to-verify>` — build a template with all 7 entity types, save (creates `template_versions` row), publish, fill via interpreter, submit, then confirm the submission renders against its pinned version |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (12 auto tasks + 1 human checkpoint)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (Plan 13-01 Task 1)
- [x] No watch-mode flags (`vitest run`, not watch)
- [x] Feedback latency < 60s (quick run)
- [x] `nyquist_compliant: true` set in frontmatter
- [ ] `wave_0_complete` — flips to `true` once Plan 13-01 executes and Wave 0 infra exists

**Approval:** approved 2026-05-20
