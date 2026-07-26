---
phase: 19-client-portal-productionization
verified: 2026-06-07T08:13:20Z
status: human_needed
score: 11/11 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Portal header shows real org name and signed-in user name after login"
    expected: "Header renders the org name from clients.name and the user's display name / role from client_users — not 'Hallam House Care Home' / 'Sarah Whitfield / Facilities Manager'"
    why_human: "Cannot verify rendered output without a live browser session; requires an authenticated client account"
  - test: "Mobile Sheet opens and active-link highlight tracks current route"
    expected: "Hamburger opens the Sheet drawer; clicking a nav item closes it; active page has underline/bold treatment"
    why_human: "usePathname active-state and Sheet open/close are client-side runtime behaviors; cannot verify from static code alone"
  - test: "Open a completed assignment submission as a client"
    expected: "Full read-only render of every field, photo, and signature using the pinned version_id schema; no input is accepted; submitted timestamp shown"
    why_human: "InterpreterRenderer rendering correctness and pointer-events-none effectiveness require a browser interaction test"
  - test: "Attempt to access another org's /client/assignments/[id]/submission"
    expected: "404 page — not the other org's submission data"
    why_human: "IDOR check is code-verified (submission.client_id !== ctx.client_id → notFound()) but the end-to-end 404 behavior requires a live request with a cross-org session"
  - test: "Contracts page with a seeded 'Contract Issued' proposal"
    expected: "Contract row renders with reference, title, issued date, and a working Download button that opens the PDF via a short-lived signed URL"
    why_human: "Signed URL generation and PDF download require a live Supabase Storage call and a browser"
  - test: "/client/assessments returns 404"
    expected: "Navigating to the old assessments URL shows a Next.js 404 page"
    why_human: "Route deletion is code-verified but the 404 response requires a live Next.js request"
---

# Phase 19: Client Portal Productionization — Verification Report

**Phase Goal:** A signed-in client sees their real org and identity in the portal chrome, navigates to real Assignments (mock Assessments removed), opens a read-only view of any completed submission, and downloads their counter-signed contracts — all DB-backed with honest empty states.

**Verified:** 2026-06-07T08:13:20Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Signed-in client's org name resolves from clients.name (D-02) | VERIFIED | `lib/auth-helpers.ts` line 97: `.select("client_id, role, name, email, client:clients(name)")` in both demo and prod paths; `orgName: clientRow?.name ?? "—"` (lines 107, 124) |
| 2 | Display name resolves from client_users.name, falling back to email (D-02) | VERIFIED | `userName: (data.name as string) \|\| (data.email as string) \|\| "—"` at lines 108, 125. Unit test case (3) confirms empty name falls back to email — 6/6 tests green |
| 3 | Demo mode resolves identity without calling getUser() (D-02) | VERIFIED | `if (await isDemoMode())` guard at line 93 returns before line 112 (`const user = await getUser()`). Unit test case (2) explicitly asserts `expect(mocks.mockGetUser).not.toHaveBeenCalled()` |
| 4 | Portal header shows real org name + user identity, not hardcoded strings (D-01) | VERIFIED | `layout.tsx` is an async server component calling `getClientContextWithIdentity()` and passing `orgName`, `userName`, `userRole` as primitive string props to `ClientPortalNav`. No literal "Hallam House Care Home", "Sarah Whitfield", "Facilities Manager", or "CL-8889" remain in nav or layout files |
| 5 | Footer consultant block is static (Matt Robinson · info@888safetyandtraining.com · 0333 049 8979) (D-03) | VERIFIED | `layout.tsx` lines 33–37 contain the static footer block verbatim; `usePathname`/`useState`/`Sheet` are absent from `layout.tsx` |
| 6 | Nav shows Assignments → /client/assignments; Assessments entry is gone (D-04/D-06) | VERIFIED | `client-portal-nav.tsx` line 19: `{ id: "05", label: "Assignments", href: "/client/assignments" }`. No "Assessments" label or `/client/assessments` href anywhere in nav or layout files |
| 7 | app/client/assessments route deleted and returns 404 (D-04/D-05) | VERIFIED (code) | `test ! -d app/client/assessments` returns DELETED. No dangling imports to client/assessments in app/. Admin assessments (`app/admin/assessments/`) correctly untouched |
| 8 | Completed assignment opens a read-only submission viewer against pinned version_id (D-07) | VERIFIED | `submission/page.tsx`: two-step fetch — `form_submissions` (scoped assignment_id + status="submitted", ordered submitted_at desc, limit 1) then `template_versions.schema_json` by `submission.template_version_id`. `SubmissionViewerClient` wraps `InterpreterRenderer` in `pointer-events-none select-none opacity-90`; no `onSubmit`/`onProgressChange`/`onValuesChange`/ref passed |
| 9 | Cross-org assignment_id 404s (IDOR protection) (D-07) | VERIFIED (code) | UUID_RE guard (line 31) rejects malformed IDs; `submission/page.tsx` line 55: `if (ctx && submission.client_id !== ctx.client_id) { notFound(); }` defense-in-depth on top of RLS |
| 10 | Completed-tab links to /submission viewer; TODO(plan-future) removed (D-08) | VERIFIED | `assignments/page.tsx` line 93: `href={\`/client/assignments/${a.id}/submission\`}`. `grep "TODO(plan-future)"` returns nothing. Active-tab link at line 73 still routes to the assignment fill flow |
| 11 | Contracts derived from proposals at "Contract Issued" with signed-URL download (D-09/D-10/D-11) | VERIFIED | `contracts/page.tsx`: `adminClient.from("proposals").eq("status", "Contract Issued").not("contract_pdf_path", "is", null).eq("client_id", ctx.client_id)`. Batch `createSignedUrls(paths, 60 * 60)` against "proposals" bucket. "contract_signed" appears only in a code comment (line 25), not as an executable value |

**Score:** 11/11 truths verified

---

### Per-Decision Verdicts

| Decision | Description | Verdict | Evidence |
|----------|-------------|---------|----------|
| D-01 | layout.tsx converted to async server component; client nav extracted | PASS | `layout.tsx` has no "use client" directive; exports `const dynamic = "force-dynamic"`; awaits `getClientContextWithIdentity()`; passes only primitive string props |
| D-02 | getClientContextWithIdentity() returns orgName + userName + role | PASS | Interface `ClientIdentity` exported at line 70; function exported at line 90; 6/6 unit tests green |
| D-03 | Footer consultant block stays static | PASS | `layout.tsx` lines 33–37: Matt Robinson / info@888safetyandtraining.com / 0333 049 8979 in a static `<footer>` block |
| D-04 | app/client/assessments deleted entirely | PASS | Directory confirmed deleted; no dangling references in client portal files |
| D-05 | Completed AI reports remain in Reports tab (no data overlap) | PASS | Assessments deletion confirmed; Reports nav item (`id: "03"`) unchanged in ClientPortalNav |
| D-06 | NAV_ITEMS re-ordered cleanly after swap | PASS | Assignments takes id "05" (same slot as old Assessments); two-digit convention preserved across all 8 entries |
| D-07 | Submission viewer uses InterpreterRenderer read-only against pinned version_id | PASS | Two-step fetch confirmed; pointer-events-none wrapper; no submit wiring; no submit button |
| D-08 | Completed tab links to /submission viewer; TODO(plan-future) removed | PASS | Link href updated; TODO comment removed; confirmed by grep |
| D-09 | Contracts derived from proposals at counter-signed stage | PASS | `eq("status", "Contract Issued")` + `.not("contract_pdf_path", "is", null)` |
| D-10 | Contract PDFs download via short-lived signed Storage URL | PASS | `createSignedUrls(paths, 60 * 60)` against "proposals" bucket; raw path never rendered |
| D-11 | Status casing reconciled — title-case "Contract Issued" used | PASS | Title-case string used in executable code; "contract_signed" appears only in comment |

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `lib/auth-helpers.ts` | getClientContextWithIdentity() + ClientIdentity interface | VERIFIED | Both exported; interface at line 70, function at line 90; original getClientContext() untouched |
| `tests/auth-helpers/client-context-with-identity.test.ts` | 6-case unit coverage for D-02 | VERIFIED | 6 tests, all PASS; demo-mode no-getUser assertion explicit |
| `app/client/layout.tsx` | Async server shell fetching identity, rendering ClientPortalNav + static footer | VERIFIED | No "use client"; awaits identity; passes primitive props; static footer present |
| `app/client/_components/client-portal-nav.tsx` | "use client" nav with NAV_ITEMS, usePathname, Sheet | VERIFIED | "use client" directive present; usePathname, useState, Sheet all in this file; Assignments entry present; no mock identity strings |
| `app/client/assignments/[id]/submission/page.tsx` | Server route with IDOR-scoped two-step fetch | VERIFIED | UUID_RE guard; two-step fetch (form_submissions → template_versions); defense-in-depth client_id check; notFound() on cross-org |
| `app/client/assignments/[id]/submission/submission-viewer-client.tsx` | Read-only InterpreterRenderer wrapper | VERIFIED | pointer-events-none + select-none wrapper; InterpreterRenderer with surface="cream", initialValues=answersJson; no submit wiring |
| `app/client/assignments/page.tsx` | Completed tab links to /submission | VERIFIED | Line 93: `/client/assignments/${a.id}/submission`; TODO(plan-future) removed |
| `app/client/contracts/page.tsx` | Real proposals-derived contracts query + signed-URL download | VERIFIED | adminClient query; "Contract Issued" filter; client_id scope; createSignedUrls; empty-state card |
| `app/client/assessments/` | Deleted | VERIFIED | Directory does not exist; no dangling imports in client portal |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `lib/auth-helpers.ts getClientContextWithIdentity()` | `client_users + clients(name) join` | `.select("client_id, role, name, email, client:clients(name)")` | WIRED | Pattern present in both demo and prod paths (lines 97, 116) |
| `demo path` | `isDemoMode() guard` | early return before getUser() | WIRED | `if (await isDemoMode())` at line 93; getUser() at line 112 — after the guard block |
| `app/client/layout.tsx` | `getClientContextWithIdentity()` | `await` call | WIRED | Line 2 import + line 12 await |
| `app/client/layout.tsx` | `ClientPortalNav` | primitive string props orgName/userName/userRole | WIRED | Lines 17–21; no whole-object prop passed |
| `NAV_ITEMS` | `/client/assignments` | `label: "Assignments"` entry | WIRED | `client-portal-nav.tsx` line 19 |
| `submission/page.tsx` | `form_submissions` scoped by client_id + status submitted | `.eq("assignment_id", id).eq("status", "submitted")` | WIRED | Lines 41–47; client_id defense-in-depth at line 55 |
| `submission/page.tsx` | `template_versions.schema_json` | two-step fetch by submission.template_version_id | WIRED | Lines 61–65 |
| `assignments/page.tsx Completed tab` | `/client/assignments/[id]/submission` | Link href repoint | WIRED | Line 93 |
| `contracts/page.tsx` | `proposals (adminClient, scoped by client_id, status "Contract Issued")` | `adminClient.from("proposals").eq(...)` | WIRED | Lines 29–34 |
| `contract_pdf_path` | signed Storage URL | `adminClient.storage.from("proposals").createSignedUrls(paths, 60*60)` | WIRED | Lines 44–55; Map keyed by path at line 51 |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `client-portal-nav.tsx` orgName/userName | props from layout server shell | `getClientContextWithIdentity()` → `client_users JOIN clients(name)` | Yes — DB join, no hardcoded fallback except "—" on null | FLOWING |
| `contracts/page.tsx` contracts list | `rows` from adminClient proposals query | `adminClient.from("proposals").eq("status","Contract Issued")` | Yes — live DB query | FLOWING |
| `submission/page.tsx` submission + schema | `submission` (form_submissions), `version` (template_versions) | Two-step DB fetch scoped by assignment_id + status | Yes — live DB queries | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| 6 unit tests for getClientContextWithIdentity() | `npx vitest run tests/auth-helpers/client-context-with-identity.test.ts` | 6/6 PASS, exit 0 | PASS |
| No "use client" in layout.tsx | `grep "use client" app/client/layout.tsx` | No match | PASS |
| No mock identity strings in nav component | `grep -E "Hallam House\|Sarah Whitfield\|Facilities Manager\|CL-8889" app/client/_components/client-portal-nav.tsx` | No match | PASS |
| Assessments directory deleted | `test ! -d app/client/assessments` | DELETED | PASS |
| TODO(plan-future) removed from assignments page | `grep "TODO(plan-future)" app/client/assignments/page.tsx` | No match | PASS |
| "contract_signed" not used as executable value | `grep "contract_signed" app/client/contracts/page.tsx` | Comment only (line 25) | PASS |
| Submission viewer has pointer-events-none | `grep "pointer-events-none" submission-viewer-client.tsx` | Line 78 | PASS |
| No submit wiring in submission viewer | `grep -n "onSubmit\|onProgressChange\|onValuesChange\|useRef\|\bref=" submission-viewer-client.tsx` | Comment only (line 22), no executable wiring | PASS |
| force-dynamic on all server pages | grep across 4 server files | All 4 present | PASS |
| Completed-tab link includes /submission suffix | `grep "/client/assignments/\${a.id}/submission" assignments/page.tsx` | Line 93 | PASS |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | — | — | — | No TBD/FIXME/XXX markers found in any phase-19-touched file. No empty return stubs. No mock data generators. The "return null" occurrences in auth-helpers.ts are correct guard returns, not stubs. |

---

### Human Verification Required

The following items require a live browser session with an authenticated client account (amjadmunsari@gmail.com linked to "Munsari Property Group" per the seeded test data).

#### 1. Portal Header Identity Rendering

**Test:** Sign in as amjadmunsari@gmail.com and navigate to any /client/* page.
**Expected:** Header shows "Munsari Property Group" as the org name; the right-side user block shows the signed-in user's name and role from client_users — not "Hallam House Care Home" or "Sarah Whitfield".
**Why human:** Rendered output requires a live authenticated browser session.

#### 2. Mobile Sheet and Active-Link Behavior

**Test:** On a narrow viewport, tap the hamburger icon, navigate between pages, confirm active-link highlight updates.
**Expected:** Sheet opens; tapping a nav item closes the sheet and routes to the correct page; the active item has the underline/bold treatment on the new page.
**Why human:** usePathname active-state and Sheet open/close are client-side runtime behaviors not verifiable from static analysis.

#### 3. Completed Submission Viewer

**Test:** Navigate to Assignments → Completed tab → click on the seeded completed assignment.
**Expected:** Full read-only form render (all fields, photos, signatures) at /client/assignments/[id]/submission. "Submitted {date}" timestamp visible. Attempting to type in a field or click a button does nothing.
**Why human:** InterpreterRenderer rendering and pointer-events-none effectiveness require browser interaction.

#### 4. IDOR Defense — Cross-Org Submission Access

**Test:** Log in as a second client account (if available), copy the submission URL from the first account, and navigate to it with the second account's session.
**Expected:** 404 page.
**Why human:** Cross-org IDOR behavior requires two live authenticated sessions.

#### 5. Contracts Download

**Test:** Navigate to /client/contracts with the seeded "Munsari Property Group" account (which has an issued contract per the seed data description).
**Expected:** At least one contract card renders with a reference number, title, issued date, and an active Download button. Clicking Download opens or saves the PDF via a signed URL.
**Why human:** Signed URL generation and PDF download require live Supabase Storage calls and a browser.

#### 6. /client/assessments Returns 404

**Test:** Navigate to https://your-domain.com/client/assessments.
**Expected:** Next.js 404 page — not the old mock assessment list.
**Why human:** Route deletion is code-verified but the 404 HTTP response requires a live Next.js request.

---

### Requirements Coverage

| Decision | Verified by | Status |
|----------|-------------|--------|
| D-01 — Server/client layout split | layout.tsx code + nav extraction + build check | SATISFIED |
| D-02 — getClientContextWithIdentity() identity resolution | lib/auth-helpers.ts + 6 unit tests green | SATISFIED |
| D-03 — Static footer consultant block | layout.tsx lines 33–37 | SATISFIED |
| D-04 — Delete app/client/assessments | Directory confirmed deleted | SATISFIED |
| D-05 — No data overlap (reports tab untouched) | Reports nav item unchanged; assessments deleted | SATISFIED |
| D-06 — Clean NAV_ITEMS renumbering | Assignments at id "05"; all 8 items with two-digit ids | SATISFIED |
| D-07 — Read-only submission viewer via InterpreterRenderer | submission/page.tsx + submission-viewer-client.tsx | SATISFIED |
| D-08 — Completed tab links to /submission viewer | assignments/page.tsx line 93; TODO removed | SATISFIED |
| D-09 — Contracts derived from proposals pipeline | contracts/page.tsx; "Contract Issued" filter | SATISFIED |
| D-10 — Signed Storage URL download | createSignedUrls(paths, 60*60); Map-based URL lookup | SATISFIED |
| D-11 — Status taxonomy: use "Contract Issued" not "contract_signed" | Title-case used; lowercase only in comment | SATISFIED |

**All 11 D-NN decisions: SATISFIED in code.**

---

### Gaps Summary

No gaps. All 11 observable truths verified in the codebase. The 6 human-verification items are live-environment checks — they do not indicate missing code but require a browser session with the seeded test account to confirm end-to-end rendering and download behavior.

---

_Verified: 2026-06-07T08:13:20Z_
_Verifier: Claude (gsd-verifier)_
