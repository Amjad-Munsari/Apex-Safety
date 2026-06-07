---
phase: 16
slug: multi-tenancy-fork-on-fill
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-26
---

# Phase 16 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Derived from `16-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.x (unit + RLS isolation) + Playwright 1.51 (existing e2e — unaffected) |
| **Config file** | `vitest.config.ts` (Wave 0 extends `include` to add `tests/rls/**/*.{test,spec}.{ts,tsx}`); `playwright.config.ts` unchanged |
| **Quick run command** | `npm test -- tests/rls/ tests/form-builder/` |
| **Full suite command** | `npm test` (full Vitest) + `npx playwright test` (existing security spec) |
| **Estimated runtime** | ~45 seconds (Vitest filtered) / ~3 minutes (full) |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- tests/rls/ tests/form-builder/`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green + UAT walkthrough started
- **Max feedback latency:** 60 seconds (quick run)

---

## Per-Task Verification Map

> Filled in by the planner from PLAN.md task IDs. Initial seed below is one row per phase requirement / decision needing automated coverage. Planner fills `Task ID` + `Plan` + `Wave` columns once plan IDs are assigned.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | 0 | D-15 / BUILDER-01..05 | Cross-tenant data read | Org A user cannot read Org B's `form_templates` | integration (RLS) | `npm test -- tests/rls/multi-tenancy.spec.ts -t "form_templates"` | ❌ W0 | ⬜ pending |
| TBD | TBD | 0 | D-15 | — | Org A user cannot read Org B's `template_versions` | integration (RLS) | `npm test -- tests/rls/multi-tenancy.spec.ts -t "template_versions"` | ❌ W0 | ⬜ pending |
| TBD | TBD | 0 | D-15 | — | Org A user cannot read Org B's `form_submissions` | integration (RLS) | `npm test -- tests/rls/multi-tenancy.spec.ts -t "form_submissions"` | ❌ W0 | ⬜ pending |
| TBD | TBD | 0 | D-15 | Cross-tenant data read | Org A user cannot read Org B's `form_assignments` | integration (RLS) | `npm test -- tests/rls/multi-tenancy.spec.ts -t "form_assignments"` | ❌ W0 | ⬜ pending |
| TBD | TBD | 0 | D-15 (positive control) | — | Org A user CAN read own org rows | integration (RLS) | `npm test -- tests/rls/multi-tenancy.spec.ts -t "own org"` | ❌ W0 | ⬜ pending |
| TBD | TBD | 1+ | D-05 / D-06 | Bypass fork ownership | `forkAssignedTemplate` copies pinned schema fidelity-preserving + rewires assignment | unit + integration | `npm test -- tests/form-builder/fork-assigned-template.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | 1+ | D-07 | — | "Customise first" button → fork → redirect to `/client/templates/[fork_id]/edit` | manual-only (UAT) | UAT walkthrough §A | ❌ | ⬜ pending |
| TBD | TBD | 1+ | D-08 | — | Fork auto-publishes at v1 | unit | covered by `fork-assigned-template.test.ts` assertion | ❌ W0 | ⬜ pending |
| TBD | TBD | 1+ | D-11 | Forging assignment status | `pending → in_progress` on first draft create or "Fill as-is" click | integration | `npm test -- tests/form-builder/assignment-status-transitions.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | 1+ | D-11 | Forging assignment status | `in_progress → completed` on submit | integration | covered by `assignment-status-transitions.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | 1+ | D-10 | Deleted-assignment leak | Soft-deleted assignments are filtered from Active/Completed | unit (query shape) | `npm test -- tests/form-builder/assignments-query.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | 1+ | D-16 | Customer self-fill `client_id` forgery | Customer-build submission writes with `assignment_id = NULL`, `client_id` from server context | integration | `npm test -- tests/form-builder/customer-self-fill-submission.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | 1+ | D-09 | — | `/client/templates` no longer shows admin masters | manual-only (UAT) | UAT walkthrough §C | ❌ | ⬜ pending |
| TBD | TBD | 1+ | D-12 | — | Admin clients list shows active-assignment count per client | manual-only (UAT) | UAT walkthrough §B | ❌ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `vitest.config.ts` — extend `include` to add `tests/rls/**/*.{test,spec}.{ts,tsx}` (currently scoped to `tests/form-builder/**` and `tests/form-interpreter/**`).
- [ ] `tests/rls/helpers/seed-two-tenants.ts` — shared fixture (port + extend `tests/security.spec.ts:62-138` to Vitest, cover `form_templates` / `template_versions` / `form_submissions` / `form_assignments`).
- [ ] `tests/rls/multi-tenancy.spec.ts` — five-spec suite (4 negative + 1 positive control).
- [ ] `tests/form-builder/fork-assigned-template.test.ts` — schema-fidelity round-trip + assignment-rewire assertion + auto-publish-v1 assertion.
- [ ] `tests/form-builder/assignment-status-transitions.test.ts` — `pending→in_progress` + `in_progress→completed` + backwards-transition rejection (D-11).
- [ ] `tests/form-builder/customer-self-fill-submission.test.ts` — `assignment_id IS NULL` insert path + `client_id` taken from server context (D-16).
- [ ] `tests/form-builder/assignments-query.test.ts` — defense-in-depth `deleted_at IS NULL` filter coverage (D-10).
- [ ] Framework install: **none** — Vitest 3 and Playwright are already installed.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| "Customise first" → fork → redirect to `/client/templates/[fork_id]/edit` lands in the builder with the assignment's exact schema | D-07 | Cross-route flow + visual confirmation of builder mount + confirmation prompt copy | UAT walkthrough §A — sign in as client user, open active assignment, click Customise first, confirm prompt, verify builder URL + form fields match the assignment |
| `/client/templates` no longer shows admin masters; only customer-owned templates appear | D-09 | UI removal verification | UAT walkthrough §C — sign in as client user with at least one assignment + one customer-built template; confirm `/client/templates` shows only the customer-built row |
| Admin `/admin/clients` list shows an active-assignment count pill per client row | D-12 | Visual count rendering against fresh seed | UAT walkthrough §B — sign in as admin, assign 2 templates to Client X, navigate to `/admin/clients`, confirm pill reads "2" |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (config + helpers + 5 new spec files)
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter once planner fills Task ID column

**Approval:** pending
