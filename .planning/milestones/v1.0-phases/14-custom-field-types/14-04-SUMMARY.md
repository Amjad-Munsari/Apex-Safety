---
phase: 14
plan: 04
subsystem: form-interpreter
tags: [phase-14, renderers, upload-pipeline, signature, rating, multi-photo, wave-2]
dependency_graph:
  requires: [14-01, 14-02, 14-03]
  provides:
    - SignatureFieldRenderer (components/form-interpreter/signature-field-renderer.tsx)
    - RatingFieldRenderer (components/form-interpreter/rating-field-renderer.tsx)
    - MultiPhotoFieldRenderer (components/form-interpreter/multi-photo-field-renderer.tsx)
  affects:
    - Plan 14-06 (interpreter wiring — imports and mounts these renderers in the components map)
tech_stack:
  added: []
  patterns:
    - EntityComponentProps shell from @coltorapps/builder-react
    - surface="dark"|"cream" token pattern from Phase 13 select-field-renderer
    - uploadMediaAction server action (Plan 14-03) called with kind='signature'/'photo'
    - useMediaProcessor hook for HEIC→JPEG + EXIF + compression (FORM-06)
    - Object-URL lifecycle management with useEffect cleanup (T-14-04-01)
key_files:
  created:
    - components/form-interpreter/signature-field-renderer.tsx
    - components/form-interpreter/rating-field-renderer.tsx
    - components/form-interpreter/multi-photo-field-renderer.tsx
  modified: []
decisions:
  - "Signature renderer keeps local base64 preview in state during session; defers signed-URL fetch to Phase 16 (T-14-04-05). Tradeoff: preview lost on page reload, acceptable for single-session admin fill flow."
  - "Rating renderer implemented inline rather than wrapping components/forms/rating-field.tsx — existing component's surface tokens diverge from Phase 14 EntityComponentProps pattern; ~40 lines inline is cleaner."
  - "Multi-photo renderer implemented inline rather than wrapping components/forms/multi-photo-field.tsx — existing component stores object-URL previews in value[] which conflicts with the D-17 storage-path contract."
  - "setValue functional-updater form not supported by coltorapps (accepts direct value only). Multi-file upload loop uses a local committedPaths accumulator to avoid stale closure and calls setValue(committedPaths) after each success."
  - "AttachPhotosAffordance left as commented TODO(14-06) in all three renderers to avoid cross-plan TS resolution failure."
metrics:
  duration: "7 minutes"
  completed: "2026-05-25"
  tasks_completed: 3
  files_created: 3
  files_modified: 0
---

# Phase 14 Plan 04: Upload-Flow Renderers (Signature, Rating, Multi-Photo) Summary

Three "use client" renderer components wrapping canvas/star/photo UI inside the coltorapps EntityComponentProps shell, calling Plan 14-03's uploadMediaAction for media persistence with full upload lifecycle management.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | SignatureFieldRenderer | 1a6e34e | components/form-interpreter/signature-field-renderer.tsx |
| 2 | RatingFieldRenderer | afbc986 | components/form-interpreter/rating-field-renderer.tsx |
| 3 | MultiPhotoFieldRenderer | b09484e | components/form-interpreter/multi-photo-field-renderer.tsx |

## What Was Built

### SignatureFieldRenderer (207 lines)

Wraps the existing `<SignatureField>` canvas component. Upload lifecycle:

1. User draws on canvas and taps Done → `onChange(dataUrl)` fires
2. Renderer calls `uploadMediaAction(submissionId, entity.id, dataUrl, "image", clientId, "signature")`
3. On success: `setValue(storagePath)` + stores base64 in `localPreview` state for instant display
4. On failure: `toast.error("Failed to save signature. Try again.")`
5. While uploading: Loader2 spinner overlay with "Saving signature…" + pointer-events-none on canvas area

Reload scenario: when only `storedPath` exists in entity.value (no localPreview), shows a "Signature captured" pill with storage path + Redraw button. Defers signed-URL fetch to Phase 16 (D-T-14-04-05).

### RatingFieldRenderer (147 lines)

Inline star-row implementation (not wrapping `components/forms/rating-field.tsx`):

- `maxRating` stars from `attrs.maxRating` (default 5)
- Each star button wrapped in `min-w-[44px] min-h-[44px]` div for WCAG 2.5.5
- Filled amber / idle muted; click same star → `setValue(0)`; click other → `setValue(n)`
- Score display `"{current} / {maxRating}"` in `font-mono tabular-nums` right of stars
- `role="group"` + `aria-label` on container for screen reader accessibility
- No clientId/submissionId props (no upload)

### MultiPhotoFieldRenderer (406 lines)

Inline photo-grid implementation with full upload pipeline:

- Grid: `grid-cols-2 sm:grid-cols-3 gap-3`; cells: `aspect-square rounded-sm object-cover`
- Per-file flow: `useMediaProcessor` (HEIC→JPEG + EXIF + compress to 1.5MB) → `FileReader.readAsDataURL` → `uploadMediaAction(kind='photo')` → storagePath appended to `entity.value[]`
- Pending items tracked with object-URL previews; revoked on success and on unmount (T-14-04-01)
- Error state per cell: AlertCircle overlay + Dismiss button + sonner toast
- maxPhotos cap: add cell hidden at capacity; excess files per-selection dropped with toast (T-14-04-02)
- Remove: `setValue(photos.filter(...))` — orphan cleanup deferred to Phase 16
- Accessibility: `aria-label="Remove photo N"` on remove buttons, `aria-label="Add photo to {label}"` on file input

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] coltorapps setValue does not accept function updater**

- **Found during:** Task 3 TypeScript compilation check
- **Issue:** The plan's behavior section described using a functional-updater form `setValue((prev) => [...prev, storagePath])` to avoid stale closures during the multi-file upload loop. However, coltorapps `EntityComponentProps.setValue` is typed as `(value?: Awaited<ReturnType<TEntity['validate']>>) => void` — it only accepts a direct value, not a function.
- **Fix:** Introduced a local `committedPaths: string[]` accumulator initialized from `photos` at the start of each `handleFiles` call. Each successful upload pushes to the accumulator and calls `setValue(committedPaths)` directly. This avoids the stale closure issue while satisfying the coltorapps type contract.
- **Files modified:** `components/form-interpreter/multi-photo-field-renderer.tsx`
- **Commit:** b09484e

## Known Stubs

None. All three renderers are fully functional standalone modules. They are not yet wired into `interpreter-renderer.tsx` — that is Plan 14-06's responsibility.

## Threat Flags

No new security surface introduced beyond what Plan 14-03's threat model covers. The three renderers operate within the trust boundaries documented in the plan's `<threat_model>`:

- T-14-04-01 (object URL leak): mitigated via useEffect cleanup + per-success revoke in MultiPhotoFieldRenderer
- T-14-04-02 (DoS on max files): mitigated via room calculation + toast in MultiPhotoFieldRenderer
- T-14-04-04 (XSS via data URL): accepted — canvas PNG cannot carry scripts; documented in SignatureFieldRenderer JSDoc
- T-14-04-05 (info disclosure on reload): accepted — documented tradeoff in SignatureFieldRenderer JSDoc

## Self-Check: PASSED

Files exist:
- components/form-interpreter/signature-field-renderer.tsx: FOUND
- components/form-interpreter/rating-field-renderer.tsx: FOUND
- components/form-interpreter/multi-photo-field-renderer.tsx: FOUND

Commits exist:
- 1a6e34e (SignatureFieldRenderer): FOUND
- afbc986 (RatingFieldRenderer): FOUND
- b09484e (MultiPhotoFieldRenderer): FOUND

TypeScript errors in new files: 0
Pre-existing errors in interpreter-renderer.tsx and tests/: out of scope (Plan 14-06 resolves interpreter-renderer.tsx; test errors are pre-existing)
