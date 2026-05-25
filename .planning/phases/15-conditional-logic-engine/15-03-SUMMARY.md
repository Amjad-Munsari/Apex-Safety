---
phase: 15-conditional-logic-engine
plan: "03"
subsystem: form-builder
tags: [graph-algorithm, dag, cycle-detection, scope-validation, typescript, vitest, tdd]

# Dependency graph
requires:
  - phase: 15-00
    provides: "Wave-0 test stubs for dependency-map, scope, validate-rule-graph"
  - phase: 14-custom-field-types
    provides: "computedField entity with computedInputs attribute; repeatingSection scope model"

provides:
  - "buildDependencyMap(schema) → { direct: Map<sourceId, Set<consumerId>>, computedInputs: Map<computedFieldId, Set<inputId>> }"
  - "resolveScope(schema, entityId) → 'root' | containerId"
  - "isAncestorScope(schema, consumerId, sourceId) → boolean enforcing D-03 rules"
  - "validateRuleGraph(schema) → { ok, cycles: CycleError[], scopeErrors: ScopeError[] }"
  - "CycleError: { path, labels, edges[] with via='direct'|'computed' }"
  - "ScopeError: { consumerId, sourceId, reason, severity?, consumerLabel, sourceLabel }"

affects:
  - phase: 15-05 (wires validateRuleGraph into 4 save/publish actions)
  - phase: 15-07 (cycle-error-banner.tsx reads CycleError payload)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two-edge-class DFS: direct (visibilityRules source→consumer) + computed (input→computedField) traversed together to catch Pitfall-8 computed-mediated cycles"
    - "3-colour DFS (WHITE/GRAY/BLACK) with cycle-path extraction from the DFS stack on back-edge detection"
    - "Scope resolution via parent-map cache built by walking container.children arrays"
    - "Advisory severity for orphan-source entries: ok stays true, entry still emitted for UI display"
    - "Schema minimal-type pattern: local type definitions keep modules trivially testable with hand-built schemas"

key-files:
  created:
    - lib/form-builder/visibility/dependency-map.ts
    - lib/form-builder/visibility/scope.ts
    - lib/form-builder/visibility/validate-rule-graph.ts
    - tests/form-builder/visibility/dependency-map.test.ts
    - tests/form-builder/visibility/scope.test.ts
    - tests/form-builder/visibility/validate-rule-graph.test.ts
    - vitest.config.ts
  modified: []

key-decisions:
  - "Two edge classes in dependency map: direct (visibilityRules rules) and computedInputs (computedField inputs) — required for Pitfall-8 detection"
  - "DFS traverses both edge classes simultaneously: direct.get(node) for consumers, plus computedInputs entries where inputs.has(node) for computed-mediated reach"
  - "Orphan-source is advisory (severity='advisory'): references to deleted entities warn but never block save (Pitfall 3 / A6)"
  - "D-03 scope classification: root, sectionGroup (layout-only, treated as root-adjacent), repeatingSection (isolation boundary)"
  - "Worktree vitest.config.ts: separate config created to fix @/ alias resolving to main repo root instead of worktree"

patterns-established:
  - "buildDependencyMap + validateRuleGraph are co-designed: buildDependencyMap is the graph input; the DFS in validateRuleGraph calls buildDependencyMap directly"
  - "pairwiseEdges helper determines via='direct'|'computed' by checking computedInputs membership for the 'to' node"
  - "isEntityInsideRepeatingSection local helper enables validateRuleGraph to classify scope errors without importing the full scope module semantics inline"

requirements-completed: [COND-03]

# Metrics
duration: 35min
completed: 2026-05-26
---

# Phase 15 Plan 03: Dependency Map, Scope Walker, and DAG Cycle Detector Summary

**Save-time cycle detection and D-03 scope validation via 3-colour DFS traversing both direct rule edges and computed-field input edges, preventing render-time infinite loops at the schema-validation gate**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-05-26T02:34:00Z
- **Completed:** 2026-05-26T02:43:00Z
- **Tasks:** 2 (both TDD — RED + GREEN each)
- **Files modified:** 7 created (3 source, 3 test, 1 vitest config)

## Accomplishments

- `buildDependencyMap(schema)` builds two edge classes: `direct` (source→consumer from visibilityRules) and `computedInputs` (input→computedField for Pitfall-8 cycle detection). Both are `Map<string, Set<string>>` structures consumed by the DFS.
- `resolveScope` + `isAncestorScope` walk the schema's parent-child graph to enforce D-03: ancestor-scope refs pass, cross-instance refs and root→inside-repeating refs are rejected.
- `validateRuleGraph` runs a 3-colour DFS over the union of both edge classes, extracting cycle paths on back-edges. `CycleError.edges` tags each hop with `via="direct"` or `via="computed"` — Pitfall-8 cycles (where the back-edge traversal requires following `computedInputs`) are fully detected and labelled.
- Orphan source references emit `severity="advisory"` entries in `scopeErrors` but leave `ok=true`. Plan 15-05 will consume the `ok=false` path to throw a structured save-rejection error.
- All 23 Wave-0 assertions passing. Zero new TypeScript errors.

## Task Commits

Each task was committed atomically with TDD RED→GREEN pairs:

1. **Task 1 RED: dependency-map + scope tests** - `b36b993` (test)
2. **Task 1 GREEN: dependency-map.ts + scope.ts + vitest.config.ts** - `c94854f` (feat)
3. **Task 2 RED: validate-rule-graph tests** - `8ac4e83` (test)
4. **Task 2 GREEN: validate-rule-graph.ts** - `b008bee` (feat)

**Plan metadata:** to be committed with this SUMMARY.

## Files Created/Modified

- `lib/form-builder/visibility/dependency-map.ts` — `buildDependencyMap(schema)` returning `DependencyMap { direct, computedInputs }`
- `lib/form-builder/visibility/scope.ts` — `resolveScope` + `isAncestorScope` schema tree-walkers
- `lib/form-builder/visibility/validate-rule-graph.ts` — `validateRuleGraph(schema)` with 3-colour DFS, exports `CycleError` and `ScopeError` interfaces
- `tests/form-builder/visibility/dependency-map.test.ts` — 4 tests: direct edges, computed edges, no-rules tolerance, empty-string exclusion
- `tests/form-builder/visibility/scope.test.ts` — 10 tests: 5 resolveScope cases + 5 isAncestorScope D-03 cases
- `tests/form-builder/visibility/validate-rule-graph.test.ts` — 9 tests: 7 Wave-0 cases + malformed-schema robustness + direct-edge tag verification
- `vitest.config.ts` — worktree-local config fixing @/ alias to resolve to worktree root

## Decisions Made

- **Two edge classes traversed together in DFS** — The DFS `dfs(node)` function checks both `map.direct.get(node)` (direct rule consumers) AND scans `map.computedInputs.entries()` where `inputs.has(node)` (computed-mediated reach). This unified traversal catches cycles like `A → computedField → A` that direct-only traversal misses (Pitfall 8).
- **`pairwiseEdges` helper checks `computedInputs` membership** — For each hop in the extracted cycle path, the edge is tagged `via="computed"` if the `to` node is a computedField with `from` in its inputs set; otherwise `via="direct"`. This is purely informational for the UI's error banner.
- **Orphan-source classification** — A `sourceEntityId` not in `schema.entities` triggers `reason="orphan-source"` with `severity="advisory"`. This is a soft warning, not a save blocker, consistent with the engine returning `false` for orphan refs at runtime (Pitfall 3 / A6).
- **`vitest.config.ts` in worktree** — Without this file, vitest walks up to the main project's `vitest.config.ts` where `__dirname` resolves to the main repo root, so `@/` alias points to main repo files, not worktree files. Adding a local copy with the same content but `__dirname` pointing to the worktree root fixes the resolution. This file should NOT be committed to main when the worktree branch is merged (it will conflict with the existing `vitest.config.ts`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript Schema type mismatch between validate-rule-graph.ts and dependency-map.ts**
- **Found during:** Task 2 verification (npx tsc --noEmit)
- **Issue:** `validate-rule-graph.ts` initially defined `VisibilityRules.rules` as optional (`rules?`) and `attributes` as optional, while `dependency-map.ts` defines them as required. TypeScript `TS2345` error: "Two different types with this name exist but are unrelated."
- **Fix:** Aligned `validate-rule-graph.ts` Schema types to use required `attributes` and required `rules`/`logic` fields, matching the `dependency-map.ts` contract.
- **Files modified:** `lib/form-builder/visibility/validate-rule-graph.ts`
- **Verification:** `npx tsc --noEmit` reports zero new errors in `lib/form-builder/visibility/`
- **Committed in:** `b008bee` (Task 2 feat commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - type error)
**Impact on plan:** Auto-fix essential for TypeScript correctness. No scope creep.

## Issues Encountered

- `vitest.config.ts` resolution: without a worktree-local config, `@/` alias resolved to the main project root rather than the worktree root, causing all module imports to fail with "Does the file exist?" errors. Fixed by creating a local `vitest.config.ts` copy (see Decisions Made above).
- The `vitest.config.ts` will need to be excluded from the merge to main to avoid conflicting with the existing config at the project root.

## Known Stubs

None — all three modules ship complete implementations with no placeholder values, no TODOs, and no hardcoded empty states flowing to UI rendering.

## Threat Flags

No new security-relevant surface introduced. All three modules are pure functions that operate only on schema data. No network endpoints, no auth paths, no file access patterns, no schema changes at trust boundaries.

STRIDE threat mitigations T-15-03-01 through T-15-03-04 are implemented:
- T-15-03-01: validateRuleGraph rejects cyclic schemas at save time; cycles never reach renderer
- T-15-03-02: orphan source refs (cross-template) classified advisory at save time; engine returns false at render time
- T-15-03-03: CycleError exposes entity labels+IDs only, no PII
- T-15-03-04: isAncestorScope rejects cross-instance refs even within same repeatingSection

## TDD Gate Compliance

| Gate | Commit | Status |
|------|--------|--------|
| RED (test) Task 1 | `b36b993` | PASSED |
| GREEN (feat) Task 1 | `c94854f` | PASSED |
| RED (test) Task 2 | `8ac4e83` | PASSED |
| GREEN (feat) Task 2 | `b008bee` | PASSED |

## Next Phase Readiness

- `validateRuleGraph` is ready for plan 15-05 to import and wire into all four save/publish server actions (`saveDraftAction`, `publishTemplateAction`, `saveClientDraftAction`, `publishClientTemplateAction`).
- `CycleError` and `ScopeError` payloads are ready for plan 15-07's `cycle-error-banner.tsx` component.
- `buildDependencyMap` is ready for plan 15-04's reactive dependency subscription (D-09 performance contract).
- `isAncestorScope` is ready for plan 15-06's rule editor source-field dropdown filtering (D-03 scope-aware candidate list).

---
*Phase: 15-conditional-logic-engine*
*Completed: 2026-05-26*
