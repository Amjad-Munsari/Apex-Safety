---
phase: 19-client-portal-productionization
plan: "01"
subsystem: auth-helpers
tags: [identity, auth, tdd, client-portal, d-02]
dependency_graph:
  requires: []
  provides: [getClientContextWithIdentity, ClientIdentity]
  affects: [lib/auth-helpers.ts, app/client/layout.tsx (Plan 02 consumer)]
tech_stack:
  added: []
  patterns: [tdd-red-green, vi.hoisted mock factory, supabase-join-normalization]
key_files:
  created:
    - tests/auth-helpers/client-context-with-identity.test.ts
  modified:
    - lib/auth-helpers.ts
    - vitest.config.ts
decisions:
  - "Sibling helper (not extension of getClientContext) to avoid breaking existing consumers"
  - "vi.hoisted() used for mock references shared with vi.mock() factory closures — avoids hoisting ReferenceError"
  - "isDemoMode() guard runs BEFORE getUser() in both paths (T-19-02 stale-auth-header invariant)"
  - "vitest.config.ts include list extended with tests/auth-helpers/** to enable test discovery"
metrics:
  duration: "8 minutes"
  completed: "2026-06-07T07:50:30Z"
  tasks: 2
  files: 3
---

# Phase 19 Plan 01: Identity Helper (getClientContextWithIdentity) Summary

JWT-authenticated identity helper that resolves org name and display name from `client_users JOIN clients(name)` in a single query, with TDD coverage for six behavioral contracts including the demo-mode no-getUser invariant.

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Write failing unit test (TDD RED) | 502a9b2 | tests/auth-helpers/client-context-with-identity.test.ts, vitest.config.ts |
| 2 | Implement getClientContextWithIdentity() (TDD GREEN) | a4ab1b7 | lib/auth-helpers.ts |

## What Was Built

### `lib/auth-helpers.ts` — two new exports

**`interface ClientIdentity`**
```ts
{ client_id: string; role: string; orgName: string; userName: string }
```

**`async function getClientContextWithIdentity(): Promise<ClientIdentity | null>`**

- Demo path: `isDemoMode()` guard runs BEFORE any `getUser()` call, then picks the first `client_users` row via `.limit(1).single()`.
- Prod path: calls `getUser()`, returns null if no session, then queries `client_users` scoped by `auth.uid()`.
- Both paths: select `"client_id, role, name, email, client:clients(name)"`.
- Join normalization: `Array.isArray(data.client) ? data.client[0] : data.client`.
- Fallbacks: `orgName: clientRow?.name ?? "—"`, `userName: data.name || data.email || "—"`.
- Original `getClientContext()` untouched.

### `tests/auth-helpers/client-context-with-identity.test.ts` — 6 unit tests (all GREEN)

1. Real-user path resolves org + display name from join
2. Demo path returns identity WITHOUT calling `getUser()` (explicit call-count assertion)
3. Name fallback: empty `client_users.name` → email
4. Org fallback: null `clients` join → orgName `"—"`
5. Join-shape normalization: `client` as array → `client[0].name`
6. Null session in non-demo mode → returns null

### `vitest.config.ts` — test discovery extended

Added `tests/auth-helpers/**/*.{test,spec}.{ts,tsx}` to the `include` list so the new test directory is discovered. (Rule 3 auto-fix — tests would not run otherwise.)

## TDD Gate Compliance

- RED gate: commit `502a9b2` — `test(19-01): add failing unit test...`
- GREEN gate: commit `a4ab1b7` — `feat(19-01): implement getClientContextWithIdentity()...`
- No REFACTOR needed — implementation is clean on first pass.

## Threat Mitigations Applied

| Threat | Mitigation |
|--------|-----------|
| T-19-01 Spoofing | Prod path uses `.eq("id", user.id)` (auth.uid()); no user-supplied client_id accepted |
| T-19-02 EoP (demo-mode auth) | `isDemoMode()` guard fires before `getUser()`; unit test asserts `getUser` call count = 0 in demo mode |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] vitest.config.ts did not include tests/auth-helpers/ in discovery glob**
- **Found during:** Task 1 setup
- **Issue:** The `include` array in `vitest.config.ts` only covered `tests/form-builder/**`, `tests/form-interpreter/**`, `tests/rls/**`, `tests/scheduler/**`, `tests/phase07/**`. The new `tests/auth-helpers/` directory would not be discovered by the test runner.
- **Fix:** Added `tests/auth-helpers/**/*.{test,spec}.{ts,tsx}` to the `include` list.
- **Files modified:** `vitest.config.ts`
- **Commit:** `502a9b2`

**2. [Rule 3 - Blocking] vi.mock() factory referenced top-level variables causing ReferenceError**
- **Found during:** Task 1 first run
- **Issue:** Vitest hoists `vi.mock()` calls to the top of the file before `const mockSingle = vi.fn()` declarations, causing `ReferenceError: Cannot access 'mockFrom' before initialization`.
- **Fix:** Rewrote mock setup using `vi.hoisted()` to declare mock functions in a closure that executes at hoist time, making them safely accessible in `vi.mock()` factories.
- **Files modified:** `tests/auth-helpers/client-context-with-identity.test.ts`
- **Commit:** `502a9b2` (incorporated into the same RED commit after the fix)

## Known Stubs

None — the helper returns real DB data; no hardcoded fixtures or placeholder values.

## Threat Flags

None — no new network endpoints or auth paths beyond the scoped Supabase query documented in the threat model.

## Self-Check: PASSED

- `lib/auth-helpers.ts` exists and contains `export interface ClientIdentity` and `export async function getClientContextWithIdentity`
- `tests/auth-helpers/client-context-with-identity.test.ts` exists with 6 test cases
- Commit `502a9b2` exists (RED gate)
- Commit `a4ab1b7` exists (GREEN gate)
- `npx vitest run tests/auth-helpers/client-context-with-identity.test.ts` exits 0 (6/6 passed)
- TypeScript: `✓ Compiled successfully` — no errors in `lib/auth-helpers.ts`
- `getClientContext()` body unchanged (verified by grep — still returns only `client_id, role`)
