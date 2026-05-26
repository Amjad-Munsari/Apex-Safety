# Phase 16: Multi-Tenancy + Fork-on-Fill — Pattern Map

**Mapped:** 2026-05-26
**Files analyzed:** 16 new / 5 modified
**Analogs found:** 21 / 21

> All patterns below are concrete excerpts pulled from the codebase. Planner should reference these by file + line range when drafting plan actions. The AGENTS.md "Form template ownership" decision (`owner_type='customer'`, `owner_id=clients.id`) is the authoritative contract — every customer-side action below uses `ctx.client_id` (the org), never `client_users.id`.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| **NEW** `app/admin/assignments/page.tsx` | route (RSC, queue) | request-response (searchParams) | `app/admin/proposals/page.tsx` | exact |
| **NEW** `app/admin/assignments/actions.ts` | server actions module | CRUD | `app/admin/templates/actions.ts` | exact |
| **NEW** `app/client/assignments/page.tsx` | route (RSC, tabbed list) | request-response | `app/client/templates/page.tsx` + `app/admin/clients/[id]/client-tabs.tsx` (Tabs pattern) | role-match |
| **NEW** `app/client/assignments/[id]/page.tsx` | route (RSC, landing) | request-response | `app/admin/assessments/[id]/page.tsx` (two-step fetch) | role-match |
| **NEW** `app/client/assignments/[id]/fill/page.tsx` | route (RSC, interpreter host) | request-response | `app/admin/assessments/[id]/page.tsx` | exact |
| **NEW** `app/client/assignments/actions.ts` | server actions module | CRUD + redirect | `app/client/templates/actions.ts` (`forkOnFill`) + `app/admin/assessments/actions.ts` (`startAssessment` `redirect()`) | exact |
| **NEW** `app/client/assignments/_components/customise-first-button.tsx` (or equivalent) | client component | event-driven | `app/client/templates/_components/client-template-card.tsx` (AlertDialog + useTransition) | exact |
| **NEW** `components/admin/assign-template-modal.tsx` | client component (shared modal) | event-driven | `components/admin/upload-document-modal.tsx` + `components/clients/new-client-dialog.tsx` | exact |
| **NEW** `supabase/migrations/013_phase16_assignments_instructions.sql` | migration (DDL only) | schema-change | `supabase/migrations/002_phase7_draft_report.sql` (simple ALTER TABLE ADD COLUMN) | exact |
| **NEW** `supabase/migrations/014_phase16_customer_submissions.sql` | migration (DDL + RLS) | schema-change | `supabase/migrations/003_form_template_customer_ownership.sql` (CHECK + RLS) | exact |
| **NEW** `tests/rls/multi-tenancy.spec.ts` | test (RLS isolation) | request-response over JWT | `tests/security.spec.ts` (Playwright → adapt to Vitest) | role-match |
| **NEW** `tests/rls/helpers/seed-two-tenants.ts` | test helper | batch-setup | `tests/security.spec.ts` `seedTwoTenants` (extract + extend) | exact |
| **NEW** `tests/form-builder/fork-assigned-template.test.ts` | unit test | transform | `tests/form-builder/version-pin.test.ts` (mock Supabase, assert query shape) | exact |
| **NEW** `tests/form-builder/assignment-status-transitions.test.ts` | unit test | state-machine | `tests/form-builder/save-draft.test.ts` (mock supabase, assert update) | exact |
| **NEW** `tests/form-builder/customer-self-fill-submission.test.ts` | unit test | CRUD invariant | `tests/form-builder/save-draft.test.ts` | exact |
| **NEW** `tests/form-builder/assignments-query.test.ts` | unit test | query-shape | `tests/form-builder/save-draft.test.ts` | exact |
| **MODIFY** `app/admin/templates/[id]/page.tsx` | route (RSC) | request-response | existing file — add `<AssignTemplateModal templateId={id} />` mount only | self |
| **MODIFY** `app/admin/clients/[id]/page.tsx` | route (RSC) | request-response | existing file — add assignments fetch + pass to ClientTabs | self |
| **MODIFY** `app/admin/clients/[id]/client-tabs.tsx` | client component | request-response | existing file — add new TabsTrigger "Assigned Forms" + TabsContent | self |
| **MODIFY** `app/client/templates/page.tsx` | route (RSC) | request-response | existing file — remove "Available admin masters" section, retain "My Templates" | self |
| **MODIFY** `app/client/templates/actions.ts` | server actions | CRUD | existing file — delete `forkOnFill` (now dead code per D-07) | self |
| **MODIFY** `vitest.config.ts` | config | n/a | existing file — extend `include` to add `tests/rls/**/*.{test,spec}.{ts,tsx}` | self |

---

## Pattern Assignments

### `app/admin/assignments/actions.ts` (server actions, CRUD)

**Analog:** `app/admin/templates/actions.ts`

**File header / "use server" + imports** (lines 1-6 of analog):
```typescript
"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { requireActorUserId } from "@/lib/auth-helpers";
```

**Admin action shape** — `requireActorUserId("admin")` is the **first** statement, then RLS-aware insert, then `revalidatePath`. From `createTemplate` (lines 9-36):
```typescript
export async function createTemplate(name: string, templateType: string) {
  const supabase = await createClient();
  const userId = await requireActorUserId("admin");

  const { data, error } = await supabase
    .from("form_templates")
    .insert({ name, template_type: templateType, owner_id: userId, owner_type: "admin" })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  // ... follow-up insert(s)
  revalidatePath("/admin/templates");
  return data.id;
}
```

**Multi-row insert pattern** for `createAssignments(templateId, clientIds[], { dueDate?, instructions? })` — `supabase.from("form_assignments").insert([{...}, {...}])` accepts an array; assigned_by comes from `requireActorUserId("admin")` (this is the same UUID column already defined on `form_assignments` migration 001 line 77).

**Soft-delete (revoke) pattern** — from `app/admin/assessments/actions.ts:deleteAssessment` style but using `update({ deleted_at: now })` instead of `.delete()`. Mirror the loud error pattern from `requireOwnedTemplate` in `app/client/templates/actions.ts` lines 23-35.

---

### `app/client/assignments/actions.ts` (server actions, CRUD + redirect)

**Analog:** `app/client/templates/actions.ts` (for fork pattern) + `app/admin/assessments/actions.ts` (for `redirect()` pattern)

**Client context helper** — lines 9-13 of `app/client/templates/actions.ts`:
```typescript
async function requireClientContext() {
  const ctx = await getClientContext();
  if (!ctx) throw new Error("Not a client user");
  return ctx;
}
```

**Ownership verification helper** (mirror as `requireOwnedAssignment`) — lines 23-35 of `app/client/templates/actions.ts`:
```typescript
async function requireOwnedTemplate(templateId: string, clientId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("form_templates")
    .select("id, owner_id, owner_type")
    .eq("id", templateId)
    .single();
  if (error || !data) throw new Error("Template not found");
  if (data.owner_type !== "customer" || data.owner_id !== clientId) {
    throw new Error("Forbidden: not your template");
  }
  return data;
}
```

**Existing fork prior art** — `forkOnFill` in `app/client/templates/actions.ts` lines 214-283 is the closest analog for `forkAssignedTemplate(assignmentId)`. The KEY DIFFERENCE the planner MUST honour:

- `forkOnFill` reads `template_versions` by `eq("template_id", masterTemplateId).order("version_number", desc).limit(1)` to find the LATEST published master version (this is the wrong choice per D-05).
- `forkAssignedTemplate` reads the EXACT `template_version_id` recorded on the assignment row (D-05: pinned, not latest).
- Both copy schema into a new customer-owned row with `parent_template_id=master_id`, auto-publish v1 (lines 255-280).
- New: after fork-version insert, UPDATE `form_assignments` row's `template_id` and `template_version_id` to point at the fork (D-06). Then `redirect()` outside any try/catch.

Concrete fork excerpt to copy (lines 255-280):
```typescript
const { data: forkRow, error: forkErr } = await supabase
  .from("form_templates")
  .insert({
    name: master.name,
    template_type: master.template_type,
    owner_id: ctx.client_id,           // org, NOT user
    owner_type: "customer",
    parent_template_id: masterTemplateId,
    is_published: true,
  })
  .select("id")
  .single();
if (forkErr || !forkRow) throw new Error(forkErr?.message ?? "Fork insert failed");

const { data: versionRow, error: versionErr } = await supabase
  .from("template_versions")
  .insert({
    template_id: forkRow.id,
    version_number: 1,
    schema_json: modifiedSchema,        // for D-05: substitute pinned.schema_json
    published_at: new Date().toISOString(),
    created_by: userId,
  })
  .select("id")
  .single();
```

**`redirect()` outside try/catch** — Pattern from `app/admin/assessments/actions.ts:startAssessment` lines 17-73. Note the redirect is the LAST line, with no try/catch wrap:
```typescript
// Step N: revalidate BEFORE redirect (redirect throws and short-circuits)
revalidatePath("/client/assignments");
revalidatePath("/client/templates");

// Step N+1: redirect MUST be the last line, outside any try/catch
redirect(`/client/templates/${forkRow.id}/edit`);
```

**Status transition helper** (`pending → in_progress → completed`) — new helper, lives next to the actions that call it. Pattern shape (planner-discretion location, but co-located with the call site that mutates `form_submissions`):
```typescript
async function transitionAssignmentStatus(
  supabase: SupabaseClient,
  assignmentId: string,
  next: "in_progress" | "completed"
) {
  const previous = next === "in_progress" ? "pending" : "in_progress";
  const { error } = await supabase
    .from("form_assignments")
    .update({ status: next })
    .eq("id", assignmentId)
    .eq("status", previous);          // optimistic guard
  if (error) console.error("Status transition failed", { assignmentId, next, error });
}
```
Reference for the broader status-update style: `app/admin/assessments/actions.ts:submitAssessmentAction` lines 232-309 (update with `.eq("status", "draft")` optimistic guard at line 291).

---

### `app/admin/assignments/page.tsx` (route, RSC queue with searchParams)

**Analog:** `app/admin/proposals/page.tsx`

**File header + dynamic flag** (lines 1-10):
```typescript
import { adminClient } from "@/lib/supabase/admin"
import { calculateProposalTotal } from "@/lib/supabase/dashboard"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { ProposalCard } from "./proposal-card"

export const dynamic = "force-dynamic"

export default async function ProposalsPage() {
  const { data: proposals } = await adminClient
    .from("proposals")
    .select(`*, client:clients(name)`)
    .order("created_at", { ascending: false })
```

**Header pattern** (lines 43-68) — back link + mono index + serif h2 + body subhead + right-side action:
```tsx
<div className="flex justify-between items-end">
  <div className="flex flex-col gap-2">
    <Link href="/admin" className="flex items-center gap-2 text-[#666] hover:text-white transition-colors mb-2">
      <ArrowLeft className="w-4 h-4" />
      <span className="font-mono text-xs uppercase tracking-widest">Back to Dashboard</span>
    </Link>
    <div className="flex items-center gap-3 font-mono text-xs tracking-widest text-[#666] uppercase">
      <span className="text-gold font-semibold">06</span>
      SALES PIPELINE
    </div>
    <h2 className="font-serif text-[34px] leading-tight text-white">Active Proposals</h2>
    <p className="text-[#666] text-sm font-sans tracking-wide max-w-xl">…</p>
  </div>
  …
</div>
```

**searchParams shape** — `app/admin/proposals/page.tsx` doesn't take searchParams; the closest documented pattern is in RESEARCH.md Pattern 5 (sketch lines 600-628). The signature is the canonical Next 16 `searchParams: Promise<{...}>`. Status pill rendering for the queue table comes from `client-tabs.tsx` lines 284-296 (inline ternary, mono `text-[10px] uppercase tracking-widest`).

**Table primitive** — for the queue, mirror the `<table>` pattern from `app/admin/clients/page.tsx` lines 52-134 (header `bg-[#151515]`, `text-[10px] font-mono tracking-widest uppercase text-[#555]` th, `hover:bg-white/[0.02]` tr).

---

### `app/client/assignments/page.tsx` (RSC, Active/Completed tabs)

**Analog:** `app/client/templates/page.tsx` (header + cream surface) + `app/admin/clients/[id]/client-tabs.tsx` (Tabs pattern)

**Page header — client surface** (`app/client/templates/page.tsx` lines 39-52, but with UI-SPEC migration to 28px):
```tsx
<section className="space-y-3">
  <div className="flex items-center gap-3">
    <span className="font-mono text-[10px] text-[#3b8273] tracking-[0.4em] uppercase font-medium">
      05 · Assigned Forms
    </span>
  </div>
  <div className="flex items-end justify-between gap-6 flex-wrap">
    <h2 className="font-serif text-[28px] text-[#1a1a1a] font-medium tracking-tight leading-[1.1]">
      Forms assigned to you.
    </h2>
  </div>
</section>
```
Note: UI-SPEC requires 28px (`text-[28px]`), not the current `text-[32px]` shown in `app/client/templates/page.tsx:47` — that file also gets updated to 28px in this phase.

**Tabs primitive** — shadcn `<Tabs>` already used at `app/admin/clients/[id]/client-tabs.tsx:148-165`. The variant for the client surface should be the default (not the admin `variant="line"`); use `defaultValue="active"`.

**RLS-aware fetch + defense-in-depth filter** — pattern from RESEARCH.md and `app/client/templates/page.tsx` lines 25-35:
```typescript
const supabase = await createClient();
const ctx = await getClientContext();
const { data: assignments } = ctx
  ? await supabase
      .from("form_assignments")
      .select("id, template_id, due_date, status, instructions, created_at, template:form_templates(name)")
      .eq("client_id", ctx.client_id)        // defense-in-depth
      .is("deleted_at", null)                // RLS does NOT filter deleted_at
      .order("due_date", { ascending: true, nullsFirst: false })
  : { data: null };
```

**Assignment card on cream surface** — copy the `<ClientTemplateCard>`-style markup from `app/client/templates/_components/client-template-card.tsx` lines 56-80:
```tsx
<div className="bg-white border border-[#e5e1d8] rounded-sm p-5 flex flex-col gap-4 hover:border-[#1a1a1a]/30 transition-colors">
  <div className="flex flex-col gap-1">
    <h4 className="font-serif text-[18px] text-[#1a1a1a] leading-tight">{templateName}</h4>
    <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#8a857f]">
      DUE · {formatDate(dueDate)}
    </span>
  </div>
  {/* status pill — see Shared Patterns below */}
</div>
```

---

### `app/client/assignments/[id]/page.tsx` (RSC landing — Fill vs Customise)

**Analog:** `app/admin/assessments/[id]/page.tsx` (two-step fetch + UUID guard)

**UUID guard + two-step fetch** (lines 1-48):
```typescript
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function AssessmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID_RE.test(id)) notFound()

  // Step 1: fetch the wrapper row (assignment, not submission)
  const { data: assignment } = await supabase
    .from("form_assignments")
    .select("id, client_id, template_id, template_version_id, due_date, status, instructions, deleted_at, template:form_templates(name)")
    .eq("id", id)
    .maybeSingle()

  if (!assignment || assignment.deleted_at) notFound()
  // Status redirect to /fill or to completed view follows same pattern as
  // `if (submission.status === "submitted") redirect(...)` at line 33.
}
```

**Customise-first button (client component)** — landing page mounts a `<CustomiseFirstButton assignmentId={id} />` that wraps the AlertDialog + `useTransition` pattern from `client-template-card.tsx` lines 39-114. The fork action is called inside `startTransition` and the catch only handles real errors (NEXT_REDIRECT bubbles to framework).

---

### `app/client/assignments/[id]/fill/page.tsx` (interpreter against pinned version)

**Analog:** `app/admin/assessments/[id]/page.tsx` (lines 1-58) — the same RSC + `AssessmentClient` mounting pattern, swap surface from dark to cream. The pinned-version fetch is identical:
```typescript
const { data: version } = await adminClient   // for client surface: use createClient() not adminClient
  .from("template_versions")
  .select("schema_json, template_id, form_template:form_templates(name)")
  .eq("id", submission.template_version_id)
  .single()
```

**Surface swap:** RESEARCH.md Anti-Pattern — `TemplateBuilderClient` on `/client/...` uses `surface="cream"` (`app/client/templates/[id]/page.tsx:53`). The interpreter analog must keep cream surface end-to-end.

---

### `components/admin/assign-template-modal.tsx` (shared multi-select modal)

**Analogs (combine):**
- Modal shell, Dialog primitive, dark surface: `components/admin/upload-document-modal.tsx`
- Form state + multi-field handling + toast feedback: `components/clients/new-client-dialog.tsx`

**Dialog shell** (`upload-document-modal.tsx` lines 86-97):
```tsx
<Dialog open={open} onOpenChange={setOpen}>
  <Button variant="secondary" …>Trigger</Button>
  <DialogContent className="bg-[#1c1c1c] border-white/10 text-white sm:max-w-[425px]">
    <DialogHeader>
      <DialogTitle className="font-serif text-2xl font-normal">Assign template</DialogTitle>
    </DialogHeader>
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 mt-4">
```

**Native date input on dark surface** (`upload-document-modal.tsx` lines 163-174):
```tsx
<Label htmlFor="dueDate" className="text-white/70 font-mono text-xs uppercase tracking-widest">
  Due date
</Label>
<Input
  id="dueDate"
  name="dueDate"
  type="date"
  className="bg-black/50 border-white/10 text-white css-invert-calendar"
  style={{ colorScheme: "dark" }}
/>
```

**State + submit + error feedback** (`new-client-dialog.tsx` lines 37-59):
```tsx
const [submitting, setSubmitting] = React.useState(false)
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault()
  if (!canSubmit) return
  setSubmitting(true)
  try {
    const { id } = await createClient({ name, … })
    setOpen(false)
    reset()
    toast.success("Client added", { description: `…` })
  } catch (err: any) {
    toast.error(err?.message || "Failed to add client")
  } finally {
    setSubmitting(false)
  }
}
```

**Checkbox grid** — `Checkbox` not yet installed (UI-SPEC declares `npx shadcn add checkbox` for Wave 1). After install, the multi-select pattern is a plain `.map()` over clients rendering one row of `<Checkbox checked={...} onCheckedChange={...} />` + `<Label>`.

**Toast copy contract** — UI-SPEC table mandates:
- Success: `Assigned to {N} client / Assigned to {N} clients`
- Validation: `Select at least one client to assign`
- Server error: `Assignment failed — please try again or contact support`

---

### `supabase/migrations/013_phase16_assignments_instructions.sql` (simple ALTER)

**Analog:** `supabase/migrations/002_phase7_draft_report.sql` (whole file is the analog — simplest `ALTER TABLE ADD COLUMN` migration in the project):
```sql
-- Phase 7: Add draft_report_json, status, and report_storage_path to form_submissions

ALTER TABLE public.form_submissions
ADD COLUMN IF NOT EXISTS draft_report_json jsonb,
ADD COLUMN IF NOT EXISTS status text DEFAULT 'Draft',
ADD COLUMN IF NOT EXISTS report_storage_path text;
```

For Phase 16 this becomes:
```sql
-- 013_phase16_assignments_instructions.sql
-- Phase 16 D-04: optional per-assignment instructions shown above the form
-- when the client opens the assignment.

ALTER TABLE public.form_assignments
  ADD COLUMN IF NOT EXISTS instructions TEXT;
```

---

### `supabase/migrations/014_phase16_customer_submissions.sql` (DROP NOT NULL + CHECK + RLS)

**Analog:** `supabase/migrations/003_form_template_customer_ownership.sql` — same shape: DDL changes, then RLS policies.

**DROP NOT NULL pattern** (analog uses ALTER + DROP CONSTRAINT lines 14-27):
```sql
ALTER TABLE form_submissions
  ALTER COLUMN assignment_id DROP NOT NULL;
```

**CHECK constraint pattern** (analog lines 22-27):
```sql
ALTER TABLE form_submissions
  DROP CONSTRAINT IF EXISTS form_submissions_assignment_or_customer_check;

ALTER TABLE form_submissions
  ADD CONSTRAINT form_submissions_assignment_or_customer_check
    CHECK (assignment_id IS NOT NULL);
-- Note: cross-table subquery CHECK is not supported in Postgres (RESEARCH Pitfall 2).
-- Application-level invariant only — RLS + server-action validation enforce it.
```

**RLS policy pattern** (analog lines 43-69): customer-side `form_submissions_client_*` policies use the same `client_id IN (SELECT client_id FROM client_users WHERE id = auth.uid())` shape used today on `form_assignments_client_own` (migration 001 lines 286-289). Add a customer INSERT/UPDATE/SELECT policy if not already present:
```sql
DROP POLICY IF EXISTS "form_submissions_client_own_insert" ON form_submissions;
CREATE POLICY "form_submissions_client_own_insert" ON form_submissions
  FOR INSERT WITH CHECK (
    client_id IN (SELECT client_id FROM client_users WHERE id = auth.uid())
  );
```

---

### `tests/rls/multi-tenancy.spec.ts` (cross-org RLS isolation)

**Analog:** `tests/security.spec.ts` (THE existing RLS test in the project — needs Vitest port)

**Setup (service-role) — lines 62-116 of analog**, copy verbatim then EXTEND to seed:
- 1 admin master `form_templates` + 1 published `template_versions` row
- 1 `form_assignments` row per tenant (assignment pinned to the master version)
- 1 customer-owned `form_templates` + v1 published `template_versions` per tenant
- 1 `form_submissions` row per tenant (draft against admin master)

**Signed-in client helper — lines 128-138 of analog (verbatim):**
```typescript
async function signedInClientFor(user: TestUser): Promise<SupabaseClient> {
  const client = createClient(SUPABASE_URL!, ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { error } = await client.auth.signInWithPassword({
    email: user.email,
    password: user.password,
  })
  if (error) throw new Error(`signIn ${user.email}: ${error.message}`)
  return client
}
```

**Negative assertion shape — lines 184-192 of analog**:
```typescript
test("Client A cannot fetch Client B's document by id", async () => {
  const a = await signedInClientFor(ctx.userA)
  const { data, error } = await a
    .from("documents")
    .select("id, client_id")
    .eq("id", ctx.userB.documentId)
  expect(error).toBeNull()
  expect(data).toEqual([])
})
```

**Required negative + positive assertions for Phase 16 (RESEARCH Pattern 2 / Pitfall 4):**
- A cannot read B's `form_templates` (`owner_type=customer, owner_id=B.clientId`)
- A cannot read B's `template_versions` (by version id)
- A cannot read B's `form_submissions` (by `client_id`)
- A cannot read B's `form_assignments` (by `client_id`)
- A **CAN** read their own rows (positive witness — proves RLS is filtering, not just returning empty for missing data)

**Env-skip pattern — lines 141-144 of analog (Vitest equivalent):**
```typescript
describe.skipIf(!hasEnv)("RLS — cross-org isolation (Phase 16)", () => {
  beforeAll(async () => { ctx = await seedTwoTenants() })
  afterAll(async () => { if (ctx) await teardown(ctx) })
  …
})
```

**Anti-pattern (RESEARCH Pitfall 4):** Do NOT use `adminClient` (service-role) for the assertions. Service-role bypasses RLS — every "cannot read" would falsely pass.

---

### `tests/rls/helpers/seed-two-tenants.ts`

**Analog:** `tests/security.spec.ts` lines 62-116 — extract verbatim into a helper module. Add Phase-16-specific seed steps (admin master template, fork, customer-owned template, assignment, submission). The `teardown(ctx)` function at lines 118-126 of the analog is the reverse-order delete pattern; extend for the new rows.

---

### Test files under `tests/form-builder/` (4 new specs)

**Analog (all four):** `tests/form-builder/save-draft.test.ts`

**Standard mocks at the top of every spec** (lines 19-66 of analog):
```typescript
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "admin-user-001" } } }) },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      insert: vi.fn().mockResolvedValue({ error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
  }),
}));

vi.mock("@/lib/auth-helpers", () => ({
  requireActorUserId: vi.fn().mockResolvedValue("admin-user-001"),
  getClientContext: vi.fn().mockResolvedValue({ client_id: "client-org-001" }),
  getActorUserId: vi.fn().mockResolvedValue("admin-user-001"),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
```

**Per-spec scope:**
- `fork-assigned-template.test.ts` — assert that `forkAssignedTemplate` reads `template_versions` by `eq("id", assignment.template_version_id)` (the PIN, D-05), inserts fork with `parent_template_id=master_id, owner_type='customer', owner_id=ctx.client_id`, then UPDATEs the assignment to the fork. Use the spy-on-`from()` pattern from `version-pin.test.ts` (lines 64-80) for query-shape assertions.
- `assignment-status-transitions.test.ts` — assert `transitionAssignmentStatus` issues `.update({status: 'in_progress'}).eq('id', assignmentId).eq('status', 'pending')` with the optimistic guard.
- `customer-self-fill-submission.test.ts` — assert customer-built fill INSERTs `form_submissions` with `assignment_id: null` (D-16 contract requires post-migration-014 nullability).
- `assignments-query.test.ts` — assert `/client/assignments` page query has `.is("deleted_at", null)` and `.eq("client_id", ctx.client_id)` (defense-in-depth — RESEARCH Pitfall 5).

---

### Modify `app/admin/templates/[id]/page.tsx`

**Pattern source:** existing file at `app/admin/templates/[id]/page.tsx` lines 1-54 — keep as-is, add `<AssignTemplateModal templateId={id} clients={…} />` import + mount in the page header alongside existing Edit/Publish controls (per UI-SPEC Route C).

---

### Modify `app/admin/clients/[id]/page.tsx` + `client-tabs.tsx`

**Pattern source:** existing files.

**`page.tsx`** — alongside the existing `documents/proposals/hours/submissions` fetches (lines 27-126), add an `assignments` fetch:
```typescript
const { data: assignmentRows } = await adminClient
  .from("form_assignments")
  .select(`
    id, status, due_date, instructions, created_at,
    template:form_templates(id, name)
  `)
  .eq("client_id", id)
  .is("deleted_at", null)
  .order("created_at", { ascending: false })
```
Pass through to `<ClientTabs … assignments={…} />`.

**`client-tabs.tsx`** — add a new `<TabsTrigger value="assignments">` next to the existing tabs (lines 148-165 of analog), and a corresponding `<TabsContent>` mirroring the Documents tab shape (lines 168-218). Insert `<AssignTemplateModal preselectClientId={clientId} clients={[]} />` in the tab header per UI-SPEC Route B.

---

### Modify `app/client/templates/page.tsx`

**Pattern source:** existing file lines 1-134.

Changes per D-09 + UI-SPEC Route G:
1. **Remove** the "Available" section (lines 54-95) and its `assigned` fetch (lines 18-23).
2. **Change** `text-[32px]` to `text-[28px]` at line 47.
3. **Change** the My Templates section label from `02 — My Templates` to `My Templates` (drop numbering).
4. **Update** mono index header at line 42 from `06 · Templates` to whatever the unified UI numbering becomes (UI-SPEC uses `05 · Assigned Forms` for the new sibling route; templates can use `06` still or be renumbered — planner-discretion).

---

### Modify `app/client/templates/actions.ts`

**Pattern source:** existing file lines 214-283.

Delete `forkOnFill` (D-07: auto-trigger contract superseded by explicit-button `forkAssignedTemplate`). Also delete the now-unused `hasStructuralChanges` import (line 7) and the corresponding mock in `tests/form-builder/save-draft.test.ts` line 66.

---

### Modify `vitest.config.ts`

**Pattern source:** existing file at lines 1-18.

Extend the `include` array at line 8:
```typescript
include: [
  "tests/form-builder/**/*.{test,spec}.{ts,tsx}",
  "tests/form-interpreter/**/*.{test,spec}.{ts,tsx}",
  "tests/rls/**/*.{test,spec}.{ts,tsx}",   // NEW — Phase 16 D-15
],
```

---

## Shared Patterns

### Authentication / context resolution

**Admin actions** — `requireActorUserId("admin")` as the first statement.
**Source:** `lib/auth-helpers.ts` lines 50-56.
**Apply to:** All files in `app/admin/assignments/actions.ts`.
```typescript
export async function requireActorUserId(_actorType: "admin" | "client"): Promise<string | null> {
  if (await isDemoMode()) return null
  const user = await getUser()
  if (user) return user.id
  throw new Error("Unauthorized")
}
```

**Client actions** — `getClientContext()` returns `{ client_id, role }`; planner must use `ctx.client_id` (the **org**, not the user) for ownership checks.
**Source:** `lib/auth-helpers.ts` lines 65-94.
**Apply to:** All files in `app/client/assignments/actions.ts` and the customer-self-fill submission paths.

### Soft-delete via `deleted_at`

**Pattern:** Use `.update({ deleted_at: new Date().toISOString() })`, never `.delete()`, for revoke + template-delete-with-submissions paths.
**Source:** migration 001 lines 81, 97 (the column exists on `form_assignments` and `form_submissions`); read-side filter in `app/client/templates/page.tsx` is implicit but every Phase-16 query MUST add `.is("deleted_at", null)` explicitly (RLS does NOT filter it — RESEARCH Pitfall 5).
**Apply to:** `revokeAssignment`, `deleteClientTemplate` (already correct in `app/client/templates/actions.ts:184`).

### `redirect()` outside try/catch

**Pattern:** `redirect()` from `next/navigation` throws `NEXT_REDIRECT`. Wrapping in try/catch swallows it (RESEARCH Pitfall 1).
**Source:** `app/admin/assessments/actions.ts:startAssessment` lines 17-73 — redirect at line 72 is the last statement, no try/catch wrap.
**Apply to:** `forkAssignedTemplate` (must end in `redirect('/client/templates/[fork_id]/edit')`).

### Toast / error messaging

**Pattern:** sonner `toast.success(...)` / `toast.error(...)`; the latter uses a generic recovery copy.
**Source:**
- `app/client/templates/_components/client-template-card.tsx` lines 43-54 (`startTransition` + try/catch + toast).
- UI-SPEC Copywriting Contract table — every user-facing message has a locked string. Wire exactly per the table.
**Apply to:** All client-component buttons that call server actions.

### Defense-in-depth `client_id` filter

**Pattern:** Server-rendered customer pages MUST filter `.eq("client_id", ctx.client_id)` on top of RLS (`tests/security.spec.ts:7-22` audit comment).
**Apply to:** `app/client/assignments/page.tsx`, `app/client/assignments/[id]/page.tsx`.

### Pinned-version fetch (NEVER latest, NEVER FK-join)

**Pattern:** Two-step fetch — read the submission/assignment first, then read `template_versions` by `eq("id", submission.template_version_id).single()`. NEVER use a `template:template_versions(...)` join in the same query (Phase 13 RESEARCH Pitfall 2; reaffirmed in `app/admin/assessments/[id]/page.tsx` lines 17-48).
**Apply to:** `forkAssignedTemplate` (reads pinned version per D-05), `/client/assignments/[id]/fill/page.tsx`, the customer-self-fill route.

### Status-pill rendering

**Pattern:** Inline ternary, mono `text-[9px]–[10px] uppercase tracking-widest`, colour pairs by status.
**Source:** `app/client/templates/_components/client-template-card.tsx` lines 68-74 (cream surface) and `app/admin/clients/[id]/client-tabs.tsx` lines 284-296 (dark surface).
**Apply to:** Every assignment row on both surfaces. UI-SPEC §"Status pill spec" pins the exact colours:
- `pending` — `text-[#666] bg-[#555]/10`
- `in_progress` — `text-[#c0a66d] bg-[#c0a66d]/10`
- `completed` — `text-[#3b8273] bg-[#3b8273]/10`

### Schema-validation + cycle-detection guard (carry-forward from Phases 13/15)

**Pattern:** After `validateSchema` succeeds, run `validateRuleGraph`; on failure throw a JSON-encoded `RuleGraphInvalid` payload.
**Source:** `app/admin/templates/actions.ts` lines 56-72 (admin), `app/client/templates/actions.ts` lines 84-101 (customer — IDENTICAL guard per COND-03).
**Apply to:** Any new server action that writes `template_versions` rows. Note: `forkAssignedTemplate` does NOT need this guard because it copies a schema that already passed validation when the master was published — but if the planner later adds a "Customise & immediately edit" path that re-validates client-edited schema, the guard reappears.

### Polymorphic ownership write contract

**Pattern:** Admin-owned templates use `owner_type='admin', owner_id=adminUserId`. Customer-owned use `owner_type='customer', owner_id=clients.id` (the **org**, not the user).
**Source:** AGENTS.md "Form template ownership" + `supabase/migrations/003_form_template_customer_ownership.sql` lines 7-33 + `app/client/templates/actions.ts:47-49`.
**Apply to:** All fork inserts in `forkAssignedTemplate`, all customer-built template inserts (already correct in `createClientTemplate`).

### Migration header style

**Pattern:** Numbered file (`013_*.sql`), header comment with phase + decision number, `IF NOT EXISTS` / `IF EXISTS` for idempotent DDL.
**Source:**
- Simple: `supabase/migrations/002_phase7_draft_report.sql`
- With CHECK + RLS: `supabase/migrations/003_form_template_customer_ownership.sql`
- With seed: `supabase/migrations/012_phase15_conditional_smoke_test.sql` (only relevant if Phase 16 ends up needing a smoke-test assignment — currently NOT in scope).

---

## No Analog Found

None. Every Phase-16 file has a strong analog in the existing codebase. The closest "novel" surface is the RLS Vitest harness, but `tests/security.spec.ts` provides the structural template (Playwright → Vitest port is mechanical: `test.describe` → `describe`, `test.skip` → `describe.skipIf`, `test.beforeAll` → `beforeAll`).

---

## Metadata

**Analog search scope (directories scanned):**
- `app/admin/assignments/` — does not exist (new directory in Phase 16)
- `app/admin/templates/` — exact match for admin actions
- `app/admin/clients/` — exact match for admin RSC + tabs
- `app/admin/proposals/` — exact match for queue page + searchParams
- `app/admin/assessments/` — exact match for two-step fetch + redirect
- `app/client/templates/` — exact match for customer actions + fork prior art
- `components/admin/`, `components/clients/` — modal patterns
- `supabase/migrations/` — DDL + RLS patterns (12 files scanned)
- `tests/security.spec.ts` — RLS harness reference
- `tests/form-builder/save-draft.test.ts`, `version-pin.test.ts` — Vitest mock patterns
- `lib/auth-helpers.ts` — admin/client context helpers
- `vitest.config.ts` — include-pattern extension

**Files read (full or targeted ranges):** 22

**Pattern extraction date:** 2026-05-26
