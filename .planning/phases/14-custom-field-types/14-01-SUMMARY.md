---
phase: 14
plan: 01
subsystem: form-builder
tags: [phase-14, foundation, attributes, pas79, leaflet, roadmap-fix, tdd]
dependency_graph:
  requires: []
  provides:
    - lib/form-builder/attributes/attach-photos.ts
    - lib/form-builder/attributes/formula.ts
    - lib/form-builder/attributes/computed-inputs.ts
    - lib/form-builder/attributes/min-instances.ts
    - lib/form-builder/attributes/max-instances.ts
    - lib/form-builder/attributes/max-rating.ts
    - lib/form-builder/attributes/max-photos.ts
    - lib/form-builder/risk/pas79.ts
    - lib/form-builder/storage/upload-paths.ts
    - public/leaflet/marker-icon.png
    - public/leaflet/marker-icon-2x.png
    - public/leaflet/marker-shadow.png
  affects:
    - .planning/ROADMAP.md
    - package.json
tech_stack:
  added:
    - leaflet@1.9.4 (exact pin, no caret)
    - react-leaflet@^5.0.0
    - "@types/leaflet@^1.9.21 (devDependencies)"
  patterns:
    - TDD RED/GREEN per attribute and utility module
    - createAttribute factory with undefined-coerce-to-default (Phase 13 Pitfall 4)
    - Pure function module for risk computation (no I/O)
    - Pure string builders for storage paths (no I/O, testable in isolation)
key_files:
  created:
    - lib/form-builder/attributes/attach-photos.ts
    - lib/form-builder/attributes/formula.ts
    - lib/form-builder/attributes/computed-inputs.ts
    - lib/form-builder/attributes/min-instances.ts
    - lib/form-builder/attributes/max-instances.ts
    - lib/form-builder/attributes/max-rating.ts
    - lib/form-builder/attributes/max-photos.ts
    - lib/form-builder/risk/pas79.ts
    - lib/form-builder/storage/upload-paths.ts
    - public/leaflet/marker-icon.png
    - public/leaflet/marker-icon-2x.png
    - public/leaflet/marker-shadow.png
    - tests/form-builder/attributes.test.ts
    - tests/form-builder/pas79.test.ts
    - tests/form-builder/upload-paths.test.ts
  modified:
    - package.json (leaflet pinned exact, @types/leaflet moved to devDeps)
    - package-lock.json
    - .planning/ROADMAP.md (D-15 wording fix)
decisions:
  - "Leaflet pinned to exact 1.9.4 (no caret) per T-13-01 carry-forward for supply chain stability"
  - "@types/leaflet placed in devDependencies (type-only, not needed at runtime)"
  - "computedInputs validates non-objects via reject; unknown keys pass through for forward-compat (future DSEAR/COSHH formulas)"
  - "maxInstances returns undefined (not 0) for unlimited — semantically distinct from 'allow zero'"
  - "PAS 79 banding: score ≤4 green, 5–12 amber, 13–25 red; Substantial spans both amber (10–12) and red (13–16)"
metrics:
  duration: "~25 minutes"
  completed: "2026-05-25"
  tasks_completed: 3
  files_created: 15
  files_modified: 3
---

# Phase 14 Plan 01: Wave 0 Foundation Summary

Wave 0 foundation established: Leaflet stack installed, Leaflet marker PNG assets copied, stale ROADMAP bucket wording fixed, 7 shared attribute modules created with TDD, and the PAS 79 risk utility + storage-path helper modules created with TDD. All 55 new tests are green.

## Tasks Completed

| # | Task | Commit | Key Output |
|---|------|--------|------------|
| 1 | Install Leaflet stack, copy marker assets, fix ROADMAP D-15 | 65bcb21 | leaflet@1.9.4 pinned, public/leaflet/ assets, ROADMAP wording |
| 2 (RED) | Add 7 failing attribute tests | e01b535 | tests/form-builder/attributes.test.ts (25 assertions, RED) |
| 2 (GREEN) | Implement 7 shared attributes | 3305848 | 7 attribute files, all 25 tests GREEN |
| 3 (RED) | Add failing PAS 79 + upload-paths tests | 77f3137 | pas79.test.ts + upload-paths.test.ts (30 assertions, RED) |
| 3 (GREEN) | Implement PAS 79 utility + upload-path helpers | bece69e | pas79.ts + upload-paths.ts, all 30 tests GREEN |

## Verification Results

- `npx vitest run tests/form-builder/attributes.test.ts tests/form-builder/pas79.test.ts tests/form-builder/upload-paths.test.ts` — 55 tests, all GREEN
- `node -e "require('leaflet/package.json').version"` → `1.9.4`
- `package.json` → `"leaflet": "1.9.4"` (no caret), react-leaflet and @types/leaflet present
- `public/leaflet/{marker-icon.png,marker-icon-2x.png,marker-shadow.png}` — all exist
- ROADMAP grep for `form-signatures|form-photos` in non-comment lines → 0 hits

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

### Pre-existing Failures (out of scope)

`tests/form-builder/version-pin.test.ts` has 2 pre-existing failing tests (`__NEXT_ERROR_CODE: E468`). These failures existed before this plan and are not caused by Plan 14-01 changes. Logged to deferred-items.

## Known Stubs

None. All 7 attribute files are fully functional (no placeholder logic). PAS 79 utility is fully functional with the practitioner-convention band boundaries.

## Threat Flags

None. No new network endpoints, auth paths, file access patterns, or schema changes introduced. Threat T-14-01-01 through T-14-01-06 are mitigated as documented in the plan's threat model:
- T-14-01-01: leaflet pinned to exact 1.9.4; package-lock.json committed
- T-14-01-02: computedInputs rejects non-objects; unknown keys pass through (forward-compat)
- T-14-01-03: All numeric attributes throw on non-integer or out-of-range values
- T-14-01-04: buildPhotoStoragePath hard-coded whitelist rejects non-image extensions
- T-14-01-05: PAS 79 band boundaries accepted risk (practitioner convention, not BSI proprietary)
- T-14-01-06: Leaflet bundle size accepted risk (dynamic import with ssr:false in Plan 14-06)

## TDD Gate Compliance

Both TDD pairs (Task 2 and Task 3) followed the RED/GREEN sequence:

**Task 2 pair:**
- RED: `e01b535` — `test(14-01): add failing tests for 7 new shared attributes`
- GREEN: `3305848` — `feat(14-01): implement 7 shared attributes for specialty fields`

**Task 3 pair:**
- RED: `77f3137` — `test(14-01): add failing tests for PAS 79 utility and upload-path helpers`
- GREEN: `bece69e` — `feat(14-01): PAS 79 risk utility and upload-path helpers`

## Downstream Consumers

Plans that depend on these outputs:

| Plan | Dependency | Import Pattern |
|------|-----------|----------------|
| 14-02 (entity definitions) | attachPhotosAttribute + minInstances/maxInstances/maxRating/maxPhotos | `import { attachPhotosAttribute } from "../attributes/attach-photos"` |
| 14-02 | formulaAttribute + computedInputsAttribute | `import { formulaAttribute } from "../attributes/formula"` |
| 14-03 (uploadMediaAction) | buildSignatureStoragePath, buildPhotoStoragePath | `import { buildSignatureStoragePath, buildPhotoStoragePath } from "@/lib/form-builder/storage/upload-paths"` |
| 14-05/06 (ComputedFieldRenderer) | computePAS79RiskLevel | `import { computePAS79RiskLevel } from "@/lib/form-builder/risk/pas79"` |
| 14-06 (GeoMap) | Leaflet + public/leaflet/ assets | Dynamic import with ssr:false; assets served from /leaflet/ |

## Self-Check: PASSED

Files verified to exist:
- lib/form-builder/attributes/attach-photos.ts — FOUND
- lib/form-builder/attributes/formula.ts — FOUND
- lib/form-builder/attributes/computed-inputs.ts — FOUND
- lib/form-builder/attributes/min-instances.ts — FOUND
- lib/form-builder/attributes/max-instances.ts — FOUND
- lib/form-builder/attributes/max-rating.ts — FOUND
- lib/form-builder/attributes/max-photos.ts — FOUND
- lib/form-builder/risk/pas79.ts — FOUND
- lib/form-builder/storage/upload-paths.ts — FOUND
- public/leaflet/marker-icon.png — FOUND
- public/leaflet/marker-icon-2x.png — FOUND
- public/leaflet/marker-shadow.png — FOUND
- tests/form-builder/attributes.test.ts — FOUND
- tests/form-builder/pas79.test.ts — FOUND
- tests/form-builder/upload-paths.test.ts — FOUND

Commits verified:
- 65bcb21 (Task 1: install + assets + ROADMAP) — FOUND
- e01b535 (Task 2 RED) — FOUND
- 3305848 (Task 2 GREEN) — FOUND
- 77f3137 (Task 3 RED) — FOUND
- bece69e (Task 3 GREEN) — FOUND
