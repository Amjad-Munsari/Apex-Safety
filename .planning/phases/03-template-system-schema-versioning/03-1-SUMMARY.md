# Phase 3: Template System + Schema Versioning — Summary

**Phase:** 03
**Status:** Completed
**Completed:** 2026-04-29
**Goal:** Mutable template metadata, immutable version rows, FRA seed, Site Risk placeholder, admin-gated builder UI.

---

## What Was Built

### Template Data Layer (`lib/supabase/templates.ts`)
- `getFormTemplates()` — server-side query fetching all templates with their published status.
- Templates are fetched via `createServerClient` (server-only, never leaks to browser).
- Schema: `form_templates` (mutable metadata) + `form_template_versions` (immutable version rows) — each submission pins to a `template_version_id` ensuring historical fidelity.

### Admin Template Builder UI (`app/admin/templates/`)
- **List view** (`page.tsx`) — grid of template cards showing name, type, published/draft status badge, version number, and last-edit timestamp. Wired to live `getFormTemplates()` query.
- **Edit view** (`[id]/page.tsx`) — individual template editor (scaffolded; full drag-and-drop field builder deferred per roadmap).
- **Actions** — "Edit Template" button links to detail route, "History" icon for version trail (placeholder).
- Empty state: "No templates found" with "Seed example templates" call-to-action.

### Schema Versioning
- Confirmed in `001_initial_schema.sql`: `form_template_versions` table stores immutable JSON snapshots.
- `form_submissions.template_version_id` FK ensures every submission is pinned to the exact schema version used at capture time.
- No retroactive schema migration — version rows are append-only.

### Seed Templates
- FRA (Type 3) template — seeded from the blank FRA template asset received from Matt.
- Site Risk placeholder — schema skeleton in place; full template pending Matt's input (Blocker B1).

### Admin Gate
- Template builder UI only accessible at `/admin/templates` — protected by admin-email check in `proxy.ts` middleware.
- No client-side access to template editing.

---

## Verification Results

- ✅ `/admin/templates` renders list of templates from Supabase
- ✅ Published/Draft status badge renders correctly per `is_published` column
- ✅ `form_submissions` pins to `template_version_id` (confirmed in migration schema)
- ✅ Admin-only route protection in place via middleware
- ⚠️ Full field-level drag-and-drop builder deferred (Site Risk template also pending Matt's input)

---

## Key Files Delivered

| File | Purpose |
|------|---------|
| `app/admin/templates/page.tsx` | Template list UI |
| `app/admin/templates/[id]/page.tsx` | Template edit UI (scaffolded) |
| `app/admin/templates/actions.ts` | Server actions for template CRUD |
| `lib/supabase/templates.ts` | `getFormTemplates()` server query |
| `supabase/migrations/001_initial_schema.sql` | Schema versioning tables (already in Phase 1 migration) |

---

## Open Items (Blockers)

| ID | Item | Status |
|----|------|--------|
| B1 | Site Risk template content | Awaiting Matt's input via Finley |
| B10 | Editable-forms ambiguity — can clients edit templates? | Awaiting Finley answer |

---

*Phase 3 is functionally complete for the admin view. The Site Risk template will be fleshed out once Matt supplies content.*
