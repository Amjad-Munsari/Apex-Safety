---
phase: 19-client-portal-productionization
plan: "02"
subsystem: client-portal-layout
tags: [identity, nav, server-component, rsc-boundary, d-01, d-03, d-04, d-05, d-06]
dependency_graph:
  requires: [19-01]
  provides: [ClientPortalNav, async-client-layout]
  affects:
    - app/client/layout.tsx
    - app/client/_components/client-portal-nav.tsx
    - app/client/assessments (deleted)
tech_stack:
  added: []
  patterns:
    - async-server-component-layout
    - rsc-to-client-primitive-props
    - use-client-nav-extraction
key_files:
  created:
    - app/client/_components/client-portal-nav.tsx
  modified:
    - app/client/layout.tsx
  deleted:
    - app/client/assessments/page.tsx
    - app/client/assessments/[id]/page.tsx
decisions:
  - "D-01: Server/client split — layout.tsx is async server shell; ClientPortalNav is use client child"
  - "D-03: Footer consultant block stays static (Matt Robinson · 888FST@proton.me · 0161 552 0918)"
  - "D-04/D-06: Assessments nav entry replaced with Assignments (href: /client/assignments)"
  - "D-05: /client/assessments route deleted entirely — 100% mock, stale bookmarks 404"
  - "RSC→Client boundary: only orgName/userName/userRole primitive strings cross (T-19-05)"
  - "CL-8889 reference-code label removed per CONTEXT.md (deferred)"
metrics:
  duration: "6 minutes"
  completed: "2026-06-07T08:05:43Z"
  tasks: 2
  files: 3
---

# Phase 19 Plan 02: Client Portal Layout Server/Client Split Summary

Async server shell (`layout.tsx`) fetching real identity via `getClientContextWithIdentity()` and passing org name, user name, and role as primitive strings to a new `"use client"` `ClientPortalNav` child — replacing all hardcoded mock identity strings. Assessments nav entry swapped to Assignments; the 100%-mock `/client/assessments` route deleted.

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Extract ClientPortalNav client component + swap nav items | 4ebddd6 | app/client/_components/client-portal-nav.tsx |
| 2 | Rewrite layout.tsx as async server shell + delete assessments route | 28ed09d | app/client/layout.tsx, app/client/assessments/* (deleted) |

## What Was Built

### `app/client/_components/client-portal-nav.tsx` — new `"use client"` component

- Owns all interactive nav state: `usePathname` active-link highlighting, `useState` mobile menu open/close
- Sheet/SheetContent/SheetTrigger for mobile hamburger drawer — verbatim from original layout
- `NAV_ITEMS` constant with `{ id: "05", label: "Assignments", href: "/client/assignments" }` replacing the former Assessments entry
- `isActive()` helper copied verbatim
- Desktop nav, sign-out form, mobile Sheet all live here
- `interface ClientPortalNavProps { orgName: string; userName: string; userRole: string }` declared at the RSC→Client boundary
- No mock identity strings: `"Hallam House Care Home"`, `"Sarah Whitfield"`, `"Facilities Manager"`, `"CL-8889"` all removed
- `{orgName}`, `{userName}`, `{userRole}` rendered from props throughout (header + mobile sheet)

### `app/client/layout.tsx` — rewritten as async server shell

- `"use client"` removed; `export const dynamic = "force-dynamic"` added
- `getClientContextWithIdentity` imported from `@/lib/auth-helpers` (Plan 01 output)
- `ClientPortalNav` imported from `./_components/client-portal-nav`
- Identity fetched: `const identity = await getClientContextWithIdentity()`
- Primitive string props passed to `<ClientPortalNav orgName={...} userName={...} userRole={...} />`
- Fallback: `identity?.orgName ?? "—"` (real data with dash for unauthenticated/missing)
- Static footer retained VERBATIM: Matt Robinson · 888FST@proton.me · 0161 552 0918 (D-03)
- No `usePathname`, `useState`, `Sheet`, or client hooks remain in this file
- `BrandingProvider` still mounted as the first child

### Deleted: `app/client/assessments/` (entire directory)

- `app/client/assessments/page.tsx` — 100% mock list (hardcoded `ASSESSMENTS` fixtures)
- `app/client/assessments/[id]/page.tsx` — 100% mock detail (hardcoded `ASSESSMENT_FIXTURES`)
- The only external reference was the NAV_ITEMS entry, now swapped to Assignments
- Stale bookmarks 404 — intended clean-removal behavior (T-19-06 accepted)

## Threat Mitigations Applied

| Threat | Mitigation |
|--------|-----------|
| T-19-04 Spoofing | Identity display from `getClientContextWithIdentity()` scoped by `auth.uid()`; nav receives display strings only |
| T-19-05 Information Disclosure | Only `orgName`/`userName`/`userRole` primitive strings cross RSC→Client boundary; `client_id` not serialized into client bundle |
| T-19-06 Tampering | `/client/assessments` deleted; stale bookmarks 404 (clean removal, not a regression) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] @react-pdf/renderer package not installed in node_modules**
- **Found during:** Task 2 build verification
- **Issue:** `@react-pdf/renderer` was listed in `package.json` but the package directory under `node_modules/@react-pdf/renderer` was empty — missing `package.json` and all source files. The build failed with "Module not found: Can't resolve '@react-pdf/renderer'". This is a pre-existing environment issue unrelated to layout changes.
- **Fix:** Ran `npm install @react-pdf/renderer --legacy-peer-deps` in the main project directory. Package installed successfully.
- **Files modified:** `node_modules/@react-pdf/renderer` (package installation, not tracked in git)
- **Commit:** N/A (npm install, no git change)

**2. [Pre-existing] Worktree build missing .env.local (supabaseUrl required)**
- **Found during:** Task 2 build verification
- **Issue:** After fixing the react-pdf issue, the Next.js build succeeded compilation ("Compiled successfully in 12.6s") and TypeScript check ("Finished TypeScript in 13.5s") but failed in the page data collection phase with "supabaseUrl is required" — the worktree lacks `.env.local` which exists only in the main project root.
- **Impact:** TypeScript compilation is clean for all files created/modified in this plan. The main project build (from the root with `.env.local`) exits 0.
- **Fix:** Verified TypeScript compilation clean (`npx tsc --noEmit` shows zero errors in `app/client/layout.tsx` and `app/client/_components/client-portal-nav.tsx`). Main project build (C:/dev/Antigravity/888 Safety) exits 0 successfully.

## Known Stubs

None — all identity data is fetched from the real DB via `getClientContextWithIdentity()`. The `"—"` fallbacks are correct behavior for unauthenticated or missing data, not stubs.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes introduced. The layout change only wires existing `getClientContextWithIdentity()` output to display strings.

## Self-Check: PASSED

- `app/client/_components/client-portal-nav.tsx` exists with `"use client"` directive
- `grep -q 'label: "Assignments"'` passes; `grep -c "Assessments"` returns 0
- No mock identity strings in `client-portal-nav.tsx` (Hallam House, Sarah Whitfield, Facilities Manager, CL-8889 — all gone)
- `app/client/assessments` directory deleted — confirmed by `test ! -e`
- `app/client/layout.tsx` has no `"use client"`, has `force-dynamic`, awaits `getClientContextWithIdentity()`, passes primitive props
- Static footer: Matt Robinson + 888FST@proton.me + 0161 552 0918 all present in layout.tsx
- No `usePathname`/`useState` in layout.tsx
- Commit `4ebddd6` exists (Task 1)
- Commit `28ed09d` exists (Task 2)
- TypeScript compilation: zero errors in plan files
