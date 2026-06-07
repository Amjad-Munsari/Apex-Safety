---
phase: 19-client-portal-productionization
reviewed: 2026-06-07T00:00:00Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - app/client/_components/client-portal-nav.tsx
  - app/client/assignments/[id]/submission/page.tsx
  - app/client/assignments/[id]/submission/submission-viewer-client.tsx
  - app/client/assignments/page.tsx
  - app/client/contracts/page.tsx
  - app/client/layout.tsx
  - lib/auth-helpers.ts
  - tests/auth-helpers/client-context-with-identity.test.ts
findings:
  critical: 3
  warning: 3
  info: 1
  total: 7
status: issues_found
---

# Phase 19: Code Review Report

**Reviewed:** 2026-06-07
**Depth:** standard
**Files Reviewed:** 8
**Status:** issues_found

## Summary

This review covers the Phase 19 client portal productionization surface: the identity helper (`lib/auth-helpers.ts`), client layout shell, submission viewer (server + client), assignments list, and contracts page. The phase is security-sensitive — service-role bypass, IDOR boundaries, and read-only enforcement were all given priority scrutiny.

Three blockers were found:

1. The submission page's IDOR defense-in-depth check fires **after** the DB fetch, is conditional on `ctx` being non-null, and **does not add `client_id` to the query filter itself**. In demo mode, where `createClient()` returns a service-role client (RLS bypassed), any authenticated-demo user can retrieve another org's submission by guessing the `assignment_id` UUID if `ctx` happens to be null (empty `client_users` table edge case) or if the demo-mode `client_users` limit-1 pick happens to return an unrelated org.

2. The `getClientContext()` and `getClientContextWithIdentity()` demo-mode paths use `limit(1).single()` without any filter. In a multi-tenant deployment with real clients in the DB, demo mode picks a random org's first row, silently impersonating that org for all subsequent queries. This is an arbitrary org impersonation bug.

3. In the contracts page, `adminClient` (service-role) is used for both the proposals query and the signed-URL generation. The IDOR guard is a query-level `.eq("client_id", ctx.client_id)` which is correct — but the function only returns early if `!ctx?.client_id`, meaning a `ctx` with a blank string `client_id` would produce an `.eq("client_id", "")` query that could return zero rows (benign) or, if Supabase normalises empty-string differently, unexpected rows. More importantly, error responses from `createSignedUrls` are silently discarded, meaning a contract row whose signed-URL generation failed will silently render a disabled download button with no log trace.

---

## Critical Issues

### CR-01: Submission page IDOR check is post-fetch and query has no `client_id` scope

**File:** `app/client/assignments/[id]/submission/page.tsx:40-57`

**Issue:** The first DB query (lines 40-47) fetches `form_submissions` filtered only by `assignment_id` and `status="submitted"`. There is no `.eq("client_id", ctx.client_id)` predicate in the query. In production mode (anon key, RLS active) this relies entirely on RLS as the access control. In demo mode, `createClient()` returns a **service-role** client (see `lib/supabase/server.ts:12-14`) which bypasses RLS entirely — leaving only the post-fetch check on lines 55-57 as the guard. That check reads:

```typescript
if (ctx && submission.client_id !== ctx.client_id) {
  notFound();
}
```

The `&&` short-circuit means the check is skipped when `ctx` is null. In demo mode `getClientContext()` returns null if `client_users` is empty (limit-1 on an empty table returns null). Result: a demo-mode request with an empty `client_users` table can retrieve any org's submission row, bypassing both RLS (service-role) and the application guard (ctx is null).

Even in the non-empty case, defense-in-depth requires that the query itself scopes by `client_id` — not just the post-fetch guard — so that a future RLS misconfiguration or anon-key rotation does not silently open the IDOR.

**Fix:** Add `.eq("client_id", ctx.client_id)` to the query, and hard-reject when ctx is null (before any DB call):

```typescript
const ctx = await getClientContext();
if (!ctx) {
  notFound(); // or redirect to login
}

const { data: submission } = await supabase
  .from("form_submissions")
  .select("id, answers_json, template_version_id, client_id, submitted_at")
  .eq("assignment_id", id)
  .eq("client_id", ctx.client_id)   // <-- add this
  .eq("status", "submitted")
  .order("submitted_at", { ascending: false })
  .limit(1)
  .maybeSingle();

if (!submission) {
  notFound();
}
// The post-fetch check can remain as belt-and-suspenders, but is now redundant.
```

---

### CR-02: Demo-mode `getClientContext()` / `getClientContextWithIdentity()` impersonate arbitrary org via unfiltered `limit(1)`

**File:** `lib/auth-helpers.ts:132-161` and `lib/auth-helpers.ts:90-130`

**Issue:** Both demo-mode branches use `createClient()` (which returns a service-role client in demo mode) and then execute an unfiltered `select(...).limit(1).single()` query against `client_users`. This returns whichever row happens to be first in physical storage order — in a multi-tenant deployment with real clients, the demo user is silently given the identity of that arbitrary org. Every downstream IDOR guard that trusts `ctx.client_id` is now scoped to the wrong org.

`getClientContext()` demo path (lines 135-148):
```typescript
const { data } = await supabase
  .from("client_users")
  .select("client_id, role")
  .limit(1)
  .single()
return data ?? null
```

`getClientContextWithIdentity()` demo path (lines 93-109):
```typescript
const { data, error } = await supabase
  .from("client_users")
  .select("client_id, role, name, email, client:clients(name)")
  .limit(1)
  .single()
```

If the database ever contains real client rows alongside the demo fixture, the demo user could read another org's submissions, assignments, contracts, etc. — because all those pages call `getClientContext()` and trust the returned `client_id`.

**Fix:** Require a dedicated demo fixture client and scope the demo path to it by a stable identifier. For example, store a `DEMO_CLIENT_ID` env var and use `.eq("client_id", process.env.DEMO_CLIENT_ID)`. Alternatively, add an `is_demo BOOLEAN` column to `clients` and filter by it. The `limit(1)` pattern is not safe in any multi-tenant environment.

```typescript
// Example: env-var-pinned demo client
const demoClientId = process.env.DEMO_CLIENT_ID;
if (!demoClientId) return null;

const { data } = await supabase
  .from("client_users")
  .select("client_id, role")
  .eq("client_id", demoClientId)
  .limit(1)
  .single();
return data ?? null;
```

---

### CR-03: `createClient()` silently uses service-role key for all queries in demo mode — RLS bypass scope is too broad

**File:** `lib/supabase/server.ts:8-14` (cross-file, surfaced by review of `app/client/assignments/[id]/submission/page.tsx` and `app/client/contracts/page.tsx`)

**Issue:** `createClient()` returns a service-role client whenever `demo_mode=1` cookie is present. This means every server component under `/client/` that calls `createClient()` runs all queries — not just auth-bypassing ones — with the service-role key. Any query that was designed to be RLS-scoped (e.g., the submission fetch in `submission/page.tsx:40-47`, the form_assignments fetch in `assignments/page.tsx:14-23`) silently becomes unscoped. RLS is the primary access-control layer per the codebase's own security comments; bypassing it for all demo-mode queries eliminates that layer entirely.

The design intent appears to be that demo mode bypasses auth (no real session), not that it bypasses data isolation between orgs. The service-role key is being used as a broad substitute for a missing auth session rather than for its intended purpose (admin operations).

**Fix:** Decouple "no auth session" from "bypass RLS." Create a dedicated demo Supabase user with RLS policies that only see the demo org's rows, or use the anon key with a demo JWT that has the demo `client_id` in its claims. At minimum, ensure every query that runs under the service-role key in demo mode has an explicit `client_id` filter (see CR-01 and CR-02).

If the service-role approach must be kept, add a clear server-side check so the demo cookie cannot be set by an arbitrary client in production (currently there is no check that demo mode is only active in non-production environments).

---

## Warnings

### WR-01: `InterpreterRenderer` receives no `ref` in `SubmissionViewerClient` — but `onValuesChange` prop type allows accidental re-wiring

**File:** `app/client/assignments/[id]/submission/submission-viewer-client.tsx:79-86`

**Issue:** `InterpreterRenderer` exposes a `submit()` method via `useImperativeHandle`. In `SubmissionViewerClient`, no `ref` is passed, so `submit()` is unreachable — correct. However, `InterpreterRenderer`'s internal `onEntityValueUpdated` handler (in `interpreter-renderer.tsx:117-135`) still calls `onValuesChangeRef.current?.()` on every value change. In the viewer, `onValuesChange` is not passed, so this is a no-op. The risk is that a future refactor that passes `onValuesChange` or `onSubmit` to `InterpreterRenderer` here would silently enable mutation/save paths without any compile-time guard.

The viewer's read-only contract is enforced solely by:
- CSS (`pointer-events-none select-none`) — bypassable via DevTools
- No `ref` passed (blocks `submit()` call chain)
- No `onSubmit`/`onValuesChange`/`onProgressChange` props passed

There is no server-side enforcement that the viewer page cannot trigger a write (i.e., no check in `submitAssessmentAction` or the draft-save action that rejects a re-submission of an already-submitted form).

**Fix:** Add a `readOnly` boolean prop to `InterpreterRenderer` that disables the `submit()` path and suppresses `onValuesChange` calls. This makes the read-only contract explicit and compiler-checkable rather than relying on the caller to omit certain props.

Alternatively, create a separate `SubmissionViewer` component that does not use `InterpreterRenderer` at all — just renders field values statically without the coltorapps interpreter store overhead.

---

### WR-02: Contracts page silently discards `createSignedUrls` errors — failed URLs produce no log trace

**File:** `app/client/contracts/page.tsx:44-55`

**Issue:** The signed-URL batch call's error return is ignored:

```typescript
const { data: signedItems } = await adminClient.storage
  .from("proposals")
  .createSignedUrls(paths, 60 * 60);
```

The destructuring discards `error`. If the storage bucket doesn't exist, the paths are invalid, or a permission error occurs, `signedItems` will be null/undefined and the `if (signedItems)` check on line 50 silently swallows the failure. The UI renders a disabled "Download" button with no indication that something went wrong, and there is no server log to diagnose the issue.

**Fix:**

```typescript
const { data: signedItems, error: signedUrlError } = await adminClient.storage
  .from("proposals")
  .createSignedUrls(paths, 60 * 60);

if (signedUrlError) {
  console.error("[contracts] createSignedUrls failed:", signedUrlError.message);
  // Optionally: render an error state rather than silent disabled buttons
}
```

---

### WR-03: `ctx &&` conditional in `submission/page.tsx` creates a logic gap that survives future refactors

**File:** `app/client/assignments/[id]/submission/page.tsx:55-57`

**Issue:** The pattern `if (ctx && submission.client_id !== ctx.client_id)` silently passes when `ctx` is null. This is documented as "belt-and-suspenders" (comment line 53), but the comment implies the check is reliable. As noted in CR-01, a null ctx in demo mode means the ownership check is entirely skipped. Beyond the demo case, any future code path that calls this page without a valid session (e.g., via a server-side `fetch()` from another action, or a misconfigured middleware) would silently bypass the check.

The same pattern appears in `app/client/assignments/[id]/page.tsx:57` and `app/client/assignments/[id]/fill/page.tsx:39`, making this a recurring pattern across the assignment surface.

**Fix:** Treat a null `ctx` as unauthorized and call `notFound()` (or redirect) before any DB query. This aligns with the contracts page pattern (`if (!ctx?.client_id) { return <error> }` at line 16-22) and removes the conditional entirely from the ownership check. See CR-01 fix for the submission page; apply the same pattern to the landing and fill pages.

---

## Info

### IN-01: `services[0] as any` cast in contracts page loses type safety for the service title derivation

**File:** `app/client/contracts/page.tsx:64`

**Issue:** The service title is derived with:

```typescript
const firstName =
  (services[0] as any)?.service?.name ?? (services[0] as any)?.name ?? "Compliance Services";
```

The double `as any` suppresses all type checking on the `services_json` shape. If `services_json` changes schema (e.g., the `service.name` key is renamed in the proposals table), this silently falls back to "Compliance Services" with no compile-time error.

**Fix:** Define a narrow type for the services JSON shape and cast to it instead of `any`:

```typescript
interface ServiceJsonItem {
  name?: string;
  service?: { name?: string };
}
const typedServices = services as ServiceJsonItem[];
const firstName =
  typedServices[0]?.service?.name ?? typedServices[0]?.name ?? "Compliance Services";
```

---

_Reviewed: 2026-06-07_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
