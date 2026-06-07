---
phase: 14
plan: "07"
subsystem: form-builder-ui
tags: [phase-14, builder-ui, palette, properties-panel, attachPhotos, specialty-types]
dependency_graph:
  requires: [14-01, 14-02]
  provides: [builder-palette-specialty, builder-properties-specialty, attachPhotos-basic-entities]
  affects: [components/form-builder/field-palette.tsx, components/form-builder/properties-panel.tsx]
tech_stack:
  added: []
  patterns:
    - Two-section palette (Basic Types / Specialty) with DraggablePaletteButton reuse
    - Universal attachPhotos toggle gated on entity.type !== sectionGroup && !== repeatingSection
    - repeatingSection gets its own render branch in PropertiesPanel (alongside sectionGroup)
    - Entity-ID dropdown for computedField reads Object.entries(entities) filtered at render time
key_files:
  created: []
  modified:
    - components/form-builder/field-palette.tsx
    - components/form-builder/properties-panel.tsx
    - lib/form-builder/entities/text-field.ts
    - lib/form-builder/entities/number-field.ts
    - lib/form-builder/entities/date-field.ts
    - lib/form-builder/entities/select-field.ts
    - lib/form-builder/entities/textarea-field.ts
    - lib/form-builder/entities/checkbox-field.ts
    - tests/form-builder/palette.test.ts
    - tests/form-builder/properties.test.ts
decisions:
  - "D-05 attachPhotos added to 6 existing basic entities now (not deferred) — backwards-compatible because validate(undefined) returns false"
  - "repeatingSection gets own PropertiesPanel render branch alongside sectionGroup to isolate its container-specific fields"
  - "computedField hasRequired=false per Plan 14-02 — Required toggle gated out via hasRequired flag"
  - "Validate boundary tests call attribute.validate() directly (coltorapps store swallows validation errors) — matches Phase 13 attributes.test.ts pattern"
metrics:
  duration: "~90 minutes (cross-session, including wave 1 reset)"
  completed: "2026-05-25"
  tasks_completed: 2
  files_changed: 10
  tests_added: 37
---

# Phase 14 Plan 07: Builder UI — Palette + Properties Panel Summary

Lit up the builder side for all 6 Phase 14 specialty types. Admins can now drag specialty fields from the palette, select them on canvas, and configure their attributes in the properties panel. The `attachPhotos` opt-in toggle also backfilled to all 6 existing basic field entities.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (RED) | Failing tests for palette + attachPhotos | `99d636c` | tests/form-builder/palette.test.ts |
| 1 (GREEN) | FieldPalette 13 entries + attachPhotos on 6 basics | `42dcbeb` | field-palette.tsx, 6 entity files, palette.test.ts |
| 2 (RED) | Failing tests for specialty PropertiesPanel editors | `b2cce5e` | tests/form-builder/properties.test.ts |
| 2 (GREEN) | PropertiesPanel specialty attribute editors | `2cb0ddc` | properties-panel.tsx, properties.test.ts |

## What Was Built

### Task 1: FieldPalette Two-Section Layout + attachPhotos Backfill

**field-palette.tsx** restructured from a flat single-section list to two labelled sections:
- "Basic Types" header + 7 existing fields (textField → sectionGroup)
- "Specialty" header + 6 new fields: Signature (PenLine), Rating (Star), Photos (Camera), Location (MapPin), Computed (Calculator), Repeating Section (ListOrdered)
- `EntityType` union widened to 13 types; `DraggablePaletteButton` component reused unchanged
- Both sections use the same dark/cream surface token system

**6 basic entity files** each received one-line import + array append:
- `import { attachPhotosAttribute } from "../attributes/attach-photos"`
- `attachPhotosAttribute` appended to `attributes: [...]` array
- `sectionGroup` and `repeatingSection` intentionally excluded (containers, per D-05)

### Task 2: PropertiesPanel Specialty Attribute Editors

**properties-panel.tsx** extended with:
- `entityTypeMeta` map entries for all 6 specialty types (labels + lucide icons)
- Universal `attachPhotos` toggle after Required toggle, gated by `hasAttachPhotos = !isSectionGroup && !isRepeatingSection` (covers 11 of 13 entity types)
- `hasRequired` flag excludes computedField (no requiredAttribute per Plan 14-02)
- `ratingField` branch: maxRating number input (min=2, max=10, default 5)
- `multiPhotoField` branch: maxPhotos number input (min=1, max=20, default 5)
- `computedField` branch: read-only "PAS 79" formula display (font-mono, green `#3b8273`) + Likelihood Source and Consequence Source entity-ID dropdowns (filtered to exclude self, sectionGroup, repeatingSection, computedField)
- `repeatingSection` render branch (separate from sectionGroup): title input, description input, minInstances (min=0, max=50), maxInstances (min=1, max=50, blank=unlimited)
- `candidateEntities` computed from `Object.entries(entities)` filtered at render time — no state needed

## Test Coverage

**palette.test.ts** — 15 new cases added:
- 6 specialty `store.addEntity()` succeeds for each new type
- 6 entity definition checks via `entity.attributes.map(a => a.name)` for attachPhotos presence
- sectionGroup does NOT have attachPhotos (container exclusion verified)
- `setEntityAttribute` round-trip tests for attachPhotos=true/false

**properties.test.ts** — 22 new cases added:
- attachPhotos toggle: textField, numberField, signatureField, computedField
- ratingField maxRating: store round-trip + boundary throws via `maxRatingAttribute.validate()`
- multiPhotoField maxPhotos: store round-trip + boundary throws
- computedField computedInputs: store round-trip + undefined coercion to `{likelihood:"",consequence:""}`
- computedField formula: `formulaAttribute.validate(undefined)` returns `"pas79"`
- repeatingSection minInstances/maxInstances: store round-trips + validate(-1) throws, validate(0) throws
- PropertiesPanel entityTypeMeta coverage: all 6 specialty types round-trip via store

**Total test count:** 244 tests passing, 3 todo (16 test files).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] coltorapps store swallows validate() errors — wrong test pattern for boundary checks**
- **Found during:** Task 2 RED
- **Issue:** Initial tests used `expect(() => store.setEntityAttribute(id, "maxRating", 1)).toThrow()`. coltorapps builder store internally catches attribute validate() errors — the call does not throw to the caller.
- **Fix:** Changed to call `attribute.validate(value)` directly per Phase 13 pattern in `attributes.test.ts`. Tests assert on the attribute validator itself, not the store wrapper.
- **Files modified:** tests/form-builder/properties.test.ts
- **Pattern:** Pre-existing in attributes.test.ts — no new approach introduced

**2. [Rule 1 - Bug] coltorapps raw schema returns `{}` for unset attributes — wrong assertion for defaults**
- **Found during:** Task 1 RED
- **Issue:** Tests asserted `expect(attrs.attachPhotos).toBe(false)` after `store.addEntity()`. `getSchema().entities[id].attributes` returns the stored object which is `{}` until explicitly set — coltorapps coercion only happens via `validate()`, not on schema reads.
- **Fix:** Changed to check entity attribute DEFINITIONS via `entity.attributes.map(a => a.name)` (does the attribute factory appear in the entity?) + `setEntityAttribute` round-trip tests.
- **Files modified:** tests/form-builder/palette.test.ts

**3. [Rule 3 - Blocking] Worktree HEAD behind Wave 1 merge commit**
- **Found during:** Task 1 setup
- **Issue:** HEAD was at `8e53d44` (pre-Wave 1 state); Wave 1 entity files (signatureField, max-rating, etc.) were not visible.
- **Fix:** `git reset --hard 08bb7a03ecea76520f8148fe4cf3f6611d5e808e` (Wave 1 merge commit per worktree_branch_check protocol).
- **Impact:** No code changes; git history only.

**4. [Rule 3 - Blocking] Vitest module cache stale after entity file changes**
- **Found during:** Task 1 GREEN
- **Issue:** Tests continued to fail even after implementation was correct — Vite's transform cache retained old compiled module versions.
- **Fix:** Cleared `node_modules/.vite` cache.
- **Impact:** No code changes.

## Known Stubs

None. All attribute editors are wired to `builderStore.setEntityAttribute()`. The computedField formula display is intentionally static ("PAS 79") — this is by design per Plan 14-01 (formula is an enum with one value in Phase 14; the display is read-only in the builder).

## Threat Flags

None. No new server-side surfaces introduced. All builder writes continue to flow through Phase 13's `saveDraftAction` / `publishTemplateAction`. The entity-ID dropdown for computedField reads only from the in-memory store — no server calls.

## Self-Check: PASSED

Files exist:
- FOUND: components/form-builder/field-palette.tsx
- FOUND: components/form-builder/properties-panel.tsx
- FOUND: lib/form-builder/entities/text-field.ts (attachPhotosAttribute present)
- FOUND: tests/form-builder/palette.test.ts
- FOUND: tests/form-builder/properties.test.ts

Commits exist:
- FOUND: 99d636c — test(14-07) RED palette
- FOUND: 42dcbeb — feat(14-07) GREEN palette
- FOUND: b2cce5e — test(14-07) RED properties
- FOUND: 2cb0ddc — feat(14-07) GREEN properties

Test suite: 244 passed, 3 todo (16 files) — all GREEN.
