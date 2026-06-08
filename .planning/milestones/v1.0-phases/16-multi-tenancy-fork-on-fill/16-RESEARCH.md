# Phase 16: Multi-Tenancy + Fork-on-Fill - Research

**Researched:** 2026-05-26
**Domain:** Multi-tenant SaaS (Next.js 16 App Router + Supabase RLS), form-template assignment + customer-fork
**Confidence:** HIGH

## Summary

Phase 16 stands up two confirmed Form Builder use cases on top of Phases 13–15. The technical surface is mostly **server actions + RLS-scoped reads + one new column** — there's almost no net-new library work. The interesting risks are (1) the transactional fork-on-button server action that ends in a `redirect()`, (2) a brand-new `tests/rls/` cross-tenant Vitest suite (the project's first proper isolation harness — `tests/security.spec.ts` is a Playwright RLS test for `documents` only), and (3) reconciling the `form_submissions.assignment_id NOT NULL` constraint with customer-built fill-only templates.

Every external dependency is already installed and exercised in production: `@coltorapps/builder@0.2.4`, `@supabase/ssr@0.10.2`, `@supabase/supabase-js@2.105.1`, Vitest 3, Playwright. No new npm installs. The polymorphic `owner_id` contract from migration 003 covers the data model — we add **one** column (`form_assignments.instructions`) and **one** constraint relaxation (`form_submissions.assignment_id` nullability).

**Primary recommendation:** Build the fork-on-click server action as a multi-step JS function on the customer's RLS-aware client (NOT a Postgres RPC — the codebase has zero `.rpc()` callsites; introducing one breaks the pattern). Wrap the redirect in a top-level `try`-then-`redirect-outside-catch` shape because `redirect()` throws `NEXT_REDIRECT` and would be swallowed by a catch. Use option (a) — `ALTER TABLE form_submissions ALTER COLUMN assignment_id DROP NOT NULL` plus a CHECK constraint — for customer self-fill (lighter than the sentinel-row approach and avoids a footgun where dangling sentinel `form_assignments` rows leak into the admin queue page).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Assignment surface (Area 1)**
- **D-01:** **Assign action lives on BOTH `/admin/templates/[id]` and `/admin/clients/[id]`**, backed by a single shared server action (`createAssignments(templateId, clientIds[], { dueDate?, instructions? })`) and a single shared modal. The two entry points are thin shells over the same component.
- **D-02:** **Multi-select clients per assignment action.** One template + checkbox list of clients + one shared `due_date` + one shared `instructions`. Submitting writes N rows to `form_assignments`. No per-row override of due_date or instructions in v1.
- **D-03:** **Assignments are mutable until submitted.** Matt can edit `due_date` and `instructions` post-creation, and can revoke via soft-delete (`form_assignments.deleted_at = now()`). Once `status = 'completed'` the row becomes immutable.
- **D-04:** **Add `form_assignments.instructions TEXT NULL`** via a new migration. Shown above the form when the client opens the assignment.

**Fork base + assignment re-link (Area 2)**
- **D-05:** **Fork copies the assignment's pinned `template_version_id`**, NOT the master's latest published version. The client edits exactly what Matt sent them.
- **D-06:** **The originating `form_assignments` row is auto-rewritten to point at the fork** on fork creation: `template_id := fork.id`, `template_version_id := fork's v1`. Admin still sees the relationship to the master via `form_templates.parent_template_id`.
- **D-07:** **Two buttons on `/client/assignments/[id]`:** "Fill as-is" → `/client/assignments/[id]/fill` (interpreter against the assignment's pinned version); "Customise first" → confirmation prompt → synchronously creates fork → redirects to `/client/templates/[fork_id]/edit`. No mid-fill auto-fork.
- **D-08:** **Forks auto-publish at v1 on creation.** Since the source is already a published master version, the fork's first version is born `published_at = now()`. Subsequent edits go through Phase 13's normal draft → publish flow.

**Forms-Assigned lifecycle UI (Area 3)**
- **D-09:** **Two routes:** `/client/assignments` (assignment-scoped) and `/client/templates` (customer-owned only). The "browse all published admin masters" list currently in `app/client/templates/page.tsx` is **removed** — resolves the `TODO(phaseB)` comment in that file.
- **D-10:** **`/client/assignments` has Active + Completed tabs.** Active = `status IN ('pending','in_progress') AND deleted_at IS NULL`. Completed = `status = 'completed' AND deleted_at IS NULL` with a "View submission" link. Revoked rows are filtered out of both. Default tab = Active.
- **D-11:** **Assignment status lifecycle = `pending → in_progress → completed`** (plus revoke via `deleted_at`). `pending → in_progress` is set the first time the client creates a draft submission OR clicks "Fill as-is"; `in_progress → completed` is set on submit. Status is updated server-side via the existing submission server actions — clients never touch it directly.
- **D-12:** **Matt's view = per-client tab + global queue (BOTH).** Add an "Assigned forms" section/tab to `/admin/clients/[id]` (list of that client's assignments + statuses + counter pill on the clients list) AND a new top-level `/admin/assignments` queue.

**Customer role gating (Area 4)**
- **D-13:** **No new role flag — every `client_user` in the org sees "My Templates" + "Customise first".** Mirrors current RLS (migration 003) exactly.
- **D-14:** **Customer-side template delete is org-level CRUD.** Any client_user in the org can soft-delete any of their org's customer-owned templates, including forks created by a teammate. Rows with existing submissions stay visible as read-only; they're NOT hard-deleted.
- **D-15:** **Cross-org isolation is proven by an automated RLS test in `tests/rls/`.** Vitest spec creates two test orgs + one client_user each, then asserts (via supabase-js with each user's session) that Org A's user cannot read Org B's rows on `form_templates`, `template_versions`, `form_submissions`, or `form_assignments`. Runs on every push.
- **D-16:** **Customer-built templates are fill-only within the org.** No `form_assignments` rows are created for customer-built templates in v1. Any client_user can open the template from `/client/templates` and fill it; the resulting `form_submissions` row has `assignment_id = NULL` (requires `form_submissions.assignment_id` to become nullable — see Claude's Discretion).

### Claude's Discretion

- **Schema for "submission without an assignment".** `form_submissions.assignment_id` is currently `NOT NULL`. Options: (a) `DROP NOT NULL` + CHECK `assignment_id IS NULL → owner_type='customer'`, (b) auto-create sentinel "self-fill" assignment row. **Lean: option (a).**
- **Wire format for the assign-action server action input.** `(templateId, clientIds[], { dueDate?, instructions? })` is one obvious shape; a single `payload` object may be cleaner.
- **Fork action location.** Either replace `forkOnFill` in `app/client/templates/actions.ts` or layer `forkAssignedTemplate(assignmentId)` next to it in a new `app/client/assignments/actions.ts`. The auto-trigger `forkOnFill` becomes dead code under the new UX.
- **`/admin/assignments` queue: server component (URL-state filters) vs client component (local filter state)** — pick whichever is consistent with `/admin/proposals` and `/admin/review-queue`.

### Deferred Ideas (OUT OF SCOPE)

- Per-row due-date override in the multi-select modal — defer; for v1 Matt runs the modal twice.
- Customer-side in-org assignment (client_user A → client_user B) — out of Phase 16 scope per D-16.
- "Browse all published admin masters" library for self-assign — removed from `/client/templates` per D-09. If ever needed, build as a separate `/client/library` route.
- Reviewed / approved sub-states on assignments — D-11 stops at `completed`. Admin review queue is Phase 7/10 territory.
- Role-gated "template_admin" within an org — D-13 leaves every client_user with full CRUD.
- Hard delete of customer templates with submissions — D-14 soft-deletes.
- `/admin/assignments` bulk actions (mark all overdue as "reminded", export to CSV).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description (from REQUIREMENTS.md v2 cluster) | Research Support |
|----|-----------------------------------------------|------------------|
| BUILDER-01 | Admin can drag field types from a palette onto a form canvas | Already shipped in Phases 13/14 — Phase 16 inherits via shared `TemplateBuilderClient`. Customer surface mounts the same component (see `app/client/templates/[id]/page.tsx`). |
| BUILDER-02 | Properties panel supports per-field: label, required, placeholder, validation, conditional visibility | Already shipped in Phases 13/14/15. Carry-forward — no Phase 16 work. |
| BUILDER-03 | Publish flow increments template version and marks the previous version immutable | Already shipped in `saveDraftAction` / `publishTemplateAction` (admin) and `saveClientDraftAction` / `publishClientTemplateAction` (client). Forks reuse the customer path verbatim. |
| BUILDER-04 | `@coltorapps/builder` React 19 compatibility verified via spike | Confirmed in Phase 13 — production version 0.2.4 works with React 19.2.4. No Phase 16 work. |
| BUILDER-05 | Builder gated to admin role unless editable-forms ambiguity resolves otherwise | RESOLVED: per AGENTS.md "Form template ownership" decision, customers DO get builder access. Phase 16 wires the second surface (already partly present in `app/client/templates/[id]/page.tsx`). |

> All five BUILDER-XX requirements above are already substantially shipped from Phases 13–15. Phase 16's net-new work is the **multi-tenancy/fork subset**: assignment flow, fork-on-click, status lifecycle, cross-org RLS isolation test. Decompose plans against the 16-CONTEXT.md decisions D-01..D-16 rather than the BUILDER-XX IDs directly — that's where the new work actually lives.
</phase_requirements>

## Project Constraints (from CLAUDE.md / AGENTS.md)

| Constraint | Source | How Phase 16 honours it |
|------------|--------|--------------------------|
| **"This is NOT the Next.js you know"** — read `node_modules/next/dist/docs/` before any Next.js API | AGENTS.md preamble | Confirmed `redirect()` behaviour against `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/redirect.md`: in Server Actions it serves a 303, uses `push` by default, **throws** — call OUTSIDE try/catch. Confirmed proxy.ts (NOT middleware.ts) is the routing gate. |
| **Polymorphic `owner_id` contract is sacred** — don't reshape without re-checking with Finley | AGENTS.md "Form template ownership" | Phase 16 adds ZERO changes to `form_templates`. All schema changes target `form_assignments` (new `instructions` column) and `form_submissions` (drop `assignment_id` NOT NULL). |
| **Build prompt §4 uses `owner_type='client'`; live schema uses `'customer'`** | CONTEXT canonical_refs note | Use `'customer'` everywhere. Treat build-prompt terminology as illustrative only. |
| **`owner_id` for customer-owned rows is `clients.id` (the org), NOT `client_users.id`** | migration 003 + AGENTS.md | Every customer template-owner write/read filters by `clients.id`, not the user id. Mirror the existing `requireOwnedTemplate()` pattern in `app/client/templates/actions.ts`. |
| **No mocks in shipped code; missing data shows "—" or real empty state** | MEMORY.md "feedback_no_demo_mocks_in_code" | Empty assignments list shows "No forms assigned yet" empty state; do not hardcode fixtures. |
| **DB is source of truth for seed data — mirror prod into seed.sql** | MEMORY.md "feedback_db_as_source_of_truth" | If Phase 16 needs a smoke-test assignment for UAT, add it through a migration (like 011/012 did), not a hardcoded fixture. |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Assignment row creation (`createAssignments`) | API (Next.js Server Action under `app/admin/`) | DB (RLS gate via `form_assignments_admin_all`) | Admin-only action; service-role NOT needed because admin JWT carries `app_metadata.role = 'admin'`. Reuse RLS-aware client from `lib/supabase/server.ts`. |
| Multi-select Assign modal | Client component (`components/admin/assign-template-modal.tsx`) | API (Server Action target) | Mirrors `components/clients/new-client-dialog.tsx` and `components/admin/upload-document-modal.tsx` patterns — shadcn `<Dialog>` + form submit calls the server action. |
| Per-client assignments tab on `/admin/clients/[id]` | Frontend Server (RSC) | API + DB | Tab is a server-rendered list filtered by `client_id` (admin uses `adminClient` per the existing pattern in `app/admin/clients/[id]/page.tsx`). |
| `/admin/assignments` queue page | Frontend Server (RSC, async page) | API + DB | Lean: server component with searchParams-driven filters — matches `/admin/proposals` (server-rendered, no client filter state). |
| `/client/assignments` Active/Completed tabs | Frontend Server (RSC) | DB (RLS gate via `form_assignments_client_own`) | RSC pattern with shadcn `<Tabs>`; reads use the RLS-aware client; defense-in-depth `.eq("client_id", ctx.client_id)` per the security.spec.ts audit comment. |
| `/client/assignments/[id]` landing (Fill / Customise) | Frontend Server (RSC) page + Client component buttons | API | Page reads assignment + template name; buttons are client component to host the "Customise first" `confirm()` + the form-action that calls `forkAssignedTemplate`. |
| `/client/assignments/[id]/fill` interpreter | Frontend Server + Client component | API | Mirror `app/admin/assessments/[id]/assessment-client.tsx` — RSC fetches schema, client component renders `InterpreterRenderer`. |
| Fork-on-click (`forkAssignedTemplate`) | API (Server Action) | DB (RLS + integrity) | Multi-step server action: verify org ownership → copy schema → write template + version → rewrite assignment → `redirect()`. No RPC. |
| Status transition `pending→in_progress→completed` | API (existing submission server actions) | DB | Plug into the existing `startAssessment` / `autosaveAnswers` / `submitAssessmentAction` paths in `app/admin/assessments/actions.ts` AND new mirror paths under `app/client/assignments/actions.ts`. JS-side write, not a trigger — consistent with codebase. |
| Cross-org RLS isolation test | Test harness (Vitest under `tests/rls/`) | DB (the test IS the gate verification) | Vitest because `npm test` already runs Vitest; Playwright is reserved for browser-driven e2e per the existing `tests/security.spec.ts`. New `tests/rls/` directory; vitest.config.ts include pattern must be updated. |
| Customer template builder mount | Client component (`TemplateBuilderClient`) | API | Already polymorphic — `app/client/templates/[id]/page.tsx` mounts the same component with `surface="cream"` and the customer server actions. Fork's edit page uses the same pattern. |

## Standard Stack

### Core (already installed; verified versions)

| Library | Version (verified in package.json) | Purpose | Why Standard |
|---------|-----------|---------|--------------|
| `next` | `16.2.4` | App Router server actions, `redirect()` (303 push), RSC | Project standard since FOUND-03; proxy.ts gate |
| `react` / `react-dom` | `19.2.4` | Server components + client components | Project standard |
| `@coltorapps/builder` + `@coltorapps/builder-react` | `0.2.4` | Builder + interpreter (re-mounted on `/client/...` surface) | Locked in Phase 13 D-01 |
| `@supabase/ssr` | `0.10.2` | `createServerClient` → RLS-aware Supabase client | Used everywhere; the trust boundary per `security.spec.ts` audit comment |
| `@supabase/supabase-js` | `2.105.1` | Service-role client (`adminClient`); also the client used by the RLS test harness | Project standard; the only Supabase client lib |
| `vitest` | `^3.0.0` | Unit + RLS isolation tests | Project standard; `npm test` invokes it |
| `@playwright/test` | `^1.51.0` | Browser e2e + existing `tests/security.spec.ts` document RLS check | Project standard for browser e2e |
| `sonner` | `^2.0.7` | Toast for fork confirmation, errors | Already used in `template-builder-client.tsx`, `client-template-card.tsx` |
| `lucide-react` | `^1.8.0` | Icons (Calendar, ClipboardList, FileText, etc.) | Project standard |

### Supporting (already installed)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| shadcn primitives (`Dialog`, `Tabs`, `Select`, `Badge`, `Card`, `AlertDialog`) | n/a — local | Modal, tab UI, confirmation prompts | Use existing components under `components/ui/`; `AlertDialog` matches the "Customise first" confirmation prompt UX pattern from `client-template-card.tsx` |

### Alternatives Considered (and rejected)

| Instead of | Could Use | Tradeoff | Decision |
|------------|-----------|----------|----------|
| Multi-step JS server action for fork | Single Postgres function via `supabase.rpc('fork_assigned_template', ...)` | RPC is atomic (one round-trip, true transaction) but **zero existing `.rpc()` calls in the codebase** — introducing one breaks the pattern. The fork creates 2 rows + 1 update; if step 3 fails, manual cleanup is bounded (`form_templates` row is orphaned with no version). | JS multi-step. Document the rollback story as a known limitation. |
| Database TRIGGER for `pending → in_progress` status | TRIGGER on `form_submissions` INSERT that flips `form_assignments.status` | Triggers are invisible to code grep — debugging "why did status change" becomes hard. No existing triggers in the project (`grep CREATE.*TRIGGER` returns zero). | JS-side update in existing `app/admin/assessments/actions.ts:startAssessment` and `submitAssessmentAction`, plus a new path in `app/client/assignments/actions.ts`. |
| Sentinel "self-fill" `form_assignments` row for customer-built submissions | Auto-INSERT a `form_assignments` row with a marker column when a customer fills their own template | Dangling sentinel rows leak into `/admin/assignments` and `/admin/clients/[id]` "Assigned forms" tab. Filtering them out everywhere is more work than the CHECK constraint. | Drop `NOT NULL` on `form_submissions.assignment_id` + CHECK constraint. |
| Playwright for cross-org RLS test | Reuse `tests/security.spec.ts` Playwright pattern | Playwright runs sequentially with `workers: 1`; spec setup is heavy. Pure-API RLS test doesn't need a browser. | Vitest under `tests/rls/`; matches `npm test` pipeline. Keep `tests/security.spec.ts` as-is (it's the existing doc-RLS check). |

**Installation:** None — all dependencies already installed.

**Version verification:** Versions read from `package.json` at `C:\dev\Antigravity\888 Safety\package.json` on 2026-05-26. All `^` ranges are within current published majors. `@coltorapps/builder@0.2.4` is pinned (no caret) — Phase 13 locked it deliberately. [VERIFIED: package.json]

## Architecture Patterns

### System Architecture Diagram

```
┌────────────────────────────────────────────────────────────────────────┐
│                        ADMIN SURFACE (`/admin`)                        │
│                                                                        │
│ /admin/templates/[id]        /admin/clients/[id]      /admin/assignments
│         │                            │                          │      │
│         └──┬── <AssignTemplateModal> ─┘  (D-01 shared component)│      │
│            │                                                    │      │
│            ▼                                                    │      │
│  createAssignments(templateId, clientIds[], { dueDate?,         │      │
│                                                instructions? }) │      │
│            │                                                    │      │
│            ▼                                                    │      │
│  INSERT N rows → form_assignments (status='pending')            │      │
│            │                                                    │      │
│            └────► revalidatePath(/admin/...)                    │      │
│                                                                 │      │
│  /admin/clients (list)                                          │      │
│         │  └─ counter pill: active assignments per client       │      │
│         ▼                                                       │      │
│  RSC reads form_assignments WHERE status IN (pending,           │      │
│       in_progress) AND deleted_at IS NULL GROUP BY client_id    │      │
│                                                                 │      │
│  /admin/assignments  ◄──────────────────────────────────────────┘      │
│  (cross-client queue, sortable by due_date / status, filterable        │
│   via searchParams — server component, mirrors /admin/proposals)       │
└────────────────────────────────────────────────────────────────────────┘
                                  │
                       form_assignments table
                  (RLS: admin all; client own via client_users)
                                  │
┌────────────────────────────────────────────────────────────────────────┐
│                       CLIENT SURFACE (`/client`)                       │
│                                                                        │
│  /client/assignments  ◄── RSC: filter ON client_id (defense-in-depth) │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │ [Active] [Completed]   ◄── shadcn Tabs                          │  │
│  │  Card: Template name · Due date · status pill                   │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│           │                                                            │
│           ▼ click row                                                  │
│  /client/assignments/[id]   (landing page — RSC)                       │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │ Template name                                                   │  │
│  │ Due date (if set)                                               │  │
│  │ Instructions (if set, from form_assignments.instructions)       │  │
│  │                                                                 │  │
│  │ [Fill as-is]   [Customise first]                                │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│           │                              │                             │
│           │ "Fill as-is"                 │ "Customise first"           │
│           ▼                              ▼                             │
│  /client/assignments/[id]/fill      AlertDialog confirm ──► forkAssignedTemplate(assignmentId)
│                                         │                              │
│  (InterpreterRenderer against           │  1. verify org owns assignment
│   pinned template_version_id)           │  2. read assignment.template_version_id schema
│           │                             │  3. INSERT form_templates (owner_type=customer,
│           │ status flip:                │      owner_id=clients.id, parent_template_id=master,
│           │ on first save               │      is_published=true)
│           │ → in_progress               │  4. INSERT template_versions (version_number=1,
│           │ on submit                   │      schema_json=COPY OF PIN, published_at=now)
│           │ → completed                 │  5. UPDATE form_assignments
│           ▼                             │      SET template_id=fork.id,
│  form_submissions row                   │          template_version_id=fork.v1.id
│  (assignment_id = NOT NULL since        │  6. revalidatePath(...)
│   assignment exists)                    │  7. redirect('/client/templates/[fork.id]/edit')
│                                         │      (outside try/catch — throws NEXT_REDIRECT)
│                                         ▼                              │
│  /client/templates (My Templates only — admin "available" list REMOVED)│
│  /client/templates/new   ──► createClientTemplate (existing)           │
│  /client/templates/[id]/edit ──► TemplateBuilderClient (cream surface) │
│  /client/templates/[id]/fill ──► InterpreterRenderer                   │
│                                  │                                     │
│                                  ▼                                     │
│              form_submissions row (assignment_id IS NULL)              │
│              ◄── requires migration 014 drop NOT NULL                  │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘

           ┌────────────────────────────────────────────┐
           │ TEST HARNESS (tests/rls/ — new Vitest)     │
           │                                            │
           │ Setup (service-role): create 2 clients,    │
           │ 2 auth users, 1 admin template each, fork  │
           │ each.                                      │
           │ Per-spec: signInWithPassword as user A;    │
           │ supabase-js .select() on form_templates,   │
           │ template_versions, form_submissions,       │
           │ form_assignments → expect empty / row-count│
           │ === own_org_only.                          │
           │ Teardown: delete all seeded rows + auth    │
           │ users via service-role.                    │
           └────────────────────────────────────────────┘
```

### Recommended Project Structure

```
app/
├── admin/
│   ├── templates/[id]/page.tsx                  # mount <AssignTemplateModal templateId={id}/>
│   ├── clients/[id]/
│   │   ├── page.tsx                             # add "Assigned forms" tab to <ClientTabs/>
│   │   └── client-tabs.tsx                      # NEW tab: AssignmentsTab
│   ├── clients/page.tsx                         # add active-assignments counter pill column
│   └── assignments/                             # NEW
│       ├── page.tsx                             # server component queue, searchParams filters
│       └── actions.ts                           # NEW: createAssignments, updateAssignment, revokeAssignment
├── client/
│   ├── assignments/                             # NEW
│   │   ├── page.tsx                             # Active/Completed tabs (RSC)
│   │   ├── [id]/
│   │   │   ├── page.tsx                         # landing (Fill / Customise buttons)
│   │   │   └── fill/page.tsx                    # interpreter against pinned version
│   │   └── actions.ts                           # NEW: forkAssignedTemplate, status-transition helpers
│   └── templates/
│       ├── page.tsx                             # SIMPLIFIED — My Templates only (D-09)
│       ├── new/page.tsx                         # NEW (already implied by D-09)
│       ├── [id]/page.tsx                        # already exists — fork edit lands here
│       ├── [id]/fill/page.tsx                   # NEW — customer-built fill route
│       └── actions.ts                           # forkOnFill deleted (D-07 supersedes), add fillCustomerTemplate helpers
components/
├── admin/
│   └── assign-template-modal.tsx                # NEW shared modal (D-01)
supabase/migrations/
├── 013_phase16_assignments_instructions.sql     # NEW
└── 014_phase16_customer_submissions.sql         # NEW
tests/
├── rls/                                         # NEW directory
│   ├── multi-tenancy.spec.ts                    # NEW (D-15)
│   └── helpers/seed-two-tenants.ts              # NEW
```

### Pattern 1: Transactional Fork Server Action with `redirect()`

**What:** Multi-step write that ends in a redirect. The `redirect()` function from `next/navigation` **throws `NEXT_REDIRECT`** — call it outside try/catch.

**When to use:** Any server action that mutates then navigates (the canonical case for `forkAssignedTemplate`).

**Example:** [CITED: `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/redirect.md` lines 50-52]

```typescript
// app/client/assignments/actions.ts
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getClientContext, requireActorUserId } from "@/lib/auth-helpers";

export async function forkAssignedTemplate(assignmentId: string) {
  const supabase = await createClient();
  const ctx = await getClientContext();
  if (!ctx) throw new Error("Not a client user");
  const userId = await requireActorUserId("client");

  // 1. Read assignment + verify org ownership (RLS does this implicitly but
  //    be loud about violations — mirrors requireOwnedTemplate pattern)
  const { data: assignment, error: aErr } = await supabase
    .from("form_assignments")
    .select("id, client_id, template_id, template_version_id, deleted_at")
    .eq("id", assignmentId)
    .single();
  if (aErr || !assignment) throw new Error("Assignment not found");
  if (assignment.client_id !== ctx.client_id) throw new Error("Forbidden: not your assignment");
  if (assignment.deleted_at) throw new Error("Cannot fork a revoked assignment");

  // 2. Read pinned version schema (NOT latest — D-05)
  const { data: pinned, error: vErr } = await supabase
    .from("template_versions")
    .select("schema_json")
    .eq("id", assignment.template_version_id)
    .single();
  if (vErr || !pinned) throw new Error("Pinned version missing");

  // 3. Read master template metadata for name/type carry-over
  const { data: master, error: mErr } = await supabase
    .from("form_templates")
    .select("name, template_type")
    .eq("id", assignment.template_id)
    .single();
  if (mErr || !master) throw new Error("Master template missing");

  // 4. INSERT fork form_templates row (D-08: is_published=true)
  const { data: fork, error: fErr } = await supabase
    .from("form_templates")
    .insert({
      name: master.name,
      template_type: master.template_type,
      owner_type: "customer",
      owner_id: ctx.client_id, // org, not user
      parent_template_id: assignment.template_id,
      is_published: true,
    })
    .select("id")
    .single();
  if (fErr || !fork) throw new Error(`Fork insert failed: ${fErr?.message}`);

  // 5. INSERT v1 with COPIED schema (D-05: copy from pinned)
  const { data: v1, error: v1Err } = await supabase
    .from("template_versions")
    .insert({
      template_id: fork.id,
      version_number: 1,
      schema_json: pinned.schema_json,
      published_at: new Date().toISOString(),
      created_by: userId,
    })
    .select("id")
    .single();
  if (v1Err || !v1) throw new Error(`Fork version insert failed: ${v1Err?.message}`);

  // 6. UPDATE assignment to point at the fork (D-06)
  const { error: uErr } = await supabase
    .from("form_assignments")
    .update({
      template_id: fork.id,
      template_version_id: v1.id,
    })
    .eq("id", assignmentId);
  if (uErr) throw new Error(`Assignment rewire failed: ${uErr.message}`);

  // 7. Revalidate BEFORE redirect (redirect throws and short-circuits)
  revalidatePath("/client/assignments");
  revalidatePath("/client/templates");

  // 8. Redirect — MUST be outside any try/catch in this function body
  //    (it's at top level here; the per-step .insert error checks above
  //     bubble out via throw, not via try/catch wrap)
  redirect(`/client/templates/${fork.id}/edit`);
}
```

**Caller pattern (client component):** [VERIFIED: `app/client/templates/_components/client-template-card.tsx`]

```tsx
"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { AlertDialog, /* ... */ } from "@/components/ui/alert-dialog";
import { forkAssignedTemplate } from "../actions";

export function CustomiseFirstButton({ assignmentId }: { assignmentId: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      try {
        await forkAssignedTemplate(assignmentId);
        // unreachable — server action redirects
      } catch (err) {
        // NEXT_REDIRECT is intentionally re-thrown by the framework; we only
        // catch genuine errors here (auth, RLS denial, schema corruption).
        toast.error(err instanceof Error ? err.message : "Could not fork template");
      }
    });
  }
  // ... render AlertDialog with "This will create your org's copy..." copy
}
```

### Pattern 2: Cross-Org RLS Test (Vitest + supabase-js JWT)

**What:** Mint two real Supabase Auth users via service-role, sign each in, assert empty cross-reads using the RLS-aware anon client with the signed-in session.

**When to use:** Any multi-tenant phase that adds tables touching `client_id`.

**Example:** [CITED: `tests/security.spec.ts` lines 62-138 — adapted from Playwright to Vitest]

```typescript
// tests/rls/multi-tenancy.spec.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { seedTwoTenants, teardown, signedInClientFor, type SeedContext } from "./helpers/seed-two-tenants";

const hasEnv = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

describe.skipIf(!hasEnv)("RLS — cross-org isolation (Phase 16)", () => {
  let ctx: SeedContext;
  beforeAll(async () => { ctx = await seedTwoTenants(); });
  afterAll(async () => { if (ctx) await teardown(ctx); });

  it("Client A cannot read Client B's form_templates", async () => {
    const a = await signedInClientFor(ctx.userA);
    const { data } = await a
      .from("form_templates")
      .select("id, owner_type, owner_id")
      .eq("owner_type", "customer")
      .eq("owner_id", ctx.userB.clientId);
    expect(data).toEqual([]);
  });

  it("Client A cannot read Client B's template_versions", async () => {
    const a = await signedInClientFor(ctx.userA);
    const { data } = await a
      .from("template_versions")
      .select("id")
      .eq("id", ctx.userB.customerTemplateVersionId);
    expect(data).toEqual([]);
  });

  it("Client A cannot read Client B's form_submissions", async () => {
    const a = await signedInClientFor(ctx.userA);
    const { data } = await a
      .from("form_submissions")
      .select("id")
      .eq("client_id", ctx.userB.clientId);
    expect(data).toEqual([]);
  });

  it("Client A cannot read Client B's form_assignments", async () => {
    const a = await signedInClientFor(ctx.userA);
    const { data } = await a
      .from("form_assignments")
      .select("id")
      .eq("client_id", ctx.userB.clientId);
    expect(data).toEqual([]);
  });

  it("Client A CAN read their own org rows", async () => {
    const a = await signedInClientFor(ctx.userA);
    const { data: ownAssignments } = await a
      .from("form_assignments")
      .select("id")
      .eq("client_id", ctx.userA.clientId);
    expect(ownAssignments?.length).toBeGreaterThan(0);
  });
});
```

**Helper (sketch):**

```typescript
// tests/rls/helpers/seed-two-tenants.ts
// — adapt seedTwoTenants() from tests/security.spec.ts:62-116, but ALSO seed:
//   (a) one admin master form_templates row + a published template_versions row
//   (b) one form_assignments row per tenant pointing at the master version
//   (c) one customer-owned form_templates row + v1 published version per tenant
//   (d) one form_submissions row per tenant (draft, against the admin master)
// Use service-role admin SupabaseClient throughout setup/teardown.
```

**Critical implementation notes:**

- **Auth method:** Use `signInWithPassword` (mirrors `tests/security.spec.ts:132`). The flow `auth.admin.createUser({ email, password, email_confirm: true })` → `signInWithPassword` produces a JWT carrying the proper `aud='authenticated'` and `sub=auth_user_id` claims that `client_users` RLS policies expect via `auth.uid()`.
- **Vitest config:** the new `tests/rls/**/*.spec.ts` pattern must be added to `vitest.config.ts` include — current include is `tests/form-builder/**` + `tests/form-interpreter/**` only. [VERIFIED: `vitest.config.ts:8`]
- **Environment:** test relies on a live (local or remote) Supabase project with the published schema. CI must export `SUPABASE_SERVICE_ROLE_KEY` + `NEXT_PUBLIC_SUPABASE_*`. The existing pattern is to skip-with-clear-message when env is missing (lines 141-144 of `tests/security.spec.ts`).
- **Isolation:** seed user emails carry a `Date.now()` stamp so concurrent test runs don't collide. Always teardown via service-role; never leave rls-test rows in the DB.
- **Avoid using `getClientContext()` or `lib/supabase/server.ts`:** the test must use `createClient(URL, ANON_KEY)` directly so JWT scope is unambiguous. Don't go through Next's request context.

### Pattern 3: Multi-Select Assign Modal (D-01 shared component)

**What:** One client component, two mount sites. Pre-fill `templateId` on `/admin/templates/[id]`; pre-fill nothing on `/admin/clients/[id]` (well, you can pre-fill `clientIds=[id]` for the client-detail entry point).

**When to use:** Any "send X to multiple Ys" admin modal.

**Pattern reference:** [VERIFIED: `components/clients/new-client-dialog.tsx`, `components/admin/upload-document-modal.tsx`]

```tsx
// components/admin/assign-template-modal.tsx (sketch — shadcn Dialog pattern)
"use client";
import { useState, useTransition } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox"; // verify exists; if not, use shadcn Switch
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { createAssignments } from "@/app/admin/assignments/actions";

interface Props {
  /** Pre-filled template id when launched from /admin/templates/[id] */
  templateId?: string;
  /** Pre-filled single client id when launched from /admin/clients/[id] */
  preselectClientId?: string;
  /** Picker options (server-fetched list of all clients / all published templates) */
  templates?: Array<{ id: string; name: string }>;
  clients: Array<{ id: string; name: string }>;
}

export function AssignTemplateModal({ templateId, preselectClientId, templates, clients }: Props) {
  const [open, setOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(templateId ?? "");
  const [selectedClients, setSelectedClients] = useState<Set<string>>(
    new Set(preselectClientId ? [preselectClientId] : [])
  );
  const [dueDate, setDueDate] = useState(() => {
    // D-04 ergonomics: default to today + 7 days
    const d = new Date(); d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  });
  const [instructions, setInstructions] = useState("");
  const [pending, startTransition] = useTransition();

  function handleAssign() {
    if (!selectedTemplate || selectedClients.size === 0) return;
    startTransition(async () => {
      try {
        await createAssignments(selectedTemplate, Array.from(selectedClients), {
          dueDate: dueDate || undefined,
          instructions: instructions.trim() || undefined,
        });
        toast.success(`Assigned to ${selectedClients.size} client${selectedClients.size > 1 ? "s" : ""}`);
        setOpen(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Assignment failed");
      }
    });
  }
  // ... render: template picker (hide if templateId prop set), checkbox grid of clients,
  //             date input, textarea, [Assign] button
}
```

### Pattern 4: Status Transition Without Scattering Writes

**What:** A single helper module owns the status-transition logic. The submission server actions call into it at the two transition points; nothing else touches `form_assignments.status` for the lifecycle.

**Why:** Avoids 5+ scattered `UPDATE form_assignments SET status = ...` callsites. The codebase already has the antipattern in nascent form: `app/admin/assessments/actions.ts:43` writes `status: "assigned"` literal, and `app/admin/assessments/actions.ts:181` writes `status: "submitted"` literal on `form_submissions`. Don't repeat for `form_assignments`.

```typescript
// app/client/assignments/actions.ts (or app/admin/assessments/actions.ts — pick ONE)
async function transitionAssignmentStatus(
  supabase: SupabaseClient,
  assignmentId: string,
  next: "in_progress" | "completed"
) {
  // Idempotent — pending→in_progress is safe to call multiple times.
  // Completed is terminal (D-03: immutable once completed).
  const previous = next === "in_progress" ? "pending" : "in_progress";
  const { error } = await supabase
    .from("form_assignments")
    .update({ status: next })
    .eq("id", assignmentId)
    .eq("status", previous); // optimistic guard prevents accidental regression
  if (error) {
    // Non-fatal — log; the submission write already succeeded.
    console.error("Assignment status transition failed", { assignmentId, next, error });
  }
}
```

Call sites:
- `app/admin/assessments/actions.ts:startAssessment` → call `transitionAssignmentStatus(..., "in_progress")` after the draft submission insert (D-11: "Fill as-is" click flips status). Note `startAssessment` itself only runs for admin path; client path needs the equivalent in `app/client/assignments/actions.ts`.
- `app/admin/assessments/actions.ts:submitAssessmentAction` and the new `app/client/assignments/actions.ts:submitClientAssignmentAction` → call `transitionAssignmentStatus(..., "completed")` after the submission write succeeds.

**Don't:** add a DB trigger. The codebase has zero triggers (`grep CREATE.*TRIGGER` returns no results in `supabase/migrations/`). [VERIFIED]

### Pattern 5: `/admin/assignments` Queue — Server Component with searchParams

**What:** Follow `/admin/proposals` pattern: full RSC, no client state, filters live in URL query string.

**Why:** Matches `app/admin/proposals/page.tsx` (a 4-column kanban that's pure server). Bookmarkable filters, simpler diffing.

```tsx
// app/admin/assignments/page.tsx (sketch)
import { adminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ status?: string; client?: string; template?: string }>;
}

export default async function AssignmentsQueuePage({ searchParams }: Props) {
  const { status, client, template } = await searchParams;
  let query = adminClient
    .from("form_assignments")
    .select(`
      id, status, due_date, created_at, instructions,
      client:clients(id, name),
      template:form_templates(id, name)
    `)
    .is("deleted_at", null)
    .order("due_date", { ascending: true, nullsFirst: false });

  if (status) query = query.eq("status", status);
  if (client) query = query.eq("client_id", client);
  if (template) query = query.eq("template_id", template);

  const { data: assignments } = await query;
  // Render: filter bar (Link to itself with new searchParams),
  //         table with status pills + due-date colour coding (overdue = red).
}
```

### Anti-Patterns to Avoid

- **`redirect()` inside try/catch.** Will swallow `NEXT_REDIRECT` and the user stays on the broken page. [CITED: redirect.md line 50]
- **Postgres RPC for the fork operation.** Breaks the project's "no `.rpc()` callsites" pattern; future contributors won't know where to find the logic.
- **DB triggers for status transitions.** Invisible to code search; debugging is hellish.
- **Mounting `TemplateBuilderClient` with `surface="dark"` on `/client/...`.** It's currently called with `surface="cream"` from `app/client/templates/[id]/page.tsx:53`. The fork edit page must do the same.
- **Reusing `forkOnFill` from `app/client/templates/actions.ts` as the explicit-button fork.** The existing function uses `hasStructuralChanges` auto-detection — opposite of D-07's explicit-button contract. Either replace it entirely or layer `forkAssignedTemplate` next to it and delete `forkOnFill` once the new flow ships.
- **Service-role client in `app/client/...` routes.** The customer surface MUST use `createClient()` from `lib/supabase/server.ts` (RLS-aware). Service-role is the admin trust boundary; using it on `/client/` defeats RLS as the cross-org gate. [VERIFIED: `tests/security.spec.ts:7-22` audit comment]
- **Reading `owner_id` from `client_users.id` instead of `client_users.client_id`.** Customer templates are org-owned, not user-owned. The build prompt's wording is wrong; the live contract is `owner_id = clients.id`.
- **Forgetting to filter `deleted_at IS NULL` in `/client/assignments` and the per-client tab.** RLS does NOT filter on `deleted_at` — every client-facing query MUST add it explicitly (or rely on a future view; out of scope here).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Atomic multi-step write rollback | Manual `try { step1; step2; } catch { undo step1 }` | Accept best-effort + document the partial-failure surface | Postgres can't transactional-wrap multi-statement supabase-js calls; the only true-transaction option is RPC, and that breaks the project pattern. Failure surface is bounded: orphaned `form_templates` row with no version (harmless; visible to org cleanup). |
| Cross-tenant test fixtures | Hand-managed test rows | Programmatic seed via service-role + auth.admin.createUser | Mirrors `tests/security.spec.ts` — well-trodden path; teardown is reliable. |
| Date picker for due_date | Custom React date input | Native `<input type="date">` | Matches `components/admin/upload-document-modal.tsx:166-173` (`type="date"`, `style={{ colorScheme: "dark" }}`). |
| Multi-select clients UI | Custom checkbox list | shadcn `Checkbox` + grid layout | Already a project component; consistent with `Select` / `Dialog` shadcn vocabulary used elsewhere. |
| Status pill rendering | One-off `<span>` per status | A reusable `<StatusPill status={...}/>` or follow `client-tabs.tsx:284-296` inline-className pattern | The codebase has inline ternary patterns. Don't over-abstract for 4 statuses (pending/in_progress/completed/revoked). |
| Confirmation prompt for fork | `window.confirm()` | shadcn `<AlertDialog>` | `app/client/templates/_components/client-template-card.tsx:95-114` shows the pattern; confirm() works but is browser-styled and ignored by Storybook/Playwright. |
| Template ownership verification | Re-inventing the check | Mirror `requireOwnedTemplate()` from `app/client/templates/actions.ts:23-35` | Loud-on-violation pattern is already established; carry it forward as `requireOwnedAssignment(assignmentId, clientId)`. |
| Form for assign action | `<form action={createAssignments}>` with FormData | `onClick` handler + typed args (the modal already controls state) | The modal is a React state container, not a `<form>` — FormData would force re-mapping. Project precedent: `client-template-card.tsx` uses `onClick + startTransition`, not `<form action>`. |

**Key insight:** Phase 16 is 90% wiring existing patterns. The only judgement call is multi-step JS vs RPC for the fork — and the codebase pattern (zero RPCs, all multi-step) dictates the answer.

## Runtime State Inventory

> Not applicable. Phase 16 has no rename / refactor / migration of existing live data. The single schema relaxation (`DROP NOT NULL` on `form_submissions.assignment_id`) doesn't migrate or rename rows. No external service config carries the names of routes or IDs. **Verified by reviewing all 5 categories explicitly:**

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — no rename. New column added (`form_assignments.instructions`); existing rows get NULL. | None. |
| Live service config | None — n8n webhooks (e.g., `N8N_ASSESSMENT_WEBHOOK_URL` from `app/admin/assessments/actions.ts:194`) reference `/admin/assessments/[id]/...` paths, NOT `/client/assignments/...`. The new `/client/assignments` route doesn't fire any webhooks in Phase 16. | None. |
| OS-registered state | None — no Windows Task Scheduler / pm2 / launchd registrations target this code path. The expiry-alert n8n workflow (Phase 7) is unrelated. | None. |
| Secrets / env vars | None — no new env vars. `SUPABASE_SERVICE_ROLE_KEY` / `NEXT_PUBLIC_SUPABASE_*` already exist for the RLS test harness (same vars `tests/security.spec.ts` uses). | None. |
| Build artifacts | None — no installed packages or compiled outputs reference old names. | None. |

## Common Pitfalls

### Pitfall 1: `redirect()` swallowed by try/catch
**What goes wrong:** Server action wraps the whole body in try/catch (defensive coding), catches `NEXT_REDIRECT`, returns instead of redirecting. User stays on the landing page; fork is created but they never reach the builder.

**Why it happens:** `redirect()` throws a special error (`NEXT_REDIRECT`) that the framework catches at the boundary. Catching it inside your action turns the redirect into a silent no-op.

**How to avoid:** Put `redirect()` **outside** any try/catch in your server action. Throw errors from helper functions to bubble out; only catch genuine errors at the call site (client component). [CITED: `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/redirect.md:50,52`]

**Warning signs:** Fork DB rows are created, but the user stays on `/client/assignments/[id]`. No console error. Status-200 response.

### Pitfall 2: `form_submissions.assignment_id NOT NULL` breaks customer-built fill
**What goes wrong:** D-16 requires customer-built templates to be fill-only without an assignment row. The current schema (`migration 001` line 86) declares `assignment_id UUID NOT NULL REFERENCES form_assignments(id)`. Any INSERT with `assignment_id = NULL` fails with `null value in column "assignment_id" violates not-null constraint`.

**Why it happens:** The original schema assumed every submission has an assignment (the Phase 6 assessment flow always created one in `startAssessment`).

**How to avoid:** Migration 014 must `ALTER TABLE form_submissions ALTER COLUMN assignment_id DROP NOT NULL`. Add a CHECK constraint enforcing the polymorphism: `CHECK (assignment_id IS NOT NULL OR (SELECT owner_type FROM form_templates ft JOIN template_versions tv ON ft.id = tv.template_id WHERE tv.id = form_submissions.template_version_id) = 'customer')` — but Postgres CHECK constraints can't run subqueries. A simpler invariant: rely on application code. (See Open Question 1.)

**Warning signs:** First customer-built fill returns a "null value in column assignment_id" Postgres error.

### Pitfall 3: Fork creates orphan if assignment rewire fails
**What goes wrong:** Steps 4 + 5 (insert fork + insert v1) succeed; step 6 (rewire assignment) fails (network blip, RLS surprise). The user has a fork they own but the assignment still points at the master.

**Why it happens:** No transactional wrap across supabase-js calls.

**How to avoid:** Order matters — do the assignment UPDATE **last**, after the fork is fully created. If rewire fails, the fork exists in `/client/templates` (user can still see + edit it), and the assignment is unchanged (user can retry "Customise first" — but retry creates a *second* fork). Document this as an accepted limitation. Alternative is RPC (rejected — see Alternatives Considered).

**Warning signs:** A `form_templates` row with `parent_template_id = X` but the corresponding `form_assignments` row still has `template_id = X` (the master, not the fork). Detect via the RLS test or a periodic sweep.

### Pitfall 4: RLS test harness doesn't actually exercise RLS
**What goes wrong:** Test uses `adminClient` (service-role) for the `.select()` calls instead of the signed-in anon client. Service-role bypasses RLS, so the test reports "Cannot read Client B's row" only because there are no rows — false-positive when policies are broken.

**Why it happens:** Easy to forget which client the test is using; the existing `tests/security.spec.ts` got this right because it explicitly signs in (`signedInClientFor`).

**How to avoid:** The test MUST use `createClient(URL, ANON_KEY).auth.signInWithPassword(...)` per spec. Add a positive assertion (Client A CAN see their own rows) as a witness that RLS is actually filtering, not just returning empty for missing data. [VERIFIED: pattern in `tests/security.spec.ts:156-167`]

**Warning signs:** All four negative tests pass; the "Client A CAN read own rows" positive control returns empty too.

### Pitfall 5: Deleted assignments leak into reads
**What goes wrong:** RLS policy `form_assignments_client_own` (migration 001 lines 286-289) does NOT filter on `deleted_at`. A revoked assignment still shows to the client.

**Why it happens:** The deleted_at convention is enforced in application code (D-10 explicitly says "filter `deleted_at IS NULL` in Active/Completed tabs"), not RLS.

**How to avoid:** Every `app/client/assignments/` query and every `app/admin/assignments/` query MUST `.is("deleted_at", null)`. Treat it like an N+1 — add the filter at every callsite. Optionally, add a view (`active_form_assignments`) with the filter built-in and select from that — out of scope for v1.

**Warning signs:** Customer reports "I see a form Matt told me he cancelled".

### Pitfall 6: Forks lose schema fidelity if `.insert(schema_json)` re-serializes
**What goes wrong:** Supabase JS converts the JSONB column through JSON.stringify/parse round-trip. If `schema_json` has any non-JSON values (Date, Map, undefined), they're silently coerced.

**Why it happens:** coltorapps schemas are POJO `{ entities, root }` — should be safe, BUT Phase 14 added entities whose `attributes` may contain... still POJO. Verify with a single test.

**How to avoid:** The fork copies via `pinned.schema_json` (already a JSONB-from-DB object). Insert directly: `.insert({ schema_json: pinned.schema_json })`. Don't re-parse it. Add a Vitest unit test that round-trips a real Phase 14/15 schema through the fork action and asserts deep-equality.

**Warning signs:** Conditional rules (Phase 15 `visibilityRules`) disappear from the fork.

### Pitfall 7: Counter pill performance (admin clients list)
**What goes wrong:** `/admin/clients` page does a sub-select per client to count active assignments. With 8 clients it's fine; with 80 it's N+1.

**Why it happens:** Naive implementation: loop over clients, for each one count assignments.

**How to avoid:** Single query: `SELECT client_id, COUNT(*) FROM form_assignments WHERE status IN ('pending','in_progress') AND deleted_at IS NULL GROUP BY client_id`. Build a `Map<clientId, count>` on the server and pass to the row component. Pre-launch scale (7-8 clients) means this is small-scale optimization, but write the right shape from the start.

**Warning signs:** N/A at current scale; revisit if the clients list grows past ~50.

## Code Examples

### Migration 013 — Add `form_assignments.instructions`

```sql
-- supabase/migrations/013_phase16_assignments_instructions.sql
-- Phase 16 D-04: add free-text instructions field shown above the form when
-- the client opens an assignment. NULL = no instructions; default behaviour
-- is no instructions block rendered.

ALTER TABLE form_assignments
  ADD COLUMN IF NOT EXISTS instructions TEXT;

COMMENT ON COLUMN form_assignments.instructions IS
  'Optional free-text shown to client above the form. Set at create-time or via edit per D-03. NULL = no instructions block.';
```

### Migration 014 — Drop NOT NULL on `form_submissions.assignment_id`

```sql
-- supabase/migrations/014_phase16_customer_submissions.sql
-- Phase 16 D-16: customer-built templates have no form_assignments row;
-- their submissions land with assignment_id IS NULL. Drop the NOT NULL
-- constraint set in migration 001. The FK itself is retained (still
-- REFERENCES form_assignments(id)) so admin-flow submissions remain valid.
--
-- Constraint enforcement: application-level. The fork-on-fill and
-- assigned-fill paths always supply assignment_id; the customer-build
-- self-fill path (new in Phase 16) is the only emitter of NULL.

ALTER TABLE form_submissions
  ALTER COLUMN assignment_id DROP NOT NULL;

COMMENT ON COLUMN form_submissions.assignment_id IS
  'NULL only when this submission is against a customer-owned template (owner_type=customer) with no preceding assignment. All admin-assigned and admin-on-site flows MUST set this. Phase 16 D-16.';
```

> **Note on CHECK constraint:** A SQL CHECK constraint enforcing "assignment_id IS NULL implies owner_type=customer" requires a subquery (template_version → template), which Postgres disallows in CHECK. Application-level guard only — document the invariant; add an assertion in `submitAssessmentAction` if extra paranoia is desired.

### Assign action — server action shape

```typescript
// app/admin/assignments/actions.ts
"use server";

import { adminClient } from "@/lib/supabase/admin";
import { requireActorUserId } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";

export interface CreateAssignmentsInput {
  dueDate?: string;        // ISO date string yyyy-mm-dd
  instructions?: string;
}

export async function createAssignments(
  templateId: string,
  clientIds: string[],
  opts: CreateAssignmentsInput = {}
): Promise<{ created: number }> {
  const adminUserId = await requireActorUserId("admin");
  if (!clientIds.length) throw new Error("Select at least one client");

  // Resolve the published version id (pin at create time, not on first fill)
  const { data: pubVersion, error: vErr } = await adminClient
    .from("template_versions")
    .select("id")
    .eq("template_id", templateId)
    .not("published_at", "is", null)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (vErr) throw new Error(vErr.message);
  if (!pubVersion) throw new Error("Template has no published version");

  const rows = clientIds.map(clientId => ({
    client_id: clientId,
    template_id: templateId,
    template_version_id: pubVersion.id,
    assigned_by: adminUserId,
    due_date: opts.dueDate ?? null,
    instructions: opts.instructions ?? null,
    status: "pending",
  }));

  const { error: insertErr } = await adminClient.from("form_assignments").insert(rows);
  if (insertErr) throw new Error(insertErr.message);

  // Revalidate every admin surface that shows assignment counts/lists.
  revalidatePath("/admin/assignments");
  revalidatePath("/admin/clients");
  for (const clientId of clientIds) revalidatePath(`/admin/clients/${clientId}`);
  revalidatePath(`/admin/templates/${templateId}`);

  return { created: rows.length };
}

export async function updateAssignment(
  assignmentId: string,
  patch: { dueDate?: string | null; instructions?: string | null }
): Promise<void> {
  await requireActorUserId("admin");

  // D-03 immutability check: refuse to edit completed rows.
  const { data: current } = await adminClient
    .from("form_assignments")
    .select("status, client_id")
    .eq("id", assignmentId)
    .single();
  if (!current) throw new Error("Assignment not found");
  if (current.status === "completed") throw new Error("Cannot edit a completed assignment");

  const update: Record<string, unknown> = {};
  if (patch.dueDate !== undefined) update.due_date = patch.dueDate;
  if (patch.instructions !== undefined) update.instructions = patch.instructions;

  const { error } = await adminClient
    .from("form_assignments")
    .update(update)
    .eq("id", assignmentId);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/assignments");
  if (current.client_id) revalidatePath(`/admin/clients/${current.client_id}`);
}

export async function revokeAssignment(assignmentId: string): Promise<void> {
  await requireActorUserId("admin");
  const { data: current } = await adminClient
    .from("form_assignments")
    .select("client_id")
    .eq("id", assignmentId)
    .single();
  const { error } = await adminClient
    .from("form_assignments")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", assignmentId);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/assignments");
  if (current?.client_id) revalidatePath(`/admin/clients/${current.client_id}`);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `middleware.ts` | `proxy.ts` (named export `proxy`) | Next.js 16 (FOUND-03) | Phase 16 doesn't change the proxy, but any reference must say `proxy.ts` |
| Auto-fork on structural-change (`forkOnFill`) | Explicit "Customise first" button (D-07) | Phase 16 | `forkOnFill` in `app/client/templates/actions.ts:214` becomes dead code |
| `/client/templates` shows "Available admin masters" + "My Templates" | `/client/templates` = My Templates ONLY (D-09) | Phase 16 | Removes the assigned-template browse list; resolves `TODO(phaseB)` |
| `form_submissions.assignment_id NOT NULL` | Nullable for customer-build self-fill (D-16 / migration 014) | Phase 16 | Application must never insert with assignment_id=NULL for admin-assigned flows |
| Single FRA-doors smoke template seeded via migration | Same pattern continues; Phase 16 doesn't need a smoke seed (UAT exercises real assignment + fork) | — | — |

**Deprecated/outdated:**
- The build prompt's `owner_type='client'` terminology is **outdated**; live contract is `'customer'`. [CITED: `supabase/migrations/003_form_template_customer_ownership.sql:27`]
- The build prompt's `owner_id = client_user_id` is **outdated**; live contract is `owner_id = clients.id` (org). [CITED: `supabase/migrations/003_form_template_customer_ownership.sql:13-14`]
- `forkOnFill` auto-trigger contract is **superseded** by D-07's explicit button. Plan should explicitly delete it (and `lib/forms/schema-diff.ts:hasStructuralChanges` if it has no other consumers — grep to confirm).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | shadcn `Checkbox` is available locally for the multi-select modal. If not, fall back to shadcn `Switch` or build a minimal `<input type="checkbox">` wrapper. | Pattern 3 | LOW — install `npx shadcn add checkbox`; no architectural impact. |
| A2 | n8n's `N8N_ASSESSMENT_WEBHOOK_URL` does not need to fire for customer-build self-fill (assignment_id is NULL). | Runtime State Inventory | MEDIUM — if Matt wants AI report drafts for customer-built submissions, that's a separate decision. Submission still goes through `submitAssessmentAction` which fires the webhook regardless. Confirm with Finley before locking. |
| A3 | The existing `app/client/templates/[id]/page.tsx` already correctly mounts `TemplateBuilderClient` with `surface="cream"` and the customer actions. The fork edit page reuses this route — no new edit page needed. | Architecture Patterns | LOW — verified by reading the file. |
| A4 | Vitest can run `tests/rls/**/*.spec.ts` against a live Supabase instance using the same env vars `tests/security.spec.ts` uses. Vitest doesn't have a Playwright-style `test.skip()` for missing env; use `describe.skipIf(!hasEnv)` (Vitest 3 supports this). | Pattern 2 | LOW — verified Vitest 3 API; falls back to `describe.skip` ternary if needed. |
| A5 | `revalidatePath()` works correctly when called immediately before `redirect()` in the same server action — `redirect()` throws but `revalidatePath` is synchronous side-effect-on-the-cache. | Pattern 1 | LOW — standard Next.js pattern; no observed issue in similar `app/admin/assessments/actions.ts:deleteAssessment` (revalidatePath then return). |
| A6 | The "first-time `Fill as-is` click → status `in_progress`" transition (D-11) happens on the FIRST autosave/draft INSERT, not on the page load of `/client/assignments/[id]/fill`. Loading the page without writing anything keeps status at `pending`. | Pattern 4 | MEDIUM — if Matt expects status to flip on page-open ("client opened it"), reshape the transition to fire from the page itself via a server action. Confirm in UAT. |

## Open Questions

1. **Should we enforce `assignment_id IS NULL ↔ owner_type='customer'` at the DB?**
   - What we know: Postgres CHECK can't subquery to enforce the invariant cross-table.
   - What's unclear: Is application-level enforcement enough, or do we want a TRIGGER (which violates the no-trigger pattern)?
   - Recommendation: Application-level only. Document the invariant in `migration 014` comment. Add a Vitest unit test on `submitAssessmentAction` paths to verify both shapes work.

2. **`forkOnFill` and `lib/forms/schema-diff.ts` removal — clean cut or keep dormant?**
   - What we know: `forkOnFill` in `app/client/templates/actions.ts:214+` becomes dead code per D-07.
   - What's unclear: Does `hasStructuralChanges` have any other consumers? Need to grep.
   - Recommendation: Delete `forkOnFill` in the same plan as the new `forkAssignedTemplate`. Grep for `hasStructuralChanges` — if only `forkOnFill` uses it, delete `lib/forms/schema-diff.ts` too. Bias toward removal: dead code rots into wrong-flow temptation later.

3. **Does `/client/assignments/[id]/fill` reuse `app/admin/assessments/[id]/assessment-client.tsx` or fork a thin variant?**
   - What we know: The admin assessment-client mounts `InterpreterRenderer` with admin-context props (`requireActorUserId('admin')` in callbacks). The client surface needs `requireActorUserId('client')`.
   - What's unclear: How much divergence is there? Quick path: factor a shared `<AssessmentFillClient role="admin"|"client" />` component.
   - Recommendation: Read `app/admin/assessments/[id]/assessment-client.tsx` end-to-end before deciding. If divergence is just the `role` arg, parameterize. If it's larger (different submit endpoint, different revalidatePath), build a thin client-side wrapper. Plan should include "factor or fork" as its first task.

4. **What's the right "Default Active tab" sort order?**
   - What we know: D-10 says "Active = pending + in_progress, default tab".
   - What's unclear: Sort by due_date ascending (overdue first)? created_at descending (newest first)?
   - Recommendation: Sort by `due_date ASC NULLS LAST` then `created_at DESC`. Mirror what overdue-aware kanbans show. Confirm in UAT.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `npm` | Build + test | ✓ | (n/a) | — |
| `node` | Build + test | ✓ | (env) | — |
| Local Supabase or remote dev DB | RLS test harness | unknown at researcher level | n/a | Test skips with clear message if `SUPABASE_*` env missing (mirrors `tests/security.spec.ts:141-144`) |
| `@coltorapps/builder@0.2.4` | Builder mount on `/client/...` | ✓ | 0.2.4 (pinned) | — |
| `@supabase/supabase-js@^2.105.1` | Service-role + RLS test harness | ✓ | 2.105.1 | — |
| `@supabase/ssr@^0.10.2` | RLS-aware server client | ✓ | 0.10.2 | — |
| `vitest@^3.0.0` | RLS test runner | ✓ | 3.x | — |
| `@playwright/test@^1.51.0` | Existing security spec (unaffected) | ✓ | 1.51.0 | — |
| `sonner@^2.0.7` | Toast | ✓ | 2.0.7 | — |
| shadcn `<Dialog>`, `<Tabs>`, `<Select>`, `<AlertDialog>`, `<Badge>`, `<Card>` | UI | ✓ | local | — |
| shadcn `<Checkbox>` | Multi-select modal | unknown — may need install | — | `npx shadcn add checkbox` if missing, else inline `<input type="checkbox">` |

**Missing dependencies with no fallback:** None blocking.

**Missing dependencies with fallback:** shadcn `Checkbox` may need `npx shadcn add checkbox` — plan should include this in the first wave that touches the modal.

## Validation Architecture

> `workflow.nyquist_validation` is `true` in `.planning/config.json`. Section included.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.x (unit + RLS isolation) + Playwright 1.51 (existing e2e — unaffected) |
| Config file | `vitest.config.ts` (include pattern must be extended for `tests/rls/`) + `playwright.config.ts` (unchanged) |
| Quick run command | `npm test -- tests/rls/` (Vitest filter) or `npm test -- tests/form-builder/` (existing) |
| Full suite command | `npm test` (runs all Vitest specs incl. new `tests/rls/`) + `npx playwright test` (existing security spec) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| D-15 / BUILDER-01..05 (RLS subset) | Org A user cannot read Org B's `form_templates` | integration (RLS) | `npm test -- tests/rls/multi-tenancy.spec.ts -t "form_templates"` | ❌ Wave 0 |
| D-15 | Org A user cannot read Org B's `template_versions` | integration (RLS) | `npm test -- tests/rls/multi-tenancy.spec.ts -t "template_versions"` | ❌ Wave 0 |
| D-15 | Org A user cannot read Org B's `form_submissions` | integration (RLS) | `npm test -- tests/rls/multi-tenancy.spec.ts -t "form_submissions"` | ❌ Wave 0 |
| D-15 | Org A user cannot read Org B's `form_assignments` | integration (RLS) | `npm test -- tests/rls/multi-tenancy.spec.ts -t "form_assignments"` | ❌ Wave 0 |
| D-15 (positive control) | Org A user CAN read own org rows | integration (RLS) | `npm test -- tests/rls/multi-tenancy.spec.ts -t "own org"` | ❌ Wave 0 |
| D-05 / D-06 | `forkAssignedTemplate` copies pinned schema fidelity-preserving + rewires assignment | unit + integration | `npm test -- tests/form-builder/fork-assigned-template.test.ts` | ❌ Wave 0 |
| D-07 | "Customise first" button → fork → redirect to `/client/templates/[fork_id]/edit` | manual-only (UAT) | UAT walkthrough Section A | ❌ |
| D-08 | Fork auto-publishes at v1 | unit | covered by `fork-assigned-template.test.ts` assertion | ❌ Wave 0 |
| D-11 | `pending → in_progress` on first draft create or "Fill as-is" click | integration | `npm test -- tests/form-builder/assignment-status-transitions.test.ts` | ❌ Wave 0 |
| D-11 | `in_progress → completed` on submit | integration | covered by `assignment-status-transitions.test.ts` | ❌ Wave 0 |
| D-10 | Soft-deleted assignments are filtered from Active/Completed | unit (query shape) | `npm test -- tests/form-builder/assignments-query.test.ts` (lightweight) | ❌ Wave 0 |
| D-16 | Customer-build submission writes with `assignment_id = NULL` | integration | `npm test -- tests/form-builder/customer-self-fill-submission.test.ts` | ❌ Wave 0 |
| D-09 | `/client/templates` no longer shows admin masters | manual-only (UAT) | UAT walkthrough Section C | ❌ |
| D-12 (admin counter pill) | Admin clients list shows active-assignment count per client | manual-only (UAT) | UAT walkthrough Section B | ❌ |

### Sampling Rate
- **Per task commit:** `npm test -- tests/rls/ tests/form-builder/` (Vitest filter to new + extended specs).
- **Per wave merge:** `npm test` (full Vitest sweep).
- **Phase gate:** `npm test` green + manual UAT walkthrough (16-UAT.md, to be authored at close-out plan).

### Wave 0 Gaps
- [ ] `vitest.config.ts` — extend `include` to add `tests/rls/**/*.{test,spec}.{ts,tsx}` (currently only `tests/form-builder/**` and `tests/form-interpreter/**`).
- [ ] `tests/rls/helpers/seed-two-tenants.ts` — shared fixture (port + extend `tests/security.spec.ts:62-138` to Vitest + cover form_templates/versions/submissions/assignments).
- [ ] `tests/rls/multi-tenancy.spec.ts` — the five-spec suite (4 negative + 1 positive control).
- [ ] `tests/form-builder/fork-assigned-template.test.ts` — schema-fidelity round-trip + assignment rewire assertion.
- [ ] `tests/form-builder/assignment-status-transitions.test.ts` — pending→in_progress and in_progress→completed.
- [ ] `tests/form-builder/customer-self-fill-submission.test.ts` — `assignment_id IS NULL` insert path.
- [ ] `tests/form-builder/assignments-query.test.ts` — defense-in-depth deleted_at filtering.
- [ ] Framework install: none — Vitest 3 and Playwright are already installed.

## Security Domain

> `security_enforcement` not explicitly set in `.planning/config.json` → treat as enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Supabase Auth (`auth.uid()` in RLS); admin gate via `requireActorUserId('admin')`; client gate via `getClientContext()` + `requireActorUserId('client')` |
| V3 Session Management | yes | `@supabase/ssr` cookie-bound session via `proxy.ts` → `updateSession`; existing pattern |
| V4 Access Control | **CRITICAL** | RLS policies in migrations 001/003/004/005 — `form_assignments_admin_all`, `form_assignments_client_own`, `form_templates_client_own_*`. Phase 16 ADDS the RLS test that proves no cross-org bleed. |
| V5 Input Validation | yes | Server action input validation: `clientIds` non-empty, `templateId` UUID, `dueDate` parseable date. Inherit Phase 13 D-08 `validateSchema` + Phase 15 `validateRuleGraph` on save/publish (forks go through same path). |
| V6 Cryptography | n/a (no new crypto introduced in Phase 16) | — |

### Known Threat Patterns for `Next.js 16 App Router + Supabase RLS`

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-tenant data read (Client A reads Client B's assignments) | Information Disclosure | RLS policy on `form_assignments` scoped via `client_users.client_id` (migration 001:286-289). Phase 16 RLS test in `tests/rls/` is the regression gate. |
| Forging `form_assignments.client_id` on create | Tampering | Admin server action uses service-role but `requireActorUserId('admin')` is the gate; client cannot call `createAssignments` because the action lives under `app/admin/`. |
| Bypassing fork ownership check (forking another org's customer template) | Elevation of Privilege | `forkAssignedTemplate` verifies `assignment.client_id === ctx.client_id` BEFORE any write (explicit check; defense-in-depth against RLS being misconfigured). |
| Customer self-fill writes with another org's `client_id` | Tampering | `submitAssessmentAction` (or client equivalent) takes `client_id` from server context (`ctx.client_id`), never trusts client-supplied value. RLS `form_submissions_client_insert` policy double-guards. |
| Forging assignment status (`completed → in_progress`) | Tampering | Transition helper uses optimistic guard: `.update().eq("status", previous_state)`. Backwards transitions fail silently. D-03 makes `completed` immutable. |
| Mass-fork via repeated "Customise first" button mash | Resource exhaustion | Bounded by manual click cadence; if a real concern, add a `created_at` rate-limit check. Out of scope for v1. |
| RLS bypass via service-role on customer surface | Elevation of Privilege | Code review gate: any `app/client/...` import of `lib/supabase/admin.ts` is a security flag. Phase 16 plans must NOT introduce one. |
| Server action invocable via direct POST | Tampering | All Phase 16 server actions call `requireActorUserId(role)` as their first statement — matches mutating-data guide warning [CITED: `node_modules/next/dist/docs/01-app/01-getting-started/07-mutating-data.md:30-31`]. |
| Deleted assignments leak via missing `deleted_at IS NULL` filter | Information Disclosure | Application-level guard at every read (Pitfall 5 above). Plan should checklist every callsite. |

## Sources

### Primary (HIGH confidence)
- `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/redirect.md` — Next.js 16 `redirect()` behavior (303, push default, throws, call outside try/catch)
- `node_modules/next/dist/docs/01-app/01-getting-started/07-mutating-data.md` — Server Actions auth-first pattern, FormData invocation, direct-POST warning
- `supabase/migrations/001_initial_schema.sql` (lines 72-98, 281-315) — `form_assignments` + `form_submissions` shape + RLS policies (current state)
- `supabase/migrations/003_form_template_customer_ownership.sql` — polymorphic owner contract (live)
- `supabase/migrations/004_form_templates_rls_fixes.sql` — scoped customer template RLS
- `supabase/migrations/005_template_versions_polymorphic_created_by.sql` — version `created_by` polymorphism
- `app/client/templates/actions.ts` — existing `forkOnFill` shape, `requireOwnedTemplate` pattern, customer save/publish actions
- `app/admin/assessments/actions.ts` — `startAssessment` + `submitAssessmentAction` (where status transitions hook in)
- `app/client/templates/[id]/page.tsx` — confirms `TemplateBuilderClient` already mounted on client surface with `surface="cream"`
- `app/admin/templates/[id]/builder-client.tsx` — proves builder is polymorphic via server-action props
- `tests/security.spec.ts` — auth + RLS test pattern (Playwright); adapt to Vitest for `tests/rls/`
- `package.json` — verified versions of every dep mentioned in Standard Stack
- `vitest.config.ts` — current include pattern + 30s timeout
- `playwright.config.ts` — sequential, workers=1 (informs why we choose Vitest for RLS specs)
- Context7 ID `/vercel/next.js` (versions list returned via `ctx7 library next "server actions redirect"`) — confirms Next.js 16.x is the supported track

### Secondary (MEDIUM confidence)
- `.planning/research/form-builder-build-prompt.md` §"Phase 4" (lines 400-457) — original Phase 16 spec (note: terminology stale — `owner_type='client'`, `owner_id=client_user_id` — supersede with live schema)

### Tertiary (LOW confidence)
- None. All claims in this document are either grounded in the codebase, in `node_modules/next/dist/docs/`, in migrations, or marked `[ASSUMED]` in the Assumptions Log above.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every library version verified against package.json; no new installs
- Architecture: HIGH — patterns lifted from existing code (`/admin/proposals`, `client-tabs.tsx`, `client-template-card.tsx`, `tests/security.spec.ts`, `forkOnFill`)
- Pitfalls: HIGH (pitfalls 1, 2, 4, 5, 6, 7) / MEDIUM (pitfall 3 — partial-failure semantics is a judgement call, not a verified bug)
- Security: HIGH for ASVS V4 (RLS is the trust boundary, well-mapped); MEDIUM for V5 (input validation is standard but not yet specified per server action)
- Test architecture: HIGH — Vitest 3 `describe.skipIf` confirmed; test patterns mirror existing `tests/security.spec.ts`

**Research date:** 2026-05-26
**Valid until:** 2026-06-25 (30 days — stable phase, no fast-moving deps)
