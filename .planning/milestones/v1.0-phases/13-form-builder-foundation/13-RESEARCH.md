# Phase 13: Form Builder Foundation - Research

**Researched:** 2026-05-20
**Domain:** @coltorapps/builder + @coltorapps/builder-react integration; schema persistence; dnd-kit drag layer; big-bang cutover
**Confidence:** HIGH (core library API verified via Context7 + npm registry; compatibility confirmed via npm view)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01:** Adopt `@coltorapps/builder` + `@coltorapps/builder-react`. Rebuild the form builder on coltorapps' entity / attribute / builder-store / interpreter-store model. Replaces the hand-rolled builder.

**D-02:** `@dnd-kit/*` (already installed) is retained only as the drag layer inside the coltorapps builder UI. coltorapps owns schema + state; dnd-kit owns pointer interaction.

**D-03:** Big-bang cutover within Phase 13. Custom builder and custom renderer are both replaced in this phase. The Phase 6 assessment fill flow switches to the coltorapps interpreter immediately; re-wiring those renderer call sites is in scope.

**D-04:** Accepted regression — signature / rating / multi-photo / geolocation / repeating field types are dropped at cutover and do not return until Phase 14.

**D-05:** Drop & reseed. Existing `form_templates` / `form_template_versions` / `form_submissions` / assessment rows (custom `FormSchema` shape) are disposable dev/demo data — wiped, not migrated. No `FormSchema` → coltorapps converter is built.

**D-06:** Phase 13 reseeds only a minimal basic-types smoke-test template (7 basic types) to exercise the build→save→version→fill→submit loop. The real FRA reseed is Phase 18.

**D-07:** The live schema contract is migration `003` (+ `004`, `005`) — `owner_id` polymorphic, `owner_type IN ('admin','customer')`, `parent_template_id` for forks. The build prompt's draft SQL is subordinate and must NOT reshape the existing contract.

**D-08:** The `schema_json` column shape changes from custom `FormSchema` to coltorapps `{ entities, root }`. Because of drop & reseed (D-05) no mixed-shape version rows exist — the renderer only ever sees coltorapps shape. Immutable-version-pinning rule still holds.

**D-09:** Strict — only the 7 basic entities (`textField`, `numberField`, `dateField`, `selectField`, `textareaField`, `checkboxField`, `sectionGroup`), including the `prefillSource` attribute on text/date fields.

### Claude's / Planner's Discretion

- **Field-component reuse** — whether to wrap existing `components/forms/*-field.tsx` as coltorapps entity render components, or write fresh. Default lean: reuse them as the render layer where clean.
- **Builder route** — keep the existing `/admin/templates` + `/admin/templates/[id]` routes vs the build prompt's `/admin/form-builder/[templateId]`. Default lean: keep `/admin/templates`.
- API route shape for versions/submissions; server-side `validateSchema` + `validateEntitiesValues` wiring.

### Deferred Ideas (OUT OF SCOPE)

- Custom field types (signature / rating / multi-photo / geolocation / repeating / computed) — Phase 14
- Per-field photo attach (`attachPhotos`) and speech-to-text on text fields — Phase 14
- Conditional logic / `visibilityRules` — Phase 15
- Fork-on-fill, template assignment, client-built-from-scratch flows — Phase 16
- Recurrence / scheduling / reminders — Phase 17
- Full FRA template reseed in coltorapps shape — Phase 18
- Builder route rename to `/admin/form-builder` — planner's discretion
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BUILDER-01 | Admin can drag field types from a palette onto a form canvas | coltorapps `addEntity` + dnd-kit DndContext; palette onClick calls `builderStore.addEntity({ type, attributes: defaults })` |
| BUILDER-02 | Properties panel supports per-field: label, required, placeholder, validation, conditional visibility (visibility deferred to Phase 15) | `BuilderEntityAttributes` component + `builderStore.setEntityAttribute(id, name, value)` |
| BUILDER-03 | Publish flow increments template version and marks the previous version immutable | `saveDraft` server action: insert new `template_versions` row with `version_number = max + 1`; `published_at` set on publish |
| BUILDER-04 | `@coltorapps/builder` React 19 compatibility is verified via spike before committing to v2 timeline | **CONFIRMED:** `@coltorapps/builder-react@0.2.4` peer dep is `react: '^18.0.0 || ^19.0.0'`. Not a blocker. |
| BUILDER-05 | Builder is gated to admin role (unless editable-forms resolves otherwise) | `requireActorUserId("admin")` guard in server actions; per AGENTS.md, form builder code MUST NOT be hardcoded to admin-only — the component is reusable, routing/gating is the gate |
</phase_requirements>

---

## Summary

Phase 13 replaces the existing hand-rolled dnd-kit form builder with `@coltorapps/builder` as the schema and state engine. The coltorapps library is headless and framework-agnostic — it provides `createBuilder` / `createEntity` / `createAttribute` for schema definition, `useBuilderStore` for builder-side state, and `useInterpreterStore` for fill-side state. The library's React 19.2.4 compatibility is confirmed by the published peer-dependency range `react: '^18.0.0 || ^19.0.0'` in `@coltorapps/builder-react@0.2.4` (published 2025-07-08). There is no compatibility blocker; planning can proceed.

The schema shape changes from the custom `{ fields: [...] }` flat array to coltorapps' `{ entities: { [uuid]: { type, attributes } }, root: [uuid, ...] }`. Because of the drop-and-reseed decision (D-05), no migration converter is needed — the DB is wiped before Phase 13 ships and all rows will be coltorapps shape.

The live DB contract (migrations 003–005) already has all tables needed: `form_templates`, `template_versions`, `form_submissions`, `form_assignments`. The build prompt's draft SQL is superseded. One important reconciliation: the live `form_assignments` table uses `client_id` (a foreign key to `clients.id`) rather than the build prompt's `assigned_to UUID REFERENCES auth.users(id)`. This is an org-level assignment, not user-level. Phase 13 does not need assignments functionality — that is Phase 16 — but the executor must be aware when wiring the submission insert.

**Primary recommendation:** Install `@coltorapps/builder@0.2.4 @coltorapps/builder-react@0.2.4`, define the 7 entities in `lib/form-builder/`, replace the three `components/templates/` files and `components/forms/form-renderer.tsx` with coltorapps-wired counterparts, update the one assessment call site (`app/admin/assessments/[id]/assessment-client.tsx`), and wire save/publish/submit server actions to use `validateSchema` + `validateEntitiesValues`.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Entity / attribute definitions | API/Backend module | — | Shared between client and server; lives in `lib/form-builder/entities/`. Used by both the client-side store and server-side validators. |
| Builder store (drag, add, reorder, edit attributes) | Browser / Client | — | `useBuilderStore` is a client-side React hook; schema state lives in client memory until saved. |
| Interpreter store (fill, validate, submit) | Browser / Client | — | `useInterpreterStore` is a client-side React hook; values live in client memory until submitted. |
| Schema persistence (save draft / publish) | API / Backend (Server Actions) | Database / Storage | `validateSchema` server-side → `template_versions` INSERT. |
| Submission persistence | API / Backend (Server Actions) | Database / Storage | `validateEntitiesValues` server-side → `form_submissions` INSERT. |
| Version pinning (submissions read their schema) | Database / Storage | API / Backend | `form_submissions.template_version_id` FK; server fetches the pinned `template_versions` row. |
| Three-panel builder UI | Browser / Client | Frontend Server (SSR) | Canvas/palette/properties are client components; the page wrapper is an RSC that fetches template data. |
| Renderer / interpreter UI | Browser / Client | Frontend Server (SSR) | `InterpreterEntities` is a client component; the assessment page wrapper is an RSC. |
| dnd-kit drag layer | Browser / Client | — | Pure pointer-event handling; integrates with `builderStore.setEntityIndex()` in the `onDragEnd` handler. |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@coltorapps/builder` | 0.2.4 | Entity / attribute / schema / validation model | Project decision (D-01); headless, no UI opinions |
| `@coltorapps/builder-react` | 0.2.4 | React hooks: `useBuilderStore`, `useInterpreterStore`, `BuilderEntities`, `InterpreterEntities` | Companion React integration package; React 19 compatible |
| `@dnd-kit/core` | ^6.3.1 (installed) | DndContext, DragOverlay, sensors | Already installed; D-02 retains it as drag layer |
| `@dnd-kit/sortable` | ^10.0.0 (installed) | SortableContext, useSortable, setEntityIndex integration | Already installed |
| `@dnd-kit/utilities` | ^3.2.2 (installed) | CSS.Transform.toString for drag overlay | Already installed |

[VERIFIED: npm registry — `npm view @coltorapps/builder-react peerDependencies version`]

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `zod` | Already in project | Attribute validation inside `createAttribute` | Optional but recommended for structured attribute validation — matches project's existing zod usage |
| `sonner` | Already in project | Submit failure toast | Already mounted in root layout; use for submission API failure |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@coltorapps/builder` | SurveyJS, react-hook-form, custom | Build prompt explicitly forbids SurveyJS and paid libraries; coltorapps is the project decision |

**Installation:**
```bash
npm install @coltorapps/builder@0.2.4 @coltorapps/builder-react@0.2.4
```

**Version verification:** Confirmed via `npm view @coltorapps/builder-react version` → `0.2.4` (published 2025-07-08). Peer dep: `react: '^18.0.0 || ^19.0.0'`.

---

## Architecture Patterns

### System Architecture Diagram

```
Browser (Client Components)
│
├── TemplateBuilderPage (RSC — fetches template + version rows from DB)
│   └── TemplateBuilderClient ("use client")
│       ├── useBuilderStore(formBuilder, { initialData: schema })
│       ├── FieldPalette ── onClick → builderStore.addEntity({ type, attributes })
│       ├── BuilderCanvas
│       │   └── DndContext + SortableContext
│       │       ├── BuilderEntities → per-entity canvas cards
│       │       └── onDragEnd → builderStore.setEntityIndex(id, newIndex)
│       ├── PropertiesPanel
│       │   └── BuilderEntityAttributes → per-attribute inputs → builderStore.setEntityAttribute(...)
│       └── Toolbar
│           ├── Save button → saveDraftAction(templateId, builderStore.getSchema(), name)
│           └── Publish button → publishTemplateAction(templateId, ...)
│
├── AssessmentClientPage (RSC — fetches submission + template_versions row by version_id)
│   └── InterpreterRenderer ("use client")  [rewired from FormRenderer]
│       ├── useInterpreterStore(formBuilder, schema_json)
│       ├── InterpreterEntities → per-entity fill inputs
│       └── Submit → validateEntitiesValues (client) → submitAssessmentAction (server)
│
Server Actions ("use server")
│
├── saveDraftAction
│   └── validateSchema(schema, formBuilder) → INSERT template_versions (version_number = max+1)
│
├── publishTemplateAction
│   └── validateSchema → UPDATE template_versions SET published_at = now()
│       + UPDATE form_templates SET is_published = true
│
└── submitAssessmentAction
    └── validateEntitiesValues(values, formBuilder, schema) → INSERT form_submissions
        with template_version_id = pinned version id (NEVER latest)

Database (Supabase)
│
├── form_templates  (mutable metadata: name, owner_id, owner_type, is_published)
├── template_versions  (immutable once published_at is set; schema_json = coltorapps shape)
├── form_submissions  (template_version_id FK — version pinning)
└── form_assignments  (client_id FK — org-level assignment, wired in Phase 16)
```

### Recommended Project Structure

```
lib/
├── form-builder/
│   ├── index.ts            # export formBuilder (createBuilder result)
│   ├── entities/
│   │   ├── text-field.ts   # createEntity({ name: 'textField', attributes: [...] })
│   │   ├── number-field.ts
│   │   ├── date-field.ts
│   │   ├── select-field.ts
│   │   ├── textarea-field.ts
│   │   ├── checkbox-field.ts
│   │   └── section-group.ts
│   └── attributes/
│       ├── label.ts
│       ├── required.ts
│       ├── placeholder.ts
│       ├── help-text.ts
│       ├── prefill-source.ts  # for textField + dateField
│       ├── options.ts          # for selectField
│       └── ...
│
components/
├── form-builder/              # new — replaces components/templates/
│   ├── builder-canvas.tsx     # DndContext + BuilderEntities + DragOverlay
│   ├── field-palette.tsx      # 7 field-type buttons; onClick → addEntity
│   ├── properties-panel.tsx   # BuilderEntityAttributes per entity type
│   ├── field-card.tsx         # canvas card with drag handle, duplicate, delete
│   └── section-card.tsx       # sectionGroup container card with nested drop zone
│
├── form-interpreter/          # new — replaces components/forms/form-renderer.tsx
│   ├── interpreter-renderer.tsx   # useInterpreterStore + InterpreterEntities
│   ├── text-field-renderer.tsx    # wraps existing <Input> + MicButton (deferred)
│   ├── number-field-renderer.tsx  # wraps NumberField
│   ├── date-field-renderer.tsx    # wraps DateField
│   ├── select-field-renderer.tsx  # wraps shadcn Select
│   ├── textarea-field-renderer.tsx
│   ├── checkbox-field-renderer.tsx
│   └── section-group-renderer.tsx
│
app/
├── admin/templates/
│   ├── page.tsx               # RSC — template list; keep existing
│   ├── actions.ts             # update to use validateSchema; update schema shape
│   └── [id]/
│       ├── page.tsx           # RSC — fetch template + latest version row
│       └── builder-client.tsx # "use client" — three-panel builder
```

### Pattern 1: Entity Definition

```typescript
// Source: https://github.com/coltorapps/builder/blob/main/docs/src/app/docs/api/create-entity/page.md
// lib/form-builder/entities/text-field.ts
import { createEntity } from "@coltorapps/builder";
import { labelAttribute } from "../attributes/label";
import { requiredAttribute } from "../attributes/required";
import { placeholderAttribute } from "../attributes/placeholder";
import { helpTextAttribute } from "../attributes/help-text";
import { prefillSourceAttribute } from "../attributes/prefill-source";

export const textFieldEntity = createEntity({
  name: "textField",
  attributes: [
    labelAttribute,
    requiredAttribute,
    placeholderAttribute,
    helpTextAttribute,
    prefillSourceAttribute,
  ],
  validate(value, context) {
    if (context.entity.attributes.required && !value) {
      throw new Error(`${context.entity.attributes.label} is required.`);
    }
    if (typeof value !== "string" && value !== undefined && value !== null) {
      throw new Error(`${context.entity.attributes.label} must be text.`);
    }
    return value;
  },
});
```

### Pattern 2: Builder Definition

```typescript
// Source: https://github.com/coltorapps/builder/blob/main/docs/src/app/docs/builders/page.md
// lib/form-builder/index.ts
import { createBuilder } from "@coltorapps/builder";
import { textFieldEntity } from "./entities/text-field";
// ... import other entities

export const formBuilder = createBuilder({
  entities: [
    textFieldEntity,
    numberFieldEntity,
    dateFieldEntity,
    selectFieldEntity,
    textareaFieldEntity,
    checkboxFieldEntity,
    sectionGroupEntity,
  ],
});
```

### Pattern 3: Builder Store + dnd-kit Reorder

```tsx
// Source: https://github.com/coltorapps/builder/blob/main/docs/src/app/docs/guides/drag-and-drop/page.md
// components/form-builder/builder-canvas.tsx
import { useBuilderStore, useBuilderStoreData, BuilderEntities } from "@coltorapps/builder-react";
import { DndContext, MouseSensor, useSensor, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { formBuilder } from "@/lib/form-builder";

export function BuilderCanvas() {
  const builderStore = useBuilderStore(formBuilder, {
    events: {
      onEntityAttributeUpdated(payload) {
        void builderStore.validateEntityAttribute(payload.entity.id, payload.attributeName);
      },
    },
  });

  const { schema: { root } } = useBuilderStoreData(builderStore, (events) =>
    events.some((e) => e.name === "RootUpdated")
  );

  const sensor = useSensor(MouseSensor, { activationConstraint: { distance: 5 } });

  function handleDragEnd(e: DragEndEvent) {
    const overId = e.over?.id;
    if (!overId || typeof e.active.id !== "string") return;
    const index = root.findIndex((id) => id === overId);
    builderStore.setEntityIndex(e.active.id, index);
  }

  return (
    <DndContext sensors={[sensor]} onDragEnd={handleDragEnd}>
      <SortableContext items={Array.from(root)} strategy={verticalListSortingStrategy}>
        <BuilderEntities
          builderStore={builderStore}
          components={{ textField: TextFieldCanvasCard, /* ... */ }}
        >
          {(props) => <DndItem id={props.entity.id}>{props.children}</DndItem>}
        </BuilderEntities>
      </SortableContext>
    </DndContext>
  );
}
```

### Pattern 4: Save Draft Server Action (schema serialization)

```typescript
// Source: https://github.com/coltorapps/builder/blob/main/docs/src/app/docs/api/validate-schema/page.md
// app/admin/templates/actions.ts
"use server";
import { validateSchema } from "@coltorapps/builder";
import { formBuilder } from "@/lib/form-builder";

export async function saveDraftAction(templateId: string, rawSchema: unknown, templateName: string) {
  const userId = await requireActorUserId("admin");
  const result = await validateSchema(rawSchema, formBuilder);
  if (!result.success) throw new Error(`Invalid schema: ${result.reason.code}`);
  
  // Insert new version row; previous rows are never mutated
  const { data: max } = await supabase
    .from("template_versions")
    .select("version_number")
    .eq("template_id", templateId)
    .order("version_number", { ascending: false })
    .limit(1).maybeSingle();
  
  await supabase.from("template_versions").insert({
    template_id: templateId,
    version_number: (max?.version_number ?? 0) + 1,
    schema_json: result.data,  // coltorapps { entities, root } shape
    created_by: userId,
  });
}
```

### Pattern 5: Interpreter Renderer (assessment fill — replaces FormRenderer)

```tsx
// Source: https://github.com/coltorapps/builder/blob/main/docs/src/app/docs/guides/form-builder/page.md
// components/form-interpreter/interpreter-renderer.tsx
"use client";
import { useInterpreterStore, InterpreterEntities } from "@coltorapps/builder-react";
import { validateEntitiesValues } from "@coltorapps/builder";
import { formBuilder } from "@/lib/form-builder";
import type { Schema } from "@coltorapps/builder";

type FormBuilderSchema = Schema<typeof formBuilder>;

export function InterpreterRenderer({
  schema,
  submissionId,
}: {
  schema: FormBuilderSchema;
  submissionId: string;
}) {
  const interpreterStore = useInterpreterStore(formBuilder, schema, {
    events: {
      onEntityValueUpdated(payload) {
        void interpreterStore.validateEntityValue(payload.entityId);
      },
    },
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const values = interpreterStore.getEntitiesValues();
    // Client-side validation first
    const result = await validateEntitiesValues(values, formBuilder, schema);
    if (!result.success) {
      // surface result.entitiesErrors to UI
      return;
    }
    await submitAssessmentAction(submissionId, values);
  }

  return (
    <form onSubmit={handleSubmit}>
      <InterpreterEntities
        interpreterStore={interpreterStore}
        components={{
          textField: TextFieldRenderer,
          numberField: NumberFieldRenderer,
          // ...
          sectionGroup: SectionGroupRenderer,
        }}
      />
      <button type="submit">Submit form</button>
    </form>
  );
}
```

### Pattern 6: Server-side Submission Validation

```typescript
// Source: https://github.com/coltorapps/builder/blob/main/docs/src/app/docs/api/validate-entities-values/page.md
"use server";
import { validateEntitiesValues } from "@coltorapps/builder";
import { formBuilder } from "@/lib/form-builder";

export async function submitAssessmentAction(submissionId: string, rawValues: unknown) {
  // Fetch the pinned version's schema
  const { data: sub } = await adminClient
    .from("form_submissions")
    .select("template_version_id")
    .eq("id", submissionId).single();

  const { data: version } = await adminClient
    .from("template_versions")
    .select("schema_json")
    .eq("id", sub.template_version_id).single();

  // Server-side re-validation
  const result = await validateEntitiesValues(rawValues, formBuilder, version.schema_json);
  if (!result.success) throw new Error("Validation failed server-side");

  await adminClient.from("form_submissions").update({
    answers_json: result.data,
    status: "submitted",
    submitted_at: new Date().toISOString(),
  }).eq("id", submissionId);
}
```

### Anti-Patterns to Avoid

- **Never mutate a published `template_versions` row.** Once `published_at` is set, the row is immutable. Always insert a new row with an incremented `version_number`. The existing `saveDraft` action in `actions.ts` already does this correctly — preserve the pattern.
- **Never render a submission against the current/latest version.** Always fetch the schema from the row whose `id = form_submissions.template_version_id`. The current `assessment-client.tsx` reads `submission.template?.schema_json` — ensure the fetching RSC joins to the pinned version row, not the template's latest.
- **Never pass `builderStore.getSchema()` directly to the server without `validateSchema`.** The store schema is untrusted client data. Always validate server-side.
- **Never hardcode admin-only in the component layer.** Per AGENTS.md, the form builder component must be reusable across surfaces. Role gating belongs in server actions (`requireActorUserId`) and route middleware, not in the component props.
- **Never use the `sectionGroup`'s entity ID as a drop zone ID that collides with field IDs.** When implementing section reparenting, use distinct DnD item IDs that encode scope (e.g., `section-${id}` vs `field-${id}`).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Schema validation | Custom JSON validator | `validateSchema(schema, formBuilder)` | Validates structure, entity types, attribute values, root references, relationship constraints |
| Submission value validation | Custom required/type checking | `validateEntitiesValues(values, formBuilder, schema)` | Entity-level errors, required checks, type coercion — all from the entity's `validate()` function |
| Builder state management | Custom useState + reducer for add/delete/reorder | `useBuilderStore(formBuilder)` | Handles entity tree, attribute editing, event system, undo-ready architecture |
| Interpreter state management | Custom form value tracking | `useInterpreterStore(formBuilder, schema)` | Handles value collection, per-entity validation, default values |
| Entity tree rendering | Custom recursive render | `BuilderEntities` / `InterpreterEntities` | Handles nested entities (sectionGroup children), render props, proper key management |
| Schema serialization | Custom JSON.stringify shape | `builderStore.getSchema()` → `validateSchema` on server | getSchema() returns the canonical coltorapps shape; validateSchema normalizes it for storage |

**Key insight:** The coltorapps library owns schema correctness. Do not duplicate any schema validation logic in application code — if `validateSchema` passes, the schema is safe to store; if `validateEntitiesValues` passes, the values are safe to persist.

---

## Runtime State Inventory

This is a drop-and-reseed cutover (D-05), not a rename/refactor. However, runtime state must be confirmed before the executor wipes dev data.

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | `form_templates`, `template_versions`, `form_submissions`, `form_assignments` rows with custom `FormSchema` shape (`{ fields: [...] }` / `{ sections: [...] }`) | Data migration migration (006 or higher) — truncate all four tables in dependency order before reseeding with coltorapps shape |
| Live service config | No n8n workflows currently reference form_templates schema shape directly (n8n triggers on `form_submissions` insert webhook — payload is submission row, not schema) | None — n8n webhook payload unchanged |
| OS-registered state | None — no scheduled tasks reference form schema shape | None |
| Secrets/env vars | None — no env var names reference old schema format | None |
| Build artifacts | The old `FormSchema` / `FormField` types are imported in `app/admin/assessments/actions.ts`, `app/admin/templates/actions.ts`, `components/forms/*-field.tsx` (via `FormSurface` re-export), `lib/supabase/templates.ts` | Code edit — replace type imports with coltorapps types; update the `FormSurface` export location |

**Executor pre-condition (D-06):** Before truncating, confirm `form_submissions` has no production assessment data. Current scale is ~7–8 clients, pre-launch. Expected safe — but verify with `SELECT count(*), status FROM form_submissions GROUP BY status` before running the truncation migration.

---

## Common Pitfalls

### Pitfall 1: sectionGroup Child Reparenting in dnd-kit

**What goes wrong:** coltorapps supports nested entities via `parentId` — a `sectionGroup` entity has children in its `entities` sub-tree. But dnd-kit's default `SortableContext` is a flat list. Dropping a field onto a section or out of a section requires calling `builderStore.setEntityIndex(entityId, index, { parentId })` where `parentId` is the section entity's ID.

**Why it happens:** The dnd-kit guide in coltorapps only shows flat root-level reorder. Section nesting is a separate builder store operation.

**How to avoid:** Implement two separate `SortableContext` instances — one for root-level entities and one for each `sectionGroup`'s children. The `handleDragEnd` handler must detect whether the drop target is inside a section (check if `overId` matches a section's child IDs) and call `setEntityIndex` with the appropriate `parentId`.

**Warning signs:** Fields appear to drag but land at wrong positions; dragging into sections silently fails (no error, field just snaps back).

### Pitfall 2: Schema Shape Mismatch at Assessment Renderer Call Site

**What goes wrong:** The existing `assessment-client.tsx` reads `submission.template?.schema_json` — but the RSC page fetches `submission` joined to the template, which is the template's *current* schema, not the version the submission was filled against.

**Why it happens:** The RSC query at `app/admin/assessments/[id]/page.tsx` must join to `template_versions` via `form_submissions.template_version_id`, not to `form_templates`. If the join fetches the template's current/latest version, historical submissions break.

**How to avoid:** The fetch query in the RSC must be: `form_submissions JOIN template_versions ON form_submissions.template_version_id = template_versions.id`. The schema passed to `InterpreterRenderer` is `template_versions.schema_json`, never anything from `form_templates` directly.

**Warning signs:** Submissions load but show incorrect fields; fields missing or in wrong order when viewing old submissions.

### Pitfall 3: `owner_id` Polymorphic Write on Template Create

**What goes wrong:** The existing `createTemplate` server action in `actions.ts` inserts `owner_id: userId` where `userId` is the auth user's UUID. For admin users, this matches `admin_users.id`. But there is no DB-level FK on `owner_id` (migration 003 dropped it) — the discriminator is `owner_type`. A careless rewrite could set `owner_type = 'customer'` with an admin user's ID.

**Why it happens:** The build prompt's draft SQL had `owner_id REFERENCES auth.users(id)` — that is NOT the live schema. Migration 003 is the authority.

**How to avoid:** For admin-created templates, always insert `owner_type = 'admin'`, `owner_id = adminUsers.id` (where `adminUsers.id` is the UUID from `admin_users`, which equals `auth.uid()` for admin users). For customer-created templates (Phase 16), `owner_type = 'customer'`, `owner_id = clients.id` (the org ID, not the user ID).

**Warning signs:** RLS blocks reads on a newly created template; `form_templates_client_published` policy returns empty.

### Pitfall 4: Attribute Validation Context Access

**What goes wrong:** The `validate(value, context)` function on `createEntity` receives `context.entity.attributes` — but during builder store use, if an attribute has never been set, it is `undefined`. A `required` attribute check of `if (context.entity.attributes.required && !value)` will fail silently if `required` itself was never written to the store.

**Why it happens:** coltorapps' `createBuilder` does not enforce default attribute values. The entity `validate` function is called with whatever is currently in the store.

**How to avoid:** When defining attributes, always provide a `defaultValue` fallback in the entity render component, and coerce in the `validate` function: `const isRequired = context.entity.attributes.required ?? false`.

### Pitfall 5: `current_draft_json` Column vs. `template_versions` Pattern

**What goes wrong:** The existing `lib/supabase/templates.ts` has an `updateTemplateDraft` function that writes to `form_templates.current_draft_json`. This column does NOT exist in the live schema (migration 001 does not create it). This function will silently fail or throw.

**Why it happens:** `templates.ts` was written optimistically and the column was never migrated into the DB.

**How to avoid:** Delete `updateTemplateDraft` from `lib/supabase/templates.ts` entirely. All draft persistence goes through the `template_versions` insert pattern (a new draft version row per save, `published_at = NULL`). This is already what `saveDraftAction` in `actions.ts` does correctly.

---

## Code Examples

### Schema Shape (verified from Context7)

```json
{
  "entities": {
    "51324b32-adc3-4d17-a90e-66b5453935bd": {
      "type": "textField",
      "attributes": {
        "label": "Assessor name",
        "required": true,
        "prefillSource": "currentUserName"
      }
    },
    "d5ae8682-156c-4511-b972-98c6c3b7c41b": {
      "type": "sectionGroup",
      "attributes": {
        "title": "Header Information",
        "description": ""
      }
    }
  },
  "root": [
    "d5ae8682-156c-4511-b972-98c6c3b7c41b",
    "51324b32-adc3-4d17-a90e-66b5453935bd"
  ]
}
```

Note: Child entities of a `sectionGroup` are NOT in `root`. Their parent entity ID is stored in the entity's own metadata within the builder store. When `builderStore.addEntity({ type: 'textField', ... }, { parentId: sectionId })` is called, the child entity appears in the section's children, not in `root`.

[VERIFIED: Context7 — /coltorapps/builder — "builder store entities children parentId"]

### Attribute Definition

```typescript
// Source: Context7 — /coltorapps/builder — createAttribute
// lib/form-builder/attributes/label.ts
import { createAttribute } from "@coltorapps/builder";

export const labelAttribute = createAttribute({
  name: "label",
  validate(value) {
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new Error("Label is required.");
    }
    return value.trim();
  },
});
```

### useBuilderStoreData (selective re-render)

```typescript
// Source: Context7 — /coltorapps/builder — useBuilderStoreData
// Selective re-render: only when schema root changes (entity add/delete/reorder)
const { schema: { root } } = useBuilderStoreData(builderStore, (events) =>
  events.some((e) => e.name === "RootUpdated")
);
```

---

## Migration Reconciliation (D-07)

The live schema contract differs from the build prompt's draft SQL in the following ways. The planner must address these:

| Item | Build Prompt Draft | Live Contract (authoritative) | Action |
|------|-------------------|-------------------------------|--------|
| `owner_type` values | `IN ('admin', 'client')` | `IN ('admin', 'customer')` — enforced by migration 003 | No migration needed; use `'customer'` everywhere, never `'client'` |
| `owner_id` reference | `REFERENCES auth.users(id)` | Polymorphic — no FK; `admin_users.id` or `clients.id` depending on `owner_type` | No migration needed; do not add FK |
| `template_versions.created_by` | `REFERENCES auth.users(id)` | No FK (migration 005 dropped it) to allow customer writes | No migration needed |
| `form_assignments.assigned_to` | `REFERENCES auth.users(id)` (user-level) | `client_id UUID REFERENCES clients(id)` (org-level) | Phase 13 does not use assignments; note for Phase 16 |
| `form_submissions.values_json` | Column name in build prompt | `answers_json` in migration 001 | Use `answers_json` everywhere |
| Drop + reseed | Not in build prompt | D-05 decision | New migration (006) to truncate the four tables + insert smoke-test seed |
| `form_templates.current_draft_json` | Referenced in `lib/supabase/templates.ts` | Column does NOT exist in migration 001 | Delete `updateTemplateDraft()` from `templates.ts` |
| `template_versions.deleted_at` | Not in build prompt | Present in migration 001 | Preserve; do not filter on it unless needed |

**Next migration number:** 009 already exists (`009_clients_contact_columns.sql`). The drop-and-reseed migration should be numbered `010_form_builder_foundation_reseed.sql`. [VERIFIED: checked migration directory listing]

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Custom `FormSchema { fields: [] }` flat array | coltorapps `{ entities: {}, root: [] }` nested map | Phase 13 | schema_json column shape changes; all consumers must be updated |
| `components/forms/form-renderer.tsx` custom switch renderer | coltorapps `InterpreterEntities` + per-entity renderer components | Phase 13 | One call site to rewire: `assessment-client.tsx` |
| `components/templates/template-builder.tsx` hand-rolled dnd-kit state | `useBuilderStore` + `BuilderEntities` + `setEntityIndex` | Phase 13 | Entire `components/templates/` directory replaced |
| `lib/types/form-builder.ts` `FormField` / `FormSchema` | coltorapps `Schema<typeof formBuilder>` TypeScript type | Phase 13 | All type imports updated |

**Deprecated/outdated after Phase 13:**
- `components/templates/template-builder.tsx` — delete
- `components/templates/field-palette.tsx` — delete
- `components/templates/field-config.tsx` — delete
- `components/templates/sortable-field.tsx` — delete
- `components/forms/form-renderer.tsx` — delete (replace with interpreter renderer)
- `lib/types/form-builder.ts` — delete (replace with coltorapps types)
- `lib/supabase/templates.ts` `updateTemplateDraft()` — delete (column doesn't exist)

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The `sectionGroup` entity in coltorapps represents a container whose children are nested entities (not in root). `builderStore.addEntity({ type: 'sectionGroup' })` then `builderStore.addEntity({ type: 'textField' }, { parentId: sectionId })` places the field inside the section. | Architecture Patterns | If sectionGroup has a different child model, the dnd-kit section reparenting implementation needs redesign. Verify with a spike in Wave 0. |
| A2 | `assessment-client.tsx` call site rewire is the only consumer of `FormRenderer` in the live app. Grep found one import of `FormRenderer` in `app/admin/assessments/[id]/assessment-client.tsx`. | Standard Stack | If other call sites exist (client portal assessments, preview routes), they must also be rewired. Run a codebase grep before starting. |
| A3 | `form_templates.current_draft_json` does not exist in the live DB. This conclusion is based on reading migration 001 which does not declare it. | Common Pitfalls | If a later migration added it (not visible in the listed 009 migrations), deleting `updateTemplateDraft()` without a column drop causes no harm but the function is then safely dead code. |
| A4 | The existing `app/client/templates/` route and its `actions.ts` are currently using the same custom `FormSchema` shape and will need the same coltorapps rewire as the admin route. Read `app/client/templates/[id]/page.tsx` and `actions.ts` before planning to confirm scope. | Code Context | If the client template editor has additional complexity, the task estimate for that file needs adjustment. |

---

## Open Questions (RESOLVED)

1. **sectionGroup child entity rendering in dnd-kit**
   - What we know: coltorapps `setEntityIndex(id, index, { parentId })` moves an entity to a position within a parent's children. The dnd-kit guide only shows flat root reorder.
   - What's unclear: Exact DnD data structure for cross-container (section→root or root→section) drag-and-drop. Does the `over` drop target need to be the sectionGroup entity ID or a synthetic container ID?
   - Recommendation: Wave 0 spike — implement sectionGroup add + basic nesting before building the full UI; confirm the `setEntityIndex` parentId API works as expected.
   - **RESOLVED:** Plan 13-01 Task 3 spike (`tests/form-builder/section-reparent.spike.test.ts`) proves the `setEntityIndex(id, index, { parentId })` cross-container API before the Plan 13-02 canvas is built.

2. **`formSchema` prop type on the rewired assessment renderer**
   - What we know: `app/admin/assessments/[id]/page.tsx` currently passes `submission.template?.schema_json` (the custom shape) to `AssessmentClient`. After the cutover, the RSC must join to the pinned `template_versions` row.
   - What's unclear: Does the existing `page.tsx` fetch query use `.select('*, template_versions!template_version_id(*)')` or does it join to the template? Need to verify before planning the RSC rewrite.
   - Recommendation: Read `app/admin/assessments/[id]/page.tsx` in the plan phase.
   - **RESOLVED:** Plan 13-03 Task 3 reads `app/admin/assessments/[id]/page.tsx` in `<read_first>` and rewrites the fetch as an explicit two-step query keyed on `template_version_id`, passing the pinned version's coltorapps `schema_json` to the interpreter renderer.

3. **`useBuilderStore` initial data hydration**
   - What we know: `useBuilderStore(formBuilder, { initialData: { schema: savedSchema } })` initializes the builder store from a persisted coltorapps schema. The `savedSchema` must conform to `{ entities: {}, root: [] }`.
   - What's unclear: Is there a synchronous shape validation on `initialData`? If the DB row has a malformed schema (from a partial save), does the hook throw?
   - Recommendation: Wrap the builder page RSC with an error boundary; confirm behavior with a malformed-schema test.
   - **RESOLVED:** Plan 13-02 Task 2 `builder-client.tsx` receives `initialData` from the RSC; the server-side `validateSchema` guard on save (Plan 13-02 Task 3) means no malformed schema is ever persisted to hydrate from, and `npx tsc --noEmit` surfaces shape mismatches at compile time.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `@coltorapps/builder` | Core engine | Not installed (install required) | 0.2.4 | — (no fallback; install is the action) |
| `@coltorapps/builder-react` | React hooks + components | Not installed (install required) | 0.2.4 | — |
| `@dnd-kit/core` | Drag layer | Already installed | ^6.3.1 | — |
| `@dnd-kit/sortable` | Sortable canvas | Already installed | ^10.0.0 | — |
| `@dnd-kit/utilities` | CSS transforms | Already installed | ^3.2.2 | — |
| Supabase (local or remote) | DB reads/writes | Available (project is live) | — | — |
| Next.js 16.2.4 | App Router | Available | 16.2.4 | — |
| React 19.2.4 | Peer dep required | Available | 19.2.4 | — |

**Missing dependencies with no fallback:**
- `@coltorapps/builder@0.2.4` — must be installed before any Phase 13 code is written
- `@coltorapps/builder-react@0.2.4` — same

**Install command (Wave 0, Task 1):**
```bash
npm install @coltorapps/builder@0.2.4 @coltorapps/builder-react@0.2.4
```

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Playwright 1.51 + Vitest 3.0 (both installed, no test script in package.json) |
| Config file | `playwright.config.ts` (exists); Vitest config missing — Wave 0 gap |
| Quick run command | `npx vitest run --reporter=verbose` (unit) |
| Full suite command | `npx playwright test` (e2e) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BUILDER-01 | Clicking a palette button adds an entity to the builder store | unit | `npx vitest run tests/form-builder/palette.test.ts` | Wave 0 |
| BUILDER-02 | Properties panel attribute change updates builder store | unit | `npx vitest run tests/form-builder/properties.test.ts` | Wave 0 |
| BUILDER-03 | saveDraftAction creates a new `template_versions` row; re-save creates next version without mutating prior | integration | `npx vitest run tests/form-builder/save-draft.test.ts` | Wave 0 |
| BUILDER-04 | React 19 compatibility | verified via install (no test needed) | — | N/A |
| BUILDER-05 | Builder route returns 401 for unauthenticated request | smoke | `npx playwright test tests/auth-gate.spec.ts` | Use existing patterns |
| Submission pinning | Viewing an old submission renders its exact version schema | integration | `npx vitest run tests/form-builder/version-pin.test.ts` | Wave 0 |
| validateSchema | Server action rejects invalid schema | unit | `npx vitest run tests/form-builder/validate-schema.test.ts` | Wave 0 |
| validateEntitiesValues | Server action rejects invalid submission values | unit | `npx vitest run tests/form-builder/validate-values.test.ts` | Wave 0 |
| Round-trip | save schema → reload page → identical builder state | e2e | `npx playwright test tests/form-builder/round-trip.spec.ts` | Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run tests/form-builder/`
- **Per wave merge:** `npx vitest run && npx playwright test tests/form-builder/`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `vitest.config.ts` — missing; add with Next.js-compatible config
- [ ] `tests/form-builder/` directory — does not exist; create with test stubs
- [ ] `tests/form-builder/palette.test.ts` — covers BUILDER-01
- [ ] `tests/form-builder/save-draft.test.ts` — covers BUILDER-03
- [ ] `tests/form-builder/version-pin.test.ts` — covers submission pinning
- [ ] `tests/form-builder/validate-schema.test.ts` — covers server-side validation
- [ ] `tests/form-builder/validate-values.test.ts` — covers server-side value validation

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No — existing auth unchanged | — |
| V3 Session Management | No — existing session unchanged | — |
| V4 Access Control | Yes | `requireActorUserId("admin")` in all template server actions; RLS policies from migrations 003/004 |
| V5 Input Validation | Yes | `validateSchema` + `validateEntitiesValues` (both server-side) before any DB write |
| V6 Cryptography | No — no new crypto | — |

### Known Threat Patterns for this Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Client sends crafted `schema_json` with arbitrary entity types | Tampering | `validateSchema(rawSchema, formBuilder)` rejects unknown entity types; result.success must be true before INSERT |
| Client submits values for entities not in the schema | Tampering | `validateEntitiesValues(values, formBuilder, schema)` only accepts values for entities in the schema |
| Cross-tenant template read via direct ID | Information Disclosure | RLS policies on `form_templates` — `form_templates_client_own_select` scopes customer reads to `owner_id IN (SELECT client_id FROM client_users WHERE id = auth.uid())` |
| Submitting against a different version than assigned | Tampering | Server fetches schema from `form_submissions.template_version_id` — the pinned version, not a client-supplied ID |
| Unauthenticated access to builder route | Elevation of Privilege | `requireActorUserId("admin")` in server actions; admin gate via `proxy.ts` middleware |

---

## Project Constraints (from CLAUDE.md / AGENTS.md)

1. **"This is NOT the Next.js you know"** — Before writing any Next.js API code (e.g., Route Handlers, middleware), read `node_modules/next/dist/docs/` for the correct API. Key differences in 16.x: `middleware.ts` → `proxy.ts`, async request APIs, `revalidateTag` signature changes. Do not assume Next.js 14 patterns work.

2. **Form builder code MUST NOT be hardcoded to admin-only.** The `TemplateBuilderClient` component must accept a `surface` prop and work on both admin (dark) and client (cream) surfaces. Role gating is done in server actions and route middleware, not in component props.

3. **`owner_type IN ('admin', 'customer')` — never `'client'`.** Migration 003 enforces this. The build prompt's `'client'` value is wrong.

4. **Do not reshape the schema without re-checking with Finley.** Per AGENTS.md. The `owner_id` polymorphic + `owner_type` discriminator + `parent_template_id` contract is locked.

5. **No production data in shipped code paths.** The smoke-test seed template (D-06) must be seeded via a SQL migration, not via hardcoded mock data in TypeScript.

---

## Sources

### Primary (HIGH confidence)
- Context7 `/coltorapps/builder` — `createBuilder`, `createEntity`, `createAttribute`, `validateSchema`, `validateEntitiesValues`, `useBuilderStore`, `useBuilderStoreData`, `useInterpreterStore`, `BuilderEntities`, `InterpreterEntities`, `setEntityIndex`, schema shape
- npm registry — `@coltorapps/builder@0.2.4` (published 2025-07-08), `@coltorapps/builder-react@0.2.4` peer deps `react: '^18.0.0 || ^19.0.0'`
- `supabase/migrations/001_initial_schema.sql` — live table definitions
- `supabase/migrations/003_form_template_customer_ownership.sql` — `owner_type IN ('admin','customer')`, `parent_template_id`, polymorphic FK removal
- `supabase/migrations/004_form_templates_rls_fixes.sql` — RLS policies
- `supabase/migrations/005_template_versions_polymorphic_created_by.sql` — `created_by` FK removal
- `node_modules/next/dist/docs/` — Next.js 16.2.4 API reference (router, server actions)

### Secondary (MEDIUM confidence)
- `components/templates/template-builder.tsx` — existing builder code; reference for UI patterns to preserve
- `components/forms/form-renderer.tsx` — existing renderer; call site to rewire
- `app/admin/templates/actions.ts` — existing server actions; save/publish patterns to preserve
- `app/admin/assessments/[id]/assessment-client.tsx` — single FormRenderer call site to rewire

### Tertiary (LOW confidence)
- sectionGroup parentId dnd-kit interaction pattern [ASSUMED] — documented API says `setEntityIndex(id, index, { parentId })` but the exact drop-zone handling for cross-container drag is not explicitly shown in docs; spike recommended (see A1 in Assumptions Log)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions verified via npm registry; peer dep confirmed
- Architecture: HIGH — core API verified via Context7; live schema verified via migration files
- Pitfalls: MEDIUM — DB schema pitfalls verified; dnd-kit sectionGroup reparenting is ASSUMED until spiked
- Migration reconciliation: HIGH — diff based on reading actual migration files

**Research date:** 2026-05-20
**Valid until:** 2026-06-20 (stable library; coltorapps 0.2.4 is current stable; canary 1.0.0-canary.0 exists but is not recommended for production)
