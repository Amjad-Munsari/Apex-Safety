# Phase 14: Custom Field Types - Pattern Map

**Mapped:** 2026-05-25
**Files analyzed:** 28 new/modified files
**Analogs found:** 26 / 28 (2 net-new: Leaflet map, PAS 79 utility)

Phase 14 is overwhelmingly a wiring phase that extends Phase 13 patterns. Every entity, attribute, renderer, palette/properties edit, and storage helper has a direct Phase 13 analog. The only genuinely net-new shapes are (a) the Leaflet map sub-component and (b) the pure PAS 79 utility — and both are isolated.

---

## File Classification

### New entity files (lib/form-builder/entities/)

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `lib/form-builder/entities/signature-field.ts` | entity | transform | `lib/form-builder/entities/checkbox-field.ts` | role-match (simple validate) |
| `lib/form-builder/entities/rating-field.ts` | entity | transform | `lib/form-builder/entities/select-field.ts` | role-match (numeric vs string validation) |
| `lib/form-builder/entities/multi-photo-field.ts` | entity | transform | `lib/form-builder/entities/select-field.ts` (allowMultiple) | role-match (array value) |
| `lib/form-builder/entities/geolocation-field.ts` | entity | transform | `lib/form-builder/entities/checkbox-field.ts` | role-match (object value) |
| `lib/form-builder/entities/computed-field.ts` | entity | transform | `lib/form-builder/entities/section-group.ts` (no value validation) | role-match (read-only container-ish) |
| `lib/form-builder/entities/repeating-section.ts` | entity (container) | transform | `lib/form-builder/entities/section-group.ts` | exact (childrenAllowed: true) |

### New attribute files (lib/form-builder/attributes/)

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `lib/form-builder/attributes/attach-photos.ts` | attribute | transform | `lib/form-builder/attributes/required.ts` | exact (boolean default-false coercion) |
| `lib/form-builder/attributes/max-rating.ts` | attribute | transform | `lib/form-builder/attributes/required.ts` | role-match (numeric default) |
| `lib/form-builder/attributes/max-photos.ts` | attribute | transform | `lib/form-builder/attributes/required.ts` | role-match (numeric default) |
| `lib/form-builder/attributes/formula.ts` | attribute | transform | `lib/form-builder/attributes/prefill-source.ts` | exact (string enum) |
| `lib/form-builder/attributes/computed-inputs.ts` | attribute | transform | `lib/form-builder/attributes/options.ts` | role-match (object value with shape check) |
| `lib/form-builder/attributes/min-instances.ts` | attribute | transform | `lib/form-builder/attributes/required.ts` | role-match (numeric default 0) |
| `lib/form-builder/attributes/max-instances.ts` | attribute | transform | `lib/form-builder/attributes/required.ts` | role-match (numeric default undefined = unlimited) |

### New renderer files (components/form-interpreter/)

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `components/form-interpreter/signature-field-renderer.tsx` | component | client fill + upload | `components/form-interpreter/select-field-renderer.tsx` | role-match (wraps existing UI) |
| `components/form-interpreter/rating-field-renderer.tsx` | component | client fill | `components/form-interpreter/select-field-renderer.tsx` | role-match |
| `components/form-interpreter/multi-photo-field-renderer.tsx` | component | client fill + upload | `components/form-interpreter/select-field-renderer.tsx` (allowMultiple branch) | role-match |
| `components/form-interpreter/geolocation-field-renderer.tsx` | component | client fill + map | `components/form-interpreter/select-field-renderer.tsx` | role-match (wraps existing + dynamic map) |
| `components/form-interpreter/computed-field-renderer.tsx` | component | derived/read-only | `components/form-interpreter/section-group-renderer.tsx` | role-match (no setValue, no input) |
| `components/form-interpreter/repeating-section-renderer.tsx` | component | client fill (nested state) | `components/form-interpreter/section-group-renderer.tsx` | role-match (container, but local instance state) |
| `components/form-interpreter/attach-photos-affordance.tsx` | component | client fill + upload | `components/forms/media-field.tsx` | role-match (lifted into per-field strip) |
| `components/form-interpreter/geolocation-map.tsx` | component | render-only | NO ANALOG | net-new (Leaflet dynamic import) |

### Universal renderer touchpoints (MODIFIED)

| Modified File | Role | Data Flow | Change | Analog for the change |
|---------------|------|-----------|--------|----------------------|
| `components/form-interpreter/interpreter-renderer.tsx` | component | request-response | Add 6 entries to `components` useMemo map (mind focus-loss); add `clientId` prop | self (lines 68–83) |
| `components/form-interpreter/text-field-renderer.tsx` | component | client fill | Inline `<MicButton>` inside relative input wrapper | `components/forms/mic-button.tsx` positioning + `select-field-renderer.tsx` structure |
| `components/form-interpreter/textarea-field-renderer.tsx` | component | client fill | Inline `<MicButton>` bottom-right inside textarea wrapper | same as above |
| All 6 new renderers + text/textarea/number/date/select/checkbox | component | client fill + upload | When `attrs.attachPhotos === true`, render `<AttachPhotosAffordance>` at bottom | self-defined affordance |

### Builder UI extensions (MODIFIED)

| Modified File | Role | Data Flow | Change | Analog |
|---------------|------|-----------|--------|--------|
| `components/form-builder/field-palette.tsx` | component | admin builder | Expand `EntityType` union (+6), split FIELDS into Basic/Specialty sections | self (lines 31–39 FIELDS array) |
| `components/form-builder/properties-panel.tsx` | component | admin builder | Add per-type attribute editors; add universal `attachPhotos` toggle; add computed-input dropdowns; add min/max instance inputs | self (lines 199–411) |
| `lib/form-builder/index.ts` | config | transform | Register 6 new entities in `createBuilder({ entities: [...] })` | self (lines 1–22) |

### Storage / pipeline / utility

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `lib/form-builder/risk/pas79.ts` | utility (pure) | transform | NO ANALOG (no risk-formula module exists) | net-new — pure function |
| `lib/form-builder/storage/upload-media.ts` (or inline in actions.ts) | service | client fill → storage | `app/admin/assessments/actions.ts → finalizeReport` (lines 432–443) | role-match (adminClient.storage.upload) |

### Server action changes (MODIFIED)

| Modified File | Role | Data Flow | Change | Analog |
|---------------|------|-----------|--------|--------|
| `app/admin/assessments/actions.ts` → `uploadMediaAction` (new) | service | upload + DB insert | NEW server action: requireActorUserId, decode base64/Buffer, `adminClient.storage.from('form-media').upload(...)`, insert `field_media` row | `finalizeReport` lines 432–457 |
| `app/admin/assessments/actions.ts` → `runReportDraftGeneration` (modify) | service | AI report | Before prompt JSON.stringify, fetch pinned schema and run `expandRepeatingSections(schema, answers)` to flatten `instances[]` for prompt | self (lines 302–368); RESEARCH Pattern 10 |

### Progress + AI pipeline extension

| Modified File | Role | Data Flow | Change | Analog |
|---------------|------|-----------|--------|--------|
| `lib/form-builder/progress.ts` | utility (pure) | transform | Extend `computeFormProgress` so `repeatingSection` with `minInstances > 0` counts as required, and is "filled" only when `instances.length >= minInstances` and each required child in each instance is filled | self (lines 34–47) |

### Migration / seed

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `supabase/migrations/011_specialty_smoke_test_template.sql` | migration | batch | `supabase/migrations/010_form_builder_foundation_reseed.sql` | role-match (template + version insert pattern) |

### Tests (NEW)

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `tests/form-builder/specialty-entities.test.ts` | test | unit | `tests/form-builder/entities.test.ts` | exact |
| `tests/form-builder/repeating-section.test.ts` | test | unit | `tests/form-builder/section-reparent.spike.test.ts` | role-match |
| `tests/form-builder/pas79.test.ts` | test | unit | NO ANALOG | net-new pure-fn test |
| `tests/form-builder/upload-paths.test.ts` | test | unit | NO ANALOG | net-new string assertions |
| `tests/form-interpreter/renderers.test.ts` | test | unit (smoke) | NO ANALOG (no existing interpreter render test) | net-new |

### Documentation (carry-forward fix)

| Modified File | Role | Change |
|---------------|------|--------|
| `.planning/ROADMAP.md` (or equivalent) | docs | Fix stale `form-signatures` / `form-photos` wording to `form-media` (D-15) |

---

## Pattern Assignments

### `lib/form-builder/entities/repeating-section.ts` (entity, container)

**Analog:** `lib/form-builder/entities/section-group.ts` — exact pattern. The ONLY container entity in the codebase; copy `childrenAllowed: true` and the no-op `validate()`.

**Full file to copy from** (`lib/form-builder/entities/section-group.ts` lines 1–19):
```typescript
import { createEntity } from "@coltorapps/builder";
import { sectionTitleAttribute } from "../attributes/section-title";
import { sectionDescriptionAttribute } from "../attributes/section-description";

export const sectionGroupEntity = createEntity({
  name: "sectionGroup",
  attributes: [
    sectionTitleAttribute,
    sectionDescriptionAttribute,
  ],
  // childrenAllowed: true marks this as a container entity.
  // Without this flag, setEntityParent() will throw "Child is not allowed."
  childrenAllowed: true,
  validate(value) {
    // Container entity — children validate themselves.
    return value;
  },
});
```

**Differences for `repeating-section.ts`:**
- Add `minInstancesAttribute`, `maxInstancesAttribute` to attribute list.
- `validate(value)` must return `{ instances: [] }` when value is undefined and assert `Array.isArray(value.instances)` otherwise (per RESEARCH.md Pattern 2 / Pitfall 3 — the instances shape).
- Keep `childrenAllowed: true`. The "children" listed in the schema are the **template** entities; their **values** live inside each instance object, not in the interpreter store.

---

### `lib/form-builder/entities/rating-field.ts` (entity, transform)

**Analog:** `lib/form-builder/entities/select-field.ts` — same shape (required + label + value validation that throws on out-of-range)

**Validate() pattern to copy** (`lib/form-builder/entities/select-field.ts` lines 15–42, simplified):
```typescript
validate(value, context) {
  const isRequired = context.entity.attributes.required ?? false;
  const label = context.entity.attributes.label ?? "This field";
  // [domain-specific bounds read from attributes]
  if (isRequired && (value === undefined || value === null || value === "")) {
    throw new Error(`${label} is required.`);
  }
  if (value !== undefined && value !== null) {
    // [domain check — throw on invalid]
  }
  return value;
}
```

**Pattern for rating** (from RESEARCH.md Pattern 1): coerce `Number(value)`, check `Number.isInteger`, range `[1, max]`. Attach `attachPhotosAttribute` alongside.

---

### `lib/form-builder/entities/signature-field.ts` (entity, transform)

**Analog:** `lib/form-builder/entities/checkbox-field.ts` lines 1–24 — minimal validator, label + required + one type-specific attribute

**Validate pattern** (signature value is the storage path string after upload):
```typescript
validate(value, context) {
  const isRequired = context.entity.attributes.required ?? false;
  const label = context.entity.attributes.label ?? "Signature";
  if (isRequired && (!value || (typeof value === "string" && value.trim().length === 0))) {
    throw new Error(`${label} is required.`);
  }
  if (value !== undefined && value !== null && typeof value !== "string") {
    throw new Error(`${label} must be a storage path string.`);
  }
  return value;
}
```

Attach `attachPhotosAttribute` (yes — even signatures can attach context photos).

---

### `lib/form-builder/entities/multi-photo-field.ts` (entity, transform)

**Analog:** `lib/form-builder/entities/select-field.ts` allowMultiple branch (lines 25–34)

Value is `string[]` (storage paths). Check `Array.isArray(value)`, validate min/max length against `attrs.maxPhotos`.

---

### `lib/form-builder/entities/geolocation-field.ts` (entity, transform)

**Analog:** `lib/form-builder/entities/checkbox-field.ts` (minimal validator) + custom shape check.

Value shape: `{ lat: number; lng: number; accuracy: number; capturedAt: string }`. Required gate when value missing; shape check on lat/lng numeric ranges.

---

### `lib/form-builder/entities/computed-field.ts` (entity, transform)

**Analog:** `lib/form-builder/entities/section-group.ts` lines 14–17 — no-op `validate()` because the field is read-only (renderer computes it, server doesn't accept user-supplied value for it).

```typescript
validate(value) {
  // Computed: value is derived in renderer, never user-supplied.
  // Server may store the latest computed result for prompt context, or strip.
  return value;
}
```

Attach `formulaAttribute` + `computedInputsAttribute` + `labelAttribute`. Do NOT attach `requiredAttribute` (a computed field is always implicitly "filled" once both inputs are set, and the renderer guards display).

---

### `lib/form-builder/attributes/attach-photos.ts` (attribute, transform)

**Analog:** `lib/form-builder/attributes/required.ts` lines 1–11 — exact shape (boolean default-false coercion)

**Full file to copy from** (`lib/form-builder/attributes/required.ts`):
```typescript
import { createAttribute } from "@coltorapps/builder";

export const requiredAttribute = createAttribute({
  name: "required",
  validate(value) {
    if (value === undefined || value === null) {
      return false;
    }
    return Boolean(value);
  },
});
```

**Change for `attach-photos.ts`:** rename `name` to `"attachPhotos"`. Same body.

---

### `lib/form-builder/attributes/formula.ts` (attribute, transform)

**Analog:** `lib/form-builder/attributes/prefill-source.ts` lines 1–19 — exact shape (string enum with whitelist + default-empty)

**Full file to copy from** (`lib/form-builder/attributes/prefill-source.ts`):
```typescript
import { createAttribute } from "@coltorapps/builder";

const VALID_PREFILL_SOURCES = ["", "currentUserName", "currentDate", "none"] as const;
type PrefillSource = (typeof VALID_PREFILL_SOURCES)[number];

export const prefillSourceAttribute = createAttribute({
  name: "prefillSource",
  validate(value) {
    if (value === undefined || value === null) {
      return "" as PrefillSource;
    }
    if (!VALID_PREFILL_SOURCES.includes(value as PrefillSource)) {
      throw new Error(`Invalid prefill source "${value}". Must be one of: ...`);
    }
    return value as PrefillSource;
  },
});
```

**Change for `formula.ts`:** rename, set valid list to `["pas79"]` (D-08), default `"pas79"`.

---

### `lib/form-builder/attributes/computed-inputs.ts` (attribute, transform)

**Analog:** `lib/form-builder/attributes/options.ts` lines 1–19 — array/object attribute with shape check

**Full file to copy from** (`lib/form-builder/attributes/options.ts`):
```typescript
import { createAttribute } from "@coltorapps/builder";

export interface SelectOption {
  value: string;
  label: string;
}

export const optionsAttribute = createAttribute({
  name: "options",
  validate(value) {
    if (value === undefined || value === null) {
      return [] as SelectOption[];
    }
    if (!Array.isArray(value)) {
      throw new Error("Options must be an array.");
    }
    return value as SelectOption[];
  },
});
```

**Change for `computed-inputs.ts`:** validate shape `{ likelihood?: string; consequence?: string }`. Default to `{ likelihood: "", consequence: "" }`.

---

### `lib/form-builder/attributes/min-instances.ts` / `max-instances.ts` / `max-rating.ts` / `max-photos.ts` (numeric attributes)

**Analog:** `lib/form-builder/attributes/required.ts` lines 1–11 — same default-coerce shape; substitute `Number()` and bounds check

**Pattern:**
```typescript
import { createAttribute } from "@coltorapps/builder";

export const minInstancesAttribute = createAttribute({
  name: "minInstances",
  validate(value) {
    if (value === undefined || value === null) return 0;
    const n = Number(value);
    if (!Number.isInteger(n) || n < 0) throw new Error("minInstances must be a non-negative integer.");
    return n;
  },
});
```

`maxInstances` default `undefined` (= unlimited per UI-SPEC); `maxRating` default `5`; `maxPhotos` default `5`.

---

### `lib/form-builder/index.ts` (config, transform) — MODIFIED

**Analog:** self, lines 1–22

**Existing pattern:**
```typescript
import { createBuilder } from "@coltorapps/builder";
import type { Schema } from "@coltorapps/builder";
import { textFieldEntity } from "./entities/text-field";
// ... 6 more
import { sectionGroupEntity } from "./entities/section-group";

export const formBuilder = createBuilder({
  entities: [
    textFieldEntity, numberFieldEntity, dateFieldEntity,
    selectFieldEntity, textareaFieldEntity, checkboxFieldEntity,
    sectionGroupEntity,
  ],
});

export type FormBuilderSchema = Schema<typeof formBuilder>;
```

**Change:** Add 6 imports + 6 entries to the `entities` array. Order: keep basics first, then specialty (matches palette section order in UI-SPEC).

---

### `components/form-interpreter/signature-field-renderer.tsx` (component, fill + upload)

**Analog:** `components/form-interpreter/select-field-renderer.tsx` (lines 1–129) for prop/surface scaffolding; `components/forms/signature-field.tsx` for the underlying canvas.

**Imports + Props pattern to copy** (`select-field-renderer.tsx` lines 1–17):
```typescript
"use client"
import { cn } from "@/lib/utils"
import type { EntityComponentProps } from "@coltorapps/builder-react"
import type { signatureFieldEntity } from "@/lib/form-builder/entities/signature-field"

type Props = EntityComponentProps<typeof signatureFieldEntity> & {
  surface?: "dark" | "cream"
  // Phase 14 addition: clientId + submissionId needed for upload pathing
  clientId: string
  submissionId: string
}
```

**Surface tokens to copy** (`select-field-renderer.tsx` lines 18–39): two-key `{ dark, cream }` object with `label`, `required`, `helpText`, `error` keys at minimum.

**Renderer shell** (`select-field-renderer.tsx` lines 41–47, 62–95):
```tsx
export function SignatureFieldRenderer({ entity, setValue, surface = "cream", clientId, submissionId }: Props) {
  const t = surfaceTokens[surface]
  const attrs = entity.attributes
  const error = entity.error ? String(entity.error) : undefined

  return (
    <div className="flex flex-col gap-1.5">
      <label className={cn("text-sm font-semibold", t.label)}>
        {attrs.label}
        {attrs.required && <span className={cn("ml-1", t.required)}>*</span>}
      </label>
      {/* SignatureField wrapper — on "Done", call uploadMediaAction then setValue(storagePath) */}
      <SignatureField
        value={localPreview}
        onChange={async (dataUrl) => {
          if (!dataUrl) { setValue(undefined); return; }
          try {
            setIsUploading(true);
            const path = await uploadMediaAction(submissionId, entity.id, dataUrl, "image", clientId);
            setValue(path);
          } catch { toast.error("Failed to save signature. Try again."); }
          finally { setIsUploading(false); }
        }}
        surface={surface}
      />
      {error && <p className={cn("text-xs", t.error)}>{error}</p>}
      {attrs.attachPhotos && <AttachPhotosAffordance ... />}
    </div>
  )
}
```

---

### `components/form-interpreter/rating-field-renderer.tsx` (component, fill)

**Analog:** `components/form-interpreter/select-field-renderer.tsx` — copy structure; swap inner `<Select>` for the existing `<RatingField>` from `components/forms/rating-field.tsx`.

Same imports/Props/surfaceTokens scaffold as signature. Read `attrs.maxRating ?? 5`, render star row, call `setValue(starN)` on click. If `attrs.attachPhotos`, render `<AttachPhotosAffordance>` at the bottom.

---

### `components/form-interpreter/multi-photo-field-renderer.tsx` (component, fill + upload)

**Analog:** `components/form-interpreter/select-field-renderer.tsx` allowMultiple branch (lines 48–96) for the "array value + per-item state" shape; `components/forms/media-field.tsx` for the photo grid UI.

Value: `string[]` (storage paths). Each capture flows through `useMediaProcessor()` (existing hook in `hooks/use-media-processor.ts`), then `uploadMediaAction(submissionId, entityId, dataUrl, "image", clientId)` per RESEARCH Pattern 5. On success, append the returned path to the value array.

---

### `components/form-interpreter/geolocation-field-renderer.tsx` (component, fill + map)

**Analog:** `components/form-interpreter/select-field-renderer.tsx` for scaffold; existing `components/forms/geolocation-field.tsx` for capture panel; NEW `geolocation-map.tsx` for Leaflet preview.

**Dynamic-import pattern** (from RESEARCH Pattern 6 — required because Leaflet is window-only):
```typescript
import dynamic from "next/dynamic";
const GeoMap = dynamic(() => import("./geolocation-map"), { ssr: false });
```

Capture flow per D-11/D-12: call `navigator.geolocation.getCurrentPosition` on every device, show desktop-accuracy badge when `accuracy > 100m` or non-mobile UA. Read-only marker; map click fires `onClickPin(lat, lng)` and updates the value.

---

### `components/form-interpreter/computed-field-renderer.tsx` (component, derived/read-only)

**Analog:** `components/form-interpreter/section-group-renderer.tsx` for "no setValue" shape; RESEARCH Pattern 3 for `useInterpreterEntitiesValues` reactivity.

**Section-group renderer shell pattern to mirror** (`section-group-renderer.tsx` lines 30–47): read-only container that renders content based on entity attributes, no input.

**Reactivity pattern** (from RESEARCH Pattern 3 + Pitfall 5):
- Renderer needs the `interpreterStore` reference. Plumb it as an extra prop from the wrapped component in `interpreter-renderer.tsx`'s `components` useMemo map (not via context, to stay consistent with the existing wrapper-fn pattern at lines 68–83).
- Inside: `const values = useInterpreterEntitiesValues(interpreterStore, [likelyId, consequenceId])` selectively re-renders only when those two values change.
- Call `computePAS79RiskLevel(Number(values[likelyId]), Number(values[consequenceId]))`. Render the badge per UI-SPEC (Tailwind classes from PAS 79 colour map; pending placeholder when result is `null`).

`role="status" aria-live="polite"` on the result badge (UI-SPEC accessibility).

---

### `components/form-interpreter/repeating-section-renderer.tsx` (component, fill, nested state)

**Analog:** `components/form-interpreter/section-group-renderer.tsx` for outer container shell; RESEARCH Pattern 8 + Code Example "Repeating Section Instance Management" for the instances state machine.

**Outer shell pattern** (`section-group-renderer.tsx` lines 30–47):
```tsx
<section className="flex flex-col gap-4">
  <div>
    <h2 className={cn("font-serif text-lg font-normal leading-[1.3]", t.title)}>{attrs.title}</h2>
    <hr className={cn("mt-2 border-t", t.divider)} />
  </div>
  <div className="flex flex-col gap-4">{/* instance cards */}</div>
</section>
```

**Critical contract (D-04, RESEARCH Pitfall 3):**
- Local React state owns `instances: Array<Record<entityId, value>>`.
- On every add/remove/per-instance-field-change: call `setValue({ instances: [...] })` with the FULL updated instances array — never partial. Wrong shape = lost instances in `answers_json`.
- Children inside instances are NOT registered with the interpreter store. The renderer recursively renders each template child entity into a mini-form, reading/writing values from `instances[index][childEntityId]` directly.
- Min/max instance enforcement: read `attrs.minInstances`, `attrs.maxInstances`; disable Add button at max; show inline destructive message at submit if below min.

Use `Array.from({ length: instances.length }, (_, i) => crypto.randomUUID())` only for React `key` stability — NOT stored. Instance ordinal labels ("# 1", "# 2") come from index per UI-SPEC.

---

### `components/form-interpreter/attach-photos-affordance.tsx` (component, fill + upload)

**Analog:** `components/forms/media-field.tsx` lines 1–40 — provides `useMediaProcessor`, photo cell layout, add-cell pattern. Lift into a slim per-field strip per UI-SPEC.

**Container pattern from UI-SPEC:**
```tsx
<div className="flex items-center gap-2 pt-2 mt-2 border-t border-dashed border-white/10">
  <Paperclip className="w-3.5 h-3.5 ..." />
  <span className="text-xs ...">Attach photos</span>
  {photos.length > 0 && <span className="text-xs font-mono text-[#3b8273]">{photos.length} attached</span>}
  <button onClick={openPicker}>+ Add Photo</button>
</div>
{/* thumbnail strip below */}
```

Upload flow: identical to `multiPhotoFieldRenderer`. Storage path appended into the affordance's own local state and persisted as a sibling entry in the field's `answers_json` (TBD at planning whether attachPhotos paths live under the field's entity ID or in a sibling `field_media` row only). Recommend: rely on `field_media` row insert in `uploadMediaAction` and surface the strip from a hook that queries `field_media` by `(submissionId, fieldId)`.

---

### `components/form-interpreter/geolocation-map.tsx` (component, render-only)

**Analog:** NONE — net-new.

**Reference:** RESEARCH Pattern 6 (full file template). Critical:
- `"use client"` at top.
- `import "leaflet/dist/leaflet.css"` (RESEARCH Pitfall 2).
- Fix default-marker-icon path (RESEARCH Pitfall 1) — copy `node_modules/leaflet/dist/images/*.png` → `public/leaflet/`.
- Export a default function `GeoMap`; the renderer dynamic-imports it with `ssr: false`.
- Map height: 200px (UI-SPEC layout exception).
- Click handler via `useMapEvents`; `<TileLayer>` URL = OSM tile server with attribution.

---

### `components/form-interpreter/interpreter-renderer.tsx` (component, request-response) — MODIFIED

**Analog:** self, lines 1–129.

**Memoized components map pattern (CRITICAL — preserve focus-loss fix)** (`interpreter-renderer.tsx` lines 68–83):
```typescript
const components = useMemo(() => ({
  textField: ({ entity, setValue, validateValue, resetError, resetValue, clearValue }: Parameters<typeof TextFieldRenderer>[0]) =>
    <TextFieldRenderer entity={entity} setValue={setValue} ... surface={surface} />,
  // ... 6 more existing entries
}), [surface])
```

**Change:** Add 6 more entries inside the same `useMemo` block (deps stay `[surface]` — UI-SPEC explicitly forbids regressing the focus-loss fix). Pattern for each new entry mirrors the existing inline-arrow wrapper:
```typescript
signatureField: ({ entity, setValue, validateValue, resetError, resetValue, clearValue }: Parameters<typeof SignatureFieldRenderer>[0]) =>
  <SignatureFieldRenderer entity={entity} setValue={setValue} ... surface={surface} clientId={clientId} submissionId={submissionId} />,
```

For `computedField`, pass the `interpreterStore` reference explicitly (RESEARCH Pitfall 5):
```typescript
computedField: (props) => <ComputedFieldRenderer {...props} surface={surface} interpreterStore={interpreterStore} />,
```

**Props change:** Add `clientId: string` to `InterpreterRendererProps` (RESEARCH Pattern 4 — assessment RSC already fetches `submission.client_id`).

---

### `components/form-interpreter/text-field-renderer.tsx` / `textarea-field-renderer.tsx` (MODIFIED — STT inline)

**Analog (positioning):** `components/forms/mic-button.tsx` lines 57–89 — absolute right/bottom positioning, `useSTT` hook, idle/recording/unsupported state.

**MicButton positioning pattern from existing file** (`mic-button.tsx` line 58):
```tsx
<div className={cn("absolute right-2 top-1/2 -translate-y-1/2 ...", className)}>
```

**Change to `text-field-renderer.tsx` lines 47–67:** wrap the existing `<Input>` in a `relative` wrapper, add `pr-12` to the input, mount `<MicButton onTranscript={(t) => setValue((value ?? "") + (value ? " " : "") + t)} surface={surface} />` inside the wrapper.

**Change to `textarea-field-renderer.tsx` lines 36–52:** same pattern, but `pr-12 pb-8` on textarea and `<MicButton className="absolute right-2 bottom-2 top-auto translate-y-0">` (override the default top-1/2 positioning per UI-SPEC).

---

### `components/form-builder/field-palette.tsx` (component, admin builder) — MODIFIED

**Analog:** self, lines 1–138.

**EntityType union expansion** (`field-palette.tsx` lines 15–22):
```typescript
type EntityType =
  | "textField" | "numberField" | "dateField" | "selectField"
  | "textareaField" | "checkboxField" | "sectionGroup"
  // Phase 14 additions:
  | "signatureField" | "ratingField" | "multiPhotoField"
  | "geolocationField" | "computedField" | "repeatingSection";
```

**FIELDS array pattern** (`field-palette.tsx` lines 31–39) — extend with 6 entries. UI-SPEC dictates icon, label, description per type:
```typescript
const FIELDS: FieldDef[] = [
  // ... 7 existing
  { type: "signatureField", label: "Signature", icon: PenLine, description: "Draw and capture a handwritten signature" },
  { type: "ratingField", label: "Rating", icon: Star, description: "Star-based numeric rating 1–N" },
  { type: "multiPhotoField", label: "Photos", icon: Camera, description: "Multi-photo capture with compression" },
  { type: "geolocationField", label: "Location", icon: MapPin, description: "GPS coordinates with map preview" },
  { type: "computedField", label: "Computed", icon: Calculator, description: "Auto-computed PAS 79 risk score" },
  { type: "repeatingSection", label: "Repeating Section", icon: ListOrdered, description: "Repeat a group of fields N times" },
];
```

**Two-section split** (UI-SPEC "Palette Extension"): refactor render to two header rows ("Basic Types", "Specialty"). Each section reuses the existing `(div headerBorder)(div p-2)(FIELDS.map → DraggablePaletteButton)` structure from lines 119–135. Lucide imports (lines 5–13): add `PenLine`, `Star`, `Camera`, `MapPin`, `Calculator`, `ListOrdered`.

`min-h-[48px]` touch target carries forward (line 93). `aria-label={`Add ${label} field`}` carries forward (line 91).

---

### `components/form-builder/properties-panel.tsx` (component, admin builder) — MODIFIED

**Analog:** self, lines 1–411.

**AttributeRow pattern (carry-forward)** (`properties-panel.tsx` lines 92–114) — the wrapper used for every editor. Copy verbatim for new attributes.

**Toggle pattern (carry-forward for attachPhotos)** (`properties-panel.tsx` lines 318–340):
```tsx
<div className="flex items-center justify-between">
  <div className="flex flex-col gap-0.5">
    <span className={cn("font-mono text-[10px] uppercase tracking-widest", t.label)}>Required</span>
    <span className={cn("text-[10px]", t.helpHint)}>Must be filled to submit</span>
  </div>
  <button
    onClick={() => setAttr("required", !((attrs.required as boolean) ?? false))}
    className={cn("relative w-10 h-5 rounded-full transition-colors", (attrs.required as boolean) ? t.toggleOn : t.toggleOff)}
  >
    <span className={cn("absolute top-0.5 w-4 h-4 rounded-full transition-transform", t.toggleKnob, (attrs.required as boolean) ? "translate-x-5" : "translate-x-0.5")} />
  </button>
</div>
```

**attachPhotos toggle:** clone this block, swap `required` → `attachPhotos`, label "Attach Photos", hint "Allow photos to be attached to this field when filling". Render for ALL non-section entity types (gate with `!isSectionGroup && entity.type !== "repeatingSection"`).

**Number input pattern (for maxRating, maxPhotos, minInstances, maxInstances):** Use `<AttributeRow>` wrapper, swap inner `<input type="text">` for `<input type="number" min={...} max={...}>`. Pattern source: existing label input at lines 273–284.

**Entity-ID dropdown for computed inputs (NEW pattern, but uses existing `<select>` styling from prefillSource at lines 381–398):**
```tsx
{entity.type === "computedField" && (
  <>
    <AttributeRow id={`${selectedId}-likelihood`} labelText="Likelihood Source" hint="Select the field that provides this value (must be a number 1–5)." t={t}>
      <select
        id={`${selectedId}-likelihood`}
        value={(attrs.inputs as any)?.likelihood ?? ""}
        onChange={(e) => setAttr("inputs", { ...(attrs.inputs as any), likelihood: e.target.value })}
        className={cn("border rounded-[3px] px-3 py-2 text-sm outline-none transition-colors", t.select)}
      >
        <option value="">— select field —</option>
        {Object.entries(entities)
          .filter(([id, e]) => id !== selectedId && e.type !== "sectionGroup" && e.type !== "repeatingSection" && e.type !== "computedField")
          .map(([id, e]) => (
            <option key={id} value={id}>{(e.attributes.label as string) ?? id}</option>
          ))}
      </select>
    </AttributeRow>
    {/* same again for consequence */}
  </>
)}
```

**Formula read-only display:** static label+value row (no editor), teal mono text. Pattern source: existing type footer at lines 401–405.

**entityTypeMeta map** (`properties-panel.tsx` lines 72–83): add 6 new entries with the corresponding lucide icon.

---

### `app/admin/assessments/actions.ts` (service, upload + AI pipeline) — MODIFIED

**Analog for `uploadMediaAction`:** `finalizeReport` lines 432–457 in the same file.

**Storage upload pattern to copy** (`actions.ts` lines 432–443):
```typescript
const { error: uploadError } = await adminClient
  .storage
  .from("reports")              // → "form-media" for Phase 14
  .upload(fileName, pdfBuffer, {
    contentType: "application/pdf",   // → "image/png" / "image/jpeg"
    upsert: true,
  })

if (uploadError) {
  throw new Error(`Failed to upload report PDF: ${uploadError.message}`)
}
```

**Auth gate pattern (top of action)** (`actions.ts` line 233):
```typescript
await requireActorUserId("admin")
```

**Full `uploadMediaAction` shape (from RESEARCH Pattern 5):**
```typescript
"use server"
export async function uploadMediaAction(
  submissionId: string,
  fieldId: string,
  fileDataUrl: string,
  mediaType: "image" | "audio",
  clientId: string,
): Promise<string> {
  await requireActorUserId("admin");
  const base64 = fileDataUrl.split(",")[1];
  const buffer = Buffer.from(base64, "base64");
  // Security: cap buffer size (RESEARCH Security domain — 500KB for sig, 2MB for photos)
  // Security: MIME type whitelist
  const ext = mediaType === "image" ? "png" : "webm";
  const uuid = crypto.randomUUID();
  const storagePath = mediaType === "image"
    ? `${clientId}/signatures/${submissionId}/${fieldId}.${ext}`   // D-16
    : `${clientId}/photos/${submissionId}/${fieldId}/${uuid}.${ext}`; // D-17
  await adminClient.storage.from("form-media").upload(storagePath, buffer, {
    contentType: mediaType === "image" ? "image/png" : "audio/webm",
    upsert: true,
  });
  await adminClient.from("field_media").insert({
    submission_id: submissionId, field_id: fieldId,
    storage_path: storagePath, media_type: mediaType,
  });
  return storagePath;
}
```

NOTE the photo path (D-17): use `image/jpeg` content type and `.jpg` extension for non-signature photos. The above example simplifies to `png`; planner should split content-type by sig-vs-photo (RESEARCH Pattern 5 has the divergence).

**For `runReportDraftGeneration` (lines 302–368) — repeatingSection expansion:**

Before line 343's `JSON.stringify(submission.answers_json, ...)`:
1. Fetch the pinned schema (mirror `submitAssessmentAction` step 2 at lines 249–257 — same explicit two-step pattern, never join):
   ```typescript
   const { data: sub } = await adminClient.from("form_submissions").select("template_version_id, answers_json").eq("id", submissionId).single();
   const { data: ver } = await adminClient.from("template_versions").select("schema_json").eq("id", sub.template_version_id).single();
   ```
2. Run `expandRepeatingSections(ver.schema_json, sub.answers_json)` (RESEARCH Pattern 10 — full code provided).
3. Pass the expanded object into the prompt's JSON.stringify.

Keep the zod schema for `reportSchema` unchanged; the prompt expansion is purely about input flattening.

---

### `lib/form-builder/progress.ts` (utility, pure) — MODIFIED

**Analog:** self, lines 1–47.

**Existing isFilled + count pattern to extend** (`progress.ts` lines 20–47):
```typescript
function isFilled(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "number") return !Number.isNaN(value);
  return true;
}

export function computeFormProgress(schema, values): number {
  const requiredIds = Object.entries(schema.entities)
    .filter(([, entity]) => entity.attributes?.required === true)
    .map(([id]) => id);
  const total = requiredIds.length;
  if (total === 0) return 100;
  const filled = requiredIds.filter((id) => isFilled(values[id])).length;
  return Math.round((filled / total) * 100);
}
```

**Phase 14 extension:**
1. `repeatingSection` entities with `attrs.minInstances > 0` count as required (add to the `requiredIds` filter).
2. A `repeatingSection` is "filled" when `value.instances?.length >= attrs.minInstances` AND every required child entity in every instance is filled (recurse `isFilled` per instance, per required child as defined by the schema).
3. Treat `signatureField` / `multiPhotoField` / `geolocationField` / `ratingField` / `computedField` values with `isFilled`:
   - Signature: string path, length > 0 (existing string branch covers it).
   - MultiPhoto: array, length > 0 (existing branch).
   - Geolocation: object with `lat` & `lng` numeric (extend `isFilled` to treat objects with `lat && lng` as filled, or add an explicit type check in `computeFormProgress`).
   - Computed: never required (renderer is read-only); always treat as filled.

Test file `tests/form-builder/progress.test.ts` exists — extend with Phase 14 cases.

---

### `lib/form-builder/risk/pas79.ts` (utility, pure) — NEW, no analog

**Source:** RESEARCH Pattern 7 provides the complete file. No codebase analog (no risk-formula module exists).

Key contract for planner / executor:
- Pure function `computePAS79RiskLevel(likelihood?: number, consequence?: number): RiskResult | null`.
- Returns `null` for undefined/out-of-range inputs (RESEARCH Pitfall 4 — guard the initial render race).
- Returns `{ score, level: RiskLevel, colourClass: string }` where `colourClass` is one of the three exact Tailwind triplets from UI-SPEC §Color (`bg-green-100 text-green-900 border border-green-300`, etc.).
- **Assumption A1** (LOW confidence): band boundaries are practitioner convention, not BSI. Matt must verify before Phase 14 ships. Planner should add a TODO comment in the file header.

---

### `supabase/migrations/011_specialty_smoke_test_template.sql` (migration, batch) — NEW

**Analog:** `supabase/migrations/010_form_builder_foundation_reseed.sql` — same migration shape (template + version insert with coltorapps schema). Phase 13 PATTERNS.md §"Smoke-test seed insert pattern" shows the CTE structure.

**Header convention** (matches 009/010):
```sql
-- 011_specialty_smoke_test_template.sql
-- 888 Safety & Training Platform
-- Seed a specialty-fields smoke-test template (Phase 14 UAT vehicle)
```

**Insert pattern from `010` (carry-forward):** `WITH t AS (INSERT INTO form_templates ...), v AS (INSERT INTO template_versions ... schema_json::jsonb ...)`. Use `gen_random_uuid()` for entity IDs in the JSON — coltorapps rejects non-RFC-4122 IDs (Phase 13 13-01 SUMMARY deviation #4).

**Content (planner decision):** either extend the existing "Basic Types Smoke Test" template or seed a separate "Specialty Smoke Test" with one of each specialty type plus the canonical "List all fire doors" repeatingSection (CONTEXT §specifics).

**AGENTS.md constraint:** real DB seed, no hardcoded TypeScript mock data anywhere (project rule "No demo mocks in shipped code paths").

---

### `tests/form-builder/specialty-entities.test.ts` (test, unit) — NEW

**Analog:** `tests/form-builder/entities.test.ts` (Phase 13 Plan 01) for entity validate-shape assertions.

Tests per RESEARCH §"Phase Requirements → Test Map":
- BUILDER-01: each new entity registers and can be added via builderStore.
- BUILDER-02: `attachPhotos` defaults to `false`; `computedField.inputs` stores entity IDs.
- D-05: attachPhotos attribute present on all non-section entities.

---

### `tests/form-builder/repeating-section.test.ts` (test, unit) — NEW

**Analog:** `tests/form-builder/section-reparent.spike.test.ts` (Phase 13) — proven pattern for in-memory builderStore manipulation.

Tests per RESEARCH §"Phase Requirements → Test Map":
- D-04: value shape `{ instances: [] }` round-trips through `setValue` / `getEntitiesValues`.
- D-04: `computeFormProgress` correctly handles `repeatingSection` with `minInstances` > 0.

---

### `tests/form-builder/pas79.test.ts` (test, unit) — NEW, no analog

Pure-function tests:
- D-07: all 25 cells of the matrix return the correct level + colour class.
- D-07: `computePAS79RiskLevel(undefined, undefined)` returns `null` (Pitfall 4 guard).
- D-07: out-of-range inputs (0, 6, 1.5) return `null`.

---

### `tests/form-builder/upload-paths.test.ts` (test, unit) — NEW, no analog

String-assertion tests:
- D-16: signature path = `{clientId}/signatures/{submissionId}/{fieldId}.png`.
- D-17: photo path = `{clientId}/photos/{submissionId}/{fieldId}/{uuid}.{ext}`.

Extract a helper `buildMediaStoragePath(opts)` from `uploadMediaAction` to make this testable without invoking the server action.

---

### `tests/form-interpreter/renderers.test.ts` (test, smoke) — NEW, no analog

FORM-02 / FORM-04 smoke:
- `<TextFieldRenderer>` renders with `<MicButton>` in the DOM.
- `<MicButton>` shows `MicOff` icon when `useSTT().supported === false` (mock the hook).

---

## Shared Patterns

### Phase 13 carry-forward (apply to ALL Phase 14 files)

#### Surface tokens object pattern
**Source:** `components/form-interpreter/select-field-renderer.tsx` lines 18–39
**Apply to:** Every new renderer file, `attach-photos-affordance.tsx`, `geolocation-map.tsx`
```typescript
const surfaceTokens = {
  dark: { label: "text-white/70", required: "text-[#8b2b21]", error: "text-[#8b2b21]", /* ... */ },
  cream: { label: "text-[#1a1a1a]", required: "text-[#8b2b21]", error: "text-[#8b2b21]", /* ... */ },
} as const
// Inside component: const t = surfaceTokens[surface]
```

#### EntityComponentProps shape
**Source:** `components/form-interpreter/select-field-renderer.tsx` lines 11–17
**Apply to:** All 6 new interpreter renderers
```typescript
import type { EntityComponentProps } from "@coltorapps/builder-react"
import type { ratingFieldEntity } from "@/lib/form-builder/entities/rating-field"
type Props = EntityComponentProps<typeof ratingFieldEntity> & { surface?: "dark" | "cream" }
```

#### Attribute validate() coercion (Pitfall 4 from Phase 13)
**Source:** `lib/form-builder/attributes/required.ts` lines 4–10
**Apply to:** Every new attribute file
```typescript
validate(value) {
  if (value === undefined || value === null) return DEFAULT;
  // ... shape check, throw on invalid
  return value;
}
```

#### Server action auth gate
**Source:** `app/admin/assessments/actions.ts` line 233
**Apply to:** `uploadMediaAction` (top of body)
```typescript
"use server"
await requireActorUserId("admin")
```

#### Admin storage upload + DB row insert
**Source:** `app/admin/assessments/actions.ts` lines 432–457 (`finalizeReport`)
**Apply to:** `uploadMediaAction`
```typescript
await adminClient.storage.from("form-media").upload(path, buffer, { contentType, upsert: true });
await adminClient.from("field_media").insert({ submission_id, field_id, storage_path, media_type });
```

#### Two-step pinned-version fetch (NEVER join)
**Source:** `app/admin/assessments/actions.ts` lines 236–257 (`submitAssessmentAction`)
**Apply to:** `runReportDraftGeneration` when fetching schema for repeatingSection expansion
```typescript
// Step 1: submission → template_version_id
// Step 2: template_versions by that id → schema_json
// NEVER select(*, template_versions(...)) — FK join can resolve to wrong version
```

#### Memoized components map (focus-loss prevention)
**Source:** `components/form-interpreter/interpreter-renderer.tsx` lines 68–83
**Apply to:** Adding 6 new entries to the existing useMemo — keep `[surface]` as the sole dependency.

#### MicButton state + positioning
**Source:** `components/forms/mic-button.tsx` lines 22–89 (whole file)
**Apply to:** STT inline in `text-field-renderer.tsx` and `textarea-field-renderer.tsx`. The button handles its own `useSTT` + idle/recording/unsupported states; the renderer just passes `onTranscript` and an optional `className` override for bottom-right positioning on textareas.

#### `cn()` for all conditional classes
**Apply to:** Every new component file. Import from `@/lib/utils`.

---

### Phase 14 net-new shared patterns

#### `attachPhotos` toggle on every non-section entity
**Source:** D-05 + RESEARCH §"Code Examples — Attribute with Default Value Coercion"
**Apply to:** Every new entity factory call's attributes list (signature, rating, multi-photo, geolocation, computed) AND every existing entity refactor (text, number, date, select, textarea, checkbox) — but the existing entities will be modified in-place to include `attachPhotosAttribute`.

#### `AttachPhotosAffordance` mounted at the bottom of every renderer when `attrs.attachPhotos === true`
**Source:** UI-SPEC §"attachPhotos Affordance" positioning rule.
**Apply to:** ALL new renderers AND text/textarea/number/date/select/checkbox renderers (modified). Always last element inside the renderer's container div, after the error message. Each renderer renders it itself; the interpreter layout does NOT do this generically.

#### `clientId` + `submissionId` prop drilling
**Source:** RESEARCH Pattern 4 — RSC already has `submission.client_id`.
**Apply to:** `InterpreterRenderer` accepts new `clientId` prop; threads to renderers that need it (signature, multi-photo, attachPhotos affordance, geolocation if it ever uploads a map snapshot).

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `components/form-interpreter/geolocation-map.tsx` | component | render | First use of Leaflet in the codebase. Use RESEARCH Pattern 6 verbatim. |
| `lib/form-builder/risk/pas79.ts` | utility | transform | First risk-formula module. Use RESEARCH Pattern 7 verbatim; flag Assumption A1 in file header for Matt validation. |
| `tests/form-builder/pas79.test.ts` | test | unit | First pure-fn test. Straightforward `describe/it/expect` per Vitest. |
| `tests/form-builder/upload-paths.test.ts` | test | unit | First string-builder test for storage paths. |
| `tests/form-interpreter/renderers.test.ts` | test | smoke | First interpreter render test. Plan should mock `useSTT` and `useInterpreterStore`. |

---

## Metadata

**Analog search scope:** `lib/form-builder/`, `components/form-builder/`, `components/form-interpreter/`, `components/forms/`, `app/admin/assessments/`, `lib/supabase/`, `tests/form-builder/`, `supabase/migrations/`
**Phase 13 PATTERNS.md consulted:** `.planning/phases/13-form-builder-foundation/13-PATTERNS.md`
**Phase 13 SUMMARY files consulted:** `13-01-SUMMARY.md` (entity/attribute patterns), `13-02-SUMMARY.md` (builder UI), `13-03-SUMMARY.md` (interpreter)
**Files scanned:** 18
**Pattern extraction date:** 2026-05-25
