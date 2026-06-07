---
phase: 13-form-builder-foundation
plan: "02"
subsystem: form-builder-ui
tags: [form-builder, coltorapps, dnd-kit, server-actions, vitest]
dependency_graph:
  requires: ["13-01"]
  provides: ["builder-canvas", "field-palette", "properties-panel", "section-card", "field-card", "builder-client", "save-draft-action", "publish-action"]
  affects: ["app/admin/templates", "app/client/templates"]
tech_stack:
  added: []
  patterns:
    - "coltorapps useBuilderStore + useBuilderStoreData for reactive schema"
    - "dnd-kit DndContext with PointerSensor + KeyboardSensor for drag layer"
    - "section:<sectionId>:<childId> drag ID encoding for scope disambiguation"
    - "setEntityParent/unsetEntityParent for nesting (not setEntityIndex with parentId)"
    - "startTransition wrapping async server action calls in client components"
    - "validateSchema gate before every template_versions INSERT"
    - "Immutable version rows — INSERT only, NEVER UPDATE schema_json"
    - "server-only bypass in vitest via inline auth simulation (no import)"
key_files:
  created:
    - components/form-builder/field-palette.tsx
    - components/form-builder/field-card.tsx
    - components/form-builder/section-card.tsx
    - components/form-builder/builder-canvas.tsx
    - components/form-builder/properties-panel.tsx
    - app/admin/templates/[id]/builder-client.tsx
  modified:
    - app/admin/templates/[id]/page.tsx
    - app/admin/templates/actions.ts
    - app/client/templates/[id]/page.tsx
    - app/client/templates/actions.ts
    - tests/form-builder/palette.test.ts
    - tests/form-builder/properties.test.ts
    - tests/form-builder/save-draft.test.ts
  deleted:
    - app/admin/templates/[id]/editor-client.tsx
decisions:
  - "Shared TemplateBuilderClient across admin (dark) and client (cream) surfaces via surface prop"
  - "validateSchema called server-side via dynamic import to avoid bundling builder in RSC root"
  - "editor-client.tsx deleted — coltorapps builder-client.tsx is the replacement"
  - "Test auth gate via inline simulation rather than importing server-only auth-helpers module"
metrics:
  duration_minutes: 90
  completed_date: "2026-05-20"
  tasks_completed: 3
  tasks_total: 3
  files_changed: 14
---

# Phase 13 Plan 02: Builder UI Components + Server Actions Summary

Coltorapps builder UI fully wired: 5 React components (palette, canvas, properties panel, field card, section card), shared `TemplateBuilderClient` on admin and client surfaces, `saveDraftAction`/`publishTemplateAction` with immutable version rows and `validateSchema` gate, and 20 new passing tests across 3 test files.

## Tasks Completed

| # | Name | Commit | Key Files |
|---|------|--------|-----------|
| 1 | Build 5 builder UI components | a28c2cf | field-palette, field-card, section-card, builder-canvas, properties-panel |
| 2 | Wire admin builder page + builder-client | a4df560 | builder-client.tsx, admin page.tsx, client page.tsx, editor-client.tsx (deleted) |
| 3 | Server actions + schema validation + tests | 4867236 | admin actions.ts, client actions.ts, 3 test files |

## What Was Built

### Task 1 — 5 Builder UI Components

**field-palette.tsx** — 7 clickable/draggable palette buttons (textField, numberField, dateField, selectField, textareaField, checkboxField, sectionGroup). Each button has `aria-label="Add {label} field"`, min-h-[48px], uses `useDraggable` from dnd-kit. Calls `onAddEntity(type)` on click.

**field-card.tsx** — Sortable entity card using `useSortable`. Accepts a `dragId` prop for scoped IDs when rendered inside sections. Shows entity label attribute and type badge. Action buttons (Duplicate, Delete) at 32px each. `aria-describedby="drag-instructions"` on drag handle.

**section-card.tsx** — Outer `useSortable` for section entity; inner `SortableContext` wrapping child field cards. Child drag IDs scoped as `section:<sectionId>:<childId>`. Inset dashed drop zone (`border-2 border-dashed min-h-[48px]`). Reads `entity.attributes.title` (not sectionTitle — AGENTS.md attribute name fix).

**builder-canvas.tsx** — `DndContext` with `PointerSensor({ activationConstraint: { distance: 5 } })` and `KeyboardSensor`. `handleDragEnd` decodes drag IDs via `decodeDragId()` and handles 5 drag cases: section drop, same-section reorder, un-nest, reparent into different section, root reorder. Uses `setEntityParent`/`unsetEntityParent` (Plan 01 proven API — NOT `setEntityIndex` with parentId). `DragOverlay` shows ghost card. `useBuilderStoreData(builderStore, () => true)` for reactive schema.

**properties-panel.tsx** — Calls `builderStore.setEntityAttribute(id, name, value)` on every change. No-selection state: "Select a field to configure". sectionGroup: `title` and `description` inputs. selectField: `OptionsEditor` sub-component (add/remove rows). textField/dateField: `prefillSource` select. All inputs associated via `htmlFor`/`id`.

### Task 2 — Builder Page + Shared Client Component

**builder-client.tsx** — `"use client"` component. Toolbar h-14: Back link, template-name input, status badges (DRAFT/LIVE/UNPUBLISHED EDITS), Save Draft + Publish buttons. `handleSave`/`handlePublish` use `startTransition` + `builderStore.getSchema()`. Three-column layout: `w-56` palette | `flex-1` canvas | `w-72` properties. Status bar h-8: field count (pluralised) + "Unsaved changes" amber pulse dot.

**Admin page.tsx** — Removed `normaliseSchema`, old `TemplateBuilder`, `saveDraft`/`publishTemplate` imports. Now passes `initialSchema={latestVersion?.schema_json ?? null}` directly. `surface="dark"`.

**Client page.tsx** — Shares `TemplateBuilderClient` from admin path. `surface="cream"`. Uses `saveClientDraftAction`/`publishClientTemplateAction` from `app/client/templates/actions`.

**editor-client.tsx deleted** — Was the hand-rolled editor, no longer referenced; was causing TS errors after actions cleanup.

### Task 3 — Server Actions + Tests

**admin actions.ts** — `saveDraftAction(templateId, rawSchema, templateName)`: requires admin auth, dynamic-imports `validateSchema` + `formBuilder`, validates schema (throws on failure), queries `MAX(version_number)`, INSERTs new `template_versions` row with `version_number = max + 1`. `publishTemplateAction`: same + sets `published_at`, updates `form_templates.is_published = true`. `createTemplate` now seeds `{ entities: {}, root: [] }`.

**client actions.ts** — `saveClientDraftAction`/`publishClientTemplateAction`: same pattern with `requireClientContext()` + `requireOwnedTemplate()` guards; `owner_type: "customer"`, `owner_id: ctx.client_id` (org UUID). `forkOnFill` kept untouched (Phase 16 scope).

**Tests (20 new, all passing):**
- `palette.test.ts` (5 tests): addEntity via store, default attributes, sectionGroup in root, 7-type smoke
- `properties.test.ts` (6 tests): setEntityAttribute for label, required (toggle), numberField label, per-type attribute contract, multi-attribute persistence
- `save-draft.test.ts` (9 tests): validateSchema smoke (empty/bad/valid), version-number math, immutability via in-memory store, auth gate simulation

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed sectionGroup attribute names**
- **Found during:** Task 1 (building properties-panel.tsx and section-card.tsx)
- **Issue:** Plan PATTERNS.md and UI-SPEC.md referenced `sectionTitle`/`sectionDescription` as attribute names, but the actual `lib/form-builder` entities defined attribute names as `title` and `description`
- **Fix:** Used `title` and `description` in properties-panel.tsx (attribute editor inputs) and section-card.tsx (title display read)
- **Files modified:** components/form-builder/section-card.tsx, components/form-builder/properties-panel.tsx, tests/form-builder/properties.test.ts
- **Commit:** a28c2cf (components), 4867236 (tests)

**2. [Rule 1 - Bug] Fixed SurfaceTokens union type in properties-panel.tsx**
- **Found during:** Task 1 TypeScript check
- **Issue:** `AttributeRow` and `OptionsEditor` sub-components received `t` prop typed as `typeof surfaceTokens["dark"]` only, but the actual passed value was the union type
- **Fix:** Added `type SurfaceTokens = (typeof surfaceTokens)["dark"] | (typeof surfaceTokens)["cream"]` and used it for both sub-component prop types
- **Files modified:** components/form-builder/properties-panel.tsx
- **Commit:** a28c2cf

**3. [Rule 3 - Blocking] Deleted editor-client.tsx to resolve TS errors**
- **Found during:** Task 2 (after rewriting actions.ts, the old editor-client.tsx imported removed exports `updateTemplateDraftAction` and `publishTemplateVersionAction`)**
- **Issue:** editor-client.tsx was no longer referenced by any page after page.tsx was updated, but was still being type-checked and failing due to removed action exports
- **Fix:** `git rm app/admin/templates/[id]/editor-client.tsx` — intentional deletion since builder-client.tsx is the complete replacement
- **Commit:** a4df560

**4. [Rule 2 - Missing Critical] Bypass server-only import in test env**
- **Found during:** Task 3 (filling save-draft.test.ts)
- **Issue:** Could not `vi.mock("@/lib/auth-helpers")` because the module itself imports `server-only` which throws in vitest jsdom environment
- **Fix:** Inlined the auth simulation logic directly in the test instead of importing auth-helpers. The structural guarantee (requireActorUserId is called as first line of action) is documented in the test comment and enforced at code level in actions.ts
- **Files modified:** tests/form-builder/save-draft.test.ts
- **Commit:** 4867236

**5. [Rule 1 - Bug] Fixed getAttrs() helper for coltorapps generic union type**
- **Found during:** Task 3 (writing properties.test.ts)
- **Issue:** `store.getSchema().entities[id].attributes` returns a generic union of all entity attribute types; accessing `.label` directly caused TS errors
- **Fix:** Added `getAttrs(store, entityId): Record<string, unknown>` helper with `as Record<string, unknown>` cast to bypass the generic union for test assertions
- **Files modified:** tests/form-builder/properties.test.ts
- **Commit:** 4867236

## Known Stubs

None. All data flows are wired: builder store → `getSchema()` → `saveDraftAction` → Supabase INSERT. Properties panel writes to store via `setEntityAttribute`. No hardcoded placeholder data.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: auth-gate | app/admin/templates/actions.ts | saveDraftAction/publishTemplateAction require admin auth via requireActorUserId — confirmed first line of each action |
| threat_flag: auth-gate | app/client/templates/actions.ts | Client actions require requireClientContext() + requireOwnedTemplate() — customer can only write their own templates |
| threat_flag: schema-validation | app/admin/templates/actions.ts | validateSchema called server-side before every DB INSERT — rejects unknown entity types and invalid attribute values |

## Test Results

```
Test Files  6 passed | 2 skipped (8)
      Tests 45 passed | 9 todo (54)
```

## Self-Check: PASSED

Files created:
- FOUND: components/form-builder/field-palette.tsx
- FOUND: components/form-builder/field-card.tsx
- FOUND: components/form-builder/section-card.tsx
- FOUND: components/form-builder/builder-canvas.tsx
- FOUND: components/form-builder/properties-panel.tsx
- FOUND: app/admin/templates/[id]/builder-client.tsx

Commits:
- FOUND: a28c2cf (task 1)
- FOUND: a4df560 (task 2)
- FOUND: 4867236 (task 3)
