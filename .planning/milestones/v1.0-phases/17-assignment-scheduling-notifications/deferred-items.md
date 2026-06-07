# Phase 17 Deferred Items

Items discovered during Plan 17-05 execution that are out of scope for this plan.

## Pre-existing test failures

### specialty-entities.test.ts — 4 failing attribute-count assertions

**Discovered during:** Plan 17-05 form-builder regression sweep  
**Confirmed pre-existing:** Yes — failures exist on base commit 9e67413 before any Plan 17-05 changes  
**File:** `tests/form-builder/specialty-entities.test.ts`  
**Failing tests:**
1. `signatureField attribute set > has exactly label, required, helpText, attachPhotos attributes` (line 129)
2. `geolocationField attribute set > has exactly label, required, helpText, attachPhotos attributes (no map config)` (line 190)
3. `computedField attribute set > has exactly label, formula, computedInputs, attachPhotos — NO required attribute` (line 206)
4. `repeatingSection attribute set > has exactly title, description, minInstances, maxInstances — NO attachPhotos` (line 222)

**Root cause:** Each entity has 5 attributes but the spec asserts `toHaveLength(4)`. Either a new attribute was added to the entities after the spec was written, or the spec count is wrong.

**Suggested fix:** Read each failing entity's attribute list and update the `toHaveLength` assertions to match reality. Or remove the `toHaveLength` assertion and rely on the existing `toContain` assertions for correctness coverage.

**Not fixed in Plan 17-05** — out of scope (Plan 17-05 modifies only the cron scheduler spec).
