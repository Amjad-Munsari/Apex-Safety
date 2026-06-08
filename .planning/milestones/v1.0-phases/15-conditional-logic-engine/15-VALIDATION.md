---
phase: 15
slug: conditional-logic-engine
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-26
updated: 2026-05-26
---

# Phase 15 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (existing) |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npm test -- --run lib/form-builder/visibility` |
| **Full suite command** | `npm test -- --run` |
| **Estimated runtime** | ~30s quick, ~3 min full |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --run <touched file glob>`
- **After every plan wave:** Run `npm test -- --run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds (per-touched-file glob)

---

## Per-Task Verification Map

> Populated from PLAN.md files 15-00 .. 15-08. Every task with an `<automated>` verify block appears below.
> Wave 0 stub files ship in 15-00 (execution-time) — `wave_0_complete` flips to true only after Wave-0 lands.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 15-00-T1 | 15-00 | 0 | COND-01..04, BUILDER-02 | T-15-00-01 | All 10 pure-logic Wave-0 stubs parse + report todos | unit | `npx vitest run tests/form-builder/visibility/ 2>&1 \| grep -E "(pending\|todo\|Error)" \| head -20` | ❌ W0 | ⬜ pending |
| 15-00-T2 | 15-00 | 0 | COND-01..04, BUILDER-02 | T-15-00-01 | Renderer + progress Wave-0 stubs parse | render | `npx vitest run tests/form-builder/progress-with-visibility.test.ts tests/form-interpreter/visibility-renderer.test.tsx 2>&1 \| tail -10` | ❌ W0 | ⬜ pending |
| 15-01-T1 | 15-01 | 1 | COND-01, BUILDER-02 | T-15-01-01, T-15-01-04 | visibilityRulesAttribute default-coerces + whitelists operator/action | unit | `npx vitest run tests/form-builder/visibility/visibility-rules-attribute.test.ts` | ✅ W0 | ⬜ pending |
| 15-01-T2 | 15-01 | 1 | COND-01, BUILDER-02 | T-15-01-03 | All 13 entities accept new attribute + hook; legacy schemas validate | unit | `npx vitest run tests/form-builder/visibility/backcompat.test.ts && npx tsc --noEmit 2>&1 \| grep -E "lib/form-builder/(entities\|attributes\|visibility)" \| head -20` | ✅ W0 | ⬜ pending |
| 15-02-T1 | 15-02 | 1 | COND-01, COND-02 | T-15-02-05 | evaluateRule 7 operators × 5 source types; AND/OR + hide-wins | unit | `npx vitest run tests/form-builder/visibility/evaluate-rule.test.ts tests/form-builder/visibility/combine-rules.test.ts` | ✅ W0 | ⬜ pending |
| 15-02-T2 | 15-02 | 1 | COND-01, COND-02, COND-04 | T-15-02-02, T-15-02-03 | cascadeVisibility + evaluateVisibility + makeShouldBeProcessed | unit | `npx vitest run tests/form-builder/visibility/cascade-visibility.test.ts tests/form-builder/visibility/evaluate-visibility.test.ts && npx tsc --noEmit 2>&1 \| grep "lib/form-builder/visibility" \| head -10` | ✅ W0 | ⬜ pending |
| 15-02-T3 | 15-02 | 1 | COND-01 | T-15-02-01, T-15-02-04 | stripHiddenAnswers strips visible===false + per-instance | unit | `npx vitest run tests/form-builder/visibility/strip-hidden-answers.test.ts` | ✅ W0 | ⬜ pending |
| 15-03-T1 | 15-03 | 1 | COND-03 | T-15-03-04 | buildDependencyMap (direct + computed edges); resolveScope + isAncestorScope | unit | `npx vitest run tests/form-builder/visibility/dependency-map.test.ts tests/form-builder/visibility/scope.test.ts` | ✅ W0 | ⬜ pending |
| 15-03-T2 | 15-03 | 1 | COND-03 | T-15-03-01, T-15-03-03, T-15-03-04 | 3-colour DFS over both edge classes; D-03 scope rejection; orphan advisory | unit | `npx vitest run tests/form-builder/visibility/validate-rule-graph.test.ts` | ✅ W0 | ⬜ pending |
| 15-04-T1 | 15-04 | 2 | COND-01, COND-02, COND-04 | T-15-04-01, T-15-04-02, T-15-04-04 | propsRef threads visibility; useMemo deps stay [surface]; dynamicRequired primitive | render | `npx vitest run tests/form-interpreter/visibility-renderer.test.tsx && npx tsc --noEmit 2>&1 \| grep "components/form-interpreter" \| head -10` | ✅ W0 | ⬜ pending |
| 15-04-T2 | 15-04 | 2 | COND-04, BUILDER-02 | T-15-04-03 | computeFormProgress visibility-aware + backward-compat | unit | `npx vitest run tests/form-builder/progress-with-visibility.test.ts tests/form-builder/progress.test.ts` | ✅ W0 | ⬜ pending |
| 15-05-T1 | 15-05 | 2 | COND-01, COND-04 | T-15-05-01, T-15-05-04 | submitAssessmentAction Step 3.5 strips hidden values before UPDATE | integration | `npx vitest run tests/form-builder/visibility/server-scrub.test.ts && npx tsc --noEmit 2>&1 \| grep "app/admin/assessments" \| head -10` | ❌ W0 | ⬜ pending |
| 15-05-T2 | 15-05 | 2 | COND-03 | T-15-05-02, T-15-05-03, T-15-05-06 | validateRuleGraph called in 4 actions (admin save/publish + client save/publish) | integration | `npx vitest run tests/form-builder/save-draft.test.ts && npx tsc --noEmit 2>&1 \| grep -E "app/(admin\|client)/templates" \| head -10` | ✅ W0 | ⬜ pending |
| 15-06-T1 | 15-06 | 3 | COND-01, COND-02, BUILDER-02 | T-15-06-01, T-15-06-02, T-15-06-05 | RuleRow + ConditionalLogicSection with D-03 scope + A7 action filter | render | `npx vitest run tests/form-builder/conditional-logic-section.test.tsx && npx tsc --noEmit 2>&1 \| grep "components/form-builder" \| head -10` | ❌ W0 | ⬜ pending |
| 15-06-T2 | 15-06 | 3 | BUILDER-02 | T-15-06-04 | PropertiesPanel hosts ConditionalLogicSection for non-container entities | render | `npx vitest run tests/form-builder/conditional-logic-section.test.tsx tests/form-interpreter/renderers.test.tsx && npx tsc --noEmit 2>&1 \| grep "components/form-builder" \| head -10` | ❌ W0 | ⬜ pending |
| 15-07-T1 | 15-07 | 3 | COND-03, BUILDER-02 | T-15-07-02, T-15-07-03 | CycleErrorBanner renders cycle + scope + advisory; ConditionalLogicSection integration | render | `npx vitest run tests/form-builder/cycle-error-banner.test.tsx tests/form-builder/conditional-logic-section.test.tsx` | ❌ W0 | ⬜ pending |
| 15-07-T2 | 15-07 | 3 | COND-03 | T-15-07-01, T-15-07-04 | Save/Publish handlers catch + parse RuleGraphInvalid → toast + cycleState clear-on-edit | render | `npx vitest run tests/form-builder/ tests/form-interpreter/ && npx tsc --noEmit 2>&1 \| grep -E "app/(admin\|client)/templates\|components/form-builder" \| head -10` | ❌ W0 | ⬜ pending |
| 15-08-T1 | 15-08 | 4 | COND-01..04, BUILDER-02 | T-15-08-01 | Migration 012 SQL follows 011 pattern; gen_random_uuid; 3 rule patterns | unit | `test -f supabase/migrations/012_phase15_conditional_smoke_test.sql && head -50 supabase/migrations/012_phase15_conditional_smoke_test.sql \| grep -E "DO \\$\\$\|gen_random_uuid\|owner_type\|status.*published"` | n/a | ⬜ pending |
| 15-08-T2 | 15-08 | 4 | COND-01..04, BUILDER-02 | T-15-08-04 | Playwright e2e PAS 79 + FRA-doors flows | e2e | `npx playwright test tests/e2e/phase15-smoke.spec.ts --reporter=list 2>&1 \| tail -30` | n/a | ⬜ pending |
| 15-08-T3 | 15-08 | 4 | COND-01..04 | T-15-08-05 | Migration 012 applied to live DB via supabase-888 MCP | integration | `cat .planning/phases/15-conditional-logic-engine/15-PUSH-LOG.md \| grep -E "version\|Phase 15 Conditional"` | n/a | ⬜ pending |
| 15-08-T4 | 15-08 | 4 | COND-01..04, BUILDER-02 | T-15-08-03 | UAT walkthrough script exists with 8 sections | unit | `test -f .planning/phases/15-conditional-logic-engine/15-UAT.md && wc -l .planning/phases/15-conditional-logic-engine/15-UAT.md` | n/a | ⬜ pending |
| 15-08-T5 | 15-08 | 4 | COND-01..04, BUILDER-02 | — | Human-verify acceptance walkthrough | checkpoint | (human) | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*File Exists column:* `✅ W0` = test file ships in Wave 0 (plan 15-00) and is populated by the task; `❌ W0` = file does NOT ship in Wave 0 — task creates it directly; `n/a` = no test file (migration / e2e / checkpoint).

---

## Wave 0 Requirements

Derived from research §Validation Architecture — minimum test stubs that MUST exist before Wave 1 tasks can claim verification.

- [ ] `tests/form-builder/visibility/evaluate-rule.test.ts` — operator × source-type matrix (COND-01)
- [ ] `tests/form-builder/visibility/combine-rules.test.ts` — AND/OR combinator (COND-02)
- [ ] `tests/form-builder/visibility/cascade-visibility.test.ts` — parent hide → children hide (COND-01)
- [ ] `tests/form-builder/visibility/evaluate-visibility.test.ts` — integration evaluate+combine+cascade (COND-01, COND-02)
- [ ] `tests/form-builder/visibility/dependency-map.test.ts` — direct + computed edge construction (COND-03)
- [ ] `tests/form-builder/visibility/validate-rule-graph.test.ts` — direct cycle, computedField-mediated cycle, ancestor-scope pass, cross-instance reject (COND-03)
- [ ] `tests/form-builder/visibility/scope.test.ts` — resolveScope for root, sectionGroup-child, repeatingSection-child (COND-03)
- [ ] `tests/form-builder/visibility/strip-hidden-answers.test.ts` — server-side scrub (COND-01)
- [ ] `tests/form-builder/visibility/visibility-rules-attribute.test.ts` — default coercion, malformed-shape rejection
- [ ] `tests/form-builder/visibility/backcompat.test.ts` — pre-Phase-15 schema_json passes validate()
- [ ] `tests/form-builder/progress-with-visibility.test.ts` — hidden + required drops from denominator
- [ ] `tests/form-interpreter/visibility-renderer.test.tsx` — focus retained on hide/show, Select stays controlled (BUILDER-02)

*Each Wave 0 file ships as a stub (failing tests with `it.todo` or skeleton assertions) before any implementation task runs. Plan 15-00 owns delivery; 9 of these files are populated by later plans, 3 (server-scrub / conditional-logic-section / cycle-error-banner) are NOT stubbed in 15-00 because they belong to plans (15-05, 15-06, 15-07) whose tasks create those test files directly alongside the implementation.*

**Cross-cutting: `lib/form-builder/visibility/should-be-processed.ts` is also a Wave 0 deliverable — created in plan 15-00 as a real (not stubbed) helper.** Both plans 15-01 (entity attach) and 15-02 (engine logic) import it; 15-01 reads the real `makeShouldBeProcessed`, 15-02 may import internal helpers. Removing the file from 15-01 + 15-02's `files_modified` resolves the Wave-1 ownership race.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Builder rule editor UX (drag/keyboard, error highlight on cycle-reject) | BUILDER-02 | UI feel + a11y check | Open admin builder → add 2-rule cycle → Save → expect inline error citing both entity labels |
| End-to-end FRA smoke template (PAS 79 mitigation + door-instance require) | COND-02, COND-03 | Cross-cutting fill flow | Seed smoke template → open customer fill page → set Risk=Intolerable → expect Mitigation shows; set Door=Poor → expect Repair urgency required |
| Submission scrub end-to-end | COND-01 | Verifies hidden subtree never reaches `answers_json` | Fill smoke template hiding a section → submit → query `form_submissions.answers_json` → expect hidden entity IDs absent |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [ ] Feedback latency < 30s (verified at execution)
- [ ] `nyquist_compliant: true` set in frontmatter — DONE; `wave_0_complete` flips at execution

**Approval:** ready for execution
