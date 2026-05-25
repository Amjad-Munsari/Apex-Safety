---
phase: 15
plan: "00"
subsystem: form-builder/visibility
tags: [wave-0, test-stubs, visibility, conditional-logic, should-be-processed]
dependency_graph:
  requires: []
  provides:
    - tests/form-builder/visibility/evaluate-rule.test.ts
    - tests/form-builder/visibility/combine-rules.test.ts
    - tests/form-builder/visibility/cascade-visibility.test.ts
    - tests/form-builder/visibility/evaluate-visibility.test.ts
    - tests/form-builder/visibility/dependency-map.test.ts
    - tests/form-builder/visibility/validate-rule-graph.test.ts
    - tests/form-builder/visibility/scope.test.ts
    - tests/form-builder/visibility/strip-hidden-answers.test.ts
    - tests/form-builder/visibility/visibility-rules-attribute.test.ts
    - tests/form-builder/visibility/backcompat.test.ts
    - tests/form-builder/progress-with-visibility.test.ts
    - tests/form-interpreter/visibility-renderer.test.tsx
    - lib/form-builder/visibility/should-be-processed.ts
  affects:
    - All Wave 1-4 plans (test stubs pre-create the verify targets)
    - plans 15-01 and 15-02 (can import makeShouldBeProcessed in parallel)
tech_stack:
  added: []
  patterns:
    - it.todo stub pattern (per tests/form-builder/attributes.test.ts convention)
    - inline-helpers approach for Wave-0 self-contained hook body
key_files:
  created:
    - tests/form-builder/visibility/evaluate-rule.test.ts
    - tests/form-builder/visibility/combine-rules.test.ts
    - tests/form-builder/visibility/cascade-visibility.test.ts
    - tests/form-builder/visibility/evaluate-visibility.test.ts
    - tests/form-builder/visibility/dependency-map.test.ts
    - tests/form-builder/visibility/validate-rule-graph.test.ts
    - tests/form-builder/visibility/scope.test.ts
    - tests/form-builder/visibility/strip-hidden-answers.test.ts
    - tests/form-builder/visibility/visibility-rules-attribute.test.ts
    - tests/form-builder/visibility/backcompat.test.ts
    - tests/form-builder/progress-with-visibility.test.ts
    - tests/form-interpreter/visibility-renderer.test.tsx
    - lib/form-builder/visibility/should-be-processed.ts
  modified: []
decisions:
  - "Inline-helpers strategy for should-be-processed.ts: evaluateRuleInline and combineShowHideInline defined within the file (no Wave-1 import). Plan 15-02 ships separate evaluate-rule.ts + combine-rules.ts modules for testing; they mirror the inline logic semantically but are NOT imported here. This keeps tsc --noEmit green with only Wave 0 shipped."
  - "No dynamic import used: shouldBeProcessed must return boolean synchronously (coltorapps contract), ruling out async dynamic import inside the closure."
metrics:
  duration: "5m 50s"
  completed: "2026-05-25"
  tasks_completed: 3
  files_created: 13
---

# Phase 15 Plan 00: Wave-0 Test Infrastructure Summary

Wave-0 test stubs and the real `makeShouldBeProcessed()` hook body deployed, satisfying the Nyquist gate — all Wave 1+ `<automated>` verify commands now reference existing files.

## What Was Built

### Task 1 — 10 pure-logic Wave-0 test stubs (commit `1c79d54`)

| File | Todos | Wave that fills it |
|------|-------|-------------------|
| `tests/form-builder/visibility/evaluate-rule.test.ts` | 12 (7 operators + 5 source types) | 15-02 Task 1 |
| `tests/form-builder/visibility/combine-rules.test.ts` | 5 (AND/OR truth-table + hide-wins) | 15-02 Task 1 |
| `tests/form-builder/visibility/cascade-visibility.test.ts` | 3 (parent cascade) | 15-02 Task 2 |
| `tests/form-builder/visibility/evaluate-visibility.test.ts` | 3 (integration) | 15-02 Task 2 |
| `tests/form-builder/visibility/dependency-map.test.ts` | 2 (direct + computed edges) | 15-03 Task 1 |
| `tests/form-builder/visibility/validate-rule-graph.test.ts` | 7 (cycle detection + scope) | 15-03 Task 2 |
| `tests/form-builder/visibility/scope.test.ts` | 3 (resolveScope) | 15-03 Task 1 |
| `tests/form-builder/visibility/strip-hidden-answers.test.ts` | 4 (server-side scrub) | 15-02 Task 3 |
| `tests/form-builder/visibility/visibility-rules-attribute.test.ts` | 5 (coercion + shape validation) | 15-01 Task 1 |
| `tests/form-builder/visibility/backcompat.test.ts` | 1 (legacy schema compat) | 15-01 Task 2 |
| **Subtotal** | **45** | |

### Task 2 — renderer + progress Wave-0 stubs (commit `7caf212`)

| File | Todos | Wave that fills it |
|------|-------|-------------------|
| `tests/form-builder/progress-with-visibility.test.ts` | 3 (backward-compat + hidden denom) | 15-04 Task 2 |
| `tests/form-interpreter/visibility-renderer.test.tsx` | 4 (hide/show, focus, Select, dynamicRequired) | 15-04 Task 1 |
| **Subtotal** | **7** | |

**Total: 12 test files, 52 todos**

Vitest run output snapshot:
```
Test Files  12 skipped (12)
      Tests  52 todo (52)
```
No parse errors. No import errors. No SyntaxErrors.

### Task 3 — real `makeShouldBeProcessed()` hook body (commit `fc89202`)

**File:** `lib/form-builder/visibility/should-be-processed.ts`

**Strategy chosen:** Inline-helpers approach.

`evaluateRuleInline` and `combineShowHideInline` are defined as private functions within the same file. This makes the module fully self-contained at Wave 0 without requiring Wave-1 modules to exist. `npx tsc --noEmit` reports zero errors traceable to this file (pre-existing errors in `geolocation-map.tsx` and `attributes.test.ts` are unrelated to this plan).

Key properties of the shipped hook:
- Exports `makeShouldBeProcessed()` — factory called once per entity definition
- Reads `context.entity.attributes.visibilityRules` with defence-in-depth coercion
- Fast-path: no rules → returns `true` immediately
- Filters to show/hide rules only; require rules are a renderer concern (plan 15-02)
- D-07 hide-wins: any hide rule firing → returns `false` immediately
- Pitfall 3: orphan `sourceEntityId` evaluates as `undefined` source → `isEmpty` operator returns `true`, others return `false` — never throws
- Hot-path invariant: iterates only this entity's own `visibilityRules.rules`; never walks the schema

**Inheritance for plan 15-02 Task 2:** Plan 15-02 ships `evaluate-rule.ts` and `combine-rules.ts` as separately-tested modules. These are NOT imported by `should-be-processed.ts` (which uses inline equivalents). Plans 15-01 and 15-02 MUST NOT include `lib/form-builder/visibility/should-be-processed.ts` in their `files_modified`.

**A3 spike resolution documented in file header:** coltorapps passes `entitiesValues` at root level only. Instance-template children inside `repeatingSection` are NOT coltorapps entities and are never passed to `shouldBeProcessed`. Per-instance visibility is handled by plan 15-04's `RepeatingSectionRenderer` modification via `evaluateVisibilityForInstance`.

## Vitest Verification Commands

All passing (todos only, no errors):
```bash
npx vitest run tests/form-builder/visibility/  # 45 todos
npx vitest run tests/form-builder/progress-with-visibility.test.ts tests/form-interpreter/visibility-renderer.test.tsx  # 7 todos
```

## Deviations from Plan

None — plan executed exactly as written.

The only decision made was between the two Wave-0 strategy options specified in the behavior block: dynamic-import (rejected — shouldBeProcessed must return boolean synchronously) vs inline-helpers (chosen). The plan explicitly offered both options and asked us to document the choice.

## Known Stubs

All 12 test files are intentional Wave-0 stubs with `it.todo` blocks. This is by design — they serve as Nyquist-gate scaffolding. The production file (`should-be-processed.ts`) is a real implementation with no stubs or placeholder values.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. The only production code is `lib/form-builder/visibility/should-be-processed.ts`, which is a pure TypeScript module with no I/O surface. Consistent with T-15-00-03 (hot-path bounded by per-entity rule count — mitigated by inline implementation).

## Self-Check

Files verified to exist:
- `tests/form-builder/visibility/evaluate-rule.test.ts` ✓
- `tests/form-builder/visibility/combine-rules.test.ts` ✓
- `tests/form-builder/visibility/cascade-visibility.test.ts` ✓
- `tests/form-builder/visibility/evaluate-visibility.test.ts` ✓
- `tests/form-builder/visibility/dependency-map.test.ts` ✓
- `tests/form-builder/visibility/validate-rule-graph.test.ts` ✓
- `tests/form-builder/visibility/scope.test.ts` ✓
- `tests/form-builder/visibility/strip-hidden-answers.test.ts` ✓
- `tests/form-builder/visibility/visibility-rules-attribute.test.ts` ✓
- `tests/form-builder/visibility/backcompat.test.ts` ✓
- `tests/form-builder/progress-with-visibility.test.ts` ✓
- `tests/form-interpreter/visibility-renderer.test.tsx` ✓
- `lib/form-builder/visibility/should-be-processed.ts` ✓

Commits verified:
- `1c79d54` — Task 1 (10 pure-logic stubs) ✓
- `7caf212` — Task 2 (renderer + progress stubs) ✓
- `fc89202` — Task 3 (should-be-processed.ts) ✓

## Self-Check: PASSED
