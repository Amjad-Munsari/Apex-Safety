---
phase: 15
slug: conditional-logic-engine
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-26
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

> Populated by planner once PLAN.md files exist. Each task with code output MUST have either an `<automated>` verify command or a Wave 0 dependency declaring the test file.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| (to be filled by planner) | | | | | | | | | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Derived from research §Validation Architecture — minimum test stubs that MUST exist before Wave 1 tasks can claim verification.

- [ ] `tests/form-builder/visibility/evaluate-rule.test.ts` — operator × source-type matrix (COND-01)
- [ ] `tests/form-builder/visibility/combine-rules.test.ts` — AND/OR combinator (COND-02)
- [ ] `tests/form-builder/visibility/cascade-visibility.test.ts` — parent hide → children hide (COND-01)
- [ ] `tests/form-builder/visibility/validate-rule-graph.test.ts` — direct cycle, computedField-mediated cycle, ancestor-scope pass, cross-instance reject (COND-04)
- [ ] `tests/form-builder/visibility/strip-hidden-answers.test.ts` — server-side scrub (COND-01)
- [ ] `tests/form-builder/visibility/visibility-rules-attribute.test.ts` — default coercion, malformed-shape rejection
- [ ] `tests/form-interpreter/visibility-renderer.test.tsx` — focus retained on hide/show, Select stays controlled (BUILDER-02)
- [ ] `tests/form-builder/progress-with-visibility.test.ts` — hidden + required drops from denominator
- [ ] `tests/form-builder/visibility/backcompat.test.ts` — pre-Phase-15 schema_json passes validate()

*Each Wave 0 file ships as a stub (failing tests with `it.todo` or skeleton assertions) before any implementation task runs.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Builder rule editor UX (drag/keyboard, error highlight on cycle-reject) | BUILDER-02 | UI feel + a11y check | Open admin builder → add 2-rule cycle → Save → expect inline error citing both entity labels |
| End-to-end FRA smoke template (PAS 79 mitigation + door-instance require) | COND-02, COND-03 | Cross-cutting fill flow | Seed smoke template → open customer fill page → set Risk=Intolerable → expect Mitigation shows; set Door=Poor → expect Repair urgency required |
| Submission scrub end-to-end | COND-01 | Verifies hidden subtree never reaches `answers_json` | Fill smoke template hiding a section → submit → query `assessments.answers_json` → expect hidden entity IDs absent |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
