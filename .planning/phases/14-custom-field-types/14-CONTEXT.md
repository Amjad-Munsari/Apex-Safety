# Phase 14: Custom Field Types - Context

**Gathered:** 2026-05-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Re-implement the 6 specialty field types (signature, rating, multi-photo, geolocation, repeating-section, computed) as coltorapps entities, plus restore STT and add a per-field `attachPhotos` capability. The React UIs already exist in `components/forms/*-field.tsx` (modified but unwired after 13-04's cutover) — Phase 14 builds the coltorapps entity/attribute layer, the interpreter renderers, and the builder palette/properties wiring.

**In scope:**
- 6 new coltorapps entities: `signatureField`, `ratingField`, `multiPhotoField`, `geolocationField`, `repeatingSection`, `computedField`
- Per-entity interpreter renderers (in `components/form-interpreter/`)
- Builder palette additions (8 buttons total: 7 existing + repeatingSection; specialty fields appear as separate palette section)
- Builder properties panels for each new entity's attributes
- `attachPhotos: boolean` attribute on every (non-section) entity, default OFF
- STT (Web Speech API, en-GB) restored on textField + textareaField renderers (universal, per FORM-02)
- Photo upload pipeline (HEIC support, EXIF auto-rotate, 1.2–1.5MB compression → `form-media` bucket)
- Computed field with hardcoded PAS 79 formula, extensible attribute design
- "Basic Types Smoke Test" template extended (or new specialty-test template seeded) for UAT

**Out of scope (deferred to other phases):**
- Conditional logic (`visibilityRules`) — Phase 15
- Multi-tenancy / fork-on-fill / template assignment — Phase 16
- Recurring assignments / scheduled reminders — Phase 17
- Full FRA seed template — Phase 18
- Other risk standards (DSEAR, COSHH) or custom expression engine — future phase

</domain>

<decisions>
## Implementation Decisions

### Repeating-section architecture
- **D-01:** New `repeatingSection` entity type, separate from `sectionGroup`. Palette grows to 8 buttons.
- **D-02:** `repeatingSection` declares "template children" — at fill time, the renderer produces N instances of the child set with independent value state.
- **D-03:** Each instance is independently removable and (optionally) collapsible at fill time. Min/max instance counts per the roadmap success criteria.
- **D-04:** schema_json contract: `repeatingSection.children` lists the template entities; submission value is `instances: Array<Record<entityId, value>>`. Validation iterates over `instances[]`. Version-pinning works unchanged because the template shape is part of the pinned schema.

### attachPhotos
- **D-05:** `attachPhotos: boolean` attribute on every non-section entity, default `false`. Admin opts in via builder properties panel.
- **D-06:** When `attrs.attachPhotos === true`, the fill-time renderer shows a small 📎 affordance below the field. Photos upload to `form-media` and are tracked in `field_media(submission_id, field_id, …)`. NOT a bottom-gallery pattern (per FORM-05).

### Computed field
- **D-07:** Hardcoded PAS 79 formula now (`computePAS79RiskLevel(likelihood, consequence)`), implemented in a pure utility module. No expression engine.
- **D-08:** Entity has `formula: "pas79"` attribute (string enum, currently single value) for forward-compatibility with future formulas (DSEAR, COSHH, custom). Zero implementation cost now, avoids a breaking schema migration later.
- **D-09:** Entity has `inputs: { likelihood: string, consequence: string }` attribute — admin maps which entity IDs feed in via the builder properties panel (dropdowns of other entity IDs in the same form).
- **D-10:** Renderer is read-only; output is auto-colour-coded per the PAS 79 standard amber/red/green palette. Recomputes whenever a dependency value changes.

### Geolocation desktop fallback
- **D-11:** Geolocation renderer calls `navigator.geolocation.getCurrentPosition()` on every device — never blocks the fill flow.
- **D-12:** After capture, show lat/lng + small map preview + a "captured from desktop browser — verify on map" badge when (a) the user agent doesn't match mobile, OR (b) `position.coords.accuracy > 100m`.
- **D-13:** "Click to set location manually" affordance lets the user pin on the map. Map library: investigate at planning (Leaflet vs Mapbox; preference for OSS + no API key).

### STT (carry-forward + restore)
- **D-14:** Existing `components/forms/mic-button.tsx` is wired into `textFieldRenderer` and `textareaFieldRenderer` universally (per FORM-02). Disabled-with-message fallback when Web Speech API unavailable (per FORM-04). en-GB locale per existing implementation (commit d2651a4).

### Storage contract (carry-forward)
- **D-15:** Single `form-media` bucket per migration 001 — NOT separate `form-signatures` / `form-photos` buckets as the ROADMAP narrative implies. The ROADMAP wording is stale; the existing migration is the source of truth. Plan-phase should flag this for a ROADMAP fix in the same PR.
- **D-16:** Signatures persist as PNG (canvas `.toDataURL("image/png")`) → upload to `form-media/{client_id}/signatures/{submission_id}/{field_id}.png`. RLS folder-prefix gate (already in migration 001) handles isolation.
- **D-17:** Photos upload to `form-media/{client_id}/photos/{submission_id}/{field_id}/{uuid}.{ext}`. Compression via `browser-image-compression` (or similar; investigate at planning). HEIC → JPEG on iOS Safari (FORM-06).

### Claude's Discretion
- Repeating-section architecture (D-01): user delegated. Chose new entity type over extending sectionGroup for semantic clarity, downstream AI report ergonomics, and cleaner validation/version-pinning.
- Computed field scope (D-07/D-08): user delegated. Chose hardcoded + extensible attribute over pure hardcoded or pluggable engine — cheapest forward-compatibility with no current implementation overhead.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 13 (foundation — carry-forward patterns)
- `.planning/phases/13-form-builder-foundation/13-CONTEXT.md` — coltorapps integration decisions
- `.planning/phases/13-form-builder-foundation/13-RESEARCH.md` — coltorapps API surface, pitfalls, validated patterns
- `.planning/phases/13-form-builder-foundation/13-01-SUMMARY.md` — entity/attribute pattern (validate() coercion, sectionGroup.childrenAllowed)
- `.planning/phases/13-form-builder-foundation/13-02-SUMMARY.md` — builder UI pattern (palette/canvas/properties, dnd-kit drag IDs)
- `.planning/phases/13-form-builder-foundation/13-03-SUMMARY.md` — interpreter pattern (renderers, server action, version pinning)
- `.planning/phases/13-form-builder-foundation/13-PATTERNS.md` — file/pattern map

### Project-level constraints
- `.planning/REQUIREMENTS.md` §FOUND-04..08 — schema (incl. `field_media` table), buckets, RLS
- `.planning/REQUIREMENTS.md` §FORM-01..06 — locked behaviour (STT, photo attachment, compression, fallback messages)
- `.planning/PROJECT.md` "Architecture split (ADR 2026-04-15)" — code vs n8n responsibilities
- `.planning/PROJECT.md` "Form architecture — unified template" — schema versioning, FRA-as-seed-template

### Code/migrations
- `supabase/migrations/001_initial_schema.sql` — `field_media` table + `form-media` bucket + RLS policies (CANONICAL — overrides the ROADMAP's stale "form-signatures / form-photos" wording)
- `components/forms/signature-field.tsx`, `rating-field.tsx`, `multi-photo-field.tsx`, `geolocation-field.tsx`, `media-field.tsx`, `mic-button.tsx` — existing React UIs to adapt
- `lib/form-builder/index.ts` + `lib/form-builder/entities/*.ts` — coltorapps factory pattern to follow
- `lib/form-builder/progress.ts` — completion-% helper (extend to count repeatingSection instances correctly)
- `components/form-interpreter/*-renderer.tsx` — renderer pattern (forwardRef, useMemo on components, surface tokens)

### External (research at planning time)
- PAS 79 risk matrix spec (admin-supplied — planner-research item)
- `browser-image-compression` (or equivalent) for HEIC + EXIF + size target
- Web Speech API browser support matrix (already validated in mic-button.tsx)
- Map library shortlist (Leaflet, Mapbox GL JS, MapLibre) for geolocation field

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `components/forms/signature-field.tsx` — canvas + clear + save; adapts to coltorapps EntityComponentProps shape
- `components/forms/rating-field.tsx` — star/numeric rating; same adaptation
- `components/forms/multi-photo-field.tsx` — multi-upload + thumbnail strip
- `components/forms/geolocation-field.tsx` — Geolocation API call + display
- `components/forms/media-field.tsx` — generic photo input (likely the base for the `attachPhotos` UI)
- `components/forms/mic-button.tsx` — STT component; ready to inline into text renderers
- `lib/supabase/admin.ts` — `adminClient` for server-side storage uploads (signed URL pattern from proposals bucket)
- `field_media` table + RLS policies in migration 001

### Established Patterns
- **coltorapps entity factory** (`createEntity` + `createAttribute` + `createBuilder`) — established in `lib/form-builder/`. New entities follow the same shape.
- **Interpreter renderer pattern**: `EntityComponentProps` consumer with `{ entity, setValue, validateValue, resetError, resetValue, clearValue }` destructure + surface prop (dark/cream).
- **Validate() coercion**: every attribute's `validate()` defaults unset values with `?? false` / `?? ""` etc. (RESEARCH Pitfall 4).
- **Server action version-pinning**: two-step fetch (submission → template_version by FK); never join.
- **Surface tokens**: `dark` (admin) vs `cream` (client) — pass through every new renderer.
- **Storage folder prefix RLS**: `(storage.foldername(name))[1]` matched against caller's `client_id` — established for `form-media` per migration 001.

### Integration Points
- New entities register in `lib/form-builder/index.ts` (the `formBuilder` instance).
- New renderers register in `components/form-interpreter/interpreter-renderer.tsx`'s memoized `components` map (mind the focus-loss fix from 13-UAT — keep `useMemo` deps minimal).
- Builder palette button list in `components/form-builder/field-palette.tsx` (FIELDS array).
- Properties panel attribute editors in `components/form-builder/properties-panel.tsx` (new attribute types may need new editor components — file upload, dropdown of entity IDs for computed inputs).
- AI report pipeline (`app/admin/assessments/actions.ts` → `runReportDraftGeneration`) must learn to traverse `repeatingSection.instances[]` when generating the draft. Update the prompt template to iterate over instances.
- Migration 011+ will add the specialty seed/extension to the "Basic Types Smoke Test" template (or seed a new specialty-test template). Decide at planning.

</code_context>

<specifics>
## Specific Ideas

- **Repeating section as the FRA-doors use case** — the canonical test scenario for `repeatingSection` is "List all fire doors". Each door instance: location, condition (good/marginal/poor), gap mm, attachPhoto. Plan an integration test that builds this template, fills 3 door instances, and verifies the AI report draft includes 3 hazards (one per door if conditions warrant).
- **PAS 79 colour coding** — standard amber/red/green from the published matrix. Renderer should match what Matt currently writes by hand in finalized reports.
- **Computed field reactivity** — recompute on every dependency value change. Use coltorapps `onEntityValueUpdated` event to detect dependency changes (extend the listener already in `interpreter-renderer.tsx`).

</specifics>

<deferred>
## Deferred Ideas

- **Custom risk-standard formulas (DSEAR, COSHH, etc.)** — D-08 leaves the door open via the `formula` attribute. New formulas added when the customer asks.
- **Pluggable expression engine for computed fields** — future phase if customer authoring of risk formulas becomes a real need.
- **Repeating sections nested inside sectionGroup or other repeating sections** — defer the nested-repeat case unless a real use-case appears. Document the schema as "repeatingSection lives at root or inside a sectionGroup, not inside another repeatingSection" at planning.
- **Auto-derived computed inputs** — admin currently picks input field IDs manually. Could later infer them by attribute tags (e.g. "this is the likelihood field"). Out of scope.
- **Signature provider integration (SignWell etc.)** — distinct from in-form signatures; deferred per HANDOFF.md.
- **Per-photo text labels (FORM-07)** — defer until customer asks; `field_media` has no caption column, AttachPhotosAffordance has no label input. Schema migration + UI affordance both required when revived. Captured here so Phase 14 close-out audit reflects the intentional deferral (gsd-checker W7).

</deferred>

---

*Phase: 14-custom-field-types*
*Context gathered: 2026-05-25*
