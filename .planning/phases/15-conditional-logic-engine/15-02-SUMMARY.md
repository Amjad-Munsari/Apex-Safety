---
phase: 15-conditional-logic-engine
plan: "02"
subsystem: form-builder/visibility
tags: [wave-1, visibility, conditional-logic, evaluate-rule, combine-rules, cascade, strip-hidden-answers]

dependency_graph:
  requires:
    - phase: 15-conditional-logic-engine
      plan: "00"
      provides: "Wave-0 test stubs + should-be-processed.ts hook body"
    - phase: 15-conditional-logic-engine
      plan: "01"
      provides: "visibilityRulesAttribute factory + VALID_OPERATORS"
  provides:
    - lib/form-builder/visibility/types.ts (VisibilityState, ProgressSchema)
    - lib/form-builder/visibility/evaluate-rule.ts (evaluateRule 7-operator pure function)
    - lib/form-builder/visibility/combine-rules.ts (combineShowHide AND/OR + D-07 hide-wins)
    - lib/form-builder/visibility/cascade-visibility.ts (cascadeVisibility recursive parent→child)
    - lib/form-builder/visibility/evaluate-visibility.ts (evaluateVisibility + evaluateVisibilityForInstance)
    - lib/form-builder/visibility/strip-hidden-answers.ts (server-side scrub)
  affects:
    - plan 15-04 (RepeatingSectionRenderer consumes evaluateVisibilityForInstance)
    - plan 15-05 (submitAssessmentAction wires stripHiddenAnswers)
    - plan 15-06 (computeFormProgress extension uses evaluateVisibility)
    - plan 15-08 (smoke-test template exercises the full evaluator)

tech_stack:
  added: []
  patterns:
    - "ProgressSchema minimal-type pattern: hand-buildable for unit tests, FormBuilderSchema satisfies it"
    - "evaluateRule + combineShowHide: pure operators consumed by both shouldBeProcessed hook and evaluateVisibility"
    - "cascadeVisibility mutates passed-in state map (performance); called as Step 2 of evaluateVisibility"
    - "evaluateVisibilityForInstance: reads instance-local values from answers[repSectionId].instances[idx]; returns child-only VisibilityState record"
    - "stripHiddenAnswers: drop-unknown-key pattern (matches existing expandRepeatingSections behavior)"

key_files:
  created:
    - lib/form-builder/visibility/types.ts
    - lib/form-builder/visibility/evaluate-rule.ts
    - lib/form-builder/visibility/combine-rules.ts
    - lib/form-builder/visibility/cascade-visibility.ts
    - lib/form-builder/visibility/evaluate-visibility.ts
    - lib/form-builder/visibility/strip-hidden-answers.ts
    - tests/form-builder/visibility/evaluate-rule.test.ts (populated)
    - tests/form-builder/visibility/combine-rules.test.ts (populated)
    - tests/form-builder/visibility/cascade-visibility.test.ts (populated)
    - tests/form-builder/visibility/evaluate-visibility.test.ts (populated)
    - tests/form-builder/visibility/strip-hidden-answers.test.ts (populated)
  modified: []
  unchanged:
    - lib/form-builder/visibility/should-be-processed.ts (plan 15-00 owns this file)

key_decisions:
  - "evaluateRule uses strict triple-equals for equals/notEquals (D-10 literal string semantics — no special-casing of 'Some', 'Yes', 'N/A')"
  - "greaterThan/lessThan coerce via Date.parse then Number — single toNumeric() handles both date strings and numeric strings"
  - "isEmpty handles {instances:[]} as the empty-repeatingSection case per RESEARCH §Pattern 5"
  - "cascadeVisibility iterates all entities and calls forceHidden(childId) recursively — top-down, not bottom-up"
  - "evaluateVisibilityForInstance builds synthetic answers map overlaying instance values over root answers; returns only child entity states"
  - "stripHiddenAnswers drops unknown keys (matches existing expand-repeating-sections pattern); preserves empty instances rows per D-01 spec"
  - "A3 spike RESOLVED: should-be-processed.ts uses inline helpers; Wave-1 evaluate-rule + combine-rules are the canonical exported modules for all other consumers"

requirements-completed: [COND-01, COND-02, COND-04]

duration: ~25min
completed: "2026-05-26"
---

# Phase 15 Plan 02: Pure-Logic Visibility Bundle Summary

**Six pure TypeScript modules — evaluateRule (7 D-06 operators), combineShowHide (AND/OR + D-07 hide-wins), cascadeVisibility (parent→child), evaluateVisibility (full schema walk), evaluateVisibilityForInstance (per-instance repeatingSection), and stripHiddenAnswers (server-side scrub) — ship the complete conditional-logic evaluation core (COND-01, COND-02, COND-04).**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-05-26T02:32:00Z
- **Completed:** 2026-05-26T02:47:00Z
- **Tasks:** 3
- **Files created:** 6 production + 5 test files (11 total)

## Accomplishments

- `evaluateRule`: 7 D-06 operators covering text/number/select/checkbox/date source types; literal string comparison for select (D-10); isEmpty handles `{instances:[]}` empty-repeatingSection; unknown operator returns false (Pitfall 3 defensive)
- `combineShowHide`: AND/OR truth table with D-07 hide-wins-over-show; any fired hide rule short-circuits; require-only lists don't affect visibility
- `cascadeVisibility`: recursive forceHidden on children of any hidden parent; D-07 forces required=false on cascade; sibling cascade does not propagate upward
- `evaluateVisibility`: Step-1 per-entity own-rule evaluation + Step-2 cascade; returns `Record<entityId, VisibilityState>` with dynamic required folding static + fired require rules
- `evaluateVisibilityForInstance`: per-instance sibling scope for repeatingSection children; builds synthetic answers map routing instance-local values; plan 15-04's RepeatingSectionRenderer consumes this
- `stripHiddenAnswers`: server-side scrub per RESEARCH §Pattern 7; drops hidden entities, unknown keys, per-instance child scrub via evaluateVisibilityForInstance; never throws
- 44 tests passing across the 5 populated test files; 18 todos remain in the 5 Wave-0 stubs owned by plans 15-01/15-03
- `lib/form-builder/visibility/should-be-processed.ts` UNCHANGED — verified by `git diff` showing zero lines changed

## Task Commits

1. **Task 1: Pure-rule evaluation + AND/OR combiner** - `58b18c1` (feat)
2. **Task 2: Cascade + full evaluateVisibility + shouldBeProcessed hook** - `ef7b17c` (feat)
3. **Task 3: Server-side stripHiddenAnswers scrub** - `88d32e9` (feat)

## Files Created

- `lib/form-builder/visibility/types.ts` — VisibilityState + ProgressSchema minimal types
- `lib/form-builder/visibility/evaluate-rule.ts` — 7-operator pure evaluator, exports `evaluateRule`
- `lib/form-builder/visibility/combine-rules.ts` — AND/OR + D-07 hide-wins, exports `combineShowHide`
- `lib/form-builder/visibility/cascade-visibility.ts` — recursive parent→child cascade, exports `cascadeVisibility`
- `lib/form-builder/visibility/evaluate-visibility.ts` — schema walker, exports `evaluateVisibility` + `evaluateVisibilityForInstance`
- `lib/form-builder/visibility/strip-hidden-answers.ts` — server-side scrub, exports `stripHiddenAnswers`
- `tests/form-builder/visibility/evaluate-rule.test.ts` — 15 tests across 7 operators + source-type matrix
- `tests/form-builder/visibility/combine-rules.test.ts` — 9 tests: AND/OR truth table + hide-wins
- `tests/form-builder/visibility/cascade-visibility.test.ts` — 7 tests: sectionGroup cascade, grandchild cascade, repSection cascade, sibling non-propagation + shouldBeProcessed smoke tests
- `tests/form-builder/visibility/evaluate-visibility.test.ts` — 8 tests: show/require/hide-wins integration + per-instance evaluateVisibilityForInstance
- `tests/form-builder/visibility/strip-hidden-answers.test.ts` — 5 tests: hidden strip, cascade strip, per-instance scrub, no-throw, unknown keys

## Decisions Made

- Strict triple-equals for `equals`/`notEquals` — satisfies D-10 literal string semantics; "Some" and "Yes" are distinct option labels
- `toNumeric` helper handles both numeric strings and date strings via Date.parse → Number fallback; returns NaN for invalid inputs → greaterThan/lessThan return false
- `cascadeVisibility` calls `forceHidden` recursively on each child when parent is hidden; the outer loop re-iterates all entities so even non-container hidden entities are processed without separate type guards
- `evaluateVisibilityForInstance` builds a synthetic answers map by overlaying instance values (`answers[repSectionId].instances[idx][childId]`) on top of root answers — this covers ancestor-scope refs (D-03) naturally
- `stripHiddenAnswers` drops unknown keys silently (matches existing `expandRepeatingSections` behavior per RESEARCH lines 700-702); preserves empty instance rows per D-01 spec

## Deviations from Plan

None — plan executed exactly as written.

The TDD cycle ran cleanly for all three tasks:
- RED: tests failed due to missing production modules (confirmed)
- GREEN: all tests pass after implementation
- REFACTOR: not needed — implementations were clean on first pass

## Known Stubs

None in production modules. The 18 remaining `it.todo` entries are in the Wave-0 stubs owned by other plans (15-01 owns `visibility-rules-attribute.test.ts` + `backcompat.test.ts`; 15-03 owns `dependency-map.test.ts`, `validate-rule-graph.test.ts`, `scope.test.ts`).

## Threat Surface Scan

All 6 modules are pure TypeScript with no network endpoints, auth paths, DB calls, or file access. No new threat surface beyond what was already modeled in the plan's threat register:

- T-15-02-01 (Information Disclosure): `stripHiddenAnswers` implemented and tested — hidden subtree never reaches DB or AI prompt. Plan 15-05 wires it server-side.
- T-15-02-02 (DoS): `shouldBeProcessed` hook is bounded per-entity; confirmed by Wave-0 + cascade tests showing O(rules) iteration only.
- T-15-02-03 (Tampering): `cascadeVisibility` forces required=false when visible=false (D-07) — tested in cascade and evaluateVisibility tests.
- T-15-02-05 (Spoofing): `evaluateRule` returns false for unknown operators — tested in "unknown operator" test case.

## Self-Check

Files verified to exist:
- `lib/form-builder/visibility/types.ts` — created ✓
- `lib/form-builder/visibility/evaluate-rule.ts` — created ✓
- `lib/form-builder/visibility/combine-rules.ts` — created ✓
- `lib/form-builder/visibility/cascade-visibility.ts` — created ✓
- `lib/form-builder/visibility/evaluate-visibility.ts` — created ✓
- `lib/form-builder/visibility/strip-hidden-answers.ts` — created ✓
- `lib/form-builder/visibility/should-be-processed.ts` — unchanged ✓

Commits verified:
- `58b18c1` — Task 1 (evaluateRule + combineShowHide + types) ✓
- `ef7b17c` — Task 2 (cascadeVisibility + evaluateVisibility) ✓
- `88d32e9` — Task 3 (stripHiddenAnswers) ✓

## Self-Check: PASSED
