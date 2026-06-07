---
phase: 19-client-portal-productionization
plan: "04"
subsystem: client-portal
tags: [contracts, proposals, signed-url, adminClient, access-control]
dependency_graph:
  requires: []
  provides: [real-contracts-list, signed-url-download]
  affects: [app/client/contracts/page.tsx]
tech_stack:
  added: []
  patterns: [adminClient-bypass-with-manual-scope, createSignedUrls-batch]
key_files:
  created: []
  modified:
    - app/client/contracts/page.tsx
decisions:
  - "Used adminClient + manual client_id scope (not createClient) because RLS proposals_client_visible uses lowercase status values that never match stored title-case, producing zero rows via createClient (D-11)"
  - "Batch createSignedUrls (not createSignedUrl per row) to minimise round trips for multi-contract users"
  - "comment_only: contract_signed string only appears in a code comment documenting what NOT to use; no executable occurrence"
metrics:
  duration: "~8 minutes"
  completed: "2026-06-07T07:48:45Z"
  tasks_completed: 1
  tasks_total: 1
  files_changed: 1
---

# Phase 19 Plan 04: Contracts Page — Real Proposals Query + Signed-URL Download

Rewrote the static "No contracts yet" stub into a real server component that queries `proposals` at status `"Contract Issued"` with a non-null `contract_pdf_path`, generates short-lived signed Storage URLs in batch, and renders a download list (or the honest editorial empty state) scoped strictly to the authenticated client's org.

## Tasks

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Rewrite contracts page with real proposals query + signed-URL download | 12a4574 | app/client/contracts/page.tsx |

## Acceptance Criteria Verification

| Criterion | Result |
|-----------|--------|
| `export const dynamic = "force-dynamic"` present | PASS |
| Uses `adminClient` (not `createClient`) | PASS |
| Status filter is title-case `"Contract Issued"` | PASS |
| `"contract_signed"` never appears in executable code | PASS (comment only, no runtime value) |
| Query scoped by `client_id` | PASS |
| Filters `not contract_pdf_path is null` | PASS |
| `createSignedUrls` against `"proposals"` bucket with `60*60` TTL | PASS |
| No mock data / no `mockXxxFor()` | PASS |
| TypeScript: no errors in contracts page | PASS (npx tsc --noEmit: zero errors in contracts/page.tsx) |
| Build: compiled successfully | PASS (Turbopack compile: 20.5s success; page-data collection fails due to missing env vars in worktree — pre-existing, not caused by this change, confirmed by identical failure on unmodified baseline) |

## Deviations from Plan

None — plan executed exactly as written.

The build failure (`supabaseUrl is required` during page data collection) is a pre-existing worktree environment issue: the worktree has no `.env.local`. Confirmed by running `npm run build` on the unmodified baseline (identical error at `/admin/clients/[id]` before my change; error at `/admin/templates/[id]` after — both caused by missing env vars, not by contracts page changes).

## Threat Model Coverage

| Threat ID | Mitigation | Status |
|-----------|------------|--------|
| T-19-11 — IDOR via adminClient bypassing RLS | `.eq("client_id", ctx.client_id)` derived from server-side `getClientContext()` | Implemented |
| T-19-12 — Raw storage path exposure | Only signed URLs cross to browser; raw `contract_pdf_path` never in rendered output | Implemented |
| T-19-13 — Over-broad status filter | Filter: `status = "Contract Issued"` AND `contract_pdf_path IS NOT NULL` | Implemented |
| T-19-14 — Status-casing mismatch | Accepted per plan; adminClient + manual scope compensates for broken RLS | Accepted |

## Known Stubs

None — page derives all data from the live `proposals` table; honest empty state when no contracts exist.

## Threat Flags

None — no new network endpoints, auth paths, or trust boundaries introduced beyond those already in the threat model.

## Self-Check

- [x] `app/client/contracts/page.tsx` exists and is modified: FOUND
- [x] Commit `12a4574` exists: FOUND (`git log --oneline -1` = `12a4574 feat(19-04): rewrite contracts page...`)
- [x] `grep "Contract Issued" app/client/contracts/page.tsx` matches
- [x] `grep "createSignedUrl" app/client/contracts/page.tsx` matches
- [x] `grep "client_id" app/client/contracts/page.tsx` matches
- [x] `grep "adminClient" app/client/contracts/page.tsx` matches
- [x] `grep "mock" app/client/contracts/page.tsx` — no matches (PASS)

## Self-Check: PASSED
