# Admin client removal — deactivate + hard delete

**Date:** 2026-06-08
**Surface:** Admin portal (`/admin/clients`)
**Status:** Approved design — ready for implementation plan

## Problem

The admin portal has no way to remove a client. `app/admin/clients/actions.ts`
exposes `createClient`, `updateClientHours`, `inviteClientUser`, and
`revokeClientUser` (user-level) — but nothing to deactivate or delete a client
org. The `clients.active` boolean exists (set `true` on create) but is never
surfaced or toggled, and `ActivePill` shows active *assignment* count, not the
client's active state.

## Goal

Give admins two distinct capabilities, both on the client detail page:

1. **Deactivate / Reactivate** — reversible. Flips `clients.active`. All data
   retained.
2. **Hard delete** — irreversible. Permanently removes the client and every
   related record (assignments, submissions, field media, reports, documents,
   hours transactions, proposals, signatures, portal users, notifications,
   customer-owned templates) plus Storage objects.

## Non-goals

- Bulk delete / list-row delete menus (detail page only).
- A separate `contracts` table delete — contracts are signed proposals; they
  cascade via `proposals`.
- Hiding inactive clients from the list (we badge them instead, see §UI).

## Database — migration `021_client_delete_cascades.sql`

Current FK `ON DELETE` behavior for `clients(id)` references:

| Table | ON DELETE | Action |
|---|---|---|
| `client_users` | CASCADE | ok |
| `form_assignments` | CASCADE | ok |
| `documents` | CASCADE | ok |
| `hours_transactions` | CASCADE | ok |
| `proposals` | CASCADE | ok (→ `proposal_signatures` cascade) |
| `form_submissions.client_id` | **none** | **add CASCADE** |
| `notifications_sent.client_id` | **none** | **add CASCADE** |

Also `form_submissions.assignment_id → form_assignments(id)` has no `ON DELETE`,
which would block the `form_assignments` cascade — **add CASCADE** there too.
`field_media.submission_id → form_submissions(id)` is already CASCADE, so media
rows follow submissions automatically.

The migration drops and re-adds each of the three constraints with
`ON DELETE CASCADE`. It is idempotent: guard each `ALTER TABLE ... DROP
CONSTRAINT` with `IF EXISTS` and look up the real constraint names (Postgres
auto-names them `<table>_<col>_fkey` by default; the migration confirms via
`information_schema` / `pg_constraint` before re-adding).

After the migration, deleting a `clients` row atomically cascades the entire
relational subtree.

## Server actions — `app/admin/clients/actions.ts`

Both gated by `requireAdmin()` (matches the file convention; service-role
`adminClient` bypasses RLS).

### `setClientActive(clientId: string, active: boolean)`
- `requireAdmin()`
- `update clients set active = :active where id = :clientId`
- `revalidatePath("/admin/clients")`, `revalidatePath(\`/admin/clients/${clientId}\`)`, `revalidatePath("/admin")`
- Returns `{ ok: true, active }`. Used by both Deactivate and Reactivate.

### `deleteClient(clientId: string, confirmationName: string)`
1. `requireAdmin()`.
2. Re-fetch `clients.name` by id. If not found → return `{ ok: false, error }`.
3. **Server-side name guard:** if `confirmationName.trim() !== client.name`
   → `{ ok: false, error: "Name does not match" }`. Defense-in-depth beyond the
   client-side gate.
4. **Storage cleanup (best-effort):** list objects under prefix `${clientId}/`
   in the `reports` and `form-media` buckets and remove them. On a list/remove
   failure, insert a `workflow_errors` row
   (`workflow_name: "client_delete_storage"`, payload includes `clientId`) and
   **continue** — a few orphaned objects in a bucket are lower-risk than a
   half-deleted client. (Same philosophy as the report-delivery path in
   `assessments/actions.ts`.)
5. **Customer-owned templates:** delete `form_templates` where
   `owner_type = 'customer' AND owner_id = :clientId` (polymorphic, no DB FK —
   per `AGENTS.md`). Their `template_versions` cascade via the templates FK.
6. **Delete the client row** — DB cascades everything relational.
7. `revalidatePath("/admin/clients")`, `revalidatePath("/admin")`.
8. Returns `{ ok: true }`. Caller redirects to `/admin/clients`.

Ordering note: storage + customer-template cleanup run **before** the row
delete so the `clientId` is still resolvable; the row delete is the final,
atomic step.

## UI

### `app/admin/clients/[id]/client-danger-zone.tsx` (new client component)
Rendered at the bottom of the client detail page. Two controls:

- **Deactivate / Reactivate** — label and behavior driven by the client's
  current `active`. Simple `Dialog` confirm ("Deactivate <name>? They'll be
  marked inactive but all data is kept."). Calls `setClientActive`.
- **Delete permanently** — opens a `Dialog` that:
  - Lists what will be erased, with counts passed in as props from the detail
    page. Reuse counts the detail page already fetches (assignments, portal
    users); for any not already loaded (e.g. submissions, reports), add a single
    lightweight `count`-only query in the page RSC rather than fetching rows.
  - Has a text input requiring the **exact client name**. The Delete button
    stays `disabled` until `input.trim() === client.name`.
  - On confirm, calls `deleteClient(clientId, input)`; on `{ok:true}` the
    component triggers navigation to `/admin/clients` (router.push) and a
    success toast; on error, shows the error inline and keeps the dialog open.

Uses existing primitives: `@/components/ui/dialog`, `@/components/ui/button`,
`sonner` toast, `lucide-react` icons (`Power`/`PowerOff`, `Trash2`).

### Inactive badge
- `client-row.tsx`: when `active === false`, render a small mono "Inactive"
  badge near the name (distinct from `ActivePill`, which is assignment count).
  Requires threading `active` into `ClientRowProps` and selecting it in the
  list query (`app/admin/clients/page.tsx`).
- Client detail header: same "Inactive" badge when `active === false`.
- Inactive clients remain in the list (not hidden) so Reactivate is
  discoverable.

## Authorization

- Both actions call `requireAdmin()` — the established gate for service-role
  writes in this file. No client-surface exposure.
- `deleteClient` re-validates the confirmation name server-side; the
  client-side disabled button is UX, not the security boundary.

## Testing — `tests/admin/` (mock style mirrors existing server-action tests)

- `setClientActive`: updates `active`, revalidates.
- `deleteClient`:
  - rejects when `confirmationName` ≠ stored name (no deletes fire);
  - calls Storage list+remove for both buckets under the `${clientId}/` prefix;
  - deletes customer-owned `form_templates` before the client row;
  - issues the final `clients` delete;
  - on storage-cleanup failure, logs `workflow_errors` and still deletes the row.
- `vitest.config.ts` does **not** currently include `tests/admin/**` — the plan
  adds that glob to the `include` array (alongside the existing dirs) so these
  tests run.

## Risks

- **Irreversible deletion.** Mitigated by the type-the-name guard (client + server)
  and the explicit "what gets erased" summary.
- **Migration on production FKs.** Low-risk DDL (constraint swap), idempotent.
- **Storage orphans on partial failure.** Accepted; logged to `workflow_errors`
  for later cleanup rather than blocking the delete.
