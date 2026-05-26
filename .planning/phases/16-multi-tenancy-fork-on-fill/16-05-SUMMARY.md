---
phase: 16-multi-tenancy-fork-on-fill
plan: "05"
plan_id: 16-05
subsystem: client-assignments
tags: [client, fork, redirect, server-action, alert-dialog]
dependency_graph:
  requires: [16-01, 16-02, 16-04]
  provides: [forkAssignedTemplate, CustomiseFirstButton, fork-assigned-template tests]
  affects:
    - app/client/assignments/actions.ts
    - app/client/assignments/[id]/customise-first-button.tsx
    - app/client/assignments/[id]/page.tsx
    - tests/form-builder/fork-assigned-template.test.ts
tech_stack:
  added: []
  patterns:
    - "pinned-version fetch by exact ID (D-05 — not latest published)"
    - "fork insert: owner_type=customer, owner_id=org, parent_template_id (AGENTS.md polymorphic contract)"
    - "redirect-last-outside-catch pattern (PITFALL 1 compliance)"
    - "NEXT_REDIRECT bubble pattern in client component (AlertDialog + useTransition)"
    - "defense-in-depth client_id ownership check before any write (T-16-03)"
key_files:
  created:
    - app/client/assignments/[id]/customise-first-button.tsx
  modified:
    - app/client/assignments/actions.ts
    - app/client/assignments/[id]/page.tsx
    - tests/form-builder/fork-assigned-template.test.ts
decisions:
  - "redirect() is last statement in forkAssignedTemplate, outside all try/catch blocks — Next.js PITFALL 1 compliance"
  - "forkAssignedTemplate reads pinned version by .eq(\"id\", assignment.template_version_id) — never latest published — satisfying D-05"
  - "AlertDialogAction uses bg-[#1a1a1a] black-fill class (not destructive variant) since fork is a create action, per UI-SPEC"
  - "Pre-existing build failures (@react-pdf/renderer, leaflet, form-renderer) confirmed not caused by this plan — out of scope per deviation boundary rule"
  - "forkOnFill deletion and schema-diff orphan cleanup deferred to Plan 06 per plan spec (avoid wave-3 file-overlap)"
metrics:
  duration_minutes: 15
  tasks_completed: 2
  files_created: 1
  files_modified: 3
  completed_date: "2026-05-26"
---

# Phase 16 Plan 05: Customise-First Fork Flow Summary

**One-liner:** forkAssignedTemplate server action (11-step write ending in redirect-outside-catch) + CustomiseFirstButton AlertDialog client component with locked UI-SPEC copy, mounted on the assignment landing page replacing the Plan 04 placeholder.

---

## What Was Delivered

### Task 1: forkAssignedTemplate server action + test scaffold replacement

**app/client/assignments/actions.ts** (appended `forkAssignedTemplate`):

Multi-step server action with signature `(assignmentId: string): Promise<never>`:

1. `requireClientContext()` — throws "Not a client user" (T-16-07)
2. `requireActorUserId("client")` — for `template_versions.created_by`
3. `createClient()` — RLS-aware, never admin client (T-16-06)
4. Read assignment row: `select("id, client_id, template_id, template_version_id, deleted_at").eq("id", assignmentId).single()` — throws "Assignment not found", "Forbidden: not your assignment" (T-16-03), "Cannot fork a revoked assignment"
5. Read pinned version **by exact ID**: `.from("template_versions").select("schema_json").eq("id", assignment.template_version_id).single()` — D-05 fidelity, NOT by template_id + latest
6. Read master metadata: `.from("form_templates").select("name, template_type").eq("id", assignment.template_id).single()`
7. Insert fork `form_templates`: `{ owner_type: "customer", owner_id: ctx.client_id, parent_template_id: assignment.template_id, is_published: true }` — D-08, AGENTS.md polymorphic contract
8. Insert v1 `template_versions`: `{ template_id: fork.id, version_number: 1, schema_json: pinned.schema_json, published_at: new Date().toISOString(), created_by: userId }` — D-08 auto-publish
9. Update `form_assignments`: `{ template_id: fork.id, template_version_id: v1.id }` — D-06 rewire
10. `revalidatePath("/client/assignments"); revalidatePath("/client/templates")`
11. `redirect(\`/client/templates/${fork.id}/edit\`)` — LAST statement, outside any try/catch

**tests/form-builder/fork-assigned-template.test.ts** (scaffold replaced):

6 real assertions replacing 5 `it.todo` stubs:
- **(a)** Reads `template_versions` via `.eq("id", MASTER_VERSION_ID)` — D-05 pin fidelity
- **(b)** `form_templates` insert includes `owner_type: "customer"`, `owner_id: "client-org-001"`, `parent_template_id: MASTER_TEMPLATE_ID`, `is_published: true` — D-08
- **(c)** `template_versions` insert includes `version_number: 1`, non-null `published_at`, and `schema_json` referentially equal to pinned source — D-05 + D-08
- **(d)** `form_assignments` UPDATE payload includes `template_id: FORK_ID, template_version_id: V1_ID` — D-06
- **(e)** `redirect` called with `/client/templates/${FORK_ID}/edit` — D-07
- **(f)** `revalidatePath` called with both `/client/assignments` and `/client/templates`

All 6 tests pass (`npm test -- tests/form-builder/fork-assigned-template.test.ts --run` exits 0).

### Task 2: CustomiseFirstButton client component + landing page mount

**app/client/assignments/[id]/customise-first-button.tsx** (new file):

- `"use client"` component `CustomiseFirstButton({ assignmentId: string })`
- Renders an outline `Button` labelled "Customise first" triggering `open` state
- `AlertDialog` with locked UI-SPEC Route E copy:
  - Title: `"Create your own copy?"`
  - Description: `"This creates your organisation's version of this form. Changes to the original won't carry over to your copy."`
  - Cancel: `"Keep original"` (AlertDialogCancel)
  - Action: `"Create my copy"` / `"Creating copy…"` when pending (AlertDialogAction with `bg-[#1a1a1a] text-white` — NOT destructive)
- `handleConfirm`: `startTransition(async () => { try { await forkAssignedTemplate(assignmentId) } catch (err) { bubble NEXT_REDIRECT; else toast.error("Could not create your copy. Please try again.") } })`
- Action button disabled and label changes to "Creating copy…" while pending

**app/client/assignments/[id]/page.tsx** (modified):

- Imported `CustomiseFirstButton from "./customise-first-button"`
- Removed Plan 04 disabled placeholder button + `"Plan 05 wires"` comments
- Mounted `<CustomiseFirstButton assignmentId={id} />` in the CTA row alongside `<FillAsIsButton>`

---

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

### Design Notes

**Pre-existing build failures confirmed out of scope:**
- `Module not found: @react-pdf/renderer`, `leaflet`, `react-leaflet`, `@/components/forms/form-renderer` — verified present on base commit `e7ec74c` before any plan-05 changes. These are not caused by this plan and are out of scope per deviation boundary rules. Logged to scope boundary.

---

## Known Stubs

None — the Plan 04 "Customise first" disabled placeholder is fully replaced with the real `CustomiseFirstButton` wired to `forkAssignedTemplate`.

---

## Threat Surface Scan

All threats from the plan's `<threat_model>` are mitigated:

| Threat | Component | Mitigation | Verified |
|--------|-----------|-----------|---------|
| T-16-03 EoP: Cross-org fork | forkAssignedTemplate | `assignment.client_id !== ctx.client_id` check before any write | Code review + test (a) exercises the fetch path |
| T-16-06 Service-role import | app/client/assignments/ | `createClient` (RLS-aware) only — zero `lib/supabase/admin` imports | `grep -rn "from \"@/lib/supabase/admin\"" app/client/assignments/` returns 0 hits |
| T-16-07 No client claim | forkAssignedTemplate | `requireClientContext()` + `requireActorUserId("client")` first | Code review |
| T-16-01 Cross-org schema read | forkAssignedTemplate | RLS on template_versions + form_assignments enforced by RLS-aware client | Schema-level |

No new threat surface introduced beyond what the plan declared.

---

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| `app/client/assignments/actions.ts` contains `forkAssignedTemplate` | PASS |
| `app/client/assignments/actions.ts` contains `owner_type: "customer"` | PASS |
| `app/client/assignments/actions.ts` contains `parent_template_id` | PASS |
| `app/client/assignments/actions.ts` contains `is_published: true` | PASS |
| `app/client/assignments/actions.ts` contains `version_number: 1` | PASS |
| `app/client/assignments/actions.ts` contains redirect outside try/catch | PASS |
| `app/client/assignments/[id]/customise-first-button.tsx` exists | PASS |
| `customise-first-button.tsx` contains all 4 locked AlertDialog copy strings | PASS |
| `customise-first-button.tsx` contains error toast string | PASS |
| `customise-first-button.tsx` contains pending label "Creating copy…" | PASS |
| `app/client/assignments/[id]/page.tsx` imports CustomiseFirstButton | PASS |
| `app/client/assignments/[id]/page.tsx` does NOT contain "Plan 05 wires" | PASS |
| `tests/form-builder/fork-assigned-template.test.ts` has 0 `it.todo` | PASS |
| `npm test -- tests/form-builder/fork-assigned-template.test.ts --run` exits 0 | PASS (6/6) |
| `grep -rn "from \"@/lib/supabase/admin\"" app/client/assignments/` = 0 hits | PASS (T-16-06) |
| Commit 1ae7acd exists | PASS |
| Commit 95c598d exists | PASS |
