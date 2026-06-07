# Phase 1: Validation Strategy

**Date:** 2026-04-29
**Phase:** 1 - Scaffolding + Security Foundation

## Validation Architecture

1. **Test Environment:** 
   - Local Next.js server (`npm run dev`)
   - Local Supabase instance (`npx supabase start`)

2. **Integration Testing:**
   - Attempt to fetch signed/unsigned Supabase Storage URL while logged out -> expect 403.
   - Attempt to fetch Client B's data while logged in as Client A -> expect 0 rows.
   - Import `lib/supabase/admin.ts` into a client component -> expect build error.

3. **Functionality Verification:**
   - Ensure all 11 tables exist in the local database.
   - Test admin sign in (email/password).
   - Test client magic link sign in.
   - Test sign out.

## Nyquist Criteria

- [ ] Dimension 8: Validation is automated where possible, manual only where necessary.
