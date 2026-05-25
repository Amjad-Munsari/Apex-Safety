---
phase: 14
plan: "05"
subsystem: form-interpreter
tags: [phase-14, renderers, leaflet, pas79, repeating-section, computed, geolocation]
dependency_graph:
  requires:
    - lib/form-builder/entities/geolocation-field.ts (14-02)
    - lib/form-builder/entities/computed-field.ts (14-02)
    - lib/form-builder/entities/repeating-section.ts (14-02)
    - lib/form-builder/risk/pas79.ts (14-01)
    - public/leaflet/*.png (14-01)
  provides:
    - components/form-interpreter/geolocation-map.tsx
    - components/form-interpreter/geolocation-field-renderer.tsx
    - components/form-interpreter/computed-field-renderer.tsx
    - components/form-interpreter/repeating-section-renderer.tsx
  affects:
    - components/form-interpreter/interpreter-renderer.tsx (14-06 wires these into components map)
tech_stack:
  added:
    - "leaflet@1.9.4 (Leaflet map library)"
    - "react-leaflet@^5.0.0 (React 19 compatible Leaflet wrapper)"
    - "@types/leaflet@^1.9.21 (TypeScript types)"
  patterns:
    - "next/dynamic with ssr:false for Leaflet SSR bypass (RESEARCH Pitfall 1+2)"
    - "useInterpreterEntitiesValues selective subscription (RESEARCH Pitfall 5)"
    - "setValue({instances:[...]}) full-array contract (RESEARCH Pitfall 3)"
    - "navigator.geolocation.getCurrentPosition auto-capture + error-code-only logging (T-14-05-01)"
    - "EntityComponentProps<typeof entity> + surface prop pattern (Phase 13 carry-forward)"
key_files:
  created:
    - components/form-interpreter/geolocation-map.tsx
    - components/form-interpreter/geolocation-field-renderer.tsx
    - components/form-interpreter/computed-field-renderer.tsx
    - components/form-interpreter/repeating-section-renderer.tsx
  modified: []
decisions:
  - "leaflet/react-leaflet installed in worktree (Wave 0 prereq was in package.json but npm install had not been run in the worktree)"
  - "computedFieldEntity has no helpTextAttribute — removed helpText rendering from ComputedFieldRenderer (entity definition is the source of truth)"
  - "ChildInput component implemented inline in repeating-section-renderer.tsx (no separate file) for co-location with the instance state machine"
  - "AccuracyBadge uses inline SVG AlertTriangle instead of lucide-react import to avoid adding a dependency before Plan 14-06's component map wiring"
metrics:
  duration: "~45 minutes"
  completed: "2026-05-25"
  tasks_completed: 3
  files_created: 4
  files_modified: 2
---

# Phase 14 Plan 05: Specialty Renderers (Geolocation, Computed, RepeatingSection) Summary

Four new client components ship three derived/container-flavoured renderers — Leaflet map sub-component with click-to-pin, read-only PAS 79 computed badge with reactive recompute, and repeating-section instance state machine with per-instance child rendering.

## What Was Built

### Task 1: GeoMap + GeolocationFieldRenderer

**geolocation-map.tsx** (default export `GeoMap`):
- `"use client"` with `leaflet/dist/leaflet.css` as the first import (RESEARCH Pitfall 2)
- Marker icon path fix: `delete _getIconUrl` + `L.Icon.Default.mergeOptions` pointing at `/leaflet/*.png` assets (RESEARCH Pitfall 1)
- OSM tile URL `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png` with mandatory attribution
- `ClickHandler` inner component using `useMapEvents` — fires `onClickPin(lat, lng)` on map click
- `role="application"` wrapper for accessibility (UI-SPEC §Accessibility Contract)
- Must be consumed via `dynamic(() => import("./geolocation-map"), { ssr: false })`

**geolocation-field-renderer.tsx** (`GeolocationFieldRenderer`):
- Auto-capture on mount (D-11): `navigator.geolocation.getCurrentPosition` fires once in background if no stored value
- Error states: permission-denied / unavailable / timeout — exact UI-SPEC copy strings
- Error logging uses only `err.code` (integer enum), never coords (T-14-05-01 security)
- Desktop accuracy badge (D-12): `role="alert"` shown when `accuracy > 100m` OR non-mobile UA; `bg-amber-100 text-amber-900 border border-amber-300` per UI-SPEC
- Dynamic GeoMap with `ssr: false` (RESEARCH Pitfall 1+2)
- Click-to-pin (D-13): `onClickPin` callback updates `{...value, lat, lng, capturedAt}` in store
- "Click the map to move the pin" instruction below map preview
- Documented TODO for AttachPhotosAffordance (Plan 14-06)

### Task 2: ComputedFieldRenderer

- Read-only, no `setValue`, no user input (D-10)
- `interpreterStore: InterpreterStore<typeof formBuilder>` mandatory prop — documented with JSDoc explaining RESEARCH Pitfall 5
- `useInterpreterEntitiesValues(interpreterStore, [likelihoodId, consequenceId])` — selective re-render on dependency changes only
- Hook called unconditionally (React hooks rules) with empty array when inputs not configured
- Three states: configuration-error pill / pending pill / computed badge
- `computePAS79RiskLevel()` wired; null result → pending state (RESEARCH Pitfall 4 guard)
- `role="status" aria-live="polite"` on both computed badge and pending pill (UI-SPEC Accessibility)
- No animation on update — colour change is the signal (UI-SPEC §Reactivity)
- Removed `helpText` rendering (deviation auto-fix: computedFieldEntity has no helpTextAttribute)

### Task 3: RepeatingSectionRenderer

- `"use client"` component with `schema: FormBuilderSchema` prop (Plan 14-06 plumbs it)
- Instance state initialised from `entity.value?.instances ?? []`
- **Pitfall 3 contract** enforced in all three mutators (`addInstance`, `removeInstance`, `updateInstance`): every call passes the full `{ instances: newInstances }` to `setValue`
- Collapse tracking via `Set<number>` state; collapsed indices shift correctly on remove
- `showMinError` state: surfaces minimum violation after user has started adding instances
- Section heading: Newsreader 18px title + teal mono instance count badge (UI-SPEC)
- Instance cards: `role="group" aria-label="Instance N"` + header (`#N` + collapse + remove buttons)
- Inline `ChildInput` component handles: textField, numberField, dateField, selectField (single), textareaField, checkboxField
- Multi-select inside instances surfaced as destructive message (out of scope, Phase 14)
- Specialty types inside instances: `"Specialty fields are not supported inside repeating sections in Phase 14."` (CONTEXT §deferred)
- Add button: disabled at maxInstances with `opacity-50` + "Maximum N instances reached" text
- Accessibility: `role="group" aria-label` on container + instance cards, `aria-label` + `aria-expanded` on collapse buttons, `aria-label` on remove and Add buttons

## Deviations from Plan

### Auto-fixed: computedFieldEntity has no helpTextAttribute

**Found during:** Task 2 TypeScript compilation
**Issue:** The plan specified rendering `attrs.helpText` in ComputedFieldRenderer, but `computedFieldEntity` only has `labelAttribute`, `formulaAttribute`, `computedInputsAttribute`, `attachPhotosAttribute` — no `helpTextAttribute`. TypeScript error TS2339 on `attrs.helpText`.
**Fix:** Removed helpText rendering from ComputedFieldRenderer. The entity definition is the source of truth; the plan's reference was incorrect.
**Files modified:** `components/form-interpreter/computed-field-renderer.tsx`
**Commit:** `8dc2025`

### Auto-fix: leaflet packages not installed in worktree

**Found during:** Task 1 TypeScript compilation
**Issue:** `leaflet@1.9.4`, `react-leaflet`, `@types/leaflet` were in the main package.json but `npm install` had not been run in the worktree. TypeScript error TS2307 "Cannot find module 'leaflet'".
**Fix:** Ran `npm install leaflet@1.9.4 react-leaflet @types/leaflet` in the worktree. Added `package.json` and `package-lock.json` to Task 1 commit.
**Commit:** `d6b3c63`

## Known Stubs

The following TODOs are intentional cross-plan deferred items, not functional gaps:

| File | Line | Stub | Resolving Plan |
|------|------|------|----------------|
| `geolocation-field-renderer.tsx` | L307 | `AttachPhotosAffordance` not yet wired | Plan 14-06 |
| `computed-field-renderer.tsx` | L160 | `AttachPhotosAffordance` not yet wired | Plan 14-06 |
| `repeating-section-renderer.tsx` | L44 | `schema` prop not yet plumbed from components map | Plan 14-06 |

These stubs do NOT prevent the renderers from functioning at unit-test / smoke-test level. Plan 14-06 wires them into `interpreter-renderer.tsx`.

## Threat Surface Scan

All plan threat register items addressed in the implementation:

| Threat ID | Status | Implementation note |
|-----------|--------|---------------------|
| T-14-05-01 | Mitigated | `err.code` only logged; coords never in state, never in error message |
| T-14-05-02 | Accepted | OSM tile URL encodes location — accepted per RESEARCH §Security Domain |
| T-14-05-03 | Mitigated | `computePAS79RiskLevel` returns null for non-numeric; renderer shows pending pill |
| T-14-05-04 | Mitigated | Child extra keys ignored at AI prompt time (Plan 14-03); only schema.entities[id].children iterated |
| T-14-05-05 | Mitigated | maxInstances enforced in renderer; Add button disabled at cap |
| T-14-05-06 | Accepted | Specialty-inside-repeating shown as inline destructive message; builder discourages in Plan 14-07 |
| T-14-05-07 | Accepted | UA detection is a heuristic; accuracy threshold (>100m) is the primary signal |

No new threat surface beyond the plan's threat_model.

## Commits

| Hash | Message |
|------|---------|
| `d6b3c63` | feat(14-05): GeoMap sub-component + GeolocationFieldRenderer |
| `8dc2025` | feat(14-05): ComputedFieldRenderer — PAS 79 badge with reactive recompute |
| `e275062` | feat(14-05): RepeatingSectionRenderer — instance state machine + child rendering |

## Self-Check

- [x] `components/form-interpreter/geolocation-map.tsx` exists (d6b3c63)
- [x] `components/form-interpreter/geolocation-field-renderer.tsx` exists (d6b3c63)
- [x] `components/form-interpreter/computed-field-renderer.tsx` exists (8dc2025)
- [x] `components/form-interpreter/repeating-section-renderer.tsx` exists (e275062)
- [x] All four files typecheck with zero errors
- [x] `geolocation-map.tsx`: leaflet.css import + _getIconUrl fix + /leaflet/marker-icon.png + openstreetmap URL
- [x] `geolocation-field-renderer.tsx`: dynamic import ssr:false + getCurrentPosition + accuracy badge text + Desktop capture copy
- [x] `computed-field-renderer.tsx`: useInterpreterEntitiesValues + interpreterStore prop + role="status" aria-live="polite"
- [x] `repeating-section-renderer.tsx`: setValue({instances:...}) contract + maxInstances + minInstances + schema prop + role="group" + aria-label.*Instance + Specialty fields not supported message
- [x] No existing renderer files modified (interpreter-renderer.tsx, text-field-renderer.tsx, select-field-renderer.tsx, section-group-renderer.tsx unchanged)
- [x] No modifications outside files_modified list

## Self-Check: PASSED
