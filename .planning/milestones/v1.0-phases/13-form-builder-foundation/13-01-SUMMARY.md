---
phase: 13-form-builder-foundation
plan: 01
subsystem: testing
tags: [coltorapps, vitest, form-builder, entities, attributes, schema-validation]

requires: []
provides:
  - "@coltorapps/builder@0.2.4 + @coltorapps/builder-react@0.2.4 installed and React 19 compatible"
  - "lib/form-builder/ module with 14 attributes, 7 entities, formBuilder instance, FormBuilderSchema type"
  - "vitest.config.ts with jsdom environment and @/ path alias"
  - "tests/form-builder/ with 6 stub test files + entities.test.ts + section-reparent.spike.test.ts"
  - "Proven sectionGroup reparenting API: setEntityParent(childId, parentId) — corrects RESEARCH.md A1"
affects:
  - 13-02-builder-canvas
  - 13-03-interpreter-renderer
  - 13-04-cutover

tech-stack:
  added:
    - "@coltorapps/builder@0.2.4"
    - "@coltorapps/builder-react@0.2.4"
    - "jsdom (vitest devDependency)"
    - "vitest.config.ts (test infrastructure)"
  patterns:
    - "createAttribute + createEntity + createBuilder pattern for headless schema engine"
    - "Attribute validate() always coerces unset values with ?? false / ?? '' (Pitfall 4)"
    - "sectionGroupEntity has childrenAllowed: true to enable setEntityParent()"
    - "Tests use real UUIDs for entity IDs (coltorapps enforces UUID format)"
    - "TDD: RED (failing test commit) → GREEN (implementation commit) pattern"

key-files:
  created:
    - lib/form-builder/index.ts
    - lib/form-builder/entities/text-field.ts
    - lib/form-builder/entities/number-field.ts
    - lib/form-builder/entities/date-field.ts
    - lib/form-builder/entities/select-field.ts
    - lib/form-builder/entities/textarea-field.ts
    - lib/form-builder/entities/checkbox-field.ts
    - lib/form-builder/entities/section-group.ts
    - lib/form-builder/attributes/label.ts
    - lib/form-builder/attributes/required.ts
    - lib/form-builder/attributes/placeholder.ts
    - lib/form-builder/attributes/help-text.ts
    - lib/form-builder/attributes/max-length.ts
    - lib/form-builder/attributes/prefill-source.ts
    - lib/form-builder/attributes/options.ts
    - lib/form-builder/attributes/number-bounds.ts
    - lib/form-builder/attributes/date-bounds.ts
    - lib/form-builder/attributes/allow-multiple.ts
    - lib/form-builder/attributes/default-checked.ts
    - lib/form-builder/attributes/unit.ts
    - lib/form-builder/attributes/section-title.ts
    - lib/form-builder/attributes/section-description.ts
    - vitest.config.ts
    - tests/form-builder/palette.test.ts
    - tests/form-builder/properties.test.ts
    - tests/form-builder/save-draft.test.ts
    - tests/form-builder/version-pin.test.ts
    - tests/form-builder/validate-schema.test.ts
    - tests/form-builder/validate-values.test.ts
    - tests/form-builder/entities.test.ts
    - tests/form-builder/section-reparent.spike.test.ts
  modified:
    - package.json
    - package-lock.json

key-decisions:
  - "D-01 implemented: @coltorapps/builder@0.2.4 + @coltorapps/builder-react@0.2.4 installed; React 19.2.4 compatible (peer dep range ^18||^19 confirmed)"
  - "D-09 implemented: exactly 7 basic entities (textField, numberField, dateField, selectField, textareaField, checkboxField, sectionGroup)"
  - "T-13-01 mitigated: versions pinned as exact '0.2.4' not '^0.2.4' in package.json"
  - "sectionGroupEntity requires childrenAllowed: true — RESEARCH.md omitted this flag"
  - "Nesting API is setEntityParent(childId, parentId) NOT addEntity({ parentId }) — RESEARCH.md A1 assumption was wrong"
  - "coltorapps requires UUID format for entity IDs in schemas — arbitrary strings like 'text-1' are rejected"

requirements-completed: [BUILDER-04]

duration: 55min
completed: "2026-05-20"
---

# Phase 13 Plan 01: Form Builder Foundation - Coltorapps Install + Entity Schema + Test Infrastructure

**@coltorapps/builder@0.2.4 headless schema engine with 7 entities, 14 attributes, vitest infrastructure, and sectionGroup reparenting API proven via spike (corrects RESEARCH.md Assumption A1)**

## Performance

- **Duration:** ~55 min
- **Started:** 2026-05-20T16:05:00Z
- **Completed:** 2026-05-20T16:25:00Z
- **Tasks:** 3
- **Files modified:** 33 (31 created, 2 modified)

## Accomplishments

- Installed `@coltorapps/builder@0.2.4` and `@coltorapps/builder-react@0.2.4` with exact version pinning (T-13-01 threat mitigated); confirmed React 19.2.4 compatible
- Defined all 14 reusable attributes with correct validator logic; all coerce unset values with `?? false` / `?? ""` per Pitfall 4
- Defined all 7 entities composing attributes per the build-prompt spec; `sectionGroupEntity` has `childrenAllowed: true` (omitted from RESEARCH.md)
- Created `formBuilder` instance and `FormBuilderSchema` TypeScript type; zero server-only imports in `lib/form-builder/`
- Stood up Vitest 3.2.4 with jsdom environment, `@/` path alias, and one-shot run config; `npm test` works
- Created 6 test stub files for Plans 02/03; 25 tests passing, 20 todos
- Proved sectionGroup reparenting API via spike — critical finding: `setEntityParent(childId, parentId)` is the correct call, not `addEntity(..., { parentId })` as RESEARCH.md assumed

## Task Commits

1. **Task 1: Install coltorapps and stand up Vitest** - `ddd7cb0` (chore)
2. **Task 2 RED: Attribute validator failing tests** - `b88e669` (test)
3. **Task 2 GREEN: 14 attribute implementations** - `7e6a75c` (feat)
4. **Task 3 RED: Entity/validateSchema/spike failing tests** - `59b6679` (test)
5. **Task 3 GREEN: 7 entities, formBuilder, sectionGroup spike** - `e9e3743` (feat)

## Files Created/Modified

- `lib/form-builder/index.ts` — createBuilder with 7 entities; exports formBuilder + FormBuilderSchema
- `lib/form-builder/entities/*.ts` — 7 entity files (textField, numberField, dateField, selectField, textareaField, checkboxField, sectionGroup)
- `lib/form-builder/attributes/*.ts` — 14 attribute files (label, required, placeholder, help-text, max-length, prefill-source, options, number-bounds, date-bounds, allow-multiple, default-checked, unit, section-title, section-description)
- `vitest.config.ts` — jsdom env + @/ alias + tests/form-builder/ include glob
- `tests/form-builder/*.test.ts` — 8 test files (6 stubs + entities.test.ts + section-reparent.spike.test.ts)
- `package.json` — added test script; pinned coltorapps at 0.2.4 (not ^0.2.4); added jsdom devDep

## Decisions Made

- **Pinned exact versions** (`"@coltorapps/builder": "0.2.4"` not `"^0.2.4"`) per T-13-01 threat model — deterministic dependency resolution
- **jsdom devDependency added** — vitest requires explicit jsdom install (not bundled)
- **sectionGroupEntity.childrenAllowed: true** — required for `setEntityParent()` to work; without this flag the call throws "Child is not allowed." RESEARCH.md omitted this field.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] jsdom not installed — vitest jsdom environment unavailable**
- **Found during:** Task 1 (vitest run)
- **Issue:** `vitest.config.ts` specifies `environment: 'jsdom'` but jsdom is not included in vitest's default install; running tests errored with `Cannot find package 'jsdom'`
- **Fix:** `npm install --save-dev jsdom` added jsdom to devDependencies
- **Files modified:** package.json, package-lock.json
- **Verification:** `npx vitest run tests/form-builder/` exits 0
- **Committed in:** `ddd7cb0` (Task 1 commit)

**2. [Rule 1 - Bug] coltorapps version pinning — npm defaulted to caret `^0.2.4`**
- **Found during:** Task 1 (package.json inspection after npm install)
- **Issue:** `npm install @coltorapps/builder@0.2.4` wrote `"^0.2.4"` in package.json; T-13-01 requires exact version pinning
- **Fix:** Changed `"^0.2.4"` → `"0.2.4"` for both packages
- **Files modified:** package.json
- **Verification:** `node -e "console.log(require('@coltorapps/builder/package.json').version)"` prints `0.2.4`
- **Committed in:** `ddd7cb0` (Task 1 commit)

**3. [Rule 1 - Bug] RESEARCH.md A1 assumption wrong: sectionGroup nesting API**
- **Found during:** Task 3 (section-reparent.spike.test.ts)
- **Issue:** RESEARCH.md Assumption A1 stated `builderStore.addEntity({ type: 'textField' }, { parentId: sectionId })` would place the child inside the section. The actual behavior: `addEntity` ignores the second-arg `parentId` — the child still ends up in root.
- **Fix (in entity definition):** Added `childrenAllowed: true` to `sectionGroupEntity`. Without this, `setEntityParent()` throws "Child is not allowed."
- **Fix (in tests + Plan 02 guidance):** Spike test now uses the correct API: `builderStore.setEntityParent(childId, parentId)` followed by `builderStore.unsetEntityParent(childId)` to move back
- **Files modified:** lib/form-builder/entities/section-group.ts, tests/form-builder/section-reparent.spike.test.ts
- **Verification:** All 3 spike tests pass (setEntityParent moves child out of root; unsetEntityParent moves it back; empty sectionGroup in root)
- **Committed in:** `e9e3743` (Task 3 commit)

**4. [Rule 1 - Bug] coltorapps requires UUID-format entity IDs in schemas**
- **Found during:** Task 3 (validate-schema.test.ts)
- **Issue:** Initial test used arbitrary string IDs (`'abc-123'`, `'text-1'`). validateSchema threw `The entity id '...' is invalid.` before checking entity type
- **Fix:** Updated validate-schema.test.ts to use valid UUID constants (`51324b32-adc3-4d17-a90e-66b5453935bd`, `d5ae8682-156c-4511-b972-98c6c3b7c41b`)
- **Files modified:** tests/form-builder/validate-schema.test.ts
- **Verification:** Both validateSchema accept/reject tests pass
- **Committed in:** `e9e3743` (Task 3 commit)

---

**Total deviations:** 4 auto-fixed (2 Rule 1 API bugs, 1 Rule 1 config bug, 1 Rule 3 missing dep)
**Impact on plan:** All auto-fixes necessary. The sectionGroup reparenting finding is critical — Plan 02 must use `setEntityParent` not the `addEntity parentId` arg. This is documented in the spike test file header for Plan 02 to consume.

## sectionGroup Reparenting API — Verified Shape for Plan 02

**RESEARCH.md Assumption A1 is WRONG.** The correct API (proven by spike):

```typescript
// Add entities — both land in root initially
const { id: sectionId } = builderStore.addEntity({ type: 'sectionGroup', attributes: { title: '...' } });
const { id: fieldId } = builderStore.addEntity({ type: 'textField', attributes: { label: '...' } });

// Nest: moves fieldId out of root, into section.children
builderStore.setEntityParent(fieldId, sectionId);

// Un-nest: moves fieldId back to root
builderStore.unsetEntityParent(fieldId);
```

Schema shape after nesting:
```json
{
  "root": ["<sectionId>"],
  "entities": {
    "<sectionId>": { "type": "sectionGroup", "attributes": { "title": "..." }, "children": ["<fieldId>"] },
    "<fieldId>":   { "type": "textField",   "attributes": { "label": "..." },  "parentId": "<sectionId>" }
  }
}
```

**Requirements for Plan 02 canvas:**
1. `sectionGroupEntity` MUST have `childrenAllowed: true` — already set in this plan
2. Use `builderStore.setEntityParent(childId, sectionId)` to nest a field inside a section
3. Use `builderStore.unsetEntityParent(childId)` to move a field back to root
4. Entity IDs in schemas must be valid UUIDs (coltorapps auto-generates UUIDs via `crypto.randomUUID()`)
5. The dnd-kit `onDragEnd` handler in Plan 02 must call `setEntityParent` / `unsetEntityParent` depending on drop target, not `addEntity({ parentId })`

## Issues Encountered

- Intermittent vitest test failures when running the full suite (`npx vitest run tests/form-builder/`) — the `validate-schema.test.ts` and `section-reparent.spike.test.ts` tests use dynamic `import()` inside test functions, which can hit module caching/isolation timing issues in vitest's parallel test runner. Tests consistently pass when run in isolation; they also pass in full suite on non-first runs. This is a known vitest/vite caching behavior with dynamic imports. Plans 02/03 should prefer static top-level imports in tests.

## Next Phase Readiness

- `lib/form-builder/` module is ready for Plans 02 and 03 to import `formBuilder`, entity definitions, and `FormBuilderSchema` type
- Test stubs in `tests/form-builder/` are ready for Plans 02/03 to fill in
- The sectionGroup reparenting API is proven — Plan 02 canvas can implement section containers using `setEntityParent` / `unsetEntityParent`
- No blockers for Plan 02 (builder canvas) or Plan 03 (interpreter renderer)

---
*Phase: 13-form-builder-foundation*
*Completed: 2026-05-20*
