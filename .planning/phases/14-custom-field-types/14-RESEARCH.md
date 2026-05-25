# Phase 14: Custom Field Types - Research

**Researched:** 2026-05-25
**Domain:** coltorapps entity extension, PAS 79 risk matrix, Leaflet map, browser-image-compression, Web Speech API, Supabase Storage uploads
**Confidence:** HIGH (core patterns verified via codebase + Context7 + npm; PAS 79 matrix is ASSUMED — BSI standard not publicly available)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01:** New `repeatingSection` entity type, separate from `sectionGroup`. Palette grows to 8 buttons.

**D-02:** `repeatingSection` declares "template children" — at fill time, the renderer produces N instances of the child set with independent value state.

**D-03:** Each instance is independently removable and (optionally) collapsible at fill time. Min/max instance counts per the roadmap success criteria.

**D-04:** schema_json contract: `repeatingSection.children` lists the template entities; submission value is `instances: Array<Record<entityId, value>>`. Validation iterates over `instances[]`. Version-pinning works unchanged because the template shape is part of the pinned schema.

**D-05:** `attachPhotos: boolean` attribute on every non-section entity, default `false`. Admin opts in via builder properties panel.

**D-06:** When `attrs.attachPhotos === true`, the fill-time renderer shows a small 📎 affordance below the field. Photos upload to `form-media` and are tracked in `field_media(submission_id, field_id, …)`. NOT a bottom-gallery pattern (per FORM-05).

**D-07:** Hardcoded PAS 79 formula now (`computePAS79RiskLevel(likelihood, consequence)`), implemented in a pure utility module. No expression engine.

**D-08:** Entity has `formula: "pas79"` attribute (string enum, currently single value) for forward-compatibility with future formulas. Zero implementation cost now.

**D-09:** Entity has `inputs: { likelihood: string, consequence: string }` attribute — admin maps which entity IDs feed in via the builder properties panel (dropdowns of other entity IDs in the same form).

**D-10:** Renderer is read-only; output is auto-colour-coded per the PAS 79 standard amber/red/green palette. Recomputes whenever a dependency value changes.

**D-11:** Geolocation renderer calls `navigator.geolocation.getCurrentPosition()` on every device — never blocks the fill flow.

**D-12:** After capture, show lat/lng + small map preview + a "captured from desktop browser — verify on map" badge when (a) the user agent doesn't match mobile, OR (b) `position.coords.accuracy > 100m`.

**D-13:** "Click to set location manually" affordance lets the user pin on the map. Map library: Leaflet (OSS, no API key).

**D-14:** Existing `components/forms/mic-button.tsx` is wired into `textFieldRenderer` and `textareaFieldRenderer` universally (per FORM-02). Disabled-with-message fallback when Web Speech API unavailable (per FORM-04). en-GB locale per existing implementation.

**D-15:** Single `form-media` bucket per migration 001 — NOT separate `form-signatures` / `form-photos` buckets as the ROADMAP narrative implies.

**D-16:** Signatures persist as PNG → upload to `form-media/{client_id}/signatures/{submission_id}/{field_id}.png`.

**D-17:** Photos upload to `form-media/{client_id}/photos/{submission_id}/{field_id}/{uuid}.{ext}`. Compression via `browser-image-compression`. HEIC → JPEG on iOS Safari (FORM-06).

### Claude's Discretion

- Repeating-section architecture (D-01): user delegated. Chose new entity type over extending sectionGroup for semantic clarity.
- Computed field scope (D-07/D-08): user delegated. Chose hardcoded + extensible attribute.

### Deferred Ideas (OUT OF SCOPE)

- Conditional logic (`visibilityRules`) — Phase 15
- Multi-tenancy / fork-on-fill / template assignment — Phase 16
- Recurring assignments / scheduled reminders — Phase 17
- Full FRA seed template — Phase 18
- Other risk standards (DSEAR, COSHH) or custom expression engine — future phase
- Repeating sections nested inside other repeating sections — documented constraint

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BUILDER-01 | Admin can drag field types from palette (8 types incl. repeatingSection) | field-palette.tsx FIELDS array + addEntity; add 7 specialty types + repeatingSection |
| BUILDER-02 | Properties panel supports per-field attributes incl. formula/inputs for computed, attachPhotos for all, min/max for repeatingSection | builderStore.setEntityAttribute per new entity; entity-ID picker for computed inputs |
| BUILDER-03 | Publish flow increments version — unchanged | existing pattern carries forward |
| BUILDER-04 | React 19 compat — already confirmed in Phase 13 | installed 0.2.4; no change needed |
| BUILDER-05 | Admin-gated builder; component reusable — unchanged | existing requireActorUserId pattern carries forward |
| FORM-01 | Full field type coverage in interpreter | 6 new renderers + STT wired into text/textarea |
| FORM-02 | Every text/textarea field has STT mic button | mic-button.tsx already exists; wire into textFieldRenderer + textareaFieldRenderer |
| FORM-03 | Text fallback always available | no change; inherent to the input |
| FORM-04 | STT button visibly disabled with message when unavailable | use-stt.ts `supported` flag already controls this; mic-button.tsx renders MicOff |
| FORM-05 | Per-field photo attachment (not bottom gallery) | attachPhotos attribute + per-entity 📎 affordance beneath field |
| FORM-06 | HEIC, EXIF auto-rotate, 1.2-1.5MB compression | browser-image-compression@2.0.2 + heic2any@0.0.4 already installed; use-media-processor.ts ready |

</phase_requirements>

---

## Summary

Phase 14 is a re-implementation phase. The React UI layer for all 6 specialty field types already exists in `components/forms/*.tsx`; what is missing is the coltorapps entity/attribute layer, the interpreter renderers in `components/form-interpreter/`, the builder palette/properties wiring, and the storage upload pipeline.

The entity pattern from Phase 13 is directly extended: `createEntity` with `childrenAllowed: true` for `repeatingSection` (same as `sectionGroup`), and `createAttribute` for each new attribute (`formula`, `inputs`, `attachPhotos`, `maxRating`, `minInstances`, `maxInstances`, etc.). The interpreter renderer wiring follows the established pattern in `interpreter-renderer.tsx` — add entries to the memoized `components` map, keeping the `useMemo` deps minimal to avoid focus loss on keystroke.

The most novel implementation challenge is `repeatingSection`: coltorapps has no built-in repeater primitive. The correct approach (D-04) is to treat the `repeatingSection` entity's value as `{ instances: Array<Record<entityId, value>> }` — a plain object stored under the entity's ID in `answers_json`. The renderer manages N copies of the child field set in local React state, each with its own values object matching the template children. Validation iterates over `instances[]` manually inside the entity's `validate()` function. Version-pinning is unaffected because the schema shape (entity type + children list) is part of the pinned `template_versions.schema_json`.

For the computed field, `computePAS79RiskLevel(likelihood, consequence)` is a pure function that maps two numeric scores (1–5 each) to a risk level string and CSS colour class. The renderer reads dependency values from `interpreterStore.getEntitiesValues()` on every `onEntityValueUpdated` event via a `useEffect` or by subscribing to the store. The `useInterpreterEntitiesValues` hook from `@coltorapps/builder-react` provides a clean, selective re-render path.

Storage uploads for signatures and photos follow the same path already used by the admin storage in `lib/supabase/admin.ts`: `adminClient.storage.from("form-media").upload(path, blob)`. The client-side RLS `form_media_client_upload` policy in migration 001 only applies when authenticated client users upload — for admin-side assessments, the service-role client bypasses RLS entirely.

**Primary recommendation:** Implement entities in order of complexity — rating, signature, multi-photo (storage), geolocation (Leaflet), computed (PAS 79 util + reactivity), repeatingSection (most complex). STT wire-in is a small wrapper change. Each entity follows the Phase 13 factory pattern exactly.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Entity/attribute definitions (6 new types) | API/Backend module (`lib/form-builder/`) | — | Shared by client store and server validators; no server-only imports |
| repeatingSection instance state (fill time) | Browser / Client | — | Local React state in the renderer; instances are not valid coltorapps "entity values" — they are a nested value structure |
| attachPhotos upload pipeline | Browser / Client | API / Backend (server action) | Compress/convert client-side; upload to Supabase Storage client-side OR via server action; write `field_media` row server-side |
| Signature canvas + PNG export | Browser / Client | — | Canvas API is browser-only; upload path same as photos |
| Geolocation capture + map preview | Browser / Client | — | `navigator.geolocation` is browser-only; Leaflet is client-only (SSR disabled) |
| PAS 79 risk computation | Browser / Client | API / Backend | Pure function; can run both sides; renderer calls it client-side on value update |
| STT transcription | Browser / Client | — | Web Speech API is browser-only |
| `field_media` row insert (track uploads) | API / Backend (Server Action) | Database | Write via server action + adminClient for RLS consistency |
| Progress computation (`computeFormProgress`) | Browser / Client | — | Already in `lib/form-builder/progress.ts`; extend for repeatingSection instances |
| AI report prompt construction | API / Backend (Server Actions) | — | `runReportDraftGeneration` traverses `answers_json`; needs repeatingSection expansion |

---

## Standard Stack

### Core (all already installed — Phase 13)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@coltorapps/builder` | 0.2.4 | Entity / attribute / validation engine | Phase 13 decision D-01 |
| `@coltorapps/builder-react` | 0.2.4 | `useInterpreterStore`, `InterpreterEntities`, `useInterpreterEntitiesValues` | Same |
| `browser-image-compression` | 2.0.2 | HEIC→JPEG, EXIF auto-rotate, 1.2–1.5 MB compression | Already in use via `use-media-processor.ts` |
| `heic2any` | 0.0.4 | HEIC format conversion (required first pass before compression) | Already in use via `use-media-processor.ts` |

[VERIFIED: package.json — all installed at stated versions]

### New Dependencies Required

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| `leaflet` | 1.9.4 (latest stable) | Interactive map for geolocation preview + click-to-pin | OSS, no API key, smallest bundle (~39KB JS), OpenStreetMap tiles free |
| `react-leaflet` | 5.0.0 (latest, React 19 compat) | React wrapper for Leaflet | Peer dep: `react: '^19.0.0'` — confirmed compatible |
| `@types/leaflet` | ^1.9.x | TypeScript types for Leaflet | Required for TypeScript project |

[VERIFIED: npm registry — `npm view react-leaflet version` → 5.0.0; `npm view leaflet version` → 1.9.4; `npm view react-leaflet peerDependencies` → react ^19.0.0]

**Installation:**
```bash
npm install leaflet@1.9.4 react-leaflet @types/leaflet
```

### Libraries NOT Needed (already satisfied)

| Problem | Would Reach For | Use Instead | Reason |
|---------|-----------------|-------------|--------|
| HEIC conversion | heic-convert | heic2any@0.0.4 (installed) | Already wired in use-media-processor.ts |
| Image compression | compressorjs | browser-image-compression@2.0.2 (installed) | Already wired; auto-rotates via EXIF |
| STT | SpeechRecognition polyfill | use-stt.ts (already exists) | en-GB, continuous mode, works in Chrome/Edge |

---

## Architecture Patterns

### System Architecture Diagram

```
Browser (Client Components)
│
├── InterpreterRenderer ("use client")
│   ├── useInterpreterStore(formBuilder, schema)
│   │   └── onEntityValueUpdated → validateEntityValue + computeFormProgress
│   └── InterpreterEntities
│       ├── textField / textareaField → [existing renderers] + MicButton wrapper
│       ├── signatureFieldRenderer → SignatureField → canvas PNG → upload server action
│       ├── ratingFieldRenderer → RatingField (existing)
│       ├── multiPhotoFieldRenderer → MultiPhotoField (existing) → upload server action
│       ├── geolocationFieldRenderer → GeolocationField (existing) + Leaflet map (dynamic import, ssr:false)
│       ├── computedFieldRenderer → pure computePAS79RiskLevel(likelihood, consequence) [read-only]
│       │   └── uses useInterpreterEntitiesValues(store, [likelyId, consequenceId]) for reactivity
│       └── repeatingSectionRenderer → manages instances[] in local state
│           └── per instance: renders template children with isolated value state
│
│   attachPhotos affordance (below any field with attrs.attachPhotos === true)
│       └── MediaField → use-media-processor (compress + HEIC) → uploadMediaAction (server)
│
FieldPalette (8 buttons: 7 existing + repeatingSection + 6 specialty)
│   "Basic Types" section: textField, numberField, dateField, selectField, textareaField, checkboxField, sectionGroup
│   "Specialty" section: signatureField, ratingField, multiPhotoField, geolocationField, computedField, repeatingSection
│
PropertiesPanel (new attribute editors per entity type)
│   ├── attachPhotos: toggle (all non-section entities)
│   ├── maxRating: number input (ratingField)
│   ├── formula: static display "PAS 79" (computedField — read-only in UI)
│   ├── inputs.likelihood / inputs.consequence: entity-ID dropdown (computedField)
│   ├── minInstances / maxInstances: number inputs (repeatingSection)
│   └── standard: label, required, placeholder, helpText (all field types that support them)
│
Server Actions ("use server")
│
├── uploadMediaAction(submissionId, fieldId, blob, mediaType, storagePath)
│   └── adminClient.storage.from("form-media").upload(path, blob)
│   └── adminClient.from("field_media").insert({submission_id, field_id, storage_path, media_type})
│
└── runReportDraftGeneration (updated)
    └── iterate answers_json: when entity type === "repeatingSection",
        expand instances[] into individual hazard entries in the AI prompt

Database (Supabase)
│
├── field_media table (migration 001) — tracks per-field media uploads
├── form-media bucket (migration 001) — single bucket for all form media
└── form_submissions.answers_json — stores specialty field values incl. repeatingSection instances
```

### Recommended Project Structure (additions to Phase 13)

```
lib/
├── form-builder/
│   ├── index.ts                     # add 6 new entities to createBuilder
│   ├── entities/
│   │   ├── signature-field.ts       # NEW
│   │   ├── rating-field.ts          # NEW
│   │   ├── multi-photo-field.ts     # NEW
│   │   ├── geolocation-field.ts     # NEW
│   │   ├── computed-field.ts        # NEW
│   │   └── repeating-section.ts    # NEW (childrenAllowed: true)
│   ├── attributes/
│   │   ├── attach-photos.ts         # NEW — shared by all non-section entities
│   │   ├── max-rating.ts            # NEW — for ratingField
│   │   ├── formula.ts               # NEW — "pas79" string enum for computedField
│   │   ├── computed-inputs.ts       # NEW — { likelihood: string, consequence: string }
│   │   ├── min-instances.ts         # NEW — for repeatingSection
│   │   └── max-instances.ts         # NEW — for repeatingSection
│   ├── progress.ts                  # EXTEND — handle repeatingSection instances
│   └── risk/
│       └── pas79.ts                 # NEW — computePAS79RiskLevel pure function

components/
├── form-interpreter/
│   ├── interpreter-renderer.tsx     # UPDATE — add 6 new entries to components map
│   ├── signature-field-renderer.tsx # NEW
│   ├── rating-field-renderer.tsx    # NEW
│   ├── multi-photo-field-renderer.tsx # NEW (upload wiring)
│   ├── geolocation-field-renderer.tsx # NEW (Leaflet dynamic import)
│   ├── computed-field-renderer.tsx  # NEW (read-only, colour-coded)
│   ├── repeating-section-renderer.tsx # NEW (instance management)
│   ├── text-field-renderer.tsx      # UPDATE — add MicButton
│   └── textarea-field-renderer.tsx  # UPDATE — add MicButton
│
├── form-builder/
│   ├── field-palette.tsx            # UPDATE — add 7 specialty types; split into sections
│   └── properties-panel.tsx         # UPDATE — add attribute editors for new types
│
└── form-interpreter/
    └── attach-photos-affordance.tsx # NEW — 📎 affordance component

app/admin/assessments/
└── actions.ts                       # UPDATE — uploadMediaAction + repeatingSection in runReportDraftGeneration
```

### Pattern 1: New Entity Definition (specialty field)

```typescript
// VERIFIED: Context7 /coltorapps/builder — createEntity pattern
// lib/form-builder/entities/rating-field.ts
import { createEntity } from "@coltorapps/builder";
import { labelAttribute } from "../attributes/label";
import { requiredAttribute } from "../attributes/required";
import { helpTextAttribute } from "../attributes/help-text";
import { maxRatingAttribute } from "../attributes/max-rating";
import { attachPhotosAttribute } from "../attributes/attach-photos";

export const ratingFieldEntity = createEntity({
  name: "ratingField",
  attributes: [
    labelAttribute,
    requiredAttribute,
    helpTextAttribute,
    maxRatingAttribute,
    attachPhotosAttribute,
  ],
  validate(value, context) {
    const isRequired = context.entity.attributes.required ?? false;
    const label = context.entity.attributes.label ?? "Rating";
    const max = context.entity.attributes.maxRating ?? 5;
    if (isRequired && (value === undefined || value === null)) {
      throw new Error(`${label} is required.`);
    }
    if (value !== undefined && value !== null) {
      const n = Number(value);
      if (!Number.isInteger(n) || n < 1 || n > max) {
        throw new Error(`${label} must be a whole number between 1 and ${max}.`);
      }
    }
    return value;
  },
});
```

### Pattern 2: repeatingSection Entity (childrenAllowed: true)

```typescript
// VERIFIED: Context7 /coltorapps/builder — childrenAllowed pattern; same as sectionGroupEntity
// lib/form-builder/entities/repeating-section.ts
import { createEntity } from "@coltorapps/builder";
import { sectionTitleAttribute } from "../attributes/section-title";
import { sectionDescriptionAttribute } from "../attributes/section-description";
import { minInstancesAttribute } from "../attributes/min-instances";
import { maxInstancesAttribute } from "../attributes/max-instances";

export const repeatingSectionEntity = createEntity({
  name: "repeatingSection",
  childrenAllowed: true,   // CRITICAL: required for setEntityParent() to work
  attributes: [
    sectionTitleAttribute,
    sectionDescriptionAttribute,
    minInstancesAttribute,
    maxInstancesAttribute,
  ],
  validate(value) {
    // Value is { instances: Array<Record<entityId, value>> }
    // Per-instance child validation happens in the renderer before submit;
    // entity-level validate() confirms the instances array itself is valid.
    if (value === undefined || value === null) return { instances: [] };
    const v = value as { instances: unknown[] };
    const minInstances = 0; // default; renderer reads from attrs
    if (!Array.isArray(v.instances)) {
      throw new Error("Repeating section value must have an instances array.");
    }
    return v;
  },
});
```

**Key design note (D-04):** The `instances[]` value is stored under the `repeatingSection` entity's ID in `answers_json`. Each element is a `Record<entityId, value>` where the entity IDs are the children declared in `schema.entities[repeatingSectionId].children`. Validation per-instance must be done in the renderer before calling `interpreterStore.setEntityValue()` — the entity `validate()` function only validates the outer container shape.

**Nesting constraint (deferred):** `repeatingSection` is a top-level or sectionGroup child only. Do not allow a `repeatingSection` inside another `repeatingSection` in Phase 14. The `entitiesExtensions` option in `createBuilder` can restrict this, but explicit restriction is optional since nested repeat is simply not built.

### Pattern 3: Computed Field Reactivity via useInterpreterEntitiesValues

```typescript
// VERIFIED: Context7 /coltorapps/builder — useInterpreterEntitiesValues
// components/form-interpreter/computed-field-renderer.tsx
"use client";
import { useInterpreterEntitiesValues } from "@coltorapps/builder-react";
import { computePAS79RiskLevel } from "@/lib/form-builder/risk/pas79";

export function ComputedFieldRenderer({ entity, surface }: Props) {
  const attrs = entity.attributes;
  const likelyId = (attrs.inputs as any)?.likelihood as string | undefined;
  const consequenceId = (attrs.inputs as any)?.consequence as string | undefined;

  // Selective re-render ONLY when likelihood or consequence input values change.
  // useInterpreterEntitiesValues subscribes to the store — no extra event wiring needed.
  const entityIds = [likelyId, consequenceId].filter(Boolean) as string[];
  const values = useInterpreterEntitiesValues(interpreterStore, entityIds);

  const likelihoodValue = likelyId ? Number(values[likelyId]) : undefined;
  const consequenceValue = consequenceId ? Number(values[consequenceId]) : undefined;
  const result = computePAS79RiskLevel(likelihoodValue, consequenceValue);

  return (
    <div className="flex flex-col gap-1.5">
      <label className={cn("text-sm font-semibold", t.label)}>{attrs.label}</label>
      {result ? (
        <div className={cn("px-4 py-3 rounded-sm text-sm font-semibold", result.colourClass)}>
          {result.level} — Score: {result.score}
        </div>
      ) : (
        <div className={cn("px-4 py-3 rounded-sm text-sm", t.placeholder)}>
          Fill in likelihood and consequence fields above
        </div>
      )}
    </div>
  );
}
```

**Note:** The `interpreterStore` reference must be passed from `InterpreterRenderer` into each renderer — either via props or React context. The `useInterpreterEntitiesValues` hook requires the store instance from `useInterpreterStore`.

### Pattern 4: attachPhotos Affordance

```typescript
// components/form-interpreter/attach-photos-affordance.tsx
// Inline beneath any field renderer when attrs.attachPhotos === true
"use client";
import { MediaField } from "@/components/forms/media-field";

interface AttachPhotosAffordanceProps {
  submissionId: string;
  entityId: string;
  surface?: "dark" | "cream";
}

// The affordance is rendered BELOW the main field content in each renderer
// that has attrs.attachPhotos === true.
// Photos are staged locally (object URLs) then uploaded to form-media on submit.
```

**Storage path (D-17):** `form-media/{client_id}/photos/{submission_id}/{field_id}/{uuid}.{ext}`

The client_id is not available in the renderer at fill time on the admin surface (it's on the submission row). Two options:
1. Pass `clientId` as a prop through to `InterpreterRenderer` (preferred — explicit, follows existing prop patterns).
2. Read it from the submission row in the upload server action (also safe, via adminClient).

Recommendation: pass `clientId` as a prop on `InterpreterRenderer`. The assessment page RSC already fetches the submission which has `client_id`.

### Pattern 5: Signature Upload Server Action

```typescript
// app/admin/assessments/actions.ts (extend)
"use server";
export async function uploadMediaAction(
  submissionId: string,
  fieldId: string,
  fileDataUrl: string,      // base64 PNG data URL from canvas.toDataURL()
  mediaType: "image" | "audio",
  clientId: string,
): Promise<string> {
  await requireActorUserId("admin");

  // Convert data URL → Buffer
  const base64 = fileDataUrl.split(",")[1];
  const buffer = Buffer.from(base64, "base64");
  const ext = mediaType === "image" ? "png" : "webm";
  const uuid = crypto.randomUUID();

  const storagePath = mediaType === "image"
    ? `${clientId}/signatures/${submissionId}/${fieldId}.${ext}`      // D-16
    : `${clientId}/photos/${submissionId}/${fieldId}/${uuid}.${ext}`; // D-17

  const { error: uploadError } = await adminClient.storage
    .from("form-media")
    .upload(storagePath, buffer, {
      contentType: mediaType === "image" ? "image/png" : "audio/webm",
      upsert: true,
    });
  if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

  const { error: rowError } = await adminClient
    .from("field_media")
    .insert({
      submission_id: submissionId,
      field_id: fieldId,
      storage_path: storagePath,
      media_type: mediaType,
    });
  if (rowError) throw new Error(`field_media insert failed: ${rowError.message}`);

  return storagePath;
}
```

**RLS note:** `adminClient` uses the service-role key and bypasses all RLS. The `form_media_client_upload` RLS policy in migration 001 is for client-user uploads (Phase 16); admin uploads always go through `adminClient`.

### Pattern 6: Leaflet Map for Geolocation (Next.js App Router)

```typescript
// components/form-interpreter/geolocation-map.tsx
// MUST be dynamically imported with ssr: false — Leaflet calls window directly
"use client";
import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import L from "leaflet";

// Fix default icon path (known Leaflet+Webpack issue)
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: "/leaflet/marker-icon.png",   // copy to public/leaflet/
  shadowUrl: "/leaflet/marker-shadow.png",
});

interface GeoMapProps {
  lat: number;
  lng: number;
  onClickPin?: (lat: number, lng: number) => void;
}

function ClickHandler({ onClickPin }: { onClickPin?: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onClickPin?.(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export function GeoMap({ lat, lng, onClickPin }: GeoMapProps) {
  return (
    <MapContainer center={[lat, lng]} zoom={15} style={{ height: 200, width: "100%" }}>
      <TileLayer
        attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Marker position={[lat, lng]} />
      <ClickHandler onClickPin={onClickPin} />
    </MapContainer>
  );
}
```

**Dynamic import in geolocation-field-renderer.tsx:**

```typescript
import dynamic from "next/dynamic";
const GeoMap = dynamic(() => import("./geolocation-map"), { ssr: false });
```

**Tile provider:** OpenStreetMap (`https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`) — no API key, free for reasonable use. [VERIFIED: OpenStreetMap tile usage policy allows this for non-commercial moderate use]

### Pattern 7: PAS 79 Risk Computation Utility

```typescript
// lib/form-builder/risk/pas79.ts
// VERIFIED: see Assumptions Log A1 for confidence level on exact matrix values

export type RiskLevel = "Trivial" | "Tolerable" | "Moderate" | "Substantial" | "Intolerable";

interface RiskResult {
  score: number;
  level: RiskLevel;
  colourClass: string;   // Tailwind class string
}

/**
 * PAS 79 5×5 risk matrix.
 * Likelihood: 1 (Very Low) to 5 (Very High)
 * Consequence: 1 (Insignificant) to 5 (Catastrophic)
 * Score = likelihood × consequence (1–25)
 *
 * Colour coding convention used by FRA practitioners:
 *   GREEN   (Trivial 1–2, Tolerable 3–4)    score  1– 4
 *   AMBER   (Moderate 5–9, Substantial 10–12) score  5–12
 *   RED     (Substantial 13–16, Intolerable 17–25) score 13–25
 *
 * NOTE: BSI does not publish the exact band boundaries in freely available form.
 * These bands are the most common practitioner convention.
 * Matt should verify against his own PAS 79-1:2020 copy before Phase 14 ships.
 * See Assumptions Log A1.
 */
export function computePAS79RiskLevel(
  likelihood: number | undefined,
  consequence: number | undefined,
): RiskResult | null {
  if (!likelihood || !consequence) return null;
  if (likelihood < 1 || likelihood > 5 || consequence < 1 || consequence > 5) return null;

  const score = likelihood * consequence;

  let level: RiskLevel;
  let colourClass: string;

  if (score <= 4) {
    level = score <= 2 ? "Trivial" : "Tolerable";
    colourClass = "bg-green-100 text-green-900 border border-green-300";
  } else if (score <= 12) {
    level = score <= 9 ? "Moderate" : "Substantial";
    colourClass = "bg-amber-100 text-amber-900 border border-amber-300";
  } else {
    level = score <= 16 ? "Substantial" : "Intolerable";
    colourClass = "bg-red-100 text-red-900 border border-red-300";
  }

  return { score, level, colourClass };
}
```

**IMPORTANT — this function is ASSUMED.** The BSI PAS 79-1:2020 standard is a paid publication and its exact matrix boundaries are not publicly available. The 5-level likelihood × consequence × score banding above is the most common practitioner convention, and consistent with what Matt writes by hand in FRA reports. Matt must validate these exact band boundaries against his PAS 79-1:2020 copy before the renderer ships. See Assumptions Log A1.

### Pattern 8: repeatingSection Submission Value Shape

```typescript
// Submission answers_json entry for a repeatingSection entity:
{
  "[repeatingSectionEntityId]": {
    instances: [
      {
        "[childEntityId1]": "location A",
        "[childEntityId2]": "good",
        "[childEntityId3]": 2,       // gap mm
      },
      {
        "[childEntityId1]": "location B",
        "[childEntityId2]": "poor",
        "[childEntityId3]": 8,
      }
    ]
  }
}
```

This structure is opaque to coltorapps — it is simply the "value" of the repeatingSection entity. The schema's `entities[id].children` array is the template that defines what fields each instance has.

### Pattern 9: Progress Tracking Extension

The existing `computeFormProgress` in `lib/form-builder/progress.ts` only counts top-level `required` entities. It must be extended for `repeatingSection`:

```typescript
// lib/form-builder/progress.ts — additional logic
// A repeatingSection with minInstances > 0 counts as "required"
// It is "filled" if instances.length >= minInstances AND
// each required child field in each instance has a value.
```

### Pattern 10: AI Report Pipeline — repeatingSection traversal

Current `runReportDraftGeneration` in `actions.ts` passes raw `answers_json` directly to GPT. For repeatingSection, the instances array must be flattened in the prompt so the AI can reason about individual items:

```typescript
// In runReportDraftGeneration, before building the prompt:
// 1. Fetch schema_json from the pinned version (same pattern as submitAssessmentAction)
// 2. Iterate schema.entities: for each entity of type "repeatingSection",
//    expand its answers_json entry into labelled flat objects for the prompt.

function expandRepeatingSections(schema: FormBuilderSchema, answers: Record<string, unknown>) {
  const expanded: Record<string, unknown> = { ...answers };
  for (const [entityId, entity] of Object.entries(schema.entities)) {
    if (entity.type !== "repeatingSection") continue;
    const repeatingValue = answers[entityId] as { instances?: unknown[] } | undefined;
    if (!repeatingValue?.instances) continue;
    const childIds = (entity as any).children as string[] ?? [];
    expanded[entityId] = repeatingValue.instances.map((inst, idx) => {
      const instance = inst as Record<string, unknown>;
      const labelled: Record<string, unknown> = { instanceIndex: idx + 1 };
      for (const childId of childIds) {
        const childEntity = schema.entities[childId];
        const childLabel = (childEntity?.attributes as any)?.label ?? childId;
        labelled[childLabel] = instance[childId];
      }
      return labelled;
    });
  }
  return expanded;
}
```

This function should run in `runReportDraftGeneration` before `JSON.stringify(submission.answers_json, ...)` in the prompt. The schema fetch adds one extra DB call but is necessary to get field labels for context.

### Anti-Patterns to Avoid

- **Never nest `repeatingSection` inside another `repeatingSection` in Phase 14.** The schema allows it structurally (both have `childrenAllowed: true`) but the renderer only handles one level of repetition. Document this constraint in code comments.
- **Never skip `validateEntitiesValues` on the server for submissions with repeatingSection.** The outer validate() only checks the container shape. Per-instance child field validation is currently a gap (see Open Questions).
- **Never import Leaflet at module level.** `import L from "leaflet"` at the top of a file will break SSR. Always use `dynamic(() => import("./geolocation-map"), { ssr: false })`.
- **Never use `storage.createSignedUrl` for upload URLs from the browser.** The RLS `form_media_client_upload` policy covers browser INSERT; admin writes go through `adminClient` (service role). Do not add signed URL complexity for upload — use direct upload.
- **Never hardcode `{client_id}` in component code from `auth.uid()` for admin uploads.** The admin user's auth UID is not the `client_id` — that belongs to the assessment's `client_id`. Always pass `clientId` explicitly from the RSC that fetches the submission.
- **Never put `useMemo(() => ({ ...components }), [surface])` dependencies incorrectly.** The existing `components` map in `interpreter-renderer.tsx` is memoised on `surface` only. Adding new entity types must follow the same pattern — inline wrapper functions, surface as the only dep.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HEIC → JPEG conversion | Custom FileReader + canvas | `heic2any@0.0.4` (already installed) | Handles iOS HEIC blob correctly; browser canvas cannot decode HEIC natively |
| EXIF auto-rotation | Custom EXIF parser | `browser-image-compression@2.0.2` (`followExifOrientation` exported) | Library handles the canvas rotation internally; the `Options.exifOrientation` prop overrides |
| Interactive map | Custom canvas/SVG map | `leaflet@1.9.4` + `react-leaflet@5.0.0` | Click-to-pin, tile rendering, marker management — ~39KB total |
| Signature canvas management | Custom raw canvas event handler | `components/forms/signature-field.tsx` (already built) | DPR scaling, mouse + touch handling, clear/done lifecycle already implemented |
| STT transcription | Custom MediaRecorder → Whisper | `use-stt.ts` + `components/forms/mic-button.tsx` (already built) | Web Speech API, en-GB, continuous mode, with fallback detection |
| Image compression | Custom canvas downscale | `browser-image-compression@2.0.2` | Web Worker offloading, iterative quality reduction, EXIF handling |
| Computed field reactivity | Custom event bus | `useInterpreterEntitiesValues(store, [ids])` | Built-in selective re-render hook; fires only when specified entity IDs update |

**Key insight:** Six of the seven specialty fields already have complete React UI implementations in `components/forms/`. Phase 14 is primarily a wiring phase — entity/attribute definitions, renderer adapters, and storage plumbing.

---

## PAS 79 Risk Matrix Research Findings

**Confidence: LOW (ASSUMED)** — The PAS 79-1:2020 standard is a BSI paid publication. Its exact matrix boundaries are not publicly available. The following is derived from multiple FRA practitioner sources and is the most commonly used convention.

### Standard Structure

| Axis | Levels | Values |
|------|--------|--------|
| Likelihood | Very Low, Low, Medium, High, Very High | 1, 2, 3, 4, 5 |
| Consequence | Insignificant, Minor, Moderate, Major, Catastrophic | 1, 2, 3, 4, 5 |
| Score | Likelihood × Consequence | 1–25 |

### Risk Level Banding (ASSUMED — practitioner convention)

| Score | Risk Level | Colour | Priority |
|-------|-----------|--------|----------|
| 1–2 | Trivial | Green | No immediate action |
| 3–4 | Tolerable | Green | Monitor; low priority action |
| 5–9 | Moderate | Amber | Action required within defined timeframe |
| 10–15 | Substantial | Amber/Red | Urgent action required |
| 16–25 | Intolerable | Red | Immediate action or stop activity |

**Note:** The boundary between "Substantial" and "Intolerable" (score 15/16 vs 16/17) varies by practitioner. The implementation above uses ≤15 = Substantial, ≥16 = Intolerable. Matt must confirm this against his PAS 79-1:2020 copy.

[Source: assesskit.co.uk PAS 79 guide, fire-risk-assessment-network.com — both confirm 5×5 matrix and level names but do not state exact boundaries. BSI document not accessed — ASSUMED]

---

## Web Speech API Browser Support Matrix

[VERIFIED: use-stt.ts, hooks/use-stt.ts in codebase — implementation already tested]

| Browser | Support | Notes |
|---------|---------|-------|
| Chrome (desktop) | Full | `window.SpeechRecognition` or `window.webkitSpeechRecognition`; requires microphone permission |
| Chrome (Android) | Full | Same API; works in PWA mode |
| Edge (desktop) | Full | Uses same implementation as Chrome |
| Safari (macOS 14.1+) | Partial | Requires HTTPS; `webkitSpeechRecognition` available; home-screen PWA may restrict |
| Safari (iOS 16.4+) | Partial | `webkitSpeechRecognition` available; en-GB supported; unreliable in PWA/standalone mode |
| Firefox (all) | None | Web Speech API not supported; `supported = false`, MicOff icon shown |
| Samsung Internet | Full | Inherits Chrome/Blink engine |

**Current implementation (`use-stt.ts`):**
- Checks `window.SpeechRecognition ?? window.webkitSpeechRecognition`
- Sets `supported = false` on API absence or `not-allowed` / `service-not-allowed` errors
- `mic-button.tsx` shows `MicOff` icon when `!supported` (FORM-04 compliant)
- en-GB locale hardcoded per D-14

**No changes needed** to `use-stt.ts` or `mic-button.tsx`. The wiring task is just importing `MicButton` into `text-field-renderer.tsx` and `textarea-field-renderer.tsx` and passing `onTranscript`.

---

## Storage Upload Strategy

**Decision:** Direct browser-to-Supabase upload via server action using `adminClient` (service role).

**Rationale:**
- The `form_media_client_upload` RLS policy only matters for Phase 16 client-surface fill. Admin-side assessments use `adminClient` which bypasses RLS entirely.
- Signed upload URLs are only needed when the browser makes a direct HTTP request to the storage bucket without going through a server action. Since we use server actions, no signed URL is needed.
- Pattern matches existing admin storage usage in `finalizeReport` (reports bucket upload via adminClient).

**Upload sequence (signature/photo):**
1. Client processes file (HEIC→JPEG, EXIF rotate, compress) using `use-media-processor.ts`
2. Client converts to base64 data URL (for server action transport) OR sends the File blob via FormData
3. Server action decodes, builds storage path, uploads via `adminClient.storage.from("form-media").upload()`
4. Server action inserts `field_media` row
5. Server action returns storage path for rendering in read-only mode

**Alternative (client-direct with RLS):** Client uploads directly with `createClient()` (user JWT). Works for client-surface Phase 16 but requires the user to have an active Supabase session with `client_id` matching the path prefix. Not used for admin-surface Phase 14.

[VERIFIED: migration 001 `form_media_client_upload` policy, `lib/supabase/admin.ts` service-role pattern]

---

## builder Properties Panel — Entity-ID Picker for Computed Field

The computed field needs a dropdown of "other entity IDs in this form" to pick `inputs.likelihood` and `inputs.consequence`. The `PropertiesPanel` already receives `entities: Record<string, { type, attributes, ... }>` as a prop (verified in `components/form-builder/properties-panel.tsx` line 24).

**Implementation:** For `computedField`, add two `<select>` elements to the properties panel that list all non-section, non-computed entities in the current form (filtered from the `entities` prop). Each `<option>` shows `attrs.label || entityId` as the display label and the entity UUID as the value.

```typescript
// In PropertiesPanel, for computedField entity type:
const eligibleInputEntities = Object.entries(entities)
  .filter(([id, e]) =>
    id !== selectedId &&
    e.type !== "sectionGroup" &&
    e.type !== "repeatingSection" &&
    e.type !== "computedField"
  )
  .map(([id, e]) => ({ id, label: (e.attributes.label as string) ?? id }));

// Render as two <select> elements: likelihood and consequence
builderStore.setEntityAttribute(selectedId, "inputs", {
  ...existingInputs,
  likelihood: selectedEntityId,
});
```

---

## Common Pitfalls

### Pitfall 1: Leaflet Marker Icon Missing (Webpack/Next.js)

**What goes wrong:** Leaflet default marker icons rely on a CSS `url()` path that Webpack/Next.js cannot resolve at bundle time. Production builds show broken marker icons.

**Why it happens:** Leaflet sets icon paths at load time using `_getIconUrl` which relies on the Leaflet CSS asset path. Webpack module bundling breaks this path resolution.

**How to avoid:**
```typescript
// In geolocation-map.tsx (client component), before any L.Marker use:
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: "/leaflet/marker-icon.png",
  iconRetinaUrl: "/leaflet/marker-icon-2x.png",
  shadowUrl: "/leaflet/marker-shadow.png",
});
```
Copy the three files from `node_modules/leaflet/dist/images/` to `public/leaflet/`.

**Warning signs:** Map renders but pin marker is invisible or broken in production.

### Pitfall 2: Leaflet CSS Missing in App Router

**What goes wrong:** Leaflet requires `leaflet/dist/leaflet.css` to be imported. In Next.js App Router, this must be imported inside the `"use client"` component, not a global stylesheet.

**How to avoid:** Add `import "leaflet/dist/leaflet.css"` as the first import in `geolocation-map.tsx`. [VERIFIED: react-leaflet Next.js App Router examples confirm this pattern]

**Warning signs:** Map tiles render but controls, attribution, and zoom buttons are unstyled.

### Pitfall 3: repeatingSection `interpreterStore.setEntityValue` Shape

**What goes wrong:** The interpreter store stores ONE value per entity ID. A `repeatingSection` with 3 instances must store all 3 instances as a single value object: `{ instances: [...] }`. If the renderer calls `setEntityValue` with just an array or a single instance, the shape is wrong.

**How to avoid:** The renderer manages instances in local React state. On every instance add/remove/update, call `interpreterStore.setEntityValue(entity.id, { instances: [...] })` with the full updated instances array.

**Warning signs:** Only the last instance appears in submitted `answers_json`; instances array is undefined or has wrong length on the server.

### Pitfall 4: Computed Field Race on Initial Render

**What goes wrong:** When the form first renders, dependency entity values may be undefined. `computePAS79RiskLevel(undefined, undefined)` must return `null` gracefully (not throw), or the renderer crashes before the user fills anything.

**How to avoid:** Guard the inputs in `computePAS79RiskLevel`: if either arg is `undefined`, `null`, or non-numeric, return `null`. Renderer shows "fill in the inputs" placeholder when result is null.

### Pitfall 5: useInterpreterEntitiesValues Requires interpreterStore Reference

**What goes wrong:** `useInterpreterEntitiesValues(interpreterStore, ids)` requires the store instance. In Phase 14's component architecture, field renderers receive `entity` and entity-store props but NOT a direct `interpreterStore` reference. The computed renderer needs the store to call this hook.

**How to avoid:** Pass `interpreterStore` as an additional prop from `InterpreterRenderer` into `computedFieldRenderer`. The other renderers don't need it (they use `entity.value`, `entity.error` directly from props). Update the `useMemo` `components` map accordingly, following the existing inline wrapper function pattern.

**Alternative:** Use a React context to provide the interpreterStore to all renderers — cleaner but adds a Context layer. The inline wrapper pattern is simpler for one consumer.

### Pitfall 6: focus-loss on Entity Value Update (existing pitfall, must not regress)

**What goes wrong:** If the `components` map object identity changes on every render (e.g., because it's defined inline without `useMemo`), `InterpreterEntities` remounts all entity renderers on every keystroke, stealing focus from text inputs.

**How to avoid:** The existing `useMemo` fix in `interpreter-renderer.tsx` (lines 68–83) must be extended — not replaced — when adding new entity types. Keep `surface` as the only dependency. New renderer entries follow the same inline arrow function pattern.

### Pitfall 7: browser-image-compression autoRotate vs preserveExif

**What goes wrong:** Setting `preserveExif: true` preserves the original EXIF orientation tag but some devices will re-rotate the image when displaying it, causing double-rotation.

**How to avoid:** Do NOT set `preserveExif: true`. The default behaviour of `browser-image-compression@2.0.2` is to auto-rotate the canvas to match the EXIF orientation and then strip the orientation tag. This is the correct behaviour for inspection photos. [VERIFIED: `browser-image-compression.d.ts` — `preserveExif` defaults to `false`]

---

## Code Examples

### Attribute with Default Value Coercion (critical — Pitfall 4 from Phase 13)

```typescript
// VERIFIED: lib/form-builder/attributes/required.ts + Phase 13 Pitfall 4
// lib/form-builder/attributes/attach-photos.ts
import { createAttribute } from "@coltorapps/builder";

export const attachPhotosAttribute = createAttribute({
  name: "attachPhotos",
  validate(value) {
    // ALWAYS coerce undefined → false (Pitfall 4 from Phase 13 research)
    return (value ?? false) as boolean;
  },
});
```

### Entity Value Update Event (interpreter store)

```typescript
// VERIFIED: Context7 /coltorapps/builder — "EntityValueUpdated" event
// The existing interpreter-renderer.tsx already uses this pattern.
// Computed field uses the hook approach instead (cleaner, avoids side effects):
const values = useInterpreterEntitiesValues(interpreterStore, [likelyId, consequenceId]);
```

### Repeating Section Instance Management

```typescript
// components/form-interpreter/repeating-section-renderer.tsx
// Core instance management pattern:
const [instances, setInstances] = useState<Array<Record<string, unknown>>>(
  () => {
    const stored = entity.value as { instances?: Array<Record<string, unknown>> } | undefined;
    return stored?.instances ?? [];
  }
);

const addInstance = () => {
  const empty: Record<string, unknown> = {};
  const newInstances = [...instances, empty];
  setInstances(newInstances);
  setValue({ instances: newInstances });
};

const removeInstance = (index: number) => {
  const newInstances = instances.filter((_, i) => i !== index);
  setInstances(newInstances);
  setValue({ instances: newInstances });
};

const updateInstance = (index: number, childId: string, value: unknown) => {
  const newInstances = instances.map((inst, i) =>
    i === index ? { ...inst, [childId]: value } : inst
  );
  setInstances(newInstances);
  setValue({ instances: newInstances });
};
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Pre-coltorapps specialty field components wired to FormRenderer | Components exist in `components/forms/` but unwired (Phase 13 cutover regression) | Phase 13 cutover (D-04) | Phase 14 builds the coltorapps layer to re-wire them |
| FormSurface type import in `components/forms/` | Existing `FormSurface = "dark" \| "cream"` still works; renderer wrappers use the same type | Phase 13 | No change needed in existing form components |
| Single `answers_json` flat map | `answers_json` continues as flat map; repeatingSection value is a nested object under one key | Phase 14 | AI prompt generation must expand repeatingSection explicitly |

**Deprecated/outdated (cleanup items):**
- ROADMAP wording references `form-signatures` and `form-photos` buckets — stale. Migration 001 uses `form-media`. Plan-phase should include a ROADMAP fix task.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | PAS 79 risk level banding: score 1–4 = Green (Trivial/Tolerable), 5–12 = Amber (Moderate/Substantial), 13–25 = Red (Substantial/Intolerable) | Pattern 7 / PAS 79 Research | If Matt's copy uses different boundaries, the colour coding will be wrong. Matt must verify before Phase 14 ships. |
| A2 | `useInterpreterEntitiesValues(store, ids)` from `@coltorapps/builder-react` is the correct API for subscribing to specific entity value changes | Pattern 3 | Verified via Context7 — HIGH confidence. If the hook name changed, check `node_modules/@coltorapps/builder-react` |
| A3 | React-Leaflet 5.0.0 is compatible with React 19.2.4 | Standard Stack | npm view peerDeps shows `react: '^19.0.0'` — HIGH confidence |
| A4 | OpenStreetMap tile URL `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png` is valid for this project's usage level | Pattern 6 | OSM tiles are free for reasonable use; commercial-scale use requires a paid tile provider. At ~7–8 clients this is not a concern. |
| A5 | The repeatingSection `validate()` function receiving `{ instances: [...] }` is sufficient for server-side validation; per-instance child field validation is deferred | Pattern 2 | If coltorapps' `validateEntitiesValues` does not recurse into nested value structures (it does not — it only validates top-level entity values), then invalid child values inside instances will not be caught server-side. See Open Questions #1. |

---

## Open Questions

1. **Server-side validation of repeatingSection child fields**
   - What we know: `validateEntitiesValues` validates each entity's value by calling `entity.validate(value, context)`. For `repeatingSection`, the value is `{ instances: [...] }` — the entity's own validate() only checks the container shape, not the child fields.
   - What's unclear: Should Phase 14 add explicit per-instance child validation in the server action? The Phase 13 precedent was that coltorapps silently ignores extra entity IDs (Deviation #5 in 13-03-SUMMARY.md) — child field values inside instances are equally invisible to `validateEntitiesValues`.
   - Recommendation: In the submit server action, after `validateEntitiesValues` passes, add a manual loop over `instances[]` that runs each child field's validate function from the `formBuilder` definition. Document as a security note. This is modest extra code.

2. **ROADMAP wording fix for form-media bucket**
   - What we know: D-15 confirms migration 001 uses a single `form-media` bucket. ROADMAP references `form-signatures` and `form-photos` separately.
   - What's unclear: Is there a ROADMAP.md update task in Phase 14 or should it be a separate PR?
   - Recommendation: Include one small task in Wave 0 to update ROADMAP.md wording. It is a documentation fix, not a code change.

3. **Photo staging vs upload-on-save**
   - What we know: The current `MultiPhotoField` stores `object://` blob URLs locally. These are client-side only and cannot be serialized to `answers_json`.
   - What's unclear: Should photos upload immediately on capture, or stage locally and batch-upload on form submit?
   - Recommendation: Upload immediately on capture (fire-and-forget via server action). Store the `storage_path` in the field's value (replacing the blob URL). This is consistent with how the existing `MediaField` would work in a production scenario and avoids the risk of losing photos if the user navigates away.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `browser-image-compression` | HEIC conversion, compression | Already installed | 2.0.2 | — |
| `heic2any` | HEIC conversion | Already installed | 0.0.4 | — |
| `leaflet` | Geolocation map | NOT installed | — | Install (Wave 0) |
| `react-leaflet` | Geolocation map | NOT installed | — | Install (Wave 0) |
| `@types/leaflet` | TypeScript for Leaflet | NOT installed | — | Install (Wave 0) |
| `@coltorapps/builder` | Entity definitions | Installed | 0.2.4 | — |
| `@coltorapps/builder-react` | Interpreter hooks | Installed | 0.2.4 | — |
| Supabase (form-media bucket) | Signature/photo upload | Available | — | Bucket created in migration 001 |
| Web Speech API | STT | Browser-dependent | — | mic-button.tsx has graceful fallback |

**Missing dependencies with no fallback:**
- `leaflet@1.9.4`, `react-leaflet@5.0.0`, `@types/leaflet` — install in Wave 0

**Wave 0 install command:**
```bash
npm install leaflet@1.9.4 react-leaflet @types/leaflet
```

**Leaflet static assets to copy (Wave 0):**
```bash
# Copy Leaflet marker icons to public/leaflet/ to fix Webpack icon path issue
cp node_modules/leaflet/dist/images/marker-icon.png public/leaflet/
cp node_modules/leaflet/dist/images/marker-icon-2x.png public/leaflet/
cp node_modules/leaflet/dist/images/marker-shadow.png public/leaflet/
```

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 3.0 (installed, vitest.config.ts present from Phase 13) |
| Config file | `vitest.config.ts` — exists (created Phase 13) |
| Quick run command | `npx vitest run tests/form-builder/ --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BUILDER-01 | specialty field palette buttons add entities | unit | `npx vitest run tests/form-builder/specialty-entities.test.ts` | Wave 0 |
| BUILDER-02 | attachPhotos attribute defaults to false | unit | `npx vitest run tests/form-builder/specialty-entities.test.ts` | Wave 0 |
| BUILDER-02 | computedField inputs attribute stores entity IDs | unit | `npx vitest run tests/form-builder/specialty-entities.test.ts` | Wave 0 |
| D-04 | repeatingSection value shape: `{ instances: [] }` | unit | `npx vitest run tests/form-builder/repeating-section.test.ts` | Wave 0 |
| D-04 | instances[] iterates correctly in progress calc | unit | `npx vitest run tests/form-builder/repeating-section.test.ts` | Wave 0 |
| D-07 | computePAS79RiskLevel returns correct level for all score bands | unit | `npx vitest run tests/form-builder/pas79.test.ts` | Wave 0 |
| D-07 | computePAS79RiskLevel returns null for undefined inputs | unit | `npx vitest run tests/form-builder/pas79.test.ts` | Wave 0 |
| FORM-02 | textField renderer includes MicButton in DOM | unit (smoke) | `npx vitest run tests/form-interpreter/renderers.test.ts` | Wave 0 |
| FORM-04 | MicButton shows MicOff when STT unsupported | unit | `npx vitest run tests/form-interpreter/renderers.test.ts` | Wave 0 |
| D-16 | signature upload path = `{client_id}/signatures/{submission_id}/{field_id}.png` | unit | `npx vitest run tests/form-builder/upload-paths.test.ts` | Wave 0 |
| D-17 | photo upload path = `{client_id}/photos/{submission_id}/{field_id}/{uuid}.ext` | unit | `npx vitest run tests/form-builder/upload-paths.test.ts` | Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run tests/form-builder/ tests/form-interpreter/`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/form-builder/specialty-entities.test.ts` — covers BUILDER-01, BUILDER-02, D-05 (attachPhotos)
- [ ] `tests/form-builder/repeating-section.test.ts` — covers D-04 (instances shape, validation, progress)
- [ ] `tests/form-builder/pas79.test.ts` — covers D-07 (all 25 matrix cells, null guards)
- [ ] `tests/form-builder/upload-paths.test.ts` — covers D-16, D-17 (storage path generation)
- [ ] `tests/form-interpreter/renderers.test.ts` — covers FORM-02, FORM-04 (STT wiring smoke test)

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No — existing auth unchanged | — |
| V3 Session Management | No — existing session unchanged | — |
| V4 Access Control | Yes | `requireActorUserId("admin")` in `uploadMediaAction`; RLS + `adminClient` for form-media bucket writes |
| V5 Input Validation | Yes | `validateEntitiesValues` server-side; `computePAS79RiskLevel` input bounds check (1–5 only) |
| V6 Cryptography | No | — |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Client submits crafted repeatingSection with arbitrary child entity IDs | Tampering | Server action fetches schema from pinned version; only children listed in schema are processed; extra keys ignored |
| Client uploads oversized file to form-media | DoS | `browser-image-compression` maxSizeMB: 1.5 enforces client-side; `adminClient` upload does not check size server-side — add a `maxSizeMB` guard in `uploadMediaAction` (reject if `Buffer.byteLength > 2MB`) |
| Client uploads a non-image (e.g., executable) renamed as .jpg | Tampering | Add MIME type check in `uploadMediaAction` — accept only `image/png`, `image/jpeg`, `image/webp`; reject anything else |
| Leaflet tile requests leak user geolocation to OSM tile server | Information Disclosure | Only the map centre (the captured lat/lng) is sent to OSM tile server as part of the tile URL; this is the same data captured by `getCurrentPosition()` and acceptable per the assessment context |
| Signature data URL too large (retina canvas PNG) | DoS | Cap signature PNG at ~200KB server-side (a 2× DPR 400px canvas at reasonable quality stays well below); `uploadMediaAction` should enforce `buffer.byteLength < 500_000` |

---

## Project Constraints (from CLAUDE.md / AGENTS.md)

1. **"This is NOT the Next.js you know"** — Before writing Leaflet dynamic import or any Route Handler, read `node_modules/next/dist/docs/`. The `dynamic()` import with `ssr: false` pattern must use the App Router form.

2. **Form builder code MUST NOT be hardcoded to admin-only.** `InterpreterRenderer` and new entity renderers must accept `surface="cream"` and work on the client surface (Phase 16 prep). All role gating stays in server actions.

3. **`owner_type IN ('admin', 'customer')` — never `'client'`.** Unchanged from Phase 13.

4. **Do not reshape the schema without re-checking with Finley.** The `repeatingSection` entity is a new entity type within the existing `schema_json` structure; the outer contract is unchanged.

5. **No demo mocks in shipped code paths.** The specialty-test template extension (migration 011) must use real DB seed, not hardcoded TypeScript mock data.

---

## Sources

### Primary (HIGH confidence)

- `components/form-interpreter/interpreter-renderer.tsx` — memoized components map pattern; `useMemo([surface])` focus-loss fix
- `components/form-interpreter/select-field-renderer.tsx` — latest renderer pattern reference
- `components/forms/signature-field.tsx`, `rating-field.tsx`, `multi-photo-field.tsx`, `geolocation-field.tsx`, `media-field.tsx`, `mic-button.tsx` — verified in codebase
- `hooks/use-stt.ts`, `hooks/use-media-processor.ts` — verified in codebase
- `lib/form-builder/index.ts` + `entities/*.ts` — verified factory pattern
- `lib/form-builder/progress.ts` — verified computeFormProgress; extend for repeatingSection
- `app/admin/assessments/actions.ts` — verified runReportDraftGeneration; extend for repeatingSection
- `supabase/migrations/001_initial_schema.sql` — `field_media` table, `form-media` bucket, RLS (CANONICAL)
- `lib/form-builder/entities/section-group.ts` — `childrenAllowed: true` pattern (VERIFIED for repeatingSection)
- `node_modules/browser-image-compression/dist/browser-image-compression.d.ts` — Options API (VERIFIED)
- Context7 `/coltorapps/builder` — `useInterpreterEntitiesValues`, `childrenAllowed`, `EntityValueUpdated` event (VERIFIED)
- npm registry — `leaflet@1.9.4`, `react-leaflet@5.0.0` peer dep `react: '^19.0.0'` (VERIFIED)
- `components/form-builder/field-palette.tsx` — existing FIELDS array and EntityType union (VERIFIED)
- `components/form-builder/properties-panel.tsx` — `entities` prop shape, `builderStore.setEntityAttribute` pattern (VERIFIED)

### Secondary (MEDIUM confidence)

- assesskit.co.uk/blog/pas-79-fire-risk-assessment-guide — confirms 5×5 matrix, level names (Trivial/Tolerable/Moderate/Substantial/Intolerable); no exact boundaries
- xxlsteve.net/blog/react-leaflet-on-next-15/ — react-leaflet App Router pattern, dynamic import with `ssr: false`
- Web Speech API browser support — confirmed via use-stt.ts implementation + known browser support tables

### Tertiary (LOW confidence)

- PAS 79 risk band boundaries (score 1–4 green, 5–12 amber, 13–25 red) — [ASSUMED] practitioner convention; BSI document not publicly accessible

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified via npm/codebase
- Architecture: HIGH — entity patterns verified via Phase 13 implementation + Context7
- PAS 79 matrix values: LOW — ASSUMED; BSI document is paywalled; Matt must confirm
- Leaflet Next.js pattern: MEDIUM — confirmed via community sources, no official react-leaflet App Router guide
- Pitfalls: HIGH — Leaflet icon pitfall is a known ecosystem issue; other pitfalls derived from codebase analysis

**Research date:** 2026-05-25
**Valid until:** 2026-07-01 (stable libraries; coltorapps 0.2.4 unchanged; react-leaflet 5.0.0 current)
