---
phase: 14
plan: "02"
subsystem: form-builder
tags: [phase-14, foundation, entities, repeating-section, progress, tdd]
dependency_graph:
  requires: []
  provides:
    - lib/form-builder/entities/signature-field.ts
    - lib/form-builder/entities/rating-field.ts
    - lib/form-builder/entities/multi-photo-field.ts
    - lib/form-builder/entities/geolocation-field.ts
    - lib/form-builder/entities/computed-field.ts
    - lib/form-builder/entities/repeating-section.ts
    - lib/form-builder/index.ts (13-entity formBuilder)
    - lib/form-builder/progress.ts (repeatingSection + geolocation support)
  affects:
    - components/form-interpreter/interpreter-renderer.tsx (downstream renderer types)
    - Plans 14-04, 14-05, 14-06 (renderers depend on these entity types)
tech_stack:
  added: []
  patterns:
    - "coltorapps createEntity + createAttribute factory pattern (Phase 13 carry-forward)"
    - "TDD RED→GREEN pair per task"
    - "repeatingSection {instances: []} safe coercion (Pitfall 3)"
    - "computeFormProgress: repeatingSection children excluded from standalone required-count"
key_files:
  created:
    - lib/form-builder/attributes/attach-photos.ts
    - lib/form-builder/attributes/max-rating.ts
    - lib/form-builder/attributes/max-photos.ts
    - lib/form-builder/attributes/formula.ts
    - lib/form-builder/attributes/computed-inputs.ts
    - lib/form-builder/attributes/min-instances.ts
    - lib/form-builder/attributes/max-instances.ts
    - lib/form-builder/entities/signature-field.ts
    - lib/form-builder/entities/rating-field.ts
    - lib/form-builder/entities/multi-photo-field.ts
    - lib/form-builder/entities/geolocation-field.ts
    - lib/form-builder/entities/computed-field.ts
    - lib/form-builder/entities/repeating-section.ts
    - tests/form-builder/specialty-entities.test.ts
    - tests/form-builder/repeating-section.test.ts
  modified:
    - lib/form-builder/index.ts (+6 imports, +6 entities = 13 total)
    - lib/form-builder/progress.ts (+repeatingSection branch, +geolocation isFilled)
    - tests/form-builder/progress.test.ts (+11 new cases, all GREEN)
decisions:
  - "repeatingSection children are excluded from the standalone required-entity count in computeFormProgress — their values live inside instances[], not at root level"
  - "repeatingSection validate({}) returns {instances: []} via Pitfall 3 safe coercion — documented in entity JSDoc"
  - "computedField has NO requiredAttribute (UI-SPEC) — never appears in required set, never blocks progress"
  - "isFilled extended to treat plain objects with numeric lat+lng as filled (geolocationField), preserving backwards-compatible true for other objects"
metrics:
  duration: "~30 minutes"
  completed: "2026-05-25"
  tasks_completed: 3
  files_created: 15
  files_modified: 3
---

# Phase 14 Plan 02: Specialty Entities + Progress Extension Summary

6 new coltorapps entity types registered in `formBuilder` (13 total), 7 new attribute files, and `computeFormProgress` extended for repeatingSection instances and geolocation objects.

## What Was Built

### Task 1: Six New Entity Files + Register in formBuilder

Created 7 attribute files:
- `attach-photos.ts` — boolean, default false (D-05)
- `max-rating.ts` — numeric, default 5
- `max-photos.ts` — numeric, default 5
- `formula.ts` — string enum ("pas79"), default ""
- `computed-inputs.ts` — Record<string, string> entity ID map
- `min-instances.ts` — numeric, default 0
- `max-instances.ts` — numeric, default undefined (unlimited)

Created 6 entity files:
- `signature-field.ts` — string storage-path value; required gate; type check; attachPhotos
- `rating-field.ts` — integer [1..maxRating]; Number coercion; bounds check; attachPhotos
- `multi-photo-field.ts` — string[] storage paths; array + length + element validation; attachPhotos
- `geolocation-field.ts` — {lat,lng,accuracy,capturedAt} object; lat/lng range check; attachPhotos
- `computed-field.ts` — pass-through validate (renderer-owned, read-only); NO requiredAttribute; attachPhotos, formula, computedInputs
- `repeating-section.ts` — childrenAllowed: true; {instances:[]} safe coercion; non-array instances throws; NO attachPhotos

Updated `lib/form-builder/index.ts` — 13 entities total (7 basic + 6 specialty).

TDD: RED commit `7b480fb` → GREEN commit `48aa3bc`.

### Task 2: repeatingSection Nesting + Value-Shape Coverage

Created `tests/form-builder/repeating-section.test.ts` (9 cases: 8 passing + 1 todo):
- setEntityParent / unsetEntityParent nesting API (Phase 13 pattern carried forward)
- Multi-child nesting (childrenAllowed: true)
- setEntityParent into textField throws (childrenAllowed: false)
- D-04 value-shape round-trip: {instances:[{childA,childB},{childA}]} survives store round-trip
- validate() container shape: valid array returns unchanged, non-array throws with "instances" in message
- 1 todo documenting per-instance validation gap (RESEARCH Open Question #1, T-14-02-03)
- D-03 bounds note: entity.validate() accepts below-minInstances (renderer-enforced)

GREEN-only commit (entity implementation shipped in Task 1): `50141d2`.

### Task 3: computeFormProgress Extension

Extended `lib/form-builder/progress.ts`:
- `isFilled()`: new branch for objects with numeric `lat` + `lng` → treated as filled (geolocationField)
- `computeFormProgress()`: collects repeatingSection child IDs and excludes them from top-level required-entity count (values live in instances[])
- `isRepeatingSectionFilled()`: quantity gate (instances.length >= minInstances) + quality gate (all required children filled in every instance)

Extended `tests/form-builder/progress.test.ts` (+11 cases, all GREEN):
- repeatingSection: minInstances=0 (not required), minInstances=2 + undefined/short/full instances
- Per-instance required children: second instance missing → 0, both filled → 100
- geolocationField: required+undefined → 0, required+{lat,lng,...} → 100
- computedField: no required attr → never blocks progress
- Mixed schema: text + repeatingSection(min=1) + optional; 50% and 100% cases

TDD: RED commit `69a7912` → GREEN commit `aad4dd0`.

## Deviations from Plan

### Auto-discovered: repeatingSection child entities counted twice in computeFormProgress

**Found during:** Task 3 implementation
**Issue:** The progress function was counting `CHILD_REQ_ID` (a required textField that is a child of repeatingSectionEntity) as BOTH a standalone required entity AND as a child checked inside the repeatingSection. This caused 50% instead of 100% when both instances were filled.
**Fix:** Added `repeatingSectionChildIds` Set: all entities in `schema.entities[id].children` for any repeatingSection are excluded from the top-level required-entity scan. Their values are accessed via `instances[childId]`, not directly from `values[childId]`.
**Files modified:** `lib/form-builder/progress.ts`
**Commit:** `aad4dd0`

## Known Downstream TypeScript Impact

Registering 6 new entities widened `FormBuilderSchema`, causing `components/form-interpreter/interpreter-renderer.tsx` to show a TS2740 error: the `components` useMemo map is missing entries for the 6 new entity types. This is the intended consequence per `key_links` in the plan — Plans 14-04, 14-05, and 14-06 will add the interpreter renderers and close the type error. This error is NOT a regression: it also existed before this plan due to unrelated pre-existing issues.

## Known Stubs

None. All entity files are fully implemented. No hardcoded empty values or placeholder text in production paths.

## Threat Surface Scan

All threat register items from the plan's threat model are addressed:
- T-14-02-01: Arbitrary child keys in instances[] are safe — server iterates only schema.entities[id].children
- T-14-02-02: {instances: "nope"} throws in validate() — test covers this
- T-14-02-03: Per-instance child validation gap documented in repeating-section.test.ts (1 todo, tracked)
- T-14-02-04: computedField pass-through accepted (read-only, Matt reviews drafts)
- T-14-02-05: geolocationField lat/lng bounds checked in validate()
- T-14-02-06: maxInstancesAttribute capped at builder level (Plan 14-07)
- T-14-02-07: computeFormProgress is pure function, no I/O

No new threat surface introduced outside the plan's threat_model.

## Commits

| Hash | Message |
|------|---------|
| `7b480fb` | test(14-02): add failing tests for 6 specialty entities (RED) |
| `48aa3bc` | feat(14-02): implement 6 specialty entities and register in formBuilder (GREEN) |
| `50141d2` | test(14-02): repeatingSection nesting + value-shape coverage |
| `69a7912` | test(14-02): extend progress tests for repeatingSection + geolocation (RED) |
| `aad4dd0` | feat(14-02): extend computeFormProgress for repeatingSection instances and geolocation isFilled (GREEN) |

## Self-Check

- [x] 6 entity files exist
- [x] 7 attribute files exist
- [x] formBuilder.entities has 13 entries (asserted in specialty-entities.test.ts)
- [x] repeatingSectionEntity.childrenAllowed === true (asserted in test)
- [x] computedFieldEntity has no required attr (asserted in test)
- [x] All specialty-entities.test.ts cases GREEN (36 passed)
- [x] All repeating-section.test.ts cases GREEN (8 passed + 1 todo)
- [x] All progress.test.ts cases GREEN (18 passed)
- [x] No Phase 13 test regressions (114 passing, 2 pre-existing failures in version-pin.test.ts unrelated to this plan)
- [x] TDD RED→GREEN pairs in git log for Tasks 1 and 3; Task 2 is GREEN-only (entity implementation already shipped in Task 1)
