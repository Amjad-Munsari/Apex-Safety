# Phase 16: Multi-Tenancy + Fork-on-Fill - Context

**Gathered:** 2026-05-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Stand up the two confirmed Form Builder use cases:

- **Use Case A — Admin assigns + fork-on-fill.** Matt assigns a published master template to one or more client orgs with an optional due date and an optional "Instructions for client" note. When a client opens the assignment, they choose **Fill as-is** (interpreter against the assignment's pinned version) or **Customise first** (synchronously fork the assignment's pinned version into a customer-owned template and redirect to the builder). The assignment row is then auto-rewritten to point at the fork; the master is never mutated.
- **Use Case B — Customer-built from scratch.** Any client_user in an org can open the builder under `/client/templates` ("My Templates") and create a template that's customer-owned (`owner_type='customer'`, `owner_id=clients.id`). Customer-built templates are fill-only within the org — no cross-org assignment in v1.

RLS keeps templates and submissions strictly org-scoped; a CI RLS test in `tests/rls/` proves it on every push.

**In scope:**
- Assignment server action + admin UI (entry points on `/admin/templates/[id]` AND `/admin/clients/[id]`, multi-select clients, optional `due_date` + `instructions`).
- Per-client "Assigned forms" tab on `/admin/clients/[id]` + top-level `/admin/assignments` queue page.
- Client `/client/assignments` route (Active + Completed tabs) replacing the assignment-shaped portion of `/client/templates`.
- `/client/assignments/[id]` landing page with **Fill as-is** + **Customise first** buttons.
- Fork-on-click server action: copy the assignment's pinned `template_version_id` into a new customer-owned template, auto-publish at v1, rewrite the originating `form_assignments` row to point at the fork, redirect to `/client/templates/[fork_id]/edit`.
- Assignment status lifecycle: `pending → in_progress → completed`, plus revoke via `deleted_at`.
- `form_assignments.instructions` migration; if needed, helper RPC for org-scoped status transitions.
- `/client/templates` retained as **My Templates only** — the "Available admin masters" browse list is removed.
- Automated cross-org RLS test in `tests/rls/` (two orgs, supabase-js, asserts empty cross-reads on `form_templates`, `template_versions`, `form_submissions`, `form_assignments`).

**Out of scope (deferred to other phases):**
- Recurring assignments / scheduled reminders — Phase 17.
- FRA seed template that exercises the whole module — Phase 18.
- In-org user-to-user assignment (multi-user customers assigning to each other) — deferred.
- E-signature / contracts on submissions — out of milestone.
- Reviewed/approved sub-states beyond `completed` (admin-side review queue is Phase 7/10 territory).

</domain>

<decisions>
## Implementation Decisions

### Assignment surface (Area 1)

- **D-01:** **Assign action lives on BOTH `/admin/templates/[id]` and `/admin/clients/[id]`**, backed by a single shared server action (`createAssignments(templateId, clientIds[], { dueDate?, instructions? })`) and a single shared modal. The two entry points are thin shells over the same component. Reason: Matt thinks both template-first ("send this to clients") and client-first ("what does this client need next?") — pick-one-and-redirect would leave half the workflows missing the affordance.
- **D-02:** **Multi-select clients per assignment action.** The modal exposes one template + a checkbox list of clients + one shared `due_date` + one shared `instructions`. Submitting writes N rows to `form_assignments` (one per selected client). No per-row override of due_date or instructions in v1 — if Matt needs different due dates, he runs the modal twice.
- **D-03:** **Assignments are mutable until submitted.** Matt can edit `due_date` and `instructions` post-creation, and can revoke via soft-delete (`form_assignments.deleted_at = now()`). Once `status = 'completed'` the row becomes immutable. Reason: pre-launch workflow is forgiving; full audit trail isn't worth the rigidity.
- **D-04:** **Add `form_assignments.instructions TEXT NULL`** via a new migration. Shown above the form when the client opens the assignment. Optional; default null.

### Fork base + assignment re-link (Area 2)

- **D-05:** **Fork copies the assignment's pinned `template_version_id`**, NOT the master's latest published version. The client edits exactly what Matt sent them, even if a newer master version was published after the assignment was created. Eliminates "why does my fork have fields that weren't in the form I saw yesterday?" surprises.
- **D-06:** **The originating `form_assignments` row is auto-rewritten to point at the fork** on fork creation: `template_id := fork.id`, `template_version_id := fork's v1`. The submission then lands cleanly against the fork and `status` flips to `completed` on submit through the normal path. Admin still sees the relationship to the master via `form_templates.parent_template_id`. Reason: the "spawn-a-new-assignment" alternative doubles row counts in the lifecycle list; the "leave dangling" alternative leaves an obviously-broken assignment row visible to the client forever.
- **D-07:** **Two buttons on `/client/assignments/[id]`:** "Fill as-is" → `/client/assignments/[id]/fill` (interpreter against the assignment's pinned version); "Customise first" → confirmation prompt → synchronously creates fork → redirects to `/client/templates/[fork_id]/edit`. No mid-fill auto-fork. Matches build prompt §4b.
- **D-08:** **Forks auto-publish at v1 on creation.** Since the source is already a published master version, the fork's first version is born `published_at = now()`. Subsequent edits go through Phase 13's normal draft → publish flow (a "Save" creates a new draft version; "Publish" promotes it). Reason: avoid the "why can't I fill my own template?" trap when a client clicks Customise but doesn't realise they need a separate publish step.

### Forms-Assigned lifecycle UI (Area 3)

- **D-09:** **Two routes:** `/client/assignments` (assignment-scoped) and `/client/templates` (customer-owned only). The "browse all published admin masters" list currently in `app/client/templates/page.tsx` is **removed** — customers don't browse, they wait for an assignment or build their own. Resolves the `TODO(phaseB)` comment in that file.
- **D-10:** **`/client/assignments` has Active + Completed tabs.** Active = `status IN ('pending','in_progress') AND deleted_at IS NULL`. Completed = `status = 'completed' AND deleted_at IS NULL` with a "View submission" link. Revoked (`deleted_at IS NOT NULL`) rows are filtered out of both. Default tab = Active.
- **D-11:** **Assignment status lifecycle = `pending → in_progress → completed`** (plus revoke via `deleted_at`). Transition rules: `pending → in_progress` is set the first time the client creates a draft submission OR clicks "Fill as-is" (whichever happens first); `in_progress → completed` is set when the submission is submitted. Status is updated server-side via the existing submission server actions — clients never touch it directly.
- **D-12:** **Matt's view = per-client tab + global queue (BOTH).** Add an "Assigned forms" section/tab to `/admin/clients/[id]` (list of that client's assignments + statuses + counter pill on the clients list) AND a new top-level `/admin/assignments` queue (cross-client, sortable by due_date / status, filter by client / template). Reason: per-client tab serves the dominant "I'm working with this client" flow; global queue serves "who's overdue this week".

### Customer role gating (Area 4)

- **D-13:** **No new role flag — every `client_user` in the org sees "My Templates" + "Customise first".** Mirrors current RLS (migration 003) exactly. If a tighter gate is ever needed, it slots in cleanly as a future migration; v1 doesn't add a column we'd then have to backfill.
- **D-14:** **Customer-side template delete is org-level CRUD.** Any client_user in the org can delete (soft-delete via `form_templates.deleted_at`) any of their org's customer-owned templates, including forks created by a teammate. Rows with existing submissions stay visible as read-only; they're NOT hard-deleted (submission integrity).
- **D-15:** **Cross-org isolation is proven by an automated RLS test in `tests/rls/`.** A Vitest spec creates two test orgs + one client_user each, then asserts (via supabase-js with each user's session) that Org A's user cannot read Org B's rows on `form_templates`, `template_versions`, `form_submissions`, or `form_assignments`. Runs on every push. No manual UAT step required for the RLS check itself, though it'll be re-confirmed in the broader Phase 16 UAT walkthrough.
- **D-16:** **Customer-built templates are fill-only within the org.** No `form_assignments` rows are created for customer-built templates in v1. Any client_user can open the template from `/client/templates` and fill it; the resulting `form_submissions` row has `assignment_id = NULL` (requires `form_submissions.assignment_id` to become nullable — or we mark Customer-built submissions through a different table column — see Claude's Discretion).

### Claude's Discretion (planner / executor decides)

- **Schema for "submission without an assignment".** `form_submissions.assignment_id` is currently `NOT NULL` (migration 001). Options: (a) `ALTER TABLE form_submissions ALTER COLUMN assignment_id DROP NOT NULL`, (b) auto-create a sentinel "self-fill" `form_assignments` row when a customer fills their own template. Both work — planner picks based on RLS impact. Lean: option (a) with an `assignment_id IS NULL → owner-must-be-customer` CHECK constraint.
- **Wire format for the assign-action server action input.** `(templateId, clientIds[], { dueDate?, instructions? })` is one obvious shape; passing a single `payload` object may be cleaner with Server Actions. No external contract impact.
- **Whether the fork creation server action lives in `app/client/templates/actions.ts` (where `forkOnFill` already exists) or in a new `app/client/assignments/actions.ts`.** The existing `forkOnFill` is auto-trigger-on-structural-change; the new flow is an explicit button. Planner can either replace `forkOnFill` or layer an explicit `forkAssignedTemplate(assignmentId)` next to it. The auto-trigger one becomes dead code under the new UX.
- **Whether `/admin/assignments` queue is a server component with URL-state filters or a client component with local filter state.** UX-equivalent; pick whichever is consistent with `/admin/proposals` and `/admin/review-queue`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Build spec (read first)
- `.planning/research/form-builder-build-prompt.md` §"Phase 4 — Multi-Tenancy + Fork-on-Fill" (lines 400-457) — full flow narrative, role-gating table, done criteria.
  - **⚠ Spec discrepancy with live schema — downstream MUST follow the schema, not the build prompt.** The build prompt uses `owner_type='client'` and `owner_id=client_user_id`. The live contract (migration 003 + AGENTS.md) uses `owner_type='customer'` and `owner_id=clients.id` (the **org**, not a user). Apply the live schema everywhere; treat the build prompt's terminology as illustrative only.

### Architecture & ownership contract
- `AGENTS.md` "Form template ownership — customers can build and fork (resolved 2026-04-17)" — Option 3 decision, polymorphic `owner_id`, `owner_type IN ('admin','customer')`, `parent_template_id` for forks. Must NOT reshape without re-checking with Finley.
- `supabase/migrations/003_form_template_customer_ownership.sql` — current `form_templates` ownership schema + customer-CRUD RLS policies. This is the authoritative shape.
- `supabase/migrations/004_form_templates_rls_fixes.sql` — additional template RLS fixes.
- `supabase/migrations/005_template_versions_polymorphic_created_by.sql` — `template_versions.created_by` polymorphism.

### Schema (current state)
- `supabase/migrations/001_initial_schema.sql` lines 72-98 — `form_assignments` table (already has `client_id`, `template_id`, `template_version_id`, `assigned_by`, `due_date`, `status`, `deleted_at`); lines 84-98 — `form_submissions` (note: `assignment_id NOT NULL` — see Claude's Discretion).
- `supabase/migrations/001_initial_schema.sql` lines 278-289 — `form_assignments` RLS policies (admin all; client scoped via `client_users.client_id`).

### Requirements & Roadmap
- `.planning/ROADMAP.md` §"Phase 16: Multi-Tenancy + Fork-on-Fill" — goal + 5 success criteria.
- `.planning/REQUIREMENTS.md` §BUILDER-01..05 (multi-tenancy / fork subset, v2; re-quote pending).

### Prior phase context (carry-forward)
- `.planning/phases/13-form-builder-foundation/13-CONTEXT.md` — coltorapps integration decisions (D-01 builder engine, D-07 schema contract, D-08 `{entities, root}` shape). The builder reused on the client side is the same `TemplateBuilderClient`.
- `.planning/phases/13-form-builder-foundation/13-RESEARCH.md` — coltorapps API surface relevant to embedding the builder in `/client/templates/[id]/edit`.
- `.planning/phases/14-custom-field-types/14-CONTEXT.md` — `computedField` + `repeatingSection` scope/instance model; forks inherit these entities transparently.
- `.planning/phases/15-conditional-logic-engine/15-CONTEXT.md` — `visibilityRules` attribute + save-time cycle detection; forks must run the same validation on save/publish (D-08 in Phase 15).

### Code paths the planner will touch
- `app/admin/templates/[id]/page.tsx` + `app/admin/templates/_components/` — host for "Assign to clients" entry point.
- `app/admin/clients/[id]/page.tsx` + `app/admin/clients/_components/` — host for the other "Assign template" entry point AND the per-client "Assigned forms" tab.
- `app/admin/assignments/` — **new route**; top-level queue page.
- `app/client/templates/page.tsx` — to be simplified to "My Templates only"; the "Available admin masters" section is removed (resolves the `TODO(phaseB)` comment on line 17).
- `app/client/templates/actions.ts` — contains the existing `forkOnFill` (lines 214+) which uses an auto-trigger-on-structural-change contract. The new explicit-button flow (D-07) makes this dead code in its current form; planner decides replace vs layer.
- `app/client/assignments/` — **new route**; replaces the assignment-shaped portion of `/client/templates`. Includes `page.tsx` (Active/Completed tabs), `[id]/page.tsx` (Fill / Customise landing), `[id]/fill/page.tsx` (interpreter), `actions.ts` (`forkAssignedTemplate(assignmentId)` server action).
- `lib/auth-helpers.ts` — `getClientContext()` already exists; reuse.
- `lib/supabase/server.ts` + `lib/supabase/admin.ts` — RLS-aware vs service-role clients; the assign action uses the RLS client, the cross-org RLS test uses two RLS clients with different sessions.
- `tests/rls/` — **new directory**; first home for the cross-org RLS isolation spec.

### Migrations to land in Phase 16
- New migration: `013_phase16_assignments_instructions.sql` — adds `form_assignments.instructions TEXT NULL`.
- New migration: `014_phase16_customer_submissions.sql` (planner-discretion) — either `ALTER TABLE form_submissions ALTER COLUMN assignment_id DROP NOT NULL` + a CHECK constraint, OR introduces the sentinel-assignment approach. See Claude's Discretion above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`TemplateBuilderClient`** — the builder component used on `/admin/templates/[id]/edit` is already reusable across surfaces (Phase 13 D-01 + AGENTS.md). The new `/client/templates/[fork_id]/edit` and `/client/templates/new` routes mount the same component; no fork.
- **`getClientContext()` / `requireActorUserId('client')`** (`lib/auth-helpers.ts`) — already used by `app/client/templates/actions.ts`. Provides `{ user_id, client_id }`. The new assignments server actions reuse it verbatim.
- **`app/client/templates/_components/{new-client-template-button,client-template-card}.tsx`** — patterns for the customer-side template list. The new `/client/assignments` page mirrors these patterns; pull the same shadcn primitives.
- **`app/client/templates/actions.ts`** — contains `createClientTemplate`, `saveClientDraftAction`, `publishClientTemplateAction`, `deleteClientTemplate`, and `forkOnFill`. All run under the customer RLS client; the new assignment-fork action follows the same pattern (verify owned, mutate, `revalidatePath`).
- **`form_assignments` table + admin RLS policy** (migration 001) — already wired; no new tables, only one column add.
- **Phase 15 cycle detection + `validateRuleGraph`** — runs on save/publish for both admin and customer surfaces. Forks inherit this for free since they go through the same `publishClientTemplateAction` path.

### Established Patterns
- **Customer RLS is the trust boundary, not the UI.** Server actions in `app/client/...` use the standard RLS-aware Supabase client; they trust RLS to block cross-org writes. The actions add loud error-throws for clarity, but the security primitive is RLS itself (per Phase 13 RESEARCH).
- **Soft-delete via `deleted_at`** is the project-wide convention (`form_templates`, `form_assignments`, `form_submissions`, `documents`). New deletes follow the pattern; no hard `DELETE`.
- **Server actions live next to the page that calls them** (`app/admin/<route>/actions.ts`, `app/client/<route>/actions.ts`). Avoid putting `assignments/actions.ts` under `lib/` — pattern is route-local.
- **Schema versioning + pinning is sacred** (Phase 13 D-08). Every submission pins to a `template_version_id`. Forks must respect this — once a fork has a published v1, edits create new draft versions, not in-place mutations of v1.

### Integration Points
- **Admin "Assign to clients" modal** mounts in both `app/admin/templates/[id]/page.tsx` and `app/admin/clients/[id]/page.tsx` via a single shared component (`components/admin/assign-template-modal.tsx`). Both pages render `<AssignTemplateModal templateId? clientId? />` — one prop is pre-filled depending on entry point.
- **`/client/assignments/[id]` landing page** is the new fork-decision point. It reads the assignment, the template name + due_date + instructions, and renders two buttons.
- **Fork-on-click server action** (`forkAssignedTemplate(assignmentId)`) is the new canonical fork entry. It (1) verifies the assignment belongs to the requesting org, (2) copies the assignment's pinned `template_version_id` schema into a new customer-owned `form_templates` row with `parent_template_id = master_template_id`, (3) auto-publishes v1, (4) rewrites the assignment's `template_id` + `template_version_id` to point at the fork, (5) returns the fork id for redirect.
- **Submission status updates** flow through existing assessment / submission server actions; the status-machine transitions (`pending → in_progress → completed`) plug into the same path that already writes `form_submissions`.
- **Cross-org RLS test** (`tests/rls/multi-tenancy.spec.ts`) is a new Vitest target. Needs two Supabase test-user JWTs. Pattern: instantiate a `createClient(url, anonKey, { global: { headers: { Authorization: \`Bearer ${userAToken}\` } } })` per user, assert empty `.select()` results on cross-org IDs.

### Pre-existing scaffolding to reconcile
- **`forkOnFill` in `app/client/templates/actions.ts` (lines 214+)** uses an auto-trigger contract (`hasStructuralChanges(originalSchema, modifiedSchema)`). The locked decision D-07 is an **explicit-button** trigger. Planner should plan to replace this with `forkAssignedTemplate(assignmentId)` or keep the auto-trigger as a secondary path. The current auto-trigger is dead code under the new UX.
- **`app/client/templates/page.tsx`** has a `TODO(phaseB)` (lines 16-18) flagging exactly this work — "scope this through form_assignments so customers see only templates Matt has actually assigned to them". D-09 resolves it.

</code_context>

<specifics>
## Specific Ideas

- **Assignment modal should default `due_date` to "this week + 7 days"** in the date picker, leave empty if Matt clears it. Small ergonomics win; lifted from the existing `/admin/proposals` pattern.
- **"Customise first" requires a confirmation prompt** ("This will create your org's copy of this form. Updates to Matt's master won't reach your copy. Continue?"). Matches build prompt §4b spirit — clients should understand the no-cascade contract before committing.
- **The per-client "Assigned forms" counter pill on the admin clients list** shows count of `Active` assignments (D-10 definition). Matches how admins read overdue/in-flight at a glance.
- **The RLS test must include `form_assignments` itself**, not just templates / submissions. An overlooked policy on the assignments table would leak which forms Matt sent to a competing org.

</specifics>

<deferred>
## Deferred Ideas

- **Per-row due-date override in the multi-select modal** — useful when assigning the same template to three clients with different deadlines. Defer; for v1 Matt runs the modal twice if needed (D-02 lean).
- **Customer-side in-org assignment (client_user A → client_user B)** — build prompt §4d row "Assign templates: within own org only (future)". Out of Phase 16 scope per D-16; revisit when multi-user customer orgs become real.
- **"Browse all published admin masters" library for self-assign** — removed from `/client/templates` per D-09. If customers ever ask for it ("can I see what forms you have?"), we'd bring it back as a separate `/client/library` route. Defer.
- **Reviewed / approved sub-states on assignments** — D-11 stops at `completed`. The admin review queue (Phase 7/10) handles post-submission triage. If we ever want clients to see "Matt has reviewed", add a `reviewed_at` column on `form_submissions` and surface it in `/client/assignments` Completed tab. Defer.
- **Role-gated "template_admin" within an org** — D-13 leaves every client_user with full CRUD. If multi-user customer orgs grow, gate via `client_users.can_manage_templates BOOL`. Defer.
- **Hard delete of customer templates with submissions** — D-14 soft-deletes; submissions remain. If GDPR/right-to-be-forgotten ever needs a hard delete, design at that point. Defer.
- **`/admin/assignments` bulk actions** (mark all overdue as "reminded", export to CSV, etc.) — handy for Matt's review week. Defer until the queue page exists and we see actual usage.

</deferred>

---

*Phase: 16-multi-tenancy-fork-on-fill*
*Context gathered: 2026-05-26*
