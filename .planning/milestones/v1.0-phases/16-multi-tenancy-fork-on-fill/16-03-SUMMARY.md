---
phase: 16-multi-tenancy-fork-on-fill
plan: "03"
plan_id: 16-03
subsystem: admin-assignments-views
tags: [admin, queue, tabs, rsc, multi-tenancy, soft-delete]
dependency_graph:
  requires: [16-01, 16-02]
  provides: [/admin/assignments queue, AssignedFormsTab, activeAssignmentCounterPill]
  affects:
    - app/admin/assignments/page.tsx (new)
    - app/admin/clients/[id]/page.tsx (extended with assignments + publishedTemplates fetches)
    - app/admin/clients/[id]/client-tabs.tsx (extended with Assigned Forms tab)
    - app/admin/clients/page.tsx (extended with counter pill aggregate)
tech_stack:
  added:
    - app/admin/assignments/page.tsx (RSC, force-dynamic, searchParams filters)
    - app/admin/assignments/revoke-assignment-button.tsx (client island, AlertDialog)
    - app/admin/clients/_components/active-pill.tsx (client island, base-ui Tooltip)
  patterns:
    - Link-based server filter bar (no client state, preserves RSC contract)
    - PostgREST join via `client:clients(id, name)` and `template:form_templates(id, name)`
    - Single aggregate GROUP-BY-in-JS pattern for counter pill (fetch-then-Map, no N+1)
    - Soft-delete guard .is("deleted_at", null) on all form_assignments reads (T-16-08)
key_files:
  created:
    - app/admin/assignments/page.tsx
    - app/admin/assignments/revoke-assignment-button.tsx
    - app/admin/clients/_components/active-pill.tsx
  modified:
    - app/admin/clients/[id]/page.tsx
    - app/admin/clients/[id]/client-tabs.tsx
    - app/admin/clients/page.tsx
decisions:
  - "Link-based filter bar for /admin/assignments: server filters via URL searchParams, no Select dropdowns needing client state — keeps the page pure RSC and avoids hydration overhead."
  - "Counter pill as separate client island (_components/active-pill.tsx): page.tsx is a server component; base-ui Tooltip requires use-client, so the pill is extracted to avoid converting the whole page."
  - "RevokeAssignmentButton re-used from app/admin/assignments/ in client-tabs.tsx via @/app/admin/assignments/revoke-assignment-button import — no duplication, single source of truth."
  - "assignmentRows cast as any[] when passing to ClientTabs: PostgREST returns template join as array shape at runtime but TypeScript expects the AssignmentRow interface. Safe because template is accessed via ?. null checks in the component."
  - "base-ui TooltipTrigger does not support asChild (same constraint as Plan 02 Dialog): styled the TooltipTrigger element directly via className instead."
metrics:
  duration_minutes: 35
  tasks_completed: 3
  files_created: 3
  files_modified: 3
  completed_date: "2026-05-26"
---

# Phase 16 Plan 03: Admin Assignment Views Summary

**One-liner:** RSC queue page at `/admin/assignments` with status/client/template filters + active count pill on clients list + "Assigned Forms" tab on `/admin/clients/[id]` with `AssignTemplateModal` mount.

---

## What Was Delivered

### Task 1: /admin/assignments queue page

**app/admin/assignments/page.tsx** — Pure RSC page, `export const dynamic = "force-dynamic"`.

- `searchParams` awaited per Next.js 16 async-prop requirement.
- `adminClient` query: `form_assignments` with joins to `clients` and `form_templates` via PostgREST `client:clients(id, name)` and `template:form_templates(id, name)`.
- Soft-delete guard: `.is("deleted_at", null)` (T-16-08 mitigation).
- Ordered by `due_date ASC, nullsFirst: false`.
- Conditional filters: `.eq("status", status)`, `.eq("client_id", client)`, `.eq("template_id", template)` — only applied when the searchParam is a non-empty string.
- Page header: back arrow + mono `07 ASSIGNMENT QUEUE` + serif `Active Assignments` h2.
- Filter bar: `Link`-based status pill groups (All | Pending | In progress | Completed) preserving existing searchParams on click.
- Table columns: Template | Client | Due Date | Status | Instructions (line-clamp-2) | Actions.
- Status pill colours per UI-SPEC: `pending=#666/bg-[#555]/10`, `in_progress=#c0a66d/bg-[#c0a66d]/10`, `completed=#3b8273/bg-[#3b8273]/10`.
- Due-date colour coding: overdue=`#e55a3a`, within 3 days=`text-gold`, otherwise=`#666`.
- Empty state with "Clear filters" link back to `/admin/assignments`.

**app/admin/assignments/revoke-assignment-button.tsx** — `"use client"` island.

- `useTransition` for non-blocking revoke.
- `AlertDialog` with locked copy: title "Revoke this assignment?", body "The client will no longer see this form in their Assigned Forms list.", cancel "Keep assignment", confirm "Revoke assignment".
- On confirm: calls `revokeAssignment(assignmentId)` → toast.success "Assignment revoked" → router.refresh().
- Error toast: "Revoke failed — please try again".

### Task 2: Assigned Forms tab on /admin/clients/[id]

**app/admin/clients/[id]/page.tsx** — Extended with two new fetches:

1. `adminClient.from("form_assignments").select("id, status, due_date, instructions, created_at, template:form_templates(id, name)").eq("client_id", id).is("deleted_at", null).order("created_at", { ascending: false })`
2. `adminClient.from("form_templates").select("id, name").eq("is_published", true).is("deleted_at", null).order("name")` — for the AssignTemplateModal picker.

Both results passed to `<ClientTabs>` as `assignments` and `publishedTemplates` props.

**app/admin/clients/[id]/client-tabs.tsx** — Extended:

- New `AssignmentRow` interface exported alongside existing types.
- `ClientTabsProps` extended with optional `assignments?: AssignmentRow[]` and `publishedTemplates?: Array<{ id: string; name: string }>` (both default to `[]` — existing call-sites unaffected).
- New `<TabsTrigger value="assignments">Assigned Forms{activeCount > 0 ? ` (${activeCount})` : ""}</TabsTrigger>` — active count = assignments where `status !== 'completed'`.
- New `<TabsContent value="assignments">` with:
  - Header row: "Assigned forms" h3 on left + `<AssignTemplateModal preselectClientId={clientId} clients={[]} templates={publishedTemplates} triggerLabel="Assign template" />` on right.
  - Per-row: template name (serif font-medium), mono metadata (`DUE · {date}` + status pill), instructions (line-clamp-2, conditional), `<RevokeAssignmentButton>` for non-completed rows.
  - Empty state with "Assign template" guidance.

### Task 3: Active-assignment counter pill on /admin/clients list

**app/admin/clients/page.tsx** — Extended:

- Single aggregate query: `form_assignments` with `status IN (pending, in_progress)` and `.is("deleted_at", null)` — builds `Map<clientId, count>` in JS (no N+1, consistent with Pitfall 7 codebase precedent for ~7-8 clients).
- `<ActivePill count={...} />` rendered inline next to client name.

**app/admin/clients/_components/active-pill.tsx** — `"use client"` island:

- Returns `null` when `count === 0` (no "0" rendered — empty is the affordance per UI-SPEC).
- `TooltipProvider` > `Tooltip` > `TooltipTrigger` + `TooltipContent` wrapping the pill span.
- Tooltip text: `{N} active assignment{s}` (pluralised).
- Pill colour: `text-[#c0a66d] bg-[#c0a66d]/10` (earth amber, per UI-SPEC Route A).

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] PostgREST join type mismatch — `any` cast required**
- **Found during:** Task 1 and Task 2 TypeScript check
- **Issue:** PostgREST TypeScript types return joined rows as `{ id: any; name: any; }[]` (array) but the component interfaces declare them as single objects or `null`. TypeScript raised TS2352 / TS2322 errors.
- **Fix:** Cast join results via `(row.template as any) as { id: string; name: string } | null` and `(assignmentRows ?? []) as any[]` at the call sites. The runtime access uses `?.` null-safe chaining throughout, so this is safe.
- **Files modified:** `app/admin/assignments/page.tsx`, `app/admin/clients/[id]/page.tsx`
- **Commit:** d9c4a32

**2. [Rule 1 - Bug] base-ui TooltipTrigger does not support `asChild`**
- **Found during:** Task 3 TypeScript check
- **Issue:** Attempted `<TooltipTrigger asChild><span>...</span></TooltipTrigger>` — same constraint as Plan 02 Dialog fix. Base UI's Trigger does not expose `asChild` prop.
- **Fix:** Styled the `TooltipTrigger` element directly via `className` prop instead of wrapping a `<span>`. Matches the Plan 02 precedent of styling directly rather than using the asChild pattern.
- **Files modified:** `app/admin/clients/_components/active-pill.tsx`
- **Commit:** d9c4a32

**3. [Pre-existing] npm run build fails due to react-leaflet + @react-pdf/renderer missing**
- **Found during:** Overall verification build
- **Issue:** Same pre-existing errors documented in Plan 02 Summary — `react-leaflet` not installed, `@react-pdf/renderer` missing. These errors exist on the base commit prior to any Plan 16-03 changes.
- **Fix:** None — out of scope. TypeScript check on Plan 16-03 files passes cleanly.
- **Impact:** `npm run build` does not complete. Our specific files have no TypeScript errors.

---

## Known Stubs

None. All data comes from live Supabase queries via `adminClient`. No hardcoded catalogs, mock data, or placeholder values in the shipping code paths.

---

## Threat Surface Scan

No new network endpoints, auth paths, or trust boundaries beyond the plan's threat model.

- `/admin/assignments` page uses `adminClient` (service-role) in a server component, gated by the existing admin proxy (same pattern as all other admin RSC pages).
- `RevokeAssignmentButton` calls `revokeAssignment` which enforces `requireActorUserId("admin")` (T-16-07 — confirmed gate from Plan 02).
- All `form_assignments` reads include `.is("deleted_at", null)` (T-16-08 mitigation — grep-verified in acceptance criteria).

---

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| `app/admin/assignments/page.tsx` exists | PASS |
| `app/admin/assignments/revoke-assignment-button.tsx` exists | PASS |
| `app/admin/clients/_components/active-pill.tsx` exists | PASS |
| `app/admin/clients/[id]/page.tsx` modified (assignments fetch) | PASS |
| `app/admin/clients/[id]/client-tabs.tsx` modified (Assigned Forms tab) | PASS |
| `app/admin/clients/page.tsx` modified (counter pill) | PASS |
| Commit f18a931 exists | PASS |
| Commit 25d2336 exists | PASS |
| Commit 6598e4a exists | PASS |
| Commit d9c4a32 exists (TS fixes) | PASS |
| All 27 acceptance criteria pass | PASS |
| TypeScript errors on plan-03 files | NONE |
