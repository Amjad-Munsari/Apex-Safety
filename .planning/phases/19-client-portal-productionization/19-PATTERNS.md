# Phase 19: Client Portal Productionization - Pattern Map

**Mapped:** 2026-06-07
**Files analyzed:** 7 new/modified files
**Analogs found:** 7 / 7

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `lib/auth-helpers.ts` (extend) | utility/auth | request-response | `lib/auth-helpers.ts` `getClientContext()` (same file, lines 65-94) | exact — sibling function, same pattern |
| `app/client/layout.tsx` (server shell rewrite) | layout/server | request-response | `app/client/compliance/page.tsx` (force-dynamic + getClientContext shape) | role-match |
| `app/client/_components/client-portal-nav.tsx` (CREATE) | component/nav | event-driven (hooks) | `app/client/layout.tsx` lines 1-198 (entire current nav body) | exact — extract from |
| `app/client/assessments/page.tsx` (DELETE) | — | — | n/a — pure deletion | — |
| `app/client/assignments/page.tsx` (modify link) | page/server | CRUD | itself — one-line change at line 96 | self-patch |
| `app/client/assignments/[id]/submission/page.tsx` (CREATE) | page/server | CRUD | `app/client/assignments/[id]/fill/page.tsx` (two-step fetch + IDOR) | exact |
| `app/client/contracts/page.tsx` (replace) | page/server | CRUD | `app/client/proposals/page.tsx` (adminClient query + empty-state) + `app/client/proposals/[id]/page.tsx` (signed URL) | exact |

---

## Pattern Assignments

### `lib/auth-helpers.ts` — add `getClientContextWithIdentity()`

**Role:** utility/auth  **Data Flow:** request-response

**Analog:** `lib/auth-helpers.ts` lines 65-94 (`getClientContext()`)

**Imports pattern** (lines 1-3 of the file):
```typescript
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
```
Note: `getUser` and `isDemoMode` are already exported from this file — no new imports needed for the sibling.

**Core pattern — existing `getClientContext()` to mirror** (lines 65-94):
```typescript
export async function getClientContext() {
  const supabase = await createClient()

  if (await isDemoMode()) {
    // Skip getUser() in demo — stale auth header poisons subsequent writes (lines 43-55)
    const { data } = await supabase
      .from("client_users")
      .select("client_id, role")
      .limit(1)
      .single()
    return data ?? null
  }

  const user = await getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from("client_users")
    .select("client_id, role")
    .eq("id", user.id)
    .single()

  if (error || !data) return null
  return data
}
```

**New sibling to add — `getClientContextWithIdentity()`:**

Extend the `.select()` with `"name, email, client:clients(name)"` in both the demo and prod paths. Return a `ClientIdentity` object. Join shape for `clients` must be normalized because Supabase-js may return it as array or object:
```typescript
const clientRow = Array.isArray(data.client) ? data.client[0] : data.client
// clientRow?.name gives orgName
// data.name || data.email gives userName (fallback chain)
```

**Critical guard (lines 43-55 comment):** The demo path MUST NOT call `getUser()`. Calling `auth.getUser()` with a stale demo cookie poisons the Supabase-js client with a bad Authorization header that overrides the service-role key. The `isDemoMode()` guard + early return is the invariant.

---

### `app/client/layout.tsx` — server shell rewrite (D-01)

**Role:** layout/server  **Data Flow:** request-response

**Analog:** `app/client/compliance/page.tsx` (force-dynamic + getClientContext shape)

**Imports pattern** (`app/client/compliance/page.tsx` lines 1-4):
```typescript
import { createClient } from "@/lib/supabase/server";
import { getClientContext } from "@/lib/auth-helpers";
export const dynamic = "force-dynamic";
```

For the layout server shell, replace the client import with the new identity helper:
```typescript
import { getClientContextWithIdentity } from "@/lib/auth-helpers";
export const dynamic = "force-dynamic";
// Remove: "use client" — the shell is an async server component
```

**Current file structure to split** (`app/client/layout.tsx` lines 1-198):

- Lines 1-13: `"use client"` directive + all imports (Link, usePathname, useState, Sheet, BrandingProvider)
- Lines 15-24: `NAV_ITEMS` constant
- Lines 26-30: `isActive()` helper
- Lines 32-198: Single `ClientLayout` export — header with hardcoded identity, desktop nav, mobile Sheet, `<main>`, footer

**What stays in server shell (new `app/client/layout.tsx`):**
- `export const dynamic = "force-dynamic"`
- `async function ClientLayout({ children })` — calls `getClientContextWithIdentity()`
- Renders outer wrapper div, `<BrandingProvider />`, `<ClientPortalNav orgName={...} userName={...} userRole={...}>`, `<main>{children}</main>`, static footer (lines 185-195 — keep verbatim)

**What moves to client nav component:**
- `"use client"` directive
- All hook imports: `usePathname`, `useState`
- `Sheet`, `SheetContent`, `SheetTrigger`
- `NAV_ITEMS` constant (with Assessments→Assignments swap)
- `isActive()` helper
- All nav markup (lines 44-177)

**Hardcoded strings to replace in the extracted nav component:**
- Line 53: `"Hallam House Care Home"` → `orgName` prop
- Line 50: `"CL-8889 · Compliance Portal"` → remove or omit (deferred)
- Lines 97, 133: `"Sarah Whitfield"` → `userName` prop
- Lines 99, 134: `"Facilities Manager"` → `userRole` prop
- Line 132: `"CL-8889 · Compliance Portal"` (mobile sheet) → remove or omit

**Footer block to keep verbatim** (lines 185-195 — static per D-03):
```tsx
<footer className="max-w-[1024px] mx-auto px-6 py-8 mt-6 border-t border-[#e5e1d8]">
  <div className="flex flex-wrap justify-center items-center gap-x-4 gap-y-2 font-mono text-[8.5px] tracking-[0.2em] text-[#8a857f] uppercase">
    <span>Your Consultant</span>
    <span className="text-[#6b6560] font-bold">&middot;</span>
    <span className="text-[#6b6560] font-bold">Matt Robinson</span>
    <span className="text-[#6b6560] font-bold">&middot;</span>
    <span className="text-[#6b6560] font-bold">888FST@proton.me</span>
    <span className="text-[#6b6560] font-bold">&middot;</span>
    <span className="text-[#6b6560] font-bold">0161 552 0918</span>
  </div>
</footer>
```

**RSC→Client boundary rule:** Pass only primitives to `<ClientPortalNav>`:
```tsx
<ClientPortalNav
  orgName={identity?.orgName ?? "—"}
  userName={identity?.userName ?? "—"}
  userRole={identity?.role ?? "—"}
/>
```
Do NOT pass the full `ClientIdentity` object — Next.js enforces serialization at the RSC→Client boundary.

---

### `app/client/_components/client-portal-nav.tsx` — CREATE (extracted from layout)

**Role:** component/nav  **Data Flow:** event-driven (hooks)

**Analog:** `app/client/layout.tsx` lines 1-198 — this IS the source; the file is created by extraction.

**File template:**
```typescript
"use client"
// Props received from server layout shell
interface ClientPortalNavProps {
  orgName: string
  userName: string
  userRole: string
  children?: React.ReactNode  // if needed for layout slot
}
```

**NAV_ITEMS after swap** (D-04/D-06 — replace `"Assessments"` entry at position 05):
```typescript
const NAV_ITEMS = [
  { id: "01", label: "Dashboard",   href: "/client" },
  { id: "02", label: "Compliance",  href: "/client/compliance" },
  { id: "03", label: "Reports",     href: "/client/reports" },
  { id: "04", label: "Billing",     href: "/client/billing" },
  { id: "05", label: "Assignments", href: "/client/assignments" },  // was "Assessments"
  { id: "06", label: "Templates",   href: "/client/templates" },
  { id: "07", label: "Proposals",   href: "/client/proposals" },
  { id: "08", label: "Contracts",   href: "/client/contracts" },
] as const;
```

**`isActive()` helper** (lines 26-30 of current layout — copy verbatim):
```typescript
function isActive(href: string, pathname: string | null): boolean {
  if (!pathname) return false;
  if (href === "/client") return pathname === "/client";
  return pathname === href || pathname.startsWith(`${href}/`);
}
```

**Mobile Sheet pattern** (lines 113-174 of current layout — copy verbatim, substituting prop names for hardcoded strings).

---

### `app/client/assessments/page.tsx` — DELETE

**Role:** n/a  **Data Flow:** n/a

No pattern needed. File is 100% mock (hardcoded `ASSESSMENTS` array, lines 19-24 of the file). Safe to delete: confirmed no other file imports from it. The route `/client/assessments/[id]` (if it exists) should also be removed — check `app/client/assessments/` directory contents before deletion.

---

### `app/client/assignments/page.tsx` — modify Completed-tab Link (line 96)

**Role:** page/server  **Data Flow:** CRUD

**Analog:** self — one-line change.

**Current line 95-96** (confirmed by direct read):
```typescript
// TODO(plan-future): update to /client/assignments/${a.id}/submission
<Link key={a.id} href={`/client/assignments/${a.id}`} className="block">
```

**Replace with:**
```typescript
<Link key={a.id} href={`/client/assignments/${a.id}/submission`} className="block">
```

Remove the TODO comment above it. No other changes to this file.

---

### `app/client/assignments/[id]/submission/page.tsx` — CREATE

**Role:** page/server  **Data Flow:** CRUD (read-only fetch)

**Primary analog:** `app/client/assignments/[id]/fill/page.tsx` (two-step fetch + IDOR pattern)

**Secondary analog:** `app/client/assignments/[id]/page.tsx` (IDOR `.eq("client_id", ctx.client_id)` check)

**Imports pattern** (from `fill/page.tsx` lines 1-5):
```typescript
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getClientContext } from "@/lib/auth-helpers";
```
Add: `export const dynamic = "force-dynamic"`

**UUID guard** (from `fill/page.tsx` lines 8-10 and `[id]/page.tsx` lines 9-10 — copy verbatim):
```typescript
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// In page body:
const { id } = await params;
if (!UUID_RE.test(id)) notFound();
```

**Step 1 — fetch submission with IDOR scope** (analog: `fill/page.tsx` lines 24-36, extended for `form_submissions`):
```typescript
const supabase = await createClient();
const ctx = await getClientContext();

const { data: submission } = await supabase
  .from("form_submissions")
  .select("id, answers_json, template_version_id, client_id, submitted_at")
  .eq("assignment_id", id)
  .eq("status", "submitted")
  .order("submitted_at", { ascending: false })
  .limit(1)
  .maybeSingle();

if (!submission) notFound();

// Defense-in-depth: verify org ownership (mirrors fill/page.tsx lines 38-40)
if (ctx && submission.client_id !== ctx.client_id) notFound();
```

**Step 2 — fetch pinned schema** (from `fill/page.tsx` lines 52-58 — copy verbatim, change variable name):
```typescript
const { data: version } = await supabase
  .from("template_versions")
  .select("schema_json, template_id")
  .eq("id", submission.template_version_id)
  .single();

if (!version) notFound();
```

**Render** — pass to a `"use client"` sibling component (same RSC→Client split as `fill/page.tsx` → `fill-assignment-client.tsx`):
```tsx
return (
  <SubmissionViewerClient
    schemaJson={version.schema_json}
    answersJson={submission.answers_json}
    submittedAt={submission.submitted_at}
    clientId={submission.client_id}
    submissionId={submission.id}
  />
);
```

**Client component `submission-viewer-client.tsx`** — mirrors `fill-assignment-client.tsx` structure but with read-only affordance:

```typescript
"use client"
// InterpreterRenderer props reference (interpreter-renderer.tsx lines 41-81):
// Required: schema, submissionId, clientId
// Optional: surface, initialValues, onProgressChange, onSubmit, onValuesChange
// NO readOnly prop exists — use CSS wrapper for read-only affordance (RESEARCH D-07)

import { InterpreterRenderer } from "@/components/form-interpreter/interpreter-renderer";
import type { FormBuilderSchema } from "@/lib/form-builder";

// Wrap in pointer-events-none to prevent any interaction (Option A from RESEARCH):
return (
  <div className="space-y-6">
    {/* Back link + header + submitted-at timestamp */}
    <div className="pointer-events-none select-none opacity-90">
      <InterpreterRenderer
        schema={schemaJson as FormBuilderSchema}
        submissionId={submissionId}
        clientId={clientId}
        initialValues={answersJson}
        surface="cream"
        // No onSubmit, no ref, no onProgressChange — purely read-only
      />
    </div>
  </div>
);
```

**No submit button, no ref** — belt-and-suspenders read-only: CSS overlay + no submit wiring + no ref.

---

### `app/client/contracts/page.tsx` — replace stub with real query

**Role:** page/server  **Data Flow:** CRUD + file I/O (signed URL)

**Primary analog:** `app/client/proposals/page.tsx` (adminClient query + empty-state pattern)

**Secondary analog:** `app/client/proposals/[id]/page.tsx` lines 63-68 (signed URL generation)

**Imports pattern** (from `proposals/page.tsx` lines 1-6):
```typescript
import { adminClient } from "@/lib/supabase/admin";
import { getClientContext } from "@/lib/auth-helpers";
export const dynamic = "force-dynamic";
```

**Auth guard + no-context fallback** (from `proposals/[id]/page.tsx` lines 19-25 — copy this shape):
```typescript
const ctx = await getClientContext();
if (!ctx?.client_id) {
  return (
    <div className="py-24 text-center font-mono text-xs uppercase tracking-widest text-[#8a857f]">
      No client context found
    </div>
  );
}
```

**Contracts query** (RESEARCH §Pattern 4 + D-09/D-11 resolution — status is title-case in DB):
```typescript
const { data: rows } = await adminClient
  .from("proposals")
  .select("id, contract_pdf_path, services_json, total_price, created_at, sent_at")
  .eq("client_id", ctx.client_id)           // IDOR defense-in-depth (adminClient bypasses RLS)
  .eq("status", "Contract Issued")          // title-case — verified by RESEARCH D-11
  .not("contract_pdf_path", "is", null)     // only rows with an actual PDF
  .order("created_at", { ascending: false });

const contracts = rows ?? [];
```

**Signed URL generation** (from `proposals/[id]/page.tsx` lines 63-68 — copy this exact pattern; bucket is `"proposals"`):
```typescript
let signedContractUrl: string | null = null;
if (contract.contract_pdf_path) {
  const { data: signed } = await adminClient.storage
    .from("proposals")
    .createSignedUrl(contract.contract_pdf_path, 60 * 60);  // 1-hour TTL
  signedContractUrl = signed?.signedUrl ?? null;
}
```

For a list of contracts (multiple rows), use batch signed URLs for efficiency:
```typescript
const signedUrls = new Map<string, string>();
const paths = contracts
  .map((c) => c.contract_pdf_path)
  .filter(Boolean) as string[];
if (paths.length > 0) {
  const { data: signed } = await adminClient.storage
    .from("proposals")
    .createSignedUrls(paths, 60 * 60);
  signed?.forEach((s) => {
    if (s.path && s.signedUrl) signedUrls.set(s.path, s.signedUrl);
  });
}
```

**Empty-state card** (from `app/client/contracts/page.tsx` lines 17-23 — reuse the existing markup verbatim; the text is already accurate):
```tsx
<div className="bg-white border border-[#e5e1d8] rounded-sm shadow-[0_1px_2px_rgba(0,0,0,0.02)] px-10 py-16 text-center">
  <p className="font-serif text-[20px] text-[#1a1a1a] mb-3">No contracts yet.</p>
  <p className="font-sans text-[13px] text-[#8a857f] max-w-md mx-auto leading-relaxed">
    Counter-signed service agreements will appear here once your proposal is accepted and issued
    by 888 Safety &amp; Training.
  </p>
</div>
```

**Page header section** (from `app/client/contracts/page.tsx` lines 5-15 — keep verbatim):
```tsx
<section className="space-y-3">
  <div className="flex items-center gap-3">
    <span className="font-mono text-[10px] text-teal tracking-[0.4em] uppercase font-medium">
      08 · Contracts
    </span>
  </div>
  <h2 className="font-serif text-[44px] text-[#1a1a1a] font-normal tracking-tight leading-[1.05]">
    Service agreements.
  </h2>
</section>
```

**Download link pattern** (from `proposals/[id]/page.tsx` lines 136-143):
```tsx
{signedUrl ? (
  <a
    href={signedUrl}
    target="_blank"
    rel="noopener noreferrer"
    download={`contract-${shortId}.pdf`}
    className="bg-[#1a1a1a] hover:bg-black text-white text-[10px] uppercase tracking-[0.25em] font-bold h-12 rounded-sm shadow-none flex items-center gap-2 justify-center transition-colors"
  >
    <Download className="w-3.5 h-3.5" />
    Download Contract
  </a>
) : (
  <button disabled className="...">
    <Download className="w-3.5 h-3.5" />
    Download Contract
  </button>
)}
```

---

## Shared Patterns

### force-dynamic + getClientContext (real-data pattern)

**Source:** `app/client/compliance/page.tsx` lines 1-6, 65-82  
**Apply to:** `app/client/assignments/[id]/submission/page.tsx`, `app/client/contracts/page.tsx`, `app/client/layout.tsx` (server shell)

```typescript
export const dynamic = "force-dynamic";

// In page body:
const ctx = await getClientContext();
if (!ctx) return <EmptyState />;           // always handle null
const supabase = await createClient();
const { data, error } = await supabase
  .from("table")
  .select("columns")
  .eq("client_id", ctx.client_id)         // defense-in-depth; RLS is primary
  .is("deleted_at", null)
  .order("...");
return <UI data={data ?? []} />;
```

### adminClient + IDOR `.eq("client_id")` (proposals pattern)

**Source:** `app/client/proposals/page.tsx` lines 4, 48-53; `app/client/proposals/[id]/page.tsx` lines 3, 31-38  
**Apply to:** `app/client/contracts/page.tsx` (contracts use `adminClient` because RLS uses lowercase status values that don't match stored title-case values — RLS is effectively bypassed for proposals; `adminClient` + manual scoping is the only access control)

```typescript
import { adminClient } from "@/lib/supabase/admin";

// IDOR: adminClient bypasses RLS, so .eq("client_id", ctx.client_id) is the ONLY ownership check
const { data } = await adminClient
  .from("proposals")
  .select("...")
  .eq("client_id", ctx.client_id)     // critical — not optional
  .eq("status", "Contract Issued");   // title-case, not "contract_signed"
```

### UUID guard + notFound()

**Source:** `app/client/assignments/[id]/fill/page.tsx` lines 8-18; `app/client/assignments/[id]/page.tsx` lines 9-10  
**Apply to:** `app/client/assignments/[id]/submission/page.tsx`

```typescript
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// ...
const { id } = await params;
if (!UUID_RE.test(id)) notFound();
```

### IDOR defense-in-depth

**Source:** `app/client/assignments/[id]/fill/page.tsx` lines 38-40; `app/client/assignments/[id]/page.tsx` lines 56-59  
**Apply to:** `app/client/assignments/[id]/submission/page.tsx`

```typescript
// After fetching the row, verify org ownership even with RLS active:
if (ctx && assignment.client_id !== ctx.client_id) notFound();
```

### Supabase join cardinality normalization

**Source:** `app/client/assignments/[id]/page.tsx` lines 90-94  
**Apply to:** `lib/auth-helpers.ts` `getClientContextWithIdentity()` (clients join)

```typescript
// Supabase join may return array or object depending on FK cardinality inference
type TemplateJoin = { name?: string } | { name?: string }[] | null;
const rawTemplate = assignment.template as TemplateJoin;
const templateName: string = Array.isArray(rawTemplate)
  ? (rawTemplate[0]?.name ?? "Untitled form")
  : (rawTemplate?.name ?? "Untitled form");
```
Apply same pattern to `client:clients(name)` join in `getClientContextWithIdentity()`.

### Signed Storage URL

**Source:** `app/client/proposals/[id]/page.tsx` lines 63-68  
**Apply to:** `app/client/contracts/page.tsx`

```typescript
let signedPdfUrl: string | null = null;
if (proposal.proposal_pdf_path) {
  const { data: signed } = await adminClient.storage
    .from("proposals")
    .createSignedUrl(proposal.proposal_pdf_path, 60 * 60);
  signedPdfUrl = signed?.signedUrl ?? null;
}
```

### InterpreterRenderer usage (fill client)

**Source:** `app/client/assignments/[id]/fill/fill-assignment-client.tsx` lines 36-95  
**Apply to:** `app/client/assignments/[id]/submission/submission-viewer-client.tsx` (new file)

Key props from `interpreter-renderer.tsx` lines 41-81:
- `schema: FormBuilderSchema` — required
- `submissionId: string` — required (specialty renderers need it even in read-only)
- `clientId: string` — required
- `surface?: "dark" | "cream"` — use `"cream"` for client portal
- `initialValues?: Record<string, unknown>` — seed with `answers_json` from DB
- **No `readOnly` prop** — wrap in `pointer-events-none select-none` div instead

### Empty-state card markup

**Source:** `app/client/compliance/page.tsx` lines 113-122; `app/client/proposals/page.tsx` lines 95-100; `app/client/contracts/page.tsx` lines 17-23  
**Apply to:** `app/client/contracts/page.tsx` (reuse existing text — it's already accurate)

```tsx
<div className="bg-white border border-[#e5e1d8] rounded-sm shadow-[0_1px_2px_rgba(0,0,0,0.02)] px-10 py-16 text-center">
  <p className="font-serif text-[20px] text-[#1a1a1a] mb-3">{emptyTitle}</p>
  <p className="font-sans text-[13px] text-[#8a857f] max-w-md mx-auto leading-relaxed">
    {emptyBody}
  </p>
</div>
```

---

## No Analog Found

All files in this phase have close analogs in the codebase. No entries in this section.

---

## Critical Anti-Patterns (do not copy)

| Anti-Pattern | Source of Confusion | Correct Approach |
|--------------|---------------------|------------------|
| `eq("status", "contract_signed")` | Migration 001 RLS policy (lowercase) | `eq("status", "Contract Issued")` — stored values are title-case (RESEARCH D-11) |
| `createClient()` for contracts query | Habit from compliance/assignments pages | `adminClient` — RLS `proposals_client_visible` policy uses lowercase values that don't match stored title-case; RLS filters out all rows |
| Calling `getUser()` in demo mode | General auth pattern | `isDemoMode()` guard before any `getUser()` call; demo path picks first `client_users` row directly |
| Passing `ClientIdentity` object as prop to client nav | Type convenience | Pass only primitive strings (`orgName`, `userName`, `userRole`) — RSC→Client serialization boundary |
| `usePathname` or `useState` in server layout shell | Forgetting to split | These hooks MUST stay in `ClientPortalNav` ("use client") |

---

## Metadata

**Analog search scope:** `app/client/`, `lib/auth-helpers.ts`, `components/form-interpreter/`
**Files read:** 11 source files (all verified by direct read — no paths invented)
**Pattern extraction date:** 2026-06-07
