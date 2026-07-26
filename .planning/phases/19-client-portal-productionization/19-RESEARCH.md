# Phase 19: Client Portal Productionization - Research

**Researched:** 2026-06-07
**Domain:** Next.js App Router server/client split · Supabase RLS queries · InterpreterRenderer read-only mode · proposal status taxonomy
**Confidence:** HIGH — all findings verified by direct codebase inspection

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Convert `app/client/layout.tsx` to a server component shell that calls `getClientContext()` and passes resolved identity as props into a client nav subcomponent for mobile Sheet + usePathname interactivity.
- **D-02:** Extend `getClientContext()` (or sibling helper) to also return org name (`clients.name`) and signed-in person's name + role. Source: org from `clients.name`; role from `client_users.role`; display name from `client_users.name`, falling back to email.
- **D-03:** Footer consultant block ("Your Consultant · Matt Robinson · info@888safetyandtraining.com · 0333 049 8979") stays static — only org name + signed-in person become dynamic.
- **D-04:** Delete `app/client/assessments` (page + route) entirely; remove "Assessments" from NAV_ITEMS; add "Assignments" pointing to `/client/assignments`.
- **D-05:** Completed AI reports live in the real Reports tab (nav 03); Assignments = assigned forms only. No data overlap.
- **D-06:** Re-number / re-order NAV_ITEMS so the sequence stays clean after the swap.
- **D-07:** Build `/client/assignments/[id]/submission` as full read-only InterpreterRenderer against the submission's pinned `version_id`.
- **D-08:** Completed tab in `app/client/assignments/page.tsx` links to the new viewer (replace the TODO(plan-future) fallback at line 95).
- **D-09:** Contracts derived from `proposals` table: status `contract_signed` + non-null `contract_pdf_path`.
- **D-10:** Contract PDFs download via short-lived signed Storage URL (same pattern as documents/reports).
- **D-11 (BLOCKING):** Reconcile proposal status casing before writing the Contracts query — do not assume either casing.

### Claude's Discretion

- Nav `id` numbering after the Assessments→Assignments swap.
- Empty-state copy for Contracts page when no counter-signed contracts exist.
- Exact helper signature/location for the extended identity lookup.
- Read-only affordance details for InterpreterRenderer (disabled inputs vs. value-only display).

### Deferred Ideas (OUT OF SCOPE)

- Billing / PayPal productionization (Phase 8).
- CL-8889-style client reference code in the header.
- Full proposal status-taxonomy cleanup (this phase only needs the Contracts query to use the correct stored values).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| D-01 | Server/client split of `app/client/layout.tsx` | Layout file fully read; split strategy documented below |
| D-02 | Extended identity: org name + person name + role | `client_users` has `name` + `role` columns; `clients.name` exists; exact query documented |
| D-03 | Static footer consultant block | Confirmed: no per-client consultant table; footer hardcode is correct |
| D-04 | Delete assessments route; add Assignments to nav | `app/client/assessments/page.tsx` is 100% mock; deletion is safe |
| D-05 | No data overlap with Reports tab | Confirmed: reports tab queries `form_submissions`; assignments tab queries `form_assignments` |
| D-06 | Re-number NAV_ITEMS | Current sequence documented; swap plan below |
| D-07 | Submission viewer read-only | `InterpreterRenderer` has no `readOnly` prop — minimal new wrapper page needed |
| D-08 | Repoint completed-tab link | Exact line (95-96 of `app/client/assignments/page.tsx`) confirmed |
| D-09 | Contracts from proposals | Status taxonomy resolved: stored values are TITLE-CASE — see critical finding below |
| D-10 | Signed URL for contract PDF | Exact pattern reused from `app/client/proposals/[id]/page.tsx` line 65-68 |
| D-11 | Status casing reconciliation | RESOLVED — see §Critical Finding: Proposal Status Taxonomy |
</phase_requirements>

---

## Summary

Phase 19 is a pure productionization phase: no new tables, no new capabilities, no library
installs. Every surface wires existing real-data patterns into previously-stubbed UI. The
research confirms all four surfaces are unblocked, with one significant finding that resolves
D-11: the proposal `status` column stores title-case values in production ("Sent", "Signed",
"Contract Issued"), not the lowercase values from migration 001's RLS policy. The admin
proposal actions already write and read title-case; the `client/proposals/page.tsx` filter
`.in("status", ["Sent", "Signed", "Contract Issued"])` is therefore correct. The Contracts
query must filter `status = 'Contract Issued'` (not `contract_signed`).

The `InterpreterRenderer` component has no built-in `readOnly` prop. The submission viewer
must wrap it in a client page with a CSS pointer-events overlay or minimal read-only wrapper
that disables the submit handle — the simplest viable approach given the component's coltorapps
internals. A new `/client/assignments/[id]/submission/page.tsx` server component will fetch
the `form_submissions` row (scoped to `client_id` for IDOR prevention), fetch the pinned
`template_versions` schema, and render `InterpreterRenderer` seeded with `initialValues`
and `readOnly` affordance.

For identity, `client_users.name` is the definitive display name (stored at invitation time) —
there is no need to call `auth.getUser()` for display purposes; the name is already in the DB.
`getClientContext()` currently selects only `client_id, role`; extending it with a join to
`clients.name` and including `client_users.name` resolves identity in one query.

**Primary recommendation:** Implement in four sequential tasks: (1) identity helper + layout
split, (2) nav swap + assessments deletion, (3) submission viewer route, (4) contracts surface.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Identity fetch (org name, user name, role) | API / Backend (server component) | — | `getClientContext()` runs server-side; auth and DB lookup happen before HTML is sent |
| Nav interactivity (mobile Sheet, active link) | Browser / Client | — | `usePathname` + `useState` require client context |
| Submission viewer data fetch | API / Backend (server component) | — | IDOR check requires server-side `client_id` scoping |
| Submission viewer render | Browser / Client | — | `InterpreterRenderer` is `"use client"` (coltorapps store) |
| Contracts query | API / Backend (server component) | — | Uses `adminClient` (service-role) to bypass RLS, scoped by `client_id` |
| Signed URL generation | API / Backend (server component) | — | Storage `createSignedUrl` is server-only |
| Nav deletion (assessments) | Frontend (file deletion) | — | Route deletion + NAV_ITEMS edit in layout |

---

## Critical Finding: Proposal Status Taxonomy (D-11 Resolved)

**Evidence chain** (all verified by codebase inspection):

1. **Migration 001 RLS policy** (`supabase/migrations/001_initial_schema.sql` line 368):
   ```sql
   CREATE POLICY "proposals_client_visible" ON proposals
     FOR SELECT USING (
       status IN ('sent', 'signed', 'contract_sent', 'contract_signed')
       AND client_id IN (SELECT client_id FROM client_users WHERE id = auth.uid())
     );
   ```
   This policy uses **lowercase** values. However, the `status` column is `TEXT` with no CHECK constraint — the column type in `database.types.ts` is `status: string`. No DB-level enum or CHECK constraint prevents title-case writes.

2. **Admin proposal actions** (`app/admin/proposals/actions.ts` line 79, 147, 207-208):
   ```typescript
   status: "Draft"          // createProposal
   update.status = "Sent"   // createProposal → Send path
   status: "Draft" | "Sent" | "Signed" | "Contract Issued"  // updateProposalStatus type
   ```
   The admin writes **title-case** values to the DB. This is the only code path that writes proposal status.

3. **Client proposals page** (`app/client/proposals/page.tsx` line 52):
   ```typescript
   .in("status", ["Sent", "Signed", "Contract Issued"])
   ```
   Uses title-case. The proposals page already works in production (Phase 9 delivered), so **title-case is what the DB actually stores**.

4. **Admin dashboard status normalization** (`app/admin/page.tsx` line 356-360):
   ```typescript
   const normalized = p.status.toLowerCase().replace(/ /g, '_');
   if (statusKey === 'contract_sent') {
     return normalized === 'contract_sent' || normalized === 'contract_issued';
   }
   ```
   The admin dashboard normalizes on read because it was built to handle both lowercase (migration spec) and title-case (actual stored values). This confirms the actual stored values are title-case.

5. **Client proposals detail page** (`app/client/proposals/[id]/page.tsx` line 71):
   ```typescript
   const isSigned = proposal.status === "Signed" || proposal.status === "Contract Issued";
   ```
   Directly compares title-case strings.

**Conclusion:** The stored proposal status values in production are title-case: `"Draft"`, `"Sent"`, `"Signed"`, `"Contract Issued"`. The migration 001 RLS policy lowercase values are a documentation/spec artifact that was superseded by the actual implementation. There is no status value `"contract_signed"` in the DB.

**For the Contracts query (D-09):**
```typescript
await adminClient
  .from("proposals")
  .select("id, contract_pdf_path, services_json, total_price, created_at, sent_at")
  .eq("client_id", ctx.client_id)
  .eq("status", "Contract Issued")
  .not("contract_pdf_path", "is", null)
  .order("created_at", { ascending: false })
```
[VERIFIED: codebase inspection of proposals/actions.ts, proposals/page.tsx, proposals/[id]/page.tsx, admin/page.tsx, migrations/001]

**RLS note:** `adminClient` bypasses RLS (as used in all other proposal client pages). The `.eq("client_id", ctx.client_id)` is the defense-in-depth ownership check (same pattern as `app/client/proposals/[id]/page.tsx` line 37-38).

---

## Standard Stack

No new packages needed. Phase 19 reuses the existing stack entirely.

| Already Available | Version (in use) | Purpose in Phase 19 |
|-------------------|-----------------|---------------------|
| `@supabase/supabase-js` | in use | `createClient()` for RLS queries; `adminClient` for contract/proposals bypass |
| `@coltorapps/builder-react` | in use | `InterpreterRenderer` for submission viewer |
| `next/navigation` (`usePathname`) | in use | Active-link state in client nav subcomponent |
| `@base-ui/react/dialog` (Sheet) | in use | Mobile nav Sheet in client nav subcomponent |

[VERIFIED: package.json + codebase imports]

---

## Architecture Patterns

### Established Real-Data Pattern (copy exactly)

```
export const dynamic = "force-dynamic"          // prevent static generation

export default async function Page() {
  const ctx = await getClientContext()           // resolves client_id + role
  if (!ctx) return <EmptyState />               // always handle null

  const supabase = await createClient()          // RLS-scoped client
  // OR: adminClient for proposals (bypasses RLS, requires .eq("client_id", ctx.client_id))

  const { data } = await supabase
    .from("table")
    .select("columns")
    .eq("client_id", ctx.client_id)             // defense-in-depth; RLS is primary
    .is("deleted_at", null)
    .order("...")

  return <UI data={data ?? []} />
}
```

[VERIFIED: app/client/compliance/page.tsx, app/client/assignments/page.tsx, app/client/proposals/page.tsx]

### System Architecture Diagram

```
Browser request → /client/...
        |
        ▼
[Server Component — layout.tsx shell]
  getClientContextWithIdentity()
  ↓ returns { client_id, role, orgName, userName }
        |
        ├── Props down → [ClientNav ("use client")]
        │     usePathname() — active link state
        │     useState(mobileOpen) — Sheet open/close
        │     NAV_ITEMS iteration
        |
        └── children (page server components)
              getClientContext() — if they need identity
              createClient() / adminClient — scoped queries
              ↓ data
              ← JSX with real data or empty-state card
```

### Pattern 1: Server Shell + Client Nav

**What:** Outer layout is a server component (async) that fetches identity, renders a thin wrapper that passes identity as props to a `"use client"` child for the interactive nav bits.

**Why needed:** `usePathname` and `useState` are browser APIs; they cannot run in a server component. But identity data must not be hardcoded.

**Key constraint:** The interactive bits (Sheet + usePathname) MUST remain in the client nav component. Do not attempt to move `Sheet` or `usePathname` to the server shell.

**Split strategy for `app/client/layout.tsx`:**

Current state: entire file is `"use client"` — 198 lines, `NAV_ITEMS` constant, `isActive()` helper, one default export.

After split:
- `app/client/layout.tsx` → async server component (remove `"use client"`), calls `getClientContextWithIdentity()`, renders `<ClientPortalNav orgName={...} userName={...} userRole={...}>` + `<main>` + static footer.
- `app/client/_components/client-portal-nav.tsx` → `"use client"`, receives `orgName`, `userName`, `userRole` as string props, owns `NAV_ITEMS`, `isActive()`, `usePathname`, `useState(mobileOpen)`, `Sheet`, desktop nav, sign-out form, mobile hamburger.

**Hardcoded strings to replace:**
- Header + mobile sheet: `"Hallam House Care Home"` → `orgName` prop
- Header + mobile sheet: `"CL-8889"` → remove or omit (deferred per CONTEXT.md)
- Right side + mobile sheet: `"Sarah Whitfield"` → `userName` prop
- Right side + mobile sheet: `"Facilities Manager"` → `userRole` prop

[VERIFIED: app/client/layout.tsx full read]

### Pattern 2: Extended Identity Helper

Current `getClientContext()` signature (lib/auth-helpers.ts line 65-94):
```typescript
// Returns: { client_id: string, role: string } | null
export async function getClientContext()
```

In demo mode, it does a `client_users.select("client_id, role").limit(1).single()` — picks the first row.
In prod mode, it does `client_users.select("client_id, role").eq("id", user.id).single()`.

**Extension approach (Claude's discretion — recommend new sibling):**

Add `getClientContextWithIdentity()` to `lib/auth-helpers.ts`:

```typescript
export interface ClientIdentity {
  client_id: string
  role: string
  orgName: string     // from clients.name
  userName: string    // from client_users.name, fallback to client_users.email
}

export async function getClientContextWithIdentity(): Promise<ClientIdentity | null> {
  const supabase = await createClient()

  if (await isDemoMode()) {
    const { data } = await supabase
      .from("client_users")
      .select("client_id, role, name, email, client:clients(name)")
      .limit(1)
      .single()
    if (!data) return null
    const clientRow = Array.isArray(data.client) ? data.client[0] : data.client
    return {
      client_id: data.client_id,
      role: data.role,
      orgName: clientRow?.name ?? "—",
      userName: data.name || data.email || "—",
    }
  }

  const user = await getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from("client_users")
    .select("client_id, role, name, email, client:clients(name)")
    .eq("id", user.id)
    .single()

  if (error || !data) return null
  const clientRow = Array.isArray(data.client) ? data.client[0] : data.client
  return {
    client_id: data.client_id,
    role: data.role,
    orgName: clientRow?.name ?? "—",
    userName: data.name || data.email || "—",
  }
}
```

**Why `client_users.name` is sufficient (no auth.getUser() needed for display):**
`client_users.name` (TEXT NOT NULL) is populated at invitation time by admin. It is the canonical display name. `auth.getUser()` would return `user.user_metadata.full_name` (Supabase auth metadata) which may be empty for magic-link-only users. Using `client_users.name` is both simpler and more reliable.
[VERIFIED: database.types.ts — `client_users.Row.name: string` (non-nullable), migration 001 line 35: `name TEXT NOT NULL`]

**Why join to `clients` works:** RLS policy `"clients_own_select"` allows `SELECT WHERE id IN (SELECT client_id FROM client_users WHERE id = auth.uid())`. The join `.select("..., client:clients(name)")` is equivalent to that RLS-allowed read.
[VERIFIED: supabase/migrations/001_initial_schema.sql line 248-251]

### Pattern 3: Submission Viewer

**Route:** `app/client/assignments/[id]/submission/page.tsx` (new file)

**Data shape:** `form_submissions` row contains:
- `answers_json: JSONB` — field values keyed by entity ID (same shape as `InterpreterRenderer`'s `initialValues` prop)
- `template_version_id: UUID` — the pinned version to fetch the schema from
- `client_id: UUID` — used for IDOR scoping

**Fetch pattern (two-step, matching fill/page.tsx lines 23-58):**
1. Fetch `form_submissions` row by assignment_id + verify `client_id` matches ctx (IDOR prevention)
2. Fetch `template_versions.schema_json` by the submission's `template_version_id`

**Read-only mode for InterpreterRenderer:**

`InterpreterRenderer` has no `readOnly` prop. [VERIFIED: components/form-interpreter/interpreter-renderer.tsx — full prop list checked, no readOnly/disabled param exists]

Options for read-only affordance (Claude's discretion per CONTEXT.md):

**Option A (CSS overlay — recommended):** Wrap `<InterpreterRenderer ...>` in a `<div className="pointer-events-none select-none opacity-80">`. This prevents any user interaction. No component changes required. The `submit` ref handle is simply not called (no submit button rendered).

**Option B (omit submit + ref):** Don't render any submit button and don't pass a ref. Since `InterpreterRenderer` only validates/submits when `ref.submit()` is explicitly called, no submission can occur. Field inputs remain enabled visually but nothing can be submitted.

Recommendation: **Option A** (CSS overlay) because it also prevents accidental typing into text fields and makes the read-only nature visually clear. If styling is unsatisfactory, a thin `ReadOnlyFormShell` wrapper component can be added without touching `InterpreterRenderer` itself.

**IDOR scoping (matching `app/client/assignments/[id]/page.tsx` lines 52-59):**
```typescript
// Fetch submission for this assignment, scoped to client
const { data: submission } = await supabase
  .from("form_submissions")
  .select("id, answers_json, template_version_id, client_id, submitted_at")
  .eq("assignment_id", assignmentId)         // assignment-scoped
  .eq("client_id", ctx.client_id)            // IDOR defense-in-depth (RLS is primary)
  .eq("status", "submitted")                  // only completed submissions
  .maybeSingle()

if (!submission) notFound()
```
[VERIFIED: form_submissions schema (migration 001 lines 84-98), fill/page.tsx pattern]

### Pattern 4: Contract PDF Signed URL

Exact reuse of `app/client/proposals/[id]/page.tsx` lines 63-68:
```typescript
let signedContractUrl: string | null = null
if (contract.contract_pdf_path) {
  const { data: signed } = await adminClient.storage
    .from("proposals")                        // contracts stored in same bucket
    .createSignedUrl(contract.contract_pdf_path, 60 * 60)  // 1-hour TTL
  signedContractUrl = signed?.signedUrl ?? null
}
```
[VERIFIED: app/client/proposals/[id]/page.tsx lines 63-68; supabase/migrations/001_initial_schema.sql — `proposals` bucket; `contract_pdf_path TEXT` column on `proposals` table]

### NAV_ITEMS Swap (D-04/D-06)

**Current NAV_ITEMS (app/client/layout.tsx lines 16-24):**
```typescript
const NAV_ITEMS = [
  { id: "01", label: "Dashboard",   href: "/client" },
  { id: "02", label: "Compliance",  href: "/client/compliance" },
  { id: "03", label: "Reports",     href: "/client/reports" },
  { id: "04", label: "Billing",     href: "/client/billing" },
  { id: "05", label: "Assessments", href: "/client/assessments" },  // DELETE
  { id: "06", label: "Templates",   href: "/client/templates" },
  { id: "07", label: "Proposals",   href: "/client/proposals" },
  { id: "08", label: "Contracts",   href: "/client/contracts" },
]
```

**After swap (Claude's discretion — keep Billing at 04, insert Assignments at 05):**
```typescript
const NAV_ITEMS = [
  { id: "01", label: "Dashboard",   href: "/client" },
  { id: "02", label: "Compliance",  href: "/client/compliance" },
  { id: "03", label: "Reports",     href: "/client/reports" },
  { id: "04", label: "Billing",     href: "/client/billing" },
  { id: "05", label: "Assignments", href: "/client/assignments" },  // REPLACED
  { id: "06", label: "Templates",   href: "/client/templates" },
  { id: "07", label: "Proposals",   href: "/client/proposals" },
  { id: "08", label: "Contracts",   href: "/client/contracts" },
]
```

The `id` numeric label in the header (`"05 · Assigned Forms"` in assignments/page.tsx line 35) also needs to match; currently it says `"05"` — stays correct.
[VERIFIED: app/client/assignments/page.tsx line 35]

### Anti-Patterns to Avoid

- **Calling `getUser()` in the layout server component:** Calling `auth.getUser()` in the layout would add latency AND risks poisoning the Supabase-js client with stale auth header in demo mode (documented in `lib/auth-helpers.ts` lines 43-55). Use `getClientContextWithIdentity()` which handles demo-mode correctly and skips `getUser()` in that path.
- **Passing the entire `ClientIdentity` object as a prop to `ClientPortalNav`:** Pass only primitive strings (`orgName`, `userName`, `userRole`) — RSC→client boundary serialization requires serializable props.
- **Using `createClient()` (RLS-scoped) for the Contracts query:** Contracts must be fetched with `adminClient` (same as all other proposal queries in the client portal) because the RLS `proposals_client_visible` policy uses lowercase status values but the stored values are title-case — the policy would filter out all rows. Use `adminClient` + explicit `.eq("client_id", ctx.client_id)` instead.
- **Filtering contracts with `.eq("status", "contract_signed")`:** The stored value is `"Contract Issued"`, not `"contract_signed"`. Use `.eq("status", "Contract Issued")`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Signed storage URL | Custom URL generator | `adminClient.storage.from("proposals").createSignedUrl(path, ttl)` | Already implemented and tested in proposals/[id]/page.tsx |
| Read-only form render | Custom field-by-field label/value renderer | `InterpreterRenderer` with CSS `pointer-events-none` wrapper | Renderer already handles schema, conditional logic, and all field types |
| Identity resolution | Custom auth hook or provider | `getClientContextWithIdentity()` sibling to `getClientContext()` | Follows established pattern; demo-mode safe |
| IDOR protection | Application-level UUID check only | RLS (primary) + `.eq("client_id", ctx.client_id)` (defense-in-depth) | Matches the existing assignment route pattern |

---

## Common Pitfalls

### Pitfall 1: RSC → Client Boundary with Non-Serializable Props
**What goes wrong:** Passing an object (`ClientIdentity`) directly from server layout to client nav component fails at runtime if it contains non-serializable values.
**Why it happens:** Next.js App Router enforces serialization at RSC→Client boundaries.
**How to avoid:** Pass only primitive strings as props to `ClientPortalNav`. Extract `orgName: string`, `userName: string`, `userRole: string` individually.
**Warning signs:** `Error: Only plain objects, and a few built-ins, can be passed to Client Components`

### Pitfall 2: Demo Mode Auth Header Poisoning
**What goes wrong:** Calling `getUser()` in the layout server component breaks demo mode by setting a stale Authorization header on the Supabase client, which then overrides the service-role API key on subsequent writes.
**Why it happens:** `lib/auth-helpers.ts` lines 43-55 document this exact bug. The demo cookie has an expired token; calling `getUser()` with it corrupts the client.
**How to avoid:** `getClientContextWithIdentity()` must guard with `if (await isDemoMode())` and skip `getUser()` in that path, picking the first `client_users` row instead.
**Warning signs:** "Invalid API key" errors in demo mode after the layout refactor.

### Pitfall 3: Contracts Query Using Wrong Status or Wrong Client
**What goes wrong:** Querying `status = 'contract_signed'` (lowercase) returns zero rows because the stored value is `"Contract Issued"` (title-case). Using `createClient()` instead of `adminClient` also returns zero rows because the RLS policy uses lowercase values that don't match stored values.
**Why it happens:** The migration 001 RLS policy specifies lowercase statuses, but the admin code path writes title-case. The RLS policy is effectively unreachable for these status values.
**How to avoid:** Use `adminClient.from("proposals").eq("status", "Contract Issued").not("contract_pdf_path", "is", null).eq("client_id", ctx.client_id)`.
**Warning signs:** Empty contracts page when proposals exist in the "Contract Issued" status.

### Pitfall 4: InterpreterRenderer Submission on the Viewer Page
**What goes wrong:** If the viewer page renders `InterpreterRenderer` without the CSS pointer-events wrapper, users can type into fields. If a `ref` is passed and `ref.submit()` is called somehow, it would call `submitAssessmentAction` with the submission ID.
**Why it happens:** `InterpreterRenderer` is a general-purpose fill component with no read-only mode.
**How to avoid:** (a) Wrap in `pointer-events-none select-none` div; (b) do not render a submit button; (c) do not pass a ref. Belt-and-suspenders: all three.
**Warning signs:** Users can type into fields on the submission viewer page.

### Pitfall 5: Coltorapps Join Shape Ambiguity
**What goes wrong:** Supabase returns joined `client:clients(name)` as either an object or an array depending on relationship cardinality inference. Treating it as always-object causes a runtime crash.
**Why it happens:** Supabase-js join cardinality is inferred from the FK relationship, but the type system often yields `{name: string} | {name: string}[] | null`.
**How to avoid:** Always normalize: `const clientRow = Array.isArray(data.client) ? data.client[0] : data.client`. This pattern appears in `app/client/assignments/[id]/page.tsx` lines 73-75 for the template join.
**Warning signs:** `TypeError: Cannot read property 'name' of undefined` in the identity helper.

### Pitfall 6: `usePathname` in Server Component After Split
**What goes wrong:** If the layout split accidentally moves `usePathname` or `useState` into the server shell, Next.js throws a build error.
**Why it happens:** `usePathname` is a client hook; it cannot be called in an async server component.
**How to avoid:** All hooks must stay in `ClientPortalNav` (the `"use client"` component). The server shell only calls `getClientContextWithIdentity()` and renders the outer `div` + `<ClientPortalNav>` + `<main>` + footer.
**Warning signs:** `Error: "usePathname" is not available in Server Components`

---

## Code Examples

### Identity: Extended Context Fetch
```typescript
// lib/auth-helpers.ts — new export below existing getClientContext()
// Source: verified against existing getClientContext() pattern (lines 65-94)

export interface ClientIdentity {
  client_id: string
  role: string
  orgName: string
  userName: string
}

export async function getClientContextWithIdentity(): Promise<ClientIdentity | null> {
  const supabase = await createClient()

  if (await isDemoMode()) {
    const { data } = await supabase
      .from("client_users")
      .select("client_id, role, name, email, client:clients(name)")
      .limit(1)
      .single()
    if (!data) return null
    const clientRow = Array.isArray(data.client) ? data.client[0] : data.client
    return {
      client_id: data.client_id,
      role: data.role,
      orgName: (clientRow as { name?: string } | null)?.name ?? "—",
      userName: data.name || data.email || "—",
    }
  }

  const user = await getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from("client_users")
    .select("client_id, role, name, email, client:clients(name)")
    .eq("id", user.id)
    .single()

  if (error || !data) return null
  const clientRow = Array.isArray(data.client) ? data.client[0] : data.client
  return {
    client_id: data.client_id,
    role: data.role,
    orgName: (clientRow as { name?: string } | null)?.name ?? "—",
    userName: data.name || data.email || "—",
  }
}
```

### Contracts Query
```typescript
// app/client/contracts/page.tsx
// Source: verified against app/client/proposals/page.tsx + status taxonomy analysis

export const dynamic = "force-dynamic"

export default async function ClientContractsPage() {
  const ctx = await getClientContext()
  if (!ctx?.client_id) return <NoContextState />

  const { data: rows } = await adminClient
    .from("proposals")
    .select("id, contract_pdf_path, services_json, total_price, created_at, sent_at")
    .eq("client_id", ctx.client_id)
    .eq("status", "Contract Issued")          // title-case — see D-11 analysis
    .not("contract_pdf_path", "is", null)     // only fully-executed contracts
    .order("created_at", { ascending: false })

  const contracts = rows ?? []

  // Generate signed URLs for each contract PDF
  const signedUrls = new Map<string, string>()
  const paths = contracts.map(c => c.contract_pdf_path).filter(Boolean) as string[]
  if (paths.length > 0) {
    const { data: signed } = await adminClient.storage
      .from("proposals")
      .createSignedUrls(paths, 60 * 60)      // 1-hour TTL; batch for efficiency
    signed?.forEach(s => { if (s.path && s.signedUrl) signedUrls.set(s.path, s.signedUrl) })
  }

  return contracts.length === 0
    ? <ContractsEmpty />
    : <ContractsList contracts={contracts} signedUrls={signedUrls} />
}
```

### Submission Viewer Route
```typescript
// app/client/assignments/[id]/submission/page.tsx (new file)
// Source: pattern from app/client/assignments/[id]/fill/page.tsx

export const dynamic = "force-dynamic"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function AssignmentSubmissionPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  if (!UUID_RE.test(id)) notFound()

  const supabase = await createClient()
  const ctx = await getClientContext()

  // Step 1: Fetch the completed submission, scoped to client (IDOR prevention)
  const { data: submission } = await supabase
    .from("form_submissions")
    .select("id, answers_json, template_version_id, client_id, submitted_at")
    .eq("assignment_id", id)
    .eq("status", "submitted")
    .maybeSingle()

  if (!submission) notFound()

  // Defense-in-depth: verify org ownership even with RLS active
  if (ctx && submission.client_id !== ctx.client_id) notFound()

  // Step 2: Fetch pinned schema (two-step, per fill/page.tsx pattern)
  const { data: version } = await supabase
    .from("template_versions")
    .select("schema_json")
    .eq("id", submission.template_version_id)
    .single()

  if (!version) notFound()

  return (
    <SubmissionViewerClient
      schemaJson={version.schema_json}
      answersJson={submission.answers_json}
      submittedAt={submission.submitted_at}
      clientId={submission.client_id}
      submissionId={submission.id}
    />
  )
}
```

### Submission Viewer Client (Read-Only Wrapper)
```typescript
// app/client/assignments/[id]/submission/submission-viewer-client.tsx
"use client"
// Wrap InterpreterRenderer in pointer-events-none so no input is editable.
// No submit button, no ref — purely for reading.

export function SubmissionViewerClient({ schemaJson, answersJson, submittedAt, clientId, submissionId }) {
  return (
    <div className="space-y-6">
      {/* Back link, page header, submitted-at timestamp */}
      <div className="pointer-events-none select-none opacity-90">
        <InterpreterRenderer
          schema={schemaJson}
          submissionId={submissionId}
          clientId={clientId}
          initialValues={answersJson}
          surface="cream"
          // No onSubmit, no onProgressChange, no ref — read-only
        />
      </div>
    </div>
  )
}
```

---

## Runtime State Inventory

This is not a rename/refactor/migration phase. No runtime state inventory is required. The phase edits code files and adds one new route — no DB migrations, no renamed keys, no stored strings change.

---

## Environment Availability

Step 2.6 SKIPPED — no external dependencies beyond the existing project stack. All required packages and services (Supabase, Next.js, coltorapps builder-react) are already installed and in use.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest |
| Config file | `vitest.config.ts` |
| Quick run command | `npm test` |
| Full suite command | `npm test -- --reporter=verbose` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| D-01/D-02 | Identity helper returns org name + user name + role; demo path still works | Unit | `npm test -- lib/auth-helpers` | ❌ Wave 0 |
| D-02 | Join fallback: `name \|\| email` when name is empty string | Unit | `npm test -- lib/auth-helpers` | ❌ Wave 0 |
| D-09/D-11 | Contracts query uses `status="Contract Issued"` and non-null `contract_pdf_path` | Integration/smoke | Manual (no proposals in test DB) | Manual |
| D-07 | Submission viewer renders InterpreterRenderer with initialValues | E2E/smoke | `npm run dev` → navigate to completed assignment → /submission | Manual |
| D-07 | Pointer-events-none wrapper prevents form input | Visual | Manual check: try clicking a field on viewer | Manual |
| D-04 | `/client/assessments` route returns 404 after deletion | Build | `npm run build` (broken import would fail) | Automated |
| D-08 | Completed tab links to `/client/assignments/${id}/submission` not `/client/assignments/${id}` | Code review | `grep "TODO(plan-future)" app/client/assignments/page.tsx` → should return nothing | Automated |

### Sampling Rate
- **Per task commit:** `npm run build` — catches broken imports (critical: executor agents hallucinate imports)
- **Per wave merge:** `npm test` — full suite
- **Phase gate:** `npm run build && npm test` green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/auth-helpers/client-context-with-identity.test.ts` — unit tests for `getClientContextWithIdentity()` covering: real user path, demo path (picks first row), name fallback to email, org name from join, null return on missing session.

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Layout reads authenticated session; no new auth code |
| V3 Session Management | No | `getClientContext()` / `getClientContextWithIdentity()` reuses existing session pattern |
| V4 Access Control | Yes | IDOR prevention: `.eq("client_id", ctx.client_id)` on submissions + contracts queries |
| V5 Input Validation | No | No new user input surfaces |
| V6 Cryptography | No | Storage signed URLs generated by Supabase SDK, not hand-rolled |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| IDOR on `/client/assignments/[id]/submission` | Elevation of Privilege | `.eq("client_id", ctx.client_id)` defense-in-depth + RLS (primary) |
| IDOR on contracts (org A views org B's contract PDF) | Elevation of Privilege | `adminClient` query MUST include `.eq("client_id", ctx.client_id)`; no service-role bypass without scoping |
| Identity spoofing in layout (client reads another org's name) | Spoofing | `getClientContextWithIdentity()` scopes the client join by `client_users.id = auth.uid()` via RLS; no user-supplied `client_id` |

**Critical security invariant:** The `adminClient` (service-role key) bypasses RLS. Every `adminClient.from("proposals")` call in the client portal MUST include `.eq("client_id", ctx.client_id)` where `ctx` is from server-side `getClientContext()`. This is the only access control boundary when RLS is bypassed. [VERIFIED: existing pattern in app/client/proposals/[id]/page.tsx lines 36-38]

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `contract_pdf_path` stores the raw Storage path (not a full URL or signed URL) — consistent with `proposal_pdf_path` which is passed directly to `createSignedUrl` | Contract PDF pattern | If it stores a full URL, the `createSignedUrl` call would fail; verify by checking an actual DB row before implementation |
| A2 | The `proposals` Storage bucket is the correct bucket for contract PDFs (same as proposal PDFs) | Contract PDF pattern | If contract PDFs go to a different bucket, the signed URL would return 404 |
| A3 | `form_submissions.assignment_id` is non-null for assignment-fill submissions (as opposed to admin-initiated assessments which go through `submitAssessmentAction` directly) | Submission viewer query | If some submissions have null `assignment_id`, the viewer query `eq("assignment_id", id)` would find nothing |

All other claims in this research were verified by direct codebase inspection.

---

## Open Questions

1. **`contract_pdf_path` column population**
   - What we know: The column exists (`TEXT` in proposals table, seen in `database.types.ts`). The contracts pipeline (Phase 9 / n8n workflow #4) was planned but not fully verified as executed in production.
   - What's unclear: Whether any live proposal rows have `contract_pdf_path` populated (the contracts feature exists in schema and code, but may not have been exercised in prod yet).
   - Recommendation: Query the live DB before implementation: `SELECT id, status, contract_pdf_path FROM proposals WHERE status = 'Contract Issued' LIMIT 5`. If no rows exist, the contracts page will correctly show the empty state — which is the correct behavior per D-09.

2. **Assignment → submission mapping when multiple fills exist**
   - What we know: A completed assignment has exactly one submission with `status = 'submitted'` in the happy path. The `form_submissions` table has `assignment_id` FK.
   - What's unclear: Whether re-fills (after a fork customization) would leave multiple `form_submissions` rows for the same `assignment_id`, and which one to show.
   - Recommendation: Add `.order("submitted_at", { ascending: false }).limit(1)` to the query to always show the most recent submitted submission. This is defensive and has no downside in the single-submission case.

---

## Sources

### Primary (HIGH confidence — verified by direct file read)
- `lib/auth-helpers.ts` — full source of `getClientContext()`, `getUser()`, `isDemoMode()`
- `app/client/layout.tsx` — full source; all hardcoded strings identified
- `app/client/assignments/page.tsx` — confirmed TODO(plan-future) at line 95-96
- `app/client/assignments/[id]/page.tsx` — IDOR scoping pattern; auth pattern
- `app/client/assignments/[id]/fill/page.tsx` — two-step fetch pattern; schema fetch
- `app/client/assignments/actions.ts` — `requireOwnedAssignment` IDOR pattern
- `app/client/proposals/page.tsx` — status filter `.in("status", ["Sent", "Signed", "Contract Issued"])`
- `app/client/proposals/[id]/page.tsx` — `createSignedUrl` pattern; IDOR `.eq("client_id")`; `isSigned` title-case comparison
- `app/client/contracts/page.tsx` — current static stub
- `app/client/compliance/page.tsx` — canonical real-data pattern exemplar
- `app/admin/proposals/actions.ts` — status values written to DB: "Draft", "Sent", "Signed", "Contract Issued"
- `app/admin/page.tsx` — status normalization confirms stored values are title-case
- `supabase/migrations/001_initial_schema.sql` — schema: proposals columns; RLS policy lowercase status values
- `lib/supabase/database.types.ts` — `client_users.Row.name: string` (non-nullable); `proposals.status: string` (unconstrained TEXT)
- `components/form-interpreter/interpreter-renderer.tsx` — full prop interface; confirmed no `readOnly` prop

### Secondary (MEDIUM confidence — verified by grep/glob)
- `app/client/assessments/page.tsx` — confirmed 100% mock (`ASSESSMENTS` hardcoded array)
- `supabase/migrations/009_clients_contact_columns.sql` — confirmed `clients.name` is original column from 001 (not added in 009)

---

## Metadata

**Confidence breakdown:**
- Proposal status taxonomy (D-11): HIGH — four separate code paths corroborate title-case stored values
- Identity extension (D-01/D-02): HIGH — `client_users.name` column verified in schema and database.types.ts
- InterpreterRenderer read-only: HIGH — full source read confirms no readOnly prop; CSS overlay approach is verified viable
- Contracts signed URL: HIGH — exact pattern verified from proposals/[id]/page.tsx
- IDOR scoping for submission viewer: HIGH — pattern verified from assignments/[id]/page.tsx and fill/page.tsx

**Research date:** 2026-06-07
**Valid until:** 2026-07-07 (stable codebase — no fast-moving dependencies)
