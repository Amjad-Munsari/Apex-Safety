---
phase: 15
plan: "06"
subsystem: form-builder/ui
tags: [wave-3, conditional-logic, rule-editor, properties-panel, tdd, builder-ui]
dependency_graph:
  requires:
    - lib/form-builder/attributes/visibility-rules.ts (15-01 — VisibilityRule, VisibilityRules, VALID_OPERATORS, VALID_ACTIONS)
    - lib/form-builder/visibility/scope.ts (15-03 — resolveScope, isAncestorScope)
    - lib/form-builder/entities/computed-field.ts (15-01 — confirms no requiredAttribute)
  provides:
    - components/form-builder/rule-row.tsx (RuleRow — D-03 scope filter, D-06 operator filter, A7 action filter)
    - components/form-builder/conditional-logic-section.tsx (ConditionalLogicSection — collapsible wrapper + AND/OR toggle + add-condition)
    - DEFAULT_NEW_RULE export from conditional-logic-section.tsx
    - PropertiesPanel wired to host ConditionalLogicSection for non-container entities
  affects:
    - components/form-builder/properties-panel.tsx (additive: ConditionalLogicSection appended below per-type editors)
    - plan 15-07 (cycle-error-banner.tsx — not yet built; will sit alongside ConditionalLogicSection)
tech_stack:
  added: []
  patterns:
    - OptionsEditor row analog: native <select>/<input> styled with surfaceTokens map (no new shadcn primitives)
    - Dual-surface token strategy: local surfaceTokens map mirroring properties-panel.tsx lines 37-78
    - defaultExpanded prop (test-only): forces expanded state in renderToStaticMarkup tests
    - getOperatorsForSourceType(sourceType) helper: D-06 entity-type → operator subset
key_files:
  created:
    - components/form-builder/rule-row.tsx
    - components/form-builder/conditional-logic-section.tsx
    - tests/form-builder/conditional-logic-section.test.tsx
  modified:
    - components/form-builder/properties-panel.tsx
    - vitest.config.ts (include pattern: add .tsx to form-builder test glob)
decisions:
  - "schema derived inline as { entities } in PropertiesPanel JSX — avoids adding a new schema prop to the component and its call site (entities prop already present)"
  - "defaultExpanded prop accepted by ConditionalLogicSection for test-only forced expansion — avoids @testing-library/react dependency, keeps test pattern consistent with renderers.test.tsx"
  - "getOperatorsForSourceType exported from rule-row.tsx — enables direct unit assertion without rendering; test case 5 validates action filter via rendered HTML"
  - "Container types (repeatingSection, sectionGroup) excluded from source-field dropdown candidates — they are scope identifiers, not value-bearing fields"
  - "DEFAULT_NEW_RULE exported from conditional-logic-section.tsx — test case 4 validates its shape directly"
metrics:
  duration: "~30 minutes"
  completed: "2026-05-26"
  tasks_completed: 2
  files_created: 3
  files_modified: 2
---

# Phase 15 Plan 06: Rule Editor UI (ConditionalLogicSection + RuleRow) Summary

**Builder-side conditional logic rule editor shipped to the PropertiesPanel — admins can declare D-03-scoped, D-06-filtered, A7-guarded rules via native select/input controls reusing the OptionsEditor surface token pattern.**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-05-26T02:51:00Z
- **Completed:** 2026-05-26T02:56:00Z
- **Tasks:** 2 (both TDD — RED + GREEN)
- **Files modified:** 5 total (3 created, 2 modified)

## Accomplishments

### Task 1 — RuleRow + ConditionalLogicSection components (TDD)

**`components/form-builder/rule-row.tsx`**
- `RuleRow` component with full D-03/D-06/A7 enforcement at the UI layer
- Source-field dropdown: `isAncestorScope` from plan 15-03 filters candidates; container types (repeatingSection, sectionGroup) excluded as value-bearing sources
- `getOperatorsForSourceType(sourceType)` helper — operator-filter map:

| Entity Type | Available Operators |
|-------------|---------------------|
| textField, textareaField | equals, notEquals, isEmpty, isNotEmpty, **contains** |
| numberField, dateField, computedField | equals, notEquals, isEmpty, isNotEmpty, **>, <** |
| all others (selectField, checkboxField, etc.) | equals, notEquals, isEmpty, isNotEmpty |

- Value input: `w-0 overflow-hidden p-0 border-0` when operator is `isEmpty`/`isNotEmpty` — row layout doesn't reflow (UI-SPEC §1 explicit)
- Action dropdown: `require` filtered OUT when `hostEntityType === "computedField"` (A7)
- Accepts `surface?: "dark" | "cream"` per AGENTS.md form-builder-reusable contract

**`components/form-builder/conditional-logic-section.tsx`**
- `ConditionalLogicSection` with collapsed/expanded state managed by `useState`
- Header: GitFork (14px) + `CONDITIONAL LOGIC` mono label + `(N)` inline badge when rules.length > 0 + ChevronRight/ChevronDown
- AND/OR segmented toggle: `w-full grid grid-cols-2 h-7 rounded-[3px]`, active chip `bg-[#3b8273] text-white` (dark) / `bg-[#1a1a1a] text-white` (cream)
- `DEFAULT_NEW_RULE: { sourceEntityId: "", operator: "equals", value: null, action: "show" }` exported
- Add-condition click appends a `{ ...DEFAULT_NEW_RULE }` copy to the rules array
- Dashed `+ Add condition` button, full-width `h-7`
- `defaultExpanded` prop (test-only, defaults `false`) for `renderToStaticMarkup` tests

### Task 2 — Wire ConditionalLogicSection into PropertiesPanel

**`components/form-builder/properties-panel.tsx`** (additive modification):
- Import `ConditionalLogicSection` from `./conditional-logic-section`
- Append `<ConditionalLogicSection>` after last per-type editor, before type footer
- Guard: `{!isSectionGroup && !isRepeatingSection && (...)}` — containers (sectionGroup, repeatingSection) don't expose the rule editor UI (UI-SPEC §1)
- `onChange={(next) => setAttr("visibilityRules", next)}` — reuses existing `setAttr` helper at lines 230-232
- `schema={{ entities }}` — derived inline; no new prop added to PropertiesPanel or its call sites

## Task Commits

| Task | Phase | Commit | Description |
|------|-------|--------|-------------|
| Task 1 RED | test | `1a5bcfa` | add failing tests for ConditionalLogicSection + RuleRow |
| Task 1 GREEN | feat | `fdfd5da` | implement RuleRow + ConditionalLogicSection components |
| Task 2 | feat | `81e7e53` | wire ConditionalLogicSection into PropertiesPanel |

## Verification Results

```
npx vitest run tests/form-builder/conditional-logic-section.test.tsx

 ✓ tests/form-builder/conditional-logic-section.test.tsx (9 tests) 354ms

Test Files  1 passed (1)
      Tests  9 passed (9)
```

```
npx tsc --noEmit 2>&1 | grep "components/form-builder"
(no output — zero new errors)
```

**`components.json` unchanged** — no new shadcn primitives installed.

## Decisions Made

- **Schema derived inline as `{ entities }` in PropertiesPanel JSX** — The `entities` prop is already the `schema.entities` record from the builder store. Wrapping it as `{ entities }` avoids adding a new `schema` prop to `PropertiesPanel` and its call site in `builder-client.tsx`. The `ConditionalLogicSection` and `RuleRow` minimal schema type accepts this shape.

- **`defaultExpanded` prop for test-only forced expansion** — `renderToStaticMarkup` cannot simulate click events. The `defaultExpanded?: boolean` prop (defaults `false`) allows tests to render the expanded state directly without changing the production default behavior.

- **Container types excluded from source-field dropdown** — `repeatingSection` and `sectionGroup` are scope identifiers, not value-bearing fields. Adding them to the source dropdown would be misleading (they have no fill-time answer value). The filter in `RuleRow` explicitly excludes `candidate.type === "repeatingSection" || candidate.type === "sectionGroup"`.

- **`getOperatorsForSourceType` exported from `rule-row.tsx`** — Exporting this pure function makes the D-06 operator map testable directly (test case 5 uses rendered HTML but the export enables future direct unit assertion).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] vitest.config.ts `include` pattern excluded `.tsx` from form-builder tests**
- **Found during:** Task 1 test setup
- **Issue:** `tests/form-builder/**/*.{test,spec}.ts` — the `form-builder` glob pattern only covered `.ts` files, but the plan specifies `tests/form-builder/conditional-logic-section.test.tsx` (`.tsx`)
- **Fix:** Extended the include pattern to `*.{test,spec}.{ts,tsx}` for the form-builder glob
- **Files modified:** `vitest.config.ts`
- **Committed in:** `1a5bcfa` (Task 1 RED commit)

## Known Stubs

None — all three new files contain real implementations:
- `rule-row.tsx`: full D-03/D-06/A7 enforcement
- `conditional-logic-section.tsx`: full collapsible UI with AND/OR toggle
- `conditional-logic-section.test.tsx`: 9 real assertions covering all spec requirements

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries. All three new files are React UI components or tests operating on data already in the builder store.

STRIDE threat mitigations from the plan's threat register:
- **T-15-06-01 (Tampering — D-03 scope filter):** `isAncestorScope` from plan 15-03 filters source candidates in `RuleRow`; server-side `validateRuleGraph` remains the authoritative guard
- **T-15-06-02 (Tampering — A7 action filter for computedField):** Action dropdown excludes `require` when `hostEntityType === "computedField"`; server-side no-op even if smuggled
- **T-15-06-03 (Spoofing — surface prop):** Purely visual; no security-relevant branching
- **T-15-06-04 (Information Disclosure):** No new exposure; rules stored in `template_versions.schema_json` already protected by Phase 13 RLS
- **T-15-06-05 (Tampering — onChange handler):** All writes go through `setAttr` → `builderStore.setEntityAttribute` → `visibilityRulesAttribute.validate()` rejection path

## TDD Gate Compliance

| Gate | Commit | Status |
|------|--------|--------|
| RED (test) Task 1 | `1a5bcfa` | PASSED |
| GREEN (feat) Task 1 | `fdfd5da` | PASSED |

## Self-Check

Files verified to exist:
- `components/form-builder/rule-row.tsx` FOUND
- `components/form-builder/conditional-logic-section.tsx` FOUND
- `tests/form-builder/conditional-logic-section.test.tsx` FOUND

Commits verified:
- `1a5bcfa` — Task 1 RED (test)
- `fdfd5da` — Task 1 GREEN (feat)
- `81e7e53` — Task 2 (feat)

## Self-Check: PASSED
