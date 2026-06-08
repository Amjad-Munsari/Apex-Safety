---
phase: 14
plan: 06
subsystem: form-interpreter
tags: [phase-14, interpreter-wiring, attach-photos, stt, mic-button, wave-3]
dependency_graph:
  requires: [14-01, 14-02, 14-03, 14-04, 14-05]
  provides:
    - AttachPhotosAffordance (components/form-interpreter/attach-photos-affordance.tsx)
    - InterpreterRenderer extended components map (13 entries, 6 new specialty types)
    - MicButton wired into TextFieldRenderer + TextareaFieldRenderer
    - clientId prop chain: page.tsx → AssessmentClient → InterpreterRenderer → renderers
  affects:
    - Plan 14-08 (UAT smoke test will exercise the full wired interpreter)
    - All Phase 14 specialty renderers now active in the fill flow
tech_stack:
  added: []
  patterns:
    - propsRef pattern (useRef + useEffect) for threading changing props through memoised component map without widening useMemo deps (RESEARCH Pitfall 6 / Phase 13 13-04 UAT focus-loss fix)
    - EntityComponentProps<typeof entity> parameter types in useMemo wrappers (not Parameters<typeof Renderer>[0]) to satisfy coltorapps EntitiesComponents contract
    - renderToStaticMarkup smoke tests to avoid @testing-library/react dependency
    - Session-local attachment strip with previewUrl retention and unmount revoke
key_files:
  created:
    - components/form-interpreter/attach-photos-affordance.tsx
    - tests/form-interpreter/renderers.test.tsx
  modified:
    - components/form-interpreter/interpreter-renderer.tsx
    - components/form-interpreter/text-field-renderer.tsx
    - components/form-interpreter/textarea-field-renderer.tsx
    - components/forms/mic-button.tsx
    - components/form-interpreter/signature-field-renderer.tsx
    - components/form-interpreter/multi-photo-field-renderer.tsx
    - components/form-interpreter/rating-field-renderer.tsx
    - components/form-interpreter/geolocation-field-renderer.tsx
    - app/admin/assessments/[id]/page.tsx
    - app/admin/assessments/[id]/assessment-client.tsx
    - vitest.config.ts
decisions:
  - "propsRef pattern selected over widening useMemo deps — deps stay [surface]; clientId/submissionId/schema/interpreterStore read from ref at wrapper call time to avoid focus-loss regression (Phase 13 13-04 UAT hard constraint)."
  - "EntityComponentProps<typeof entity> used as parameter type in useMemo wrappers instead of Parameters<typeof Renderer>[0] — coltorapps EntitiesComponents type expects the coltorapps-only props; extra props (clientId, submissionId, interpreterStore, schema) are supplied by the wrapper, not passed through the coltorapps interface."
  - "AttachPhotosAffordance uses session-local state — storage paths NOT mirrored to entity.value; field_media row is the authoritative record; thumbnail strip resets on page reload. Phase 16+ will add a fetcher."
  - "Rating and Geolocation renderers extended with optional clientId/submissionId — guarded with clientId && submissionId before rendering affordance (they had no upload props in Plan 14-04/14-05)."
  - "renderToStaticMarkup smoke tests chosen over @testing-library/react — avoids new dependency for 3 smoke tests; adequate for verifying Lucide SVG class presence in rendered output."
metrics:
  duration: "35 minutes"
  completed: "2026-05-26"
  tasks_completed: 3
  files_created: 2
  files_modified: 11
---

# Phase 14 Plan 06: Interpreter Wiring (AttachPhotosAffordance + MicButton + Components Map) Summary

Activated all 6 Phase 14 specialty renderers in the interpreter fill flow by building AttachPhotosAffordance, wiring MicButton inline into text/textarea renderers, and extending the InterpreterRenderer components useMemo map with all 6 new entries using the propsRef pattern to preserve the Phase 13 focus-loss fix.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | AttachPhotosAffordance + uncomment TODO(14-06) in Wave 2 renderers | 72ae4a3 | attach-photos-affordance.tsx (new); signature, multi-photo, rating, geolocation renderers |
| 2 (RED) | STT wiring smoke tests | e51e10f | tests/form-interpreter/renderers.test.tsx; vitest.config.ts |
| 2 (GREEN) | Wire MicButton + add aria-label | 263a994 | text-field-renderer.tsx; textarea-field-renderer.tsx; mic-button.tsx |
| 3 | Extend InterpreterRenderer + thread clientId chain | 5c9ec2a | interpreter-renderer.tsx; assessment-client.tsx; page.tsx |

## What Was Built

### AttachPhotosAffordance (components/form-interpreter/attach-photos-affordance.tsx — 219 lines)

Per-field photo-attach widget rendered beneath any non-section renderer when `attrs.attachPhotos === true`:

- Affordance bar: `📎 Attach photos` + uploaded count badge + `+ Add Photo` button
- Upload flow: File → useMediaProcessor (HEIC→JPEG + EXIF + compress) → FileReader → uploadMediaAction(kind='photo') → session-local strip
- Thumbnail strip: horizontal scroll; 40×40 thumbnails; Loader2 on uploading; AlertCircle on error; remove button with aria-label per item
- Session-local trade-off: storage paths NOT mirrored to entity.value; field_media row is authoritative; strip resets on reload (Phase 16 will add a fetcher)
- Accessibility: `aria-label="Attach photo to {fieldLabel}"` on file input; `aria-label="Remove attached photo {N}"` on each remove button
- Unmount cleanup: all previewUrls revoked; remove does NOT delete storage or field_media row (orphan cleanup deferred to Phase 16)

### Wave 2 Renderer Updates (Task 1)

All 4 Wave 2 renderers no longer contain `TODO(14-06)` markers:

- **SignatureFieldRenderer**: import activated + `{attrs.attachPhotos && <AttachPhotosAffordance ... />}` (already had clientId/submissionId)
- **MultiPhotoFieldRenderer**: same; documented that attachPhotos here is for extra-context photos beyond the main grid (FORM-05)
- **RatingFieldRenderer**: extended Props with optional `clientId?: string; submissionId?: string`; guarded with `clientId && submissionId`
- **GeolocationFieldRenderer**: same optional extension + guard

### MicButton Wiring (Task 2)

- **TextFieldRenderer**: `<Input>` wrapped in `<div className="relative">`; `pr-12` added to Input; MicButton mounted with `onTranscript` append
- **TextareaFieldRenderer**: `<Textarea>` wrapped in `<div className="relative">`; `pr-12 pb-8` added to Textarea; MicButton with `className="absolute right-2 bottom-2 top-auto translate-y-0"` for bottom-right positioning (UI-SPEC §STT Mic Button)
- **mic-button.tsx**: `aria-label` attribute added to Button element mirroring existing `title` value (UI-SPEC §Accessibility)
- onTranscript semantics: appends transcript to current value with space separator (or no space if field was empty)

### Smoke Tests (Task 2 — tests/form-interpreter/renderers.test.tsx — 3 tests GREEN)

Uses `renderToStaticMarkup` to avoid adding @testing-library/react as a new dependency:
1. TextFieldRenderer renders `lucide-mic` SVG when STT supported
2. TextFieldRenderer renders `lucide-mic-off` SVG when STT unsupported (FORM-04)
3. TextareaFieldRenderer contains `bottom-2` class (bottom-right MicButton positioning)

### InterpreterRenderer Extension (Task 3)

- **clientId prop**: added as required (sourced from RSC's submission.client_id — T-14-06-01)
- **propsRef pattern**: `useRef({ clientId, submissionId, schema, interpreterStore })` + `useEffect` to keep ref current; wrappers read `propsRef.current` at call time so useMemo deps stay `[surface]` (focus-loss invariant preserved)
- **13-entry components map** (7 Phase 13 + 6 Phase 14):
  - signatureField: clientId + submissionId from propsRef
  - ratingField: clientId + submissionId from propsRef (optional on renderer, always supplied)
  - multiPhotoField: clientId + submissionId from propsRef
  - geolocationField: clientId + submissionId from propsRef
  - computedField: interpreterStore from propsRef (RESEARCH Pitfall 5)
  - repeatingSection: schema from propsRef (Plan 14-05 contract)
- JSDoc block added above useMemo explaining the propsRef pattern + citing RESEARCH Pitfall 6 + Phase 13 13-04 UAT

### clientId Prop Chain

`assessment/[id]/page.tsx` (RSC) → `submission.client_id ?? ""` → `<AssessmentClient clientId={...} />` → `<InterpreterRenderer clientId={...} />` → per-entity wrappers via propsRef

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] EntityComponentProps parameter type instead of Parameters<typeof Renderer>[0]**
- **Found during:** Task 3 TypeScript compilation check
- **Issue:** Using `Parameters<typeof SignatureFieldRenderer>[0]` as the parameter type in the useMemo wrapper caused a TS2322 error: coltorapps `EntitiesComponents<Builder<...>>` expects `EntityComponent<Entity<...>>` whose parameter is `EntityComponentProps<typeof entity>` — the plain coltorapps props without the extra `clientId/submissionId` fields that the wrapper *supplies*. The Parameters form includes those extra props as required, making the wrapper incompatible with the coltorapps slot type.
- **Fix:** Changed all 6 specialty wrapper parameters from `Parameters<typeof Renderer>[0]` to `EntityComponentProps<typeof entity>` (imported the entity types). The wrapper then spreads `p` and adds the extra props explicitly. TypeScript-correct and matches the coltorapps generic contract.
- **Files modified:** `components/form-interpreter/interpreter-renderer.tsx`
- **Commit:** 5c9ec2a

## Known Stubs

None. The AttachPhotosAffordance has a documented session-local trade-off (reload shows 0 attached) but the upload flow is fully functional and the field_media row is the authoritative record. This is a deliberate Phase 14 MVP scope decision, not a stub.

## Threat Flags

No new threat surface beyond what the plan's `<threat_model>` covers:
- T-14-06-01: clientId sourced server-side from RSC — mitigated
- T-14-06-02: propsRef pattern preserves [surface] deps — mitigated
- T-14-06-04: blob: scheme thumbnails safe; no data URL rendered as img src — mitigated

## Self-Check: PASSED

Files exist:
- components/form-interpreter/attach-photos-affordance.tsx: FOUND
- components/form-interpreter/interpreter-renderer.tsx: FOUND
- components/form-interpreter/text-field-renderer.tsx: FOUND
- components/form-interpreter/textarea-field-renderer.tsx: FOUND
- components/forms/mic-button.tsx: FOUND
- tests/form-interpreter/renderers.test.tsx: FOUND
- app/admin/assessments/[id]/page.tsx: FOUND
- app/admin/assessments/[id]/assessment-client.tsx: FOUND

Commits exist:
- 72ae4a3 (Task 1: AttachPhotosAffordance + Wave 2 renderers): FOUND
- e51e10f (Task 2 RED: smoke tests): FOUND
- 263a994 (Task 2 GREEN: MicButton wiring + aria-label): FOUND
- 5c9ec2a (Task 3: interpreter-renderer extension + clientId chain): FOUND

TypeScript errors in modified files: 0
Vitest suite: 247 passed, 3 todo (250 total) — GREEN
