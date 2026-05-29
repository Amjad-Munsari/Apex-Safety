---
phase: 07-ai-report-pipeline
plan: 08
subsystem: build/deps
tags: [gap-closure, pdf-render, dependencies, build]
requires:
  - "package.json declares @react-pdf/renderer ^4.5.1"
  - "package-lock.json pins integrity hashes for the @4.5.1 tree"
provides:
  - "node_modules/@react-pdf/renderer/ is materialised on disk"
  - "lib/pdf/generator.tsx static import resolves at compile + runtime"
  - "finalizeReport's dynamic import('@/lib/pdf/generator') no longer throws ERR_MODULE_NOT_FOUND"
  - "Closure pointer on the @react-pdf/renderer deferred-items.md entry"
affects:
  - "REPORT-05: branded PDF render path now reachable"
  - "REPORT-06: PDF storage upload path now reachable (gated only on a valid PDF buffer at runtime)"
  - "REPORT-09 runtime: Approve & Generate PDF CTA no longer crashes on the dynamic import"
  - "REPORT-10 runtime: n8n report_ready dispatch can fire after a successful PDF upload"
tech-stack:
  added: []
  patterns:
    - "Re-hydration via plain `npm install` (no `--force`, no `--legacy-peer-deps`, no version-bumping `npm install <pkg>`)"
key-files:
  created:
    - .planning/phases/07-ai-report-pipeline/07-08-SUMMARY.md
  modified:
    - .planning/phases/07-ai-report-pipeline/deferred-items.md
decisions:
  - "Plain `npm install` is the canonical fix for the missing dep — confirmed by deferred-items.md recommendation and validated end-to-end (renderer + build)"
  - "Used literal `https://stub.invalid` / `stub` env values for the build verification per the threat model T-07-08-03 mitigation (no real env paste)"
metrics:
  duration: ~2 min
  completed: 2026-05-29
---

# Phase 7 Plan 8: Gap closure — restore `@react-pdf/renderer` to node_modules

**One-liner:** Rehydrated `@react-pdf/renderer@4.5.1` via plain `npm install`, unblocking finalizeReport's PDF render path and producing a green `npm run build` (gap #2 from `07-VERIFICATION.md` is now closed).

## What Changed

- Ran `npm install` at the repo root. npm reported `changed 1 package, and audited 860 packages in 4s` — exactly one tree was rehydrated, consistent with the lockfile already pinning the correct version.
- No edits to `package.json` (specifier untouched at `"@react-pdf/renderer": "^4.5.1"`; `grep -c "@react-pdf/renderer" package.json` still returns 1).
- `package-lock.json` was NOT modified by the install (`git status package-lock.json` → clean). The fix lives entirely in `node_modules/` (untracked by git). This is the expected outcome when the lockfile already had complete metadata and only the on-disk install was broken.
- Annotated `deferred-items.md` `@react-pdf/renderer` entry as **CLOSED 2026-05-29** with a pointer back to this SUMMARY. The other (env-var) entry above it was left untouched per the plan's scope guard.

## Verification Evidence

### Acceptance gate 1 — package on disk
```
$ test -f node_modules/@react-pdf/renderer/package.json && echo PRESENT
PRESENT

$ head -3 node_modules/@react-pdf/renderer/package.json
{
  "name": "@react-pdf/renderer",
  "version": "4.5.1",
```

### Acceptance gate 2 — `renderToBuffer` callable
```
$ node -e "const m = require('@react-pdf/renderer'); if (typeof m.renderToBuffer !== 'function') { console.error('renderToBuffer is not a function'); process.exit(1); } console.log('renderToBuffer resolved');"
renderToBuffer resolved
```

This is the exact named export used by `lib/pdf/generator.tsx:2` (`import { renderToBuffer } from '@react-pdf/renderer'`), so the resolvability check directly covers the production code path.

### Acceptance gate 3 — `npm run build` no longer emits the module-not-found error

Build command actually run (env-stub workaround per Notes & Constraints — the SUPABASE_URL deferral remains in `deferred-items.md` unchanged):

```
SUPABASE_URL=https://stub.invalid SUPABASE_SERVICE_ROLE_KEY=stub \
NEXT_PUBLIC_SUPABASE_URL=https://stub.invalid NEXT_PUBLIC_SUPABASE_ANON_KEY=stub \
npm run build
```

Result:
```
▲ Next.js 16.2.4 (Turbopack)
- Environments: .env.local

  Creating an optimized production build ...
✓ Compiled successfully in 8.3s
  Running TypeScript ...
  Finished TypeScript in 10.6s ...
  Collecting page data using 11 workers ...
  Generating static pages using 11 workers (20/20) in 50s
  Finalizing page optimization ...

Route (app)
… 50+ routes printed, including ƒ /admin/assessments/[id]/review
… ending with a successful "Finalizing page optimization" line.
```

Grep assertion against the captured log:
```
$ grep -c "Can't resolve '@react-pdf/renderer'" /tmp/build.log
0
```

ZERO occurrences of the module-not-found string. The exact symptom logged in `deferred-items.md` (`Module not found: Can't resolve '@react-pdf/renderer'`) is gone.

> Note on the stub-env workaround: the build log contained a handful of `Dashboard stats error (…): TypeError: fetch failed` lines from the sidebar audit at SSG time — these are the documented SUPABASE_URL deferral surfacing at page-data collection (the stub URL is unreachable, so fetches fail). They are NOT the `@react-pdf/renderer` failure and they do not abort the build (compile succeeded, static pages generated 20/20, route table printed). The SUPABASE_URL deferral entry in `deferred-items.md` is intentionally left in place; closing it is out of scope for Plan 07-08.

## Plan Truth Confirmation

From the plan's `must_haves.truths`:

| Truth | Status |
|-------|--------|
| `@react-pdf/renderer` is resolvable from `node_modules` at runtime and build-time | CONFIRMED (acceptance gates 1+2) |
| `npm run build` completes without `Module not found: Can't resolve '@react-pdf/renderer'` | CONFIRMED (acceptance gate 3) |
| `finalizeReport`'s dynamic `import('@/lib/pdf/generator')` no longer throws ERR_MODULE_NOT_FOUND | CONFIRMED (the import chain `finalizeReport → @/lib/pdf/generator → @react-pdf/renderer` now resolves through Node's CJS resolver because every link is present; verified via the direct `require('@react-pdf/renderer')` node one-liner which exercises the same resolver) |

## Deviations from Plan

None. The plan executed exactly as written:
- Step 1 pre-condition matched (MISSING) → did NOT skip to Step 4.
- Step 2 `npm install` succeeded without peer-dependency conflicts.
- Step 3 post-install presence check passed.
- Step 4 `npm run build` succeeded with the documented env-stub workaround.

No deviation-rule fixes were needed (no bugs in adjacent code, no missing critical functionality, no blocking issues outside the documented env stub).

## Files Created / Modified

| File | Action | Notes |
|------|--------|-------|
| `.planning/phases/07-ai-report-pipeline/07-08-SUMMARY.md` | created | This file |
| `.planning/phases/07-ai-report-pipeline/deferred-items.md` | modified | `@react-pdf/renderer` entry annotated as CLOSED with back-pointer to this SUMMARY; the env-var entry above is untouched |
| `node_modules/@react-pdf/renderer/` | materialised (untracked) | The actual fix — npm rehydrated this tree from the existing lockfile |
| `package.json` | UNCHANGED | Specifier remains `^4.5.1` (verified via `grep -c` = 1) |
| `package-lock.json` | UNCHANGED | `git status` clean; lockfile already had the full @4.5.1 metadata, only the on-disk install was broken |

## Downstream Unblocking

This closes the runtime half of Phase 7's delivery promise. With `@react-pdf/renderer` resolvable:

- **REPORT-05/06:** `finalizeReport`'s render → upload chain can run end-to-end against a real Supabase + storage bucket.
- **REPORT-09 (runtime):** Matt's "Approve & Generate PDF" CTA no longer crashes inside the dynamic import.
- **REPORT-10 (runtime):** The signed-URL + n8n `report_ready` dispatch path is now reachable.

The two remaining `07-VERIFICATION.md` gaps (REPORT-08 `field_media.transcript` column missing, and REPORT-12 month-summary count-only display) are NOT addressed by this plan — they are tracked separately in `07-VERIFICATION.md` and are not in this plan's frontmatter `requirements`.

## Self-Check: PASSED

- `node_modules/@react-pdf/renderer/package.json` → PRESENT, `"name": "@react-pdf/renderer"`, `"version": "4.5.1"`.
- `require('@react-pdf/renderer').renderToBuffer` → callable (printed `renderToBuffer resolved`).
- `grep -c "Can't resolve '@react-pdf/renderer'" /tmp/build.log` → `0`.
- `grep -c "@react-pdf/renderer" package.json` → `1` (specifier unchanged).
- `deferred-items.md` `@react-pdf/renderer` entry now begins with `**CLOSED 2026-05-29**` and ends with a back-pointer to `07-08-SUMMARY.md`.
- The env-var entry in `deferred-items.md` is untouched (verified by file diff).
