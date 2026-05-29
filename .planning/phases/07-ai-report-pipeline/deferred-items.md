# Phase 07 — Deferred Items (out-of-scope findings)

## Build-time env requirement: SUPABASE_URL missing in worktree
- **Found during:** Plan 07-01 overall `npm run build` verification
- **Symptom:** `Failed to collect page data for /admin/templates/[id]` with `cause: Error: supabaseUrl is required.`
- **Scope:** TypeScript compile + type-check PASS. Failure is at the Next.js page-data collection step (runtime) caused by an unset env var, NOT by Plan 07-01 code (the three files created live under `lib/ai/` and are not imported anywhere yet — they are consumed only by Plan 07-02).
- **Recommendation:** Either populate `.env.local` for the worktree before the wave-end gate, or stub the Supabase admin client to tolerate missing env at build time. Not in scope of Plan 07-01.
