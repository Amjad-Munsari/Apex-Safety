# Phase 16: Multi-Tenancy + Fork-on-Fill - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-26
**Phase:** 16-multi-tenancy-fork-on-fill
**Areas discussed:** Assignment surface, Fork base + assignment re-link, "Forms Assigned to You" lifecycle UI, Customer role gating

---

## Assignment surface

### Q1: Where does Matt initiate "assign template to client"?

| Option | Description | Selected |
|--------|-------------|----------|
| Per-template page | Add 'Assign to clients' action on `/admin/templates/[id]`. Most natural for "I built this template, now send it". | |
| Per-client page | Add 'Assign template' picker on `/admin/clients/[id]`. Better when Matt thinks client-first. | |
| Both entry points | Same modal reachable from both pages. ~2x UI cost; eliminates "where do I find this" churn. | ✓ |
| Dedicated `/admin/assignments` page | New top-level nav + create button + queue. Queue-management thinking. | |

**User's choice:** Both entry points
**Notes:** Locked: single shared modal/server action, mounted from both routes.

### Q2: Single client or multi-select?

| Option | Description | Selected |
|--------|-------------|----------|
| Multi-select | Pick 1…N clients; all get the same template + due date; writes N rows. | ✓ |
| Single client only | One client per submission; modal is a single dropdown. | |
| Multi-select with per-row override | Per-client due-date override. Most flexible, more UI work. | |

**User's choice:** Multi-select (Recommended)
**Notes:** One shared due_date per modal submission; per-row override deferred.

### Q3: After an assignment is created, what can Matt change?

| Option | Description | Selected |
|--------|-------------|----------|
| Edit due date + revoke | Due date mutable; revoke = soft-delete via `deleted_at`. Submitted assignments immutable. | ✓ |
| Revoke only | No editing; mistakes → revoke + re-assign. | |
| Create-only | Fully immutable; revoke + re-create on any change. | |

**User's choice:** Edit due date + revoke (Recommended)
**Notes:** Soft-delete via `form_assignments.deleted_at` (column already exists).

### Q4: Optional "instructions for client" note?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — optional note field | Adds `form_assignments.instructions TEXT NULL`; shown above the form when client opens it. | ✓ |
| No — keep minimal | Just template + clients + optional due date. | |

**User's choice:** Yes — optional note field (Recommended)
**Notes:** New migration `013_phase16_assignments_instructions.sql`.

---

## Fork base + assignment re-link

### Q1: When client clicks "Customise first", what version is forked?

| Option | Description | Selected |
|--------|-------------|----------|
| Assignment's pinned version | Copy from `form_assignments.template_version_id`. Predictable; matches what client saw. | ✓ |
| Master's latest published version | Re-resolve master.latest_published at fork time. Freshest; may differ from assigned. | |
| Show both, let the client choose | Prompt if latest > assigned. More transparent; one extra click. | |

**User's choice:** Assignment's pinned version (Recommended)
**Notes:** Eliminates "where did these new fields come from?" surprises.

### Q2: When client submits the fork against an assignment, what happens to `form_assignments`?

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-rewrite to point at the fork | `template_id := fork.id`, `template_version_id := fork v1`. Status flows normally. | ✓ |
| Mark completed despite mismatch | Leave row pointing at master; submission's `template_version_id` is the fork's. Audit-friendly but confusing. | |
| Spawn a new assignment for the fork | Mark original 'forked_out'; create fresh row for the fork. Cleanest separation; one more state. | |

**User's choice:** Auto-rewrite to point at the fork (Recommended)
**Notes:** Admin still sees the relationship via `form_templates.parent_template_id`.

### Q3: Where do "Fill as-is" / "Customise first" buttons live?

| Option | Description | Selected |
|--------|-------------|----------|
| Two buttons on assignment landing page | `/client/assignments/[id]` with both CTAs. Customise creates fork + redirects to builder. | ✓ |
| Single 'Open form', customise from inside interpreter | Hidden until they're already filling. | |
| Modal on first open | Forced one-time decision. | |

**User's choice:** Two buttons on assignment landing page (Recommended)
**Notes:** Matches build prompt §4b. Confirmation prompt on "Customise first" before commit.

### Q4: After fork creation, fill immediately or require publish?

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-publish on fork creation | Fork v1 born `published_at = now()`. Subsequent edits go through Phase 13 draft → publish flow. | ✓ |
| Require explicit Publish | Same as customer-built-from-scratch flow. One extra click; uniform behavior. | |
| You decide | Defer to planner / Claude. | |

**User's choice:** Auto-publish on fork creation (Recommended)
**Notes:** Avoids the "why can't I fill my own template?" trap.

---

## "Forms Assigned to You" lifecycle UI

### Q1: What does `app/client/templates/page.tsx` become?

| Option | Description | Selected |
|--------|-------------|----------|
| Split into two pages | `/client/assignments` (assigned only) + `/client/templates` (My Templates only). Drop browseable admin masters. | ✓ |
| Three sections on one page | Tabs: Assigned / My templates / Available masters. Browseable for self-assign. | |
| One page, only assignments + my templates | Single route with two sections; no browseable list. | |

**User's choice:** Split into two pages (Recommended)
**Notes:** Resolves `TODO(phaseB)` in `app/client/templates/page.tsx` lines 16-18.

### Q2: Lifecycle view — active only or also history?

| Option | Description | Selected |
|--------|-------------|----------|
| Active + Completed tabs | Default Active; Completed tab with submission link. Revoked filtered out of both. | ✓ |
| Active only | Submitted rows drop off; history lives admin-side. | |
| Single list with status pills | All non-revoked together; no tabs. | |

**User's choice:** Active + Completed tabs (Recommended)
**Notes:** Default tab = Active.

### Q3: Assignment status lifecycle?

| Option | Description | Selected |
|--------|-------------|----------|
| `pending → in_progress → completed` | Two-tier active state; supports 'Resume' vs 'Start' affordance. | ✓ |
| Just `pending → completed` | Status flips at submit; in-progress inferred from draft submission row. | |
| `pending → in_progress → submitted → reviewed` | Adds admin review state. More server wiring. | |

**User's choice:** `pending → in_progress → completed` (Recommended)
**Notes:** Plus revoke via `deleted_at`. Admin review state deferred.

### Q4: Where does Matt see assigned forms?

| Option | Description | Selected |
|--------|-------------|----------|
| Per-client tab on `/admin/clients/[id]` | Client-first; counter pill on clients list. | |
| Dedicated `/admin/assignments` queue | Cross-client queue. Best for "overdue this week". | |
| Both: per-client tab AND a queue page | Most flexible; ~2x UI work. | ✓ |

**User's choice:** Both: per-client tab AND a queue page
**Notes:** Per-client serves dominant flow; queue serves "overdue this week".

---

## Customer role gating

### Q1: Who in an org sees "My Templates" + "Customise first"?

| Option | Description | Selected |
|--------|-------------|----------|
| Everyone in the org | Mirrors RLS exactly. Easiest to ship; matches success criterion #3. | ✓ |
| Gate behind a new role flag on `client_users` | Add `client_users.can_manage_templates BOOL`. Matt sets per-user. | |
| Gate behind an existing field if one fits | Reuse a column like `is_primary_contact`. Avoids migration. | |

**User's choice:** Everyone in the org (Recommended for v1)
**Notes:** Future-proof — easy to add a gate later if multi-user orgs grow.

### Q2: Customer template delete rules?

| Option | Description | Selected |
|--------|-------------|----------|
| Org-level CRUD | Any client_user can delete any of their org's templates. Soft-delete via `deleted_at`. | ✓ |
| Only the creator can delete | Add `created_by_user_id`; tighter scope. | |
| No customer-side delete | Admin removes on request. | |

**User's choice:** Yes — org-level CRUD (Recommended)
**Notes:** Templates with existing submissions stay visible as read-only.

### Q3: How do we prove cross-org isolation?

| Option | Description | Selected |
|--------|-------------|----------|
| Automated RLS test in `tests/rls/` | Vitest spec; two orgs; assert empty cross-reads via supabase-js. CI catches regressions. | ✓ |
| Manual UAT — two test accounts walkthrough | Document in 16-UAT.md; one-time check. | |
| Both — automated test + manual UAT | Belt + braces. | |

**User's choice:** Automated RLS test in `tests/rls/` (Recommended)
**Notes:** Must cover `form_templates`, `template_versions`, `form_submissions`, AND `form_assignments`.

### Q4: Customer-built templates — assignment scope?

| Option | Description | Selected |
|--------|-------------|----------|
| No — fill-only for the org | No `form_assignments` rows for customer-built templates. Any client_user can fill from `/client/templates`. | ✓ |
| Yes — self-assign with a due date | Creates an in-org `form_assignments` row. Lets clients give themselves deadlines. | |
| Yes — multi-user customers can assign within the org (future) | Cross-user in-org assignment. Build-prompt-deferred. | |

**User's choice:** No — customer templates are fill-only for their org (Recommended)
**Notes:** Implies `form_submissions.assignment_id` must become nullable, or a sentinel "self-fill" assignment is auto-created. Planner picks; lean = nullable + CHECK constraint.

---

## Claude's Discretion (planner / executor decides)

- Schema for "submission without an assignment" — drop `NOT NULL` on `form_submissions.assignment_id` (with CHECK) vs sentinel-assignment row.
- Wire format of the assign-action server action input (positional vs single payload object).
- Where to put the new explicit fork action (`app/client/templates/actions.ts` alongside the dead `forkOnFill`, vs `app/client/assignments/actions.ts`).
- Server vs client component for `/admin/assignments` queue (URL filters vs local state) — match `/admin/proposals` / `/admin/review-queue` convention.

## Deferred Ideas

- Per-row due-date override in the multi-select assignment modal.
- Customer-side in-org user-to-user assignment.
- "Browse all published admin masters" library route for self-assign.
- Reviewed / approved sub-state beyond `completed`.
- Role-gated "template_admin" within an org.
- Hard delete of customer templates with submissions.
- `/admin/assignments` bulk actions (CSV export, mark-as-reminded, etc.).
