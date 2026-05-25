---
phase: 15
plan: "01"
subsystem: form-builder/attributes
tags: [wave-1, conditional-logic, visibility-rules, attribute-factory, entity-patch, backcompat]
dependency_graph:
  requires:
    - lib/form-builder/visibility/should-be-processed.ts (shipped by plan 15-00 Task 3)
  provides:
    - lib/form-builder/attributes/visibility-rules.ts
    - visibilityRulesAttribute + VisibilityRule + VisibilityRules + VALID_OPERATORS + VALID_ACTIONS
    - shouldBeProcessed hook attached to all 13 entity definitions
  affects:
    - All 13 lib/form-builder/entities/*.ts (each now carries the new attribute + hook)
    - plans 15-02 through 15-09 (the attribute is the foundation for the entire engine)
tech_stack:
  added: []
  patterns:
    - default-coerce attribute validate() (Phase 13 RESEARCH Pitfall 4 carry-forward)
    - visibilityRulesAttribute factory modelled on computed-inputs.ts
    - entity two-line patch: import + attrs-entry + option (Phase 14 attachPhotos pattern)
key_files:
  created:
    - lib/form-builder/attributes/visibility-rules.ts
  modified:
    - lib/form-builder/entities/text-field.ts
    - lib/form-builder/entities/number-field.ts
    - lib/form-builder/entities/date-field.ts
    - lib/form-builder/entities/select-field.ts
    - lib/form-builder/entities/textarea-field.ts
    - lib/form-builder/entities/checkbox-field.ts
    - lib/form-builder/entities/section-group.ts
    - lib/form-builder/entities/signature-field.ts
    - lib/form-builder/entities/rating-field.ts
    - lib/form-builder/entities/multi-photo-field.ts
    - lib/form-builder/entities/geolocation-field.ts
    - lib/form-builder/entities/computed-field.ts
    - lib/form-builder/entities/repeating-section.ts
    - tests/form-builder/visibility/visibility-rules-attribute.test.ts
    - tests/form-builder/visibility/backcompat.test.ts
decisions:
  - "visibilityRulesAttribute validate() returns DEFAULT (not throw) for undefined/null inputs — Pitfall 1 / A4 backward-compat with pre-Phase-15 template_versions.schema_json rows"
  - "rules array coerced to empty array when missing (not error) — same Pitfall 1 rationale"
  - "logic field coerces any non-'or' value (including missing) to 'and' rather than throwing"
  - "Per-rule validation throws indexed Rule #i: messages for admin-readable server-log diagnostics (T-15-01-04)"
  - "computedField gets both attribute + hook normally — UI filters 'require' from action dropdown in plan 15-06; engine is uniform per RESEARCH §Pattern 3"
  - "sectionGroup and repeatingSection get both changes for engine uniformity; UI hides conditional-logic editor for containers (PropertiesPanel guard, plan 15-06)"
  - "lib/form-builder/index.ts confirmed UNCHANGED — entity self-registration via file-level createEntity() is sufficient; no createBuilder() re-registration needed"
  - "backcompat test UUID issue: coltorapps rejects non-v4 UUIDs — handcrafted hex strings fail; resolved by generating proper v4 UUIDs via node crypto.randomUUID()"
metrics:
  duration: "~70 minutes"
  completed: "2026-05-25"
  tasks_completed: 2
  files_created: 1
  files_modified: 14
---

# Phase 15 Plan 01: visibilityRulesAttribute + Entity Registration Summary

`visibilityRulesAttribute` factory implemented with D-05/D-06/D-07 validation, default-coercing pre-Phase-15 schemas cleanly; attached (with `shouldBeProcessed` hook) to all 13 entity definitions.

## What Was Built

### Task 1 — `visibilityRulesAttribute` factory (commit `225067e`)

**File:** `lib/form-builder/attributes/visibility-rules.ts`

Exports:
- `VALID_OPERATORS: Set<string>` — the seven D-06 operators
- `VALID_ACTIONS: Set<string>` — the three D-07 actions
- `VisibilityRule` interface (sourceEntityId, operator, value, action)
- `VisibilityRules` interface (rules, logic)
- `visibilityRulesAttribute` — coltorapps `createAttribute` factory

**Default-coerce behaviour (Pitfall 1 / A4):**
- `undefined` → `{ rules: [], logic: "and" }` — no throw
- `null` → `{ rules: [], logic: "and" }` — no throw
- Non-object root → throws `visibilityRules must be an object with 'rules' and 'logic'.`
- `logic` missing or not `"or"` → coerced to `"and"` (only `"or"` is preserved)
- `rules` missing → coerced to `[]`
- `rules` present but not array → throws `visibilityRules.rules must be an array.`
- Per-rule: non-object → `Rule #i is not an object.`
- Per-rule: missing/empty sourceEntityId → `Rule #i: sourceEntityId must be a non-empty string.`
- Per-rule: invalid operator → `Rule #i: operator must be one of equals, notEquals, ...`
- Per-rule: invalid action → `Rule #i: action must be show, hide, or require.`
- Per-rule: missing value → coerced to `null`

**Tests:** 5 real assertions in `tests/form-builder/visibility/visibility-rules-attribute.test.ts` — replaced Wave-0 `it.todo` stubs. All 5 passing.

### Task 2 — 13 entity patches + backcompat test (commit `c97ea05`)

**13 entities modified** — each receives the same two-line addition:

| File | Type | Change |
|------|------|--------|
| `text-field.ts` | textField (basic) | + `visibilityRulesAttribute` in attrs[], + `shouldBeProcessed: makeShouldBeProcessed()` |
| `number-field.ts` | numberField (basic) | same |
| `date-field.ts` | dateField (basic) | same |
| `select-field.ts` | selectField (basic) | same |
| `textarea-field.ts` | textareaField (basic) | same |
| `checkbox-field.ts` | checkboxField (basic) | same |
| `section-group.ts` | sectionGroup (container) | same — UI hides editor; engine is uniform |
| `signature-field.ts` | signatureField (specialty) | same |
| `rating-field.ts` | ratingField (specialty) | same |
| `multi-photo-field.ts` | multiPhotoField (specialty) | same |
| `geolocation-field.ts` | geolocationField (specialty) | same |
| `computed-field.ts` | computedField (specialty, read-only) | same — UI will filter 'require' in plan 15-06 |
| `repeating-section.ts` | repeatingSection (container) | same — UI hides editor; engine is uniform |

**`should-be-processed.ts` import:** All 13 entity files import `makeShouldBeProcessed` from `../visibility/should-be-processed` (shipped by plan 15-00 Task 3 at commit `fc89202`). This file was NOT modified or stubbed by this plan.

**`lib/form-builder/index.ts`:** CONFIRMED UNCHANGED — reading lines 1-38 confirmed `createBuilder({ entities: [...] })` only needs entity refs already present; no additional registration needed.

**Backcompat test** (`tests/form-builder/visibility/backcompat.test.ts`): 1 real assertion replacing Wave-0 `it.todo` stub. Loads a 14-entity inline snapshot mirroring the migration 011 seed schema (all Phase 14 entity types, no `visibilityRules` keys). Asserts `result.success === true` and that every entity's `attributes.visibilityRules` equals `{ rules: [], logic: "and" }` post-validation. Passing.

## Verification Results

```
npx vitest run tests/form-builder/visibility/visibility-rules-attribute.test.ts tests/form-builder/visibility/backcompat.test.ts

Test Files  2 passed (2)
      Tests  6 passed (6)
```

```
npx tsc --noEmit 2>&1 | grep -E "lib/form-builder/(entities|attributes|visibility)"
(no output — zero new errors)
```

```
grep -l "visibilityRulesAttribute" lib/form-builder/entities/*.ts | wc -l
13

grep -l "makeShouldBeProcessed" lib/form-builder/entities/*.ts | wc -l
13
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] coltorapps UUID validation rejects hand-crafted hex UUIDs**
- **Found during:** Task 2 backcompat test
- **Issue:** coltorapps `validateSchema` rejects entity IDs like `00000000-0000-0000-0000-000000000001` and `a1b2c3d4-e5f6-7890-abcd-ef1234567890` with "The entity id '...' is invalid." — these are not valid UUIDs per the library's validator even though they look like UUIDs
- **Fix:** Used `node crypto.randomUUID()` to generate proper v4 UUIDs for the test fixture, matching the pattern in `tests/form-builder/validate-schema.test.ts`
- **Files modified:** `tests/form-builder/visibility/backcompat.test.ts`
- **Commit:** `c97ea05` (same task commit)

## Known Stubs

None — all files created/modified by this plan contain real implementations. The test files replace Wave-0 `it.todo` stubs with real assertions.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. The only new code is:
- `lib/form-builder/attributes/visibility-rules.ts` — pure TypeScript module, no I/O
- 13 entity file modifications — additive, no I/O changes

The threat model items T-15-01-01 and T-15-01-04 (Tampering via validate()) are mitigated by the whitelist enforcement in `visibilityRulesAttribute.validate()` — `VALID_OPERATORS` and `VALID_ACTIONS` sets reject any operator or action not in the D-06/D-07 fixed lists.

## Self-Check

Files verified to exist:
- `lib/form-builder/attributes/visibility-rules.ts` FOUND
- `tests/form-builder/visibility/visibility-rules-attribute.test.ts` FOUND
- `tests/form-builder/visibility/backcompat.test.ts` FOUND

Commits verified:
- `225067e` — Task 1 (visibilityRulesAttribute factory + test) FOUND
- `c97ea05` — Task 2 (13 entity patches + backcompat test) FOUND

## Self-Check: PASSED
