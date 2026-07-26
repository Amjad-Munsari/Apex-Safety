# Phase 19: Client Portal Productionization - Context

**Gathered:** 2026-06-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace hardcoded / mock client-portal surfaces with real DB-backed data, using the
portal's established real-data pattern (`force-dynamic` server component →
`getClientContext()` → `adminClient`/`supabase` queries). Four surfaces are in scope:

1. **Header/footer identity** — org name + signed-in user (currently hardcoded
   "Hallam House Care Home" / "Sarah Whitfield / Facilities Manager").
2. **Assessments → Assignments nav consolidation** — drop the fully-mock
   `/client/assessments` page and surface the real `/client/assignments` (Phase 16) in nav.
3. **Completed-submission viewer** — a read-only view of a client's submitted assignment
   (`/client/assignments/[id]/submission`, already stubbed with a TODO).
4. **Contracts surface** — replace the static "No contracts yet" page with real
   counter-signed contracts derived from the `proposals` pipeline (Phase 9).

**Out of scope (explicit):** Billing / PayPal (Phase 8 — deferred). The Billing nav item
and page are left untouched.

This phase clarifies HOW to productionize what's listed above. It does not add new
client-portal capabilities.
</domain>

<decisions>
## Implementation Decisions

### Identity rendering
- **D-01:** Convert `app/client/layout.tsx` to a **server component** that calls
  `getClientContext()` and passes resolved identity as **props** into a small client
  nav subcomponent for the interactive bits (mobile sheet, active-link state). Matches
  the existing `force-dynamic` server-component pattern used by compliance/assignments/proposals.
  (Rejected: client-side provider + API/server-action fetch — more moving parts.)
- **D-02:** Extend `getClientContext()` (or add a sibling helper) to additionally return
  the **org name** (`clients.name`) and the **signed-in person's name + role**. Source of
  truth: org from `clients.name`; role from `client_users.role`; display name from the
  authenticated auth user, **falling back to email** if no display name is stored. Exact
  columns/joins are a research/planning detail.
- **D-03:** The **footer consultant block is static** ("Your Consultant · Matt Robinson ·
  info@888safetyandtraining.com · 0333 049 8979"). Matt is the sole consultant; no per-client consultant
  assignment exists. Only org name + signed-in person become dynamic.

### Assessments → Assignments consolidation
- **D-04:** **Delete** `app/client/assessments` (page + route) entirely — it is 100% mock
  (hardcoded `ASSESSMENTS` array, including fake "completed reports"). Remove the
  "Assessments" item from `NAV_ITEMS` and add **"Assignments"** (→ `/client/assignments`).
  (Rejected: keep route as a redirect — no real bookmarks to preserve; clean removal preferred.)
- **D-05:** Completed AI reports already live in the real **Reports** tab (nav item 03), so
  there is no data overlap. Assignments = assigned forms only (Active / Completed tabs).
- **D-06:** Re-number / re-order `NAV_ITEMS` so the sequence stays clean after the swap
  (implementation detail — keep the existing two-digit `id` convention).

### Completed-submission viewer
- **D-07:** Build `/client/assignments/[id]/submission` as a **full read-only render** using
  the existing **`InterpreterRenderer`** in a read-only/disabled mode, rendering the submission
  against its **pinned `version_id`** (every field, photo, signature exactly as filled).
  (Rejected: lightweight label→value summary — lower fidelity.)
- **D-08:** The Completed tab in `app/client/assignments/page.tsx` links here (replacing the
  current `TODO(plan-future)` fallback to the assignment landing page at line ~95).

### Contracts surface
- **D-09:** Contracts are **derived from the `proposals` table** — there is no separate
  `contracts` table. A client "contract" = a proposal row at the counter-signed stage:
  **status `contract_signed`** with a non-null **`contract_pdf_path`**.
  (Rejected: also surfacing `contract_sent` / awaiting-signature — kept on the Proposals page.)
- **D-10:** Contract PDFs download via a **short-lived signed Storage URL**, consistent with
  how documents/reports download elsewhere in the portal.
- **D-11:** ⚠ **Status-taxonomy note for research/planning:** migration 001 defines proposal
  statuses as lowercase `'sent','signed','contract_sent','contract_signed'`, but
  `app/client/proposals/page.tsx` filters on title-case `["Sent","Signed","Contract Issued"]`.
  Reconcile the actual stored values before writing the Contracts query — do not assume either casing.

### Claude's Discretion
- Nav `id` numbering scheme after the Assessments→Assignments swap.
- Empty-state copy for the Contracts page when no counter-signed contracts exist (reuse the
  existing editorial empty-state card style already on the page).
- Exact helper signature/location for the extended identity lookup (new helper vs. extend
  `getClientContext`).
- Read-only affordance details for `InterpreterRenderer` (disabled inputs vs. value-only display).

### No-mock policy
- Every productionized surface uses **real queries with honest empty states** ("—" or the
  existing empty-state cards) — no fixtures, no `mockXxxFor()` generators. (Project rule.)
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope
- `.planning/ROADMAP.md` §"Milestone 2 — Productionization" / Phase 19 line — one-line scope of record.

### Auth / identity
- `lib/auth-helpers.ts` — `getClientContext()` (returns `{client_id, role}` today), `getUser()`,
  `isDemoMode()`, demo-mode synthesis path. The identity extension lands here or adjacent.

### Real-data pattern exemplars (copy this shape)
- `app/client/compliance/page.tsx` — `force-dynamic` server page → `getClientContext()` →
  `supabase.from("documents").eq("client_id", ctx.client_id)` → empty-state fallback.
- `app/client/assignments/page.tsx` — real `form_assignments` query, Active/Completed tabs,
  the `TODO(plan-future)` submission-viewer link to replace.
- `app/client/proposals/page.tsx` — `adminClient.from("proposals")` query + status mapping
  (note the casing mismatch in D-11).

### Submission viewer
- `components/form-interpreter/` (InterpreterRenderer + field renderers) — the renderer to
  reuse in read-only mode; submissions are pinned to `version_id`.

### Schema
- `supabase/migrations/001_initial_schema.sql` §"PROPOSALS & CONTRACTS" (~line 145) —
  `proposals` columns: `contract_pdf_path`, `signwell_contract_doc_id`, status CHECK.
- `supabase/migrations/009_clients_contact_columns.sql` — `clients` contact columns (org name source).

### Project rules
- `AGENTS.md` — form-template ownership ADR (multi-tenant context); "This is NOT the Next.js
  you know" (read `node_modules/next/dist/docs/` before App Router changes).
- `.planning/codebase/CONVENTIONS.md`, `ARCHITECTURE.md` — portal conventions.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `getClientContext()` (`lib/auth-helpers.ts`) — the org/user resolver to extend for identity.
- `InterpreterRenderer` (`components/form-interpreter/`) — reuse read-only for the submission viewer.
- Signed-URL download flow already used by compliance documents / reports — reuse for contract PDFs.
- Existing editorial empty-state card markup (contracts/compliance/proposals pages) — reuse for empty states.

### Established Patterns
- Portal data pages are `export const dynamic = "force-dynamic"` **server components** that
  resolve `getClientContext()` then query scoped by `client_id`. New work follows this exactly.
- `app/client/layout.tsx` is currently `"use client"` for nav interactivity — D-01 splits it
  into a server shell (identity fetch) + client nav child.

### Integration Points
- `NAV_ITEMS` in `app/client/layout.tsx` — edit for the Assessments→Assignments swap.
- Completed-tab `<Link>` in `app/client/assignments/page.tsx` (~line 96) — repoint to the new viewer.
- `proposals` table — the Contracts query's only data source.

### Landmines
- `layout.tsx` interactivity (mobile `Sheet`, `usePathname` active state) must stay client-side
  after the server/client split — don't regress the nav.
- Demo-mode path in `getClientContext()` synthesizes a client by picking the first row; the
  identity extension must not break that flow.
- Proposal status casing mismatch (D-11) — verify before querying.
</code_context>

<specifics>
## Specific Ideas

- Current hardcoded identity to replace lives in `app/client/layout.tsx`: org "Hallam House
  Care Home" / ref "CL-8889" (header + mobile sheet), person "Sarah Whitfield / Facilities
  Manager" (right side + mobile sheet). All three become dynamic; the footer consultant does not.
- Mock to delete: the `ASSESSMENTS` array in `app/client/assessments/page.tsx`.
</specifics>

<deferred>
## Deferred Ideas

- **Billing / PayPal productionization** — Phase 8 work, explicitly excluded. Billing nav item
  + page left untouched this phase.
- **CL-8889-style client reference code** — if a real per-client reference is wanted in the
  header, that's a small follow-up; for now derive from data or drop the mock code.
- **Proposal status-taxonomy cleanup** — fully reconciling the lowercase-DB vs title-case-UI
  status values across the proposals/contracts surfaces could be its own tidy-up; this phase
  only needs the Contracts query to read the correct stored values (D-11).

None of the above block Phase 19.
</deferred>

---

*Phase: 19-client-portal-productionization*
*Context gathered: 2026-06-07*
