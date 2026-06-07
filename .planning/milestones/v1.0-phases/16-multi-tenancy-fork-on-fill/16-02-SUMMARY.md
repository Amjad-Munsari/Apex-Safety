---
phase: 16-multi-tenancy-fork-on-fill
plan: "02"
plan_id: 16-02
subsystem: admin-assignments
tags: [admin, server-action, modal, shadcn, assignment, multi-tenancy]
dependency_graph:
  requires: [16-01]
  provides: [createAssignments, updateAssignment, revokeAssignment, AssignTemplateModal]
  affects: [app/admin/templates/[id]/page.tsx, app/admin/clients/[id]/page.tsx (Plan 03 consumer)]
tech_stack:
  added: [components/ui/checkbox.tsx (Base UI @base-ui/react/checkbox via shadcn base-mira), app/admin/assignments/actions.ts, components/admin/assign-template-modal.tsx]
  patterns: [useTransition server action invocation, shadcn Base UI dialog modal, soft-delete via deleted_at, requireActorUserId("admin") gate, service-role adminClient for admin pages]
key_files:
  created:
    - app/admin/assignments/actions.ts
    - components/admin/assign-template-modal.tsx
    - components/ui/checkbox.tsx
  modified:
    - app/admin/templates/[id]/builder-client.tsx (added assignButton?: React.ReactNode slot prop)
    - app/admin/templates/[id]/page.tsx (fetch clients + pass AssignTemplateModal as assignButton)
decisions:
  - "assignButton slot prop pattern: TemplateBuilderClient accepts a React.ReactNode prop to embed the modal in the toolbar without restructuring the full-screen builder layout"
  - "Base UI checkbox: shadcn base-mira style installs @base-ui/react/checkbox instead of @radix-ui/react-checkbox; onCheckedChange signature is (checked: boolean, eventDetails: ...) => void — compatible with our handler"
  - "Button trigger instead of DialogTrigger asChild: Base UI DialogPrimitive.Trigger does not support the asChild pattern; used Button with onClick={() => setOpen(true)} matching upload-document-modal.tsx pattern"
metrics:
  duration_minutes: 9
  tasks_completed: 3
  files_created: 3
  files_modified: 2
  completed_date: "2026-05-26"
---

# Phase 16 Plan 02: Admin Assignment Server Actions + Modal Summary

**One-liner:** Three server actions (createAssignments / updateAssignment / revokeAssignment) with `requireActorUserId("admin")` gates and a shared `AssignTemplateModal` mounted on the template builder page toolbar.

---

## What Was Delivered

### Task 1: shadcn Checkbox + server actions

**components/ui/checkbox.tsx** — Installed via `npx shadcn@latest add checkbox -y`. Uses `@base-ui/react/checkbox` (base-mira style variant). Exports `Checkbox` with `checked` / `onCheckedChange` / `defaultChecked` props.

**app/admin/assignments/actions.ts** — Three exported server actions:

```typescript
// Signature summary
export async function createAssignments(
  templateId: string,
  clientIds: string[],
  opts?: CreateAssignmentsInput   // { dueDate?: string; instructions?: string }
): Promise<{ created: number }>

export async function updateAssignment(
  assignmentId: string,
  patch: { dueDate?: string | null; instructions?: string | null }
): Promise<void>

export async function revokeAssignment(assignmentId: string): Promise<void>
```

All three functions call `requireActorUserId("admin")` as their first statement (T-16-02, T-16-07 mitigations).

- `createAssignments` resolves the latest published version via `.not("published_at", "is", null).order("version_number", { ascending: false }).limit(1).maybeSingle()`. Throws "Template has no published version" when none exists. Writes N rows to `form_assignments` via `adminClient`. Revalidates `/admin/assignments`, `/admin/clients`, `/admin/templates/[id]`, and each `/admin/clients/[clientId]`.
- `updateAssignment` reads current status; throws "Cannot edit a completed assignment" when `status === "completed"` (D-03 immutability gate). Performs sparse update — only sets `due_date` or `instructions` if present in `patch`. Revalidates `/admin/assignments` and `/admin/clients/[clientId]`.
- `revokeAssignment` sets `deleted_at = new Date().toISOString()` (soft-delete convention). Never uses `.delete()`. Revalidates same paths as updateAssignment.

### Task 2: AssignTemplateModal component

**components/admin/assign-template-modal.tsx** — `"use client"` component.

**Prop interface:**
```typescript
interface AssignTemplateModalProps {
  templateId?: string;           // pre-fills template picker
  preselectClientId?: string;    // pre-checks one client
  templates?: Array<{ id: string; name: string }>;  // picker options
  clients: Array<{ id: string; name: string }>;     // required
  triggerLabel?: string;         // defaults to "Assign to clients"
}
```

- Uses `useTransition` for the submit handler (not `<form action>`)
- Template picker (`<Select>`) hidden when `templateId` prop is provided
- Clients as scrollable `max-h-48 overflow-y-auto` checkbox grid using Base UI `<Checkbox>`
- Due date `<Input type="date" style={{ colorScheme: "dark" }}>` defaults to today + 7 days
- Instructions `<Textarea placeholder="Optional instructions for the client..." rows={3}>`
- Submit button gold accent, disabled when `!selectedTemplate || selectedClients.size === 0 || pending`
- Success toast: `Assigned to {N} client` / `Assigned to {N} clients` (pluralised)
- Error toast: locked copy `Assignment failed — please try again or contact support`
- Form resets on dialog close (including preselectClientId re-init)

**Locked copywriting strings shipped:**
- Trigger: `"Assign to clients"` (default; overridable via `triggerLabel`)
- Modal title: `"Assign template"`
- Submit button: `"Assign template"` / `"Assigning..."` (pending)
- Success toast: `Assigned to ${n} client${n > 1 ? "s" : ""}`
- Error toast (server): `"Assignment failed — please try again or contact support"`
- Error toast (validation): `"Select at least one client to assign"`

### Task 3: Mount on /admin/templates/[id]

**app/admin/templates/[id]/builder-client.tsx** — Added `assignButton?: React.ReactNode` prop to `TemplateBuilderClient`. The prop is rendered in the fixed toolbar div alongside the Save + Publish buttons.

**app/admin/templates/[id]/page.tsx** — Added:
1. `adminClient` import from `@/lib/supabase/admin`
2. `AssignTemplateModal` import from `@/components/admin/assign-template-modal`
3. Clients fetch: `adminClient.from("clients").select("id, name").is("deleted_at", null).order("name")`
4. `assignButton={<AssignTemplateModal templateId={id} clients={clients ?? []} triggerLabel="Assign to clients" />}` prop on `<TemplateBuilderClient>`

No existing logic (template fetch, version fetch, builder mount) was changed.

---

## Deviations from Plan

### Auto-fixed / Design Adaptations

**1. [Rule 1 - Bug] Base UI Dialog does not support DialogTrigger asChild pattern**
- **Found during:** Task 2
- **Issue:** `DialogTrigger` in this project uses `@base-ui/react/dialog` (base-mira style), not Radix UI. Base UI's `Trigger` does not have an `asChild` prop — using it caused TS2322 error.
- **Fix:** Used `<Button onClick={() => setOpen(true)}>` pattern matching `upload-document-modal.tsx` exactly (lines 87-93).
- **Files modified:** `components/admin/assign-template-modal.tsx`
- **Commit:** 43ea578

**2. [Rule 1 - Adaptation] assignButton slot prop for full-screen builder**
- **Found during:** Task 3
- **Issue:** `app/admin/templates/[id]/page.tsx` renders `<TemplateBuilderClient>` which takes over the entire viewport (`fixed inset-0`). Adding a separate element outside the client component would be behind the builder overlay.
- **Fix:** Added `assignButton?: React.ReactNode` slot prop to `TemplateBuilderClient`; render it in the toolbar. Page.tsx passes the modal as a JSX element. This is the minimal additive change — no existing props modified.
- **Files modified:** `app/admin/templates/[id]/builder-client.tsx`, `app/admin/templates/[id]/page.tsx`
- **Commit:** 10f54ac

**3. [Pre-existing] npm run build fails due to react-leaflet missing**
- **Found during:** Task 3 verification
- **Issue:** `components/form-interpreter/geolocation-map.tsx` imports `react-leaflet` which is not installed. This causes 4 Turbopack build errors. Pre-existing — same errors appear on the base commit before any of this plan's changes.
- **Fix:** None — out of scope (pre-existing issue from a prior phase). Not introduced by Plan 16-02.
- **Impact:** `npm run build` does not complete. TypeScript checks on our specific files pass cleanly.

---

## Known Stubs

None. The modal calls `createAssignments` which writes real DB rows. Due date defaults to today+7 (computed at render time, not hardcoded). Client list is fetched from the database, not mocked.

---

## Threat Surface Scan

No new network endpoints, auth paths, or trust boundaries introduced beyond what the plan's threat model declares. The `createAssignments` server action is protected by `requireActorUserId("admin")`. The `adminClient` (service-role) is used only on the server component page fetch (not exposed to client).

---

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| `components/ui/checkbox.tsx` exists | PASS |
| `app/admin/assignments/actions.ts` exists | PASS |
| `components/admin/assign-template-modal.tsx` exists | PASS |
| Commit b1bf3b9 exists | PASS |
| Commit 43ea578 exists | PASS |
| Commit 10f54ac exists | PASS |
