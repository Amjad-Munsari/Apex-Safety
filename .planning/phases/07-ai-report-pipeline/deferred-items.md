# Phase 07 — Deferred Items (out-of-scope findings)

## Build-time env requirement: SUPABASE_URL missing in worktree
- **Found during:** Plan 07-01 overall `npm run build` verification
- **Symptom:** `Failed to collect page data for /admin/templates/[id]` with `cause: Error: supabaseUrl is required.`
- **Scope:** TypeScript compile + type-check PASS. Failure is at the Next.js page-data collection step (runtime) caused by an unset env var, NOT by Plan 07-01 code (the three files created live under `lib/ai/` and are not imported anywhere yet — they are consumed only by Plan 07-02).
- **Recommendation:** Either populate `.env.local` for the worktree before the wave-end gate, or stub the Supabase admin client to tolerate missing env at build time. Not in scope of Plan 07-01.

## Build-time module-not-found: `@react-pdf/renderer`
- **Found during:** Plan 07-06 post-Task-2 `npm run build` verification
- **Symptom:** `Module not found: Can't resolve '@react-pdf/renderer'` traced through `lib/pdf/generator.tsx:2` → `components/pdf/{proposal,report}-document.tsx` → various server actions.
- **Scope:** TypeScript `tsc --noEmit` PASS on the two Plan 07-06 files (`review-client.tsx`, `review/page.tsx`). The missing dep is a pre-existing repo state — `@react-pdf/renderer` is imported by Phase 6 PDF generator code that Plan 07-06 does not touch. Likely needs `npm install @react-pdf/renderer` in this checkout, or the dep is listed in package.json but the node_modules has drifted.
- **Recommendation:** Repo-level fix (run `npm install` or restore the missing dep). Out of Plan 07-06's single-file scope.
