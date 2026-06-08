---
phase: 13-form-builder-foundation
plan: "04"
subsystem: cutover
tags: [migration, dead-code-deletion, coltorapps, form-builder, cutover]
dependency_graph:
  requires: ["13-01", "13-02", "13-03"]
  provides:
    - "supabase/migrations/010_form_builder_foundation_reseed.sql — drop+reseed migration ready for supabase db push"
    - "All 6 dead pre-coltorapps builder/renderer/types files deleted"
    - "lib/supabase/templates.ts cleaned (updateTemplateDraft removed, FormBuilderSchema types)"
    - "FormSurface type extracted to components/forms/form-surface.ts"
  affects:
    - "supabase/migrations"
    - "components/forms"
    - "lib/supabase/templates.ts"
    - "lib/forms/schema-diff.ts"
    - "app/client/templates/actions.ts"

tech_stack:
  added: []
  patterns:
    - "PostgreSQL DO block with gen_random_uuid() for dynamic UUID generation in seed JSON"
    - "jsonb_build_object / jsonb_build_array for assembling coltorapps schema_json in SQL"
    - "FormSurface type extracted to standalone shared module (components/forms/form-surface.ts)"
    - "FormBuilderSchema (coltorapps Schema<typeof formBuilder>) replaces old FormSchema everywhere"

key_files:
  created:
    - supabase/migrations/010_form_builder_foundation_reseed.sql
    - components/forms/form-surface.ts
  modified:
    - lib/supabase/templates.ts
    - lib/forms/schema-diff.ts
    - lib/forms/schema-diff.test.ts
    - lib/forms/schema-adapter.ts
    - lib/forms/schema-adapter.test.ts
    - app/client/templates/actions.ts
    - components/forms/checkbox-field.tsx
    - components/forms/date-field.tsx
    - components/forms/geolocation-field.tsx
    - components/forms/media-field.tsx
    - components/forms/mic-button.tsx
    - components/forms/multi-photo-field.tsx
    - components/forms/number-field.tsx
    - components/forms/rating-field.tsx
    - components/forms/signature-field.tsx
  deleted:
    - components/forms/form-renderer.tsx
    - components/templates/template-builder.tsx
    - components/templates/field-palette.tsx
    - components/templates/field-config.tsx
    - components/templates/sortable-field.tsx
    - lib/types/form-builder.ts

key-decisions:
  - "D-05/D-06 implemented: migration 010 TRUNCATEs 4 form tables and reseeds one coltorapps-shape smoke-test template with all 7 entity types"
  - "D-03 implemented: 6 dead pre-coltorapps files deleted; tree is clean"
  - "FormSurface extracted to form-surface.ts so components/forms/*.tsx can compile without form-renderer"
  - "schema-diff.ts/forkOnFill updated to FormBuilderSchema (coltorapps root/entities comparison)"
  - "Tasks 3 (supabase db push) and 4 (human-verify) are orchestrator-handled — not executed by this agent"

metrics:
  duration_minutes: 30
  completed_date: "2026-05-20"
  tasks_completed: 2
  tasks_total: 4
  tasks_orchestrator_handled: 2
  files_changed: 22
---

# Phase 13 Plan 04: Cutover — Migration 010 + Dead Code Deletion

Migration 010 written with 4-table TRUNCATE and 7-entity coltorapps smoke-test seed using `gen_random_uuid()` DO block; 6 dead pre-coltorapps files deleted; `lib/supabase/templates.ts` cleaned; zero dangling imports; `tsc --noEmit` clean.

## Scope Note

Per executor scope instructions:
- **Task 1** (write migration 010): DONE — committed `07faa7b`
- **Task 2** (delete dead code + clean templates.ts): DONE — committed `5a8b28c`
- **Task 3** (`supabase db push`): NOT executed — no `.env.local` / Supabase auth in this worktree; orchestrator applies migration 010 to the live database via Supabase MCP after merge
- **Task 4** (human-verify checkpoint): NOT executed — orchestrator runs this with the user after Task 3

## Task Commits

| # | Name | Commit | Key Output |
|---|------|--------|------------|
| 1 | Write migration 010 | 07faa7b | supabase/migrations/010_form_builder_foundation_reseed.sql |
| 2 | Delete dead code + clean templates.ts | 5a8b28c | 6 files deleted, 16 files modified, form-surface.ts created |

## What Was Built

### Task 1 — Migration 010

`supabase/migrations/010_form_builder_foundation_reseed.sql` contains:

1. Four `TRUNCATE TABLE ... CASCADE` statements in child-first FK order:
   - `form_submissions` (FK child of `form_assignments` + `template_versions`)
   - `form_assignments` (FK child of `form_templates` + `template_versions`)
   - `template_versions` (FK child of `form_templates`)
   - `form_templates` (root)

2. A `DO $$` block that:
   - Calls `gen_random_uuid()` for each of the 8 entity UUIDs (1 section + 7 field entities)
   - Inserts one `form_templates` row: `name='Basic Types Smoke Test'`, `template_type='fra'`, `owner_type='admin'`, `owner_id=(SELECT id FROM admin_users LIMIT 1)`, `is_published=false`
   - Builds `schema_json` as `JSONB` via `jsonb_build_object` / `jsonb_build_array` covering all 7 entity types
   - The `sectionGroup` contains one nested `textField` child (`parentId` set on child, child excluded from `root`)
   - Inserts one `template_versions` row: `version_number=1`, `published_at=NULL` (draft)

Attribute keys used exactly match the Plan 01 entity definitions: `label`, `required`, `placeholder`, `prefillSource`, `title`, `description`, `options` (with `label`/`value` per option), `allowMultiple`, `defaultChecked`.

Verification passed:
```
OK: 4 truncates, 7/7 entity types in seed
gen_random_uuid count: 10
owner_type: 'admin' confirmed
```

### Task 2 — Dead Code Deletion + Cleanup

**6 dead files deleted:**
- `components/templates/template-builder.tsx`
- `components/templates/field-palette.tsx`
- `components/templates/field-config.tsx`
- `components/templates/sortable-field.tsx`
- `components/forms/form-renderer.tsx`
- `lib/types/form-builder.ts`

(`app/admin/templates/[id]/editor-client.tsx` was already deleted by Plan 02 — acceptance criterion satisfied.)

**`lib/supabase/templates.ts` cleaned:**
- Removed `updateTemplateDraft()` (writes non-existent `form_templates.current_draft_json` column — RESEARCH.md Pitfall 5)
- Removed `publishTemplateVersion()` (dead; replaced by `publishTemplateAction` in admin `actions.ts`)
- Updated type imports: replaced `FormSchema, FormTemplate, TemplateVersion` from `@/types/forms` with `FormBuilderSchema` from `@/lib/form-builder`
- `getFormTemplates()`, `getFormTemplate()`, `getLatestPublishedVersion()` preserved unchanged

**Dangling import chain resolved (Rule 1 — Bug fix):**

Deleting `form-renderer.tsx` exposed that 9 `components/forms/*.tsx` files imported `FormSurface` from `./form-renderer`. Solution: created `components/forms/form-surface.ts` with the type alias `export type FormSurface = "dark" | "cream"`, then updated all 9 files to import from `./form-surface`.

**`lib/forms/schema-diff.ts` updated:**
Replaced old flat `FormSchema` type (from deleted `@/lib/types/form-builder`) with `FormBuilderSchema` from `@/lib/form-builder`. Rewrote `hasStructuralChanges()` to compare coltorapps `{ entities, root }` shape (root length, root order, entity types, labels, required flags, selectField options). Updated `schema-diff.test.ts` to use coltorapps-shaped fixtures.

**`lib/forms/schema-adapter.ts` and test updated:**
Removed import from deleted `@/lib/types/form-builder`; changed `flat` parameter to `{ fields: unknown[] }`. This adapter is dead code (the old FormRenderer it bridged to is deleted) — preserved only to keep the test suite non-failing.

**`app/client/templates/actions.ts` updated:**
Replaced `FormSchema` import from deleted module with `FormBuilderSchema` from `@/lib/form-builder`. `forkOnFill()` parameters updated to `FormBuilderSchema` type.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] `FormSurface` type stranded by form-renderer deletion**
- **Found during:** Task 2 (after deleting `form-renderer.tsx`, TypeScript showed 9 `components/forms/*.tsx` files had dangling `import type { FormSurface } from "./form-renderer"`)
- **Issue:** `form-renderer.tsx` was both a renderer and the canonical source of the `FormSurface = "dark" | "cream"` type. 9 field components (`checkbox-field`, `date-field`, `geolocation-field`, `media-field`, `mic-button`, `multi-photo-field`, `number-field`, `rating-field`, `signature-field`) imported it from there.
- **Fix:** Extracted `FormSurface` to `components/forms/form-surface.ts`; updated all 9 files to `import from "./form-surface"`.
- **Files modified:** `components/forms/form-surface.ts` (created), plus 9 `.tsx` files
- **Commit:** 5a8b28c

**2. [Rule 1 — Bug] `lib/forms/schema-diff.ts` used deleted `FormSchema`/`FormField` types**
- **Found during:** Task 2 (deleting `lib/types/form-builder.ts` broke `schema-diff.ts` and downstream `app/client/templates/actions.ts` which imports `forkOnFill`)
- **Issue:** `schema-diff.ts` imported `FormSchema, FormField` from `@/lib/types/form-builder`; `schema-diff.test.ts` did the same. `app/client/templates/actions.ts` imported `FormSchema` from `@/lib/types/form-builder` for `forkOnFill` params.
- **Fix:** Rewrote `schema-diff.ts` to use `FormBuilderSchema` from `@/lib/form-builder` and updated the diff logic to compare coltorapps `{ entities, root }` shape. Updated `schema-diff.test.ts` with coltorapps-shaped fixtures. Updated `app/client/templates/actions.ts` to use `FormBuilderSchema`. Updated `schema-adapter.ts` / `schema-adapter.test.ts` similarly.
- **Files modified:** `lib/forms/schema-diff.ts`, `lib/forms/schema-diff.test.ts`, `lib/forms/schema-adapter.ts`, `lib/forms/schema-adapter.test.ts`, `app/client/templates/actions.ts`
- **Commit:** 5a8b28c

## Known Stubs

None. Migration 010 is complete and ready for `supabase db push` by the orchestrator. The coltorapps smoke-test template seed is valid. All deleted modules had their consumers updated.

## Outstanding (Orchestrator-Handled)

- **Task 3:** `supabase db push` — applies migration 010 to the live database. Run by the orchestrator via Supabase MCP after this worktree merges.
- **Task 4:** Human verification of the full build→save→version→fill→submit loop. Gated on Task 3 completing successfully.

## Self-Check: PASSED

Files created:
- FOUND: supabase/migrations/010_form_builder_foundation_reseed.sql
- FOUND: components/forms/form-surface.ts

Files deleted (confirmed absent):
- CONFIRMED DELETED: components/forms/form-renderer.tsx
- CONFIRMED DELETED: components/templates/template-builder.tsx
- CONFIRMED DELETED: components/templates/field-palette.tsx
- CONFIRMED DELETED: components/templates/field-config.tsx
- CONFIRMED DELETED: components/templates/sortable-field.tsx
- CONFIRMED DELETED: lib/types/form-builder.ts

Acceptance criteria:
- 4 TRUNCATE TABLE statements: CONFIRMED (node verification OK: 4 truncates)
- 7/7 entity types in seed: CONFIRMED (node verification OK: 7/7)
- gen_random_uuid count >= 1: CONFIRMED (count=10)
- owner_type='admin': CONFIRMED
- updateTemplateDraft in templates.ts: 0 occurrences CONFIRMED
- No dangling imports: CONFIRMED (grep returned no matches)
- tsc --noEmit non-test errors: 0 CONFIRMED

Commits:
- FOUND: 07faa7b (Task 1)
- FOUND: 5a8b28c (Task 2)
