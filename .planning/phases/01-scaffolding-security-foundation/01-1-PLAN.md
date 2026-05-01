---
wave: 1
depends_on: []
files_modified:
  - supabase/migrations/20240101000000_init.sql
  - lib/supabase/admin.ts
  - lib/supabase/server.ts
  - proxy.ts
  - middleware.ts
  - app/auth/login/page.tsx
  - app/auth/callback/route.ts
autonomous: true
---

# Phase 1: Scaffolding + Security Foundation

**Goal**: Establish the project infrastructure, database schema, security, and authentication so no breaking-change debt can be introduced by later phases.

<threat_model>
- Unauthorized access to client data. Mitigated by RLS policies checking `client_id` on all tables and storage.
- Admin bypass. Mitigated by `admin_users` table and server-side checks.
</threat_model>

<task type="execute">
<requirements>FOUND-01, OPS-05</requirements>
<instruction>Document the manual steps required to fulfill FOUND-01 and OPS-05.</instruction>
<read_first>
- .planning/PROJECT.md
</read_first>
<action>
1. Update `.planning/PROJECT.md` to document that the Supabase project MUST be created in the `eu-west-2` (London) region.
2. Add a note in `.planning/PROJECT.md` that the Twilio UK sender ID "888Safety" registration process has been initiated.
</action>
<acceptance_criteria>
- `.planning/PROJECT.md` contains "eu-west-2".
- `.planning/PROJECT.md` contains "888Safety".
</acceptance_criteria>
</task>

<task type="execute">
<requirements>FOUND-02</requirements>
<instruction>Create the admin service-role Supabase client.</instruction>
<read_first>
- lib/supabase/admin.ts
</read_first>
<action>
1. Create `lib/supabase/admin.ts`.
2. Add `import "server-only";` at the very top.
3. Export a configured Supabase client using `@supabase/ssr` or `@supabase/supabase-js` that utilizes the `SUPABASE_SERVICE_ROLE_KEY`.
</action>
<acceptance_criteria>
- `lib/supabase/admin.ts` exists and contains `import "server-only";`.
</acceptance_criteria>
</task>

<task type="execute">
<requirements>FOUND-03</requirements>
<instruction>Apply the Next.js 16 codemod.</instruction>
<read_first>
- middleware.ts
- proxy.ts
</read_first>
<action>
1. Delete `middleware.ts` if it exists.
2. Create `proxy.ts` in the root (or src) replacing `middleware.ts` logic for session management using the new Next.js 16 patterns.
3. Ensure the project does not contain `@supabase/auth-helpers-nextjs` and only uses `@supabase/ssr`.
</action>
<acceptance_criteria>
- `proxy.ts` exists.
</acceptance_criteria>
</task>

<task type="execute">
<requirements>FOUND-04, FOUND-05, FOUND-06</requirements>
<instruction>Create the initial schema migration and storage buckets.</instruction>
<read_first>
- supabase/migrations/20240101000000_init.sql
</read_first>
<action>
1. Create a migration file `supabase/migrations/20240101000000_init.sql` (or similar timestamp).
2. Define the tables: `clients`, `client_users`, `admin_users`, `documents`, `form_templates`, `template_versions`, `form_submissions`, `field_media`, `notifications_sent`, `workflow_errors`, `hours_transactions`.
3. Add `deleted_at timestamptz` to every table.
4. Enable RLS on all tables.
5. Create policies so `client_users` can only read data associated with their `client_id`.
6. Create buckets: `client-documents`, `reports`, `proposals`, `form-media` (private), and `brand-assets` (public).
7. Add storage RLS checking `(storage.foldername(name))[1] = get_user_client_id(auth.uid()::uuid)::text`.
</action>
<acceptance_criteria>
- Migration SQL file exists and contains `create table clients`, `create table admin_users`, etc.
- Migration SQL file contains `deleted_at timestamptz` for all tables.
- Migration SQL file contains `create policy` for RLS.
- Migration SQL file contains `insert into storage.buckets` for the required buckets.
</acceptance_criteria>
</task>

<task type="execute" autonomous="false">
<requirements>FOUND-08</requirements>
<instruction>Push the schema to local Supabase and generate types.</instruction>
<read_first>
- supabase/migrations/
</read_first>
<action>
1. Run `npx supabase db push`.
2. Run `npx supabase gen types typescript --local > types/supabase.ts` (or similar path).
</action>
<acceptance_criteria>
- `types/supabase.ts` exists and contains type definitions for `clients`, `admin_users`, etc.
</acceptance_criteria>
</task>

<task type="execute">
<requirements>AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06, AUTH-07</requirements>
<instruction>Implement authentication routes and flows.</instruction>
<read_first>
- app/auth/login/page.tsx
- app/auth/callback/route.ts
- lib/supabase/server.ts
</read_first>
<action>
1. Create `lib/supabase/server.ts` to instantiate the `@supabase/ssr` server client.
2. Create `app/auth/login/page.tsx` with email/password login and magic-link request forms.
3. Create `app/auth/callback/route.ts` to exchange Auth code for session.
4. Implement a server action or route handler to sign out.
5. Create helper functions to check membership in `admin_users`.
</action>
<acceptance_criteria>
- `app/auth/login/page.tsx` exists.
- `app/auth/callback/route.ts` exists.
</acceptance_criteria>
</task>

<task type="execute">
<requirements>FOUND-07</requirements>
<instruction>Create the security integration tests.</instruction>
<read_first>
- tests/security.spec.ts
</read_first>
<action>
1. Create a Playwright integration test at `tests/security.spec.ts`.
2. Write a test asserting that a logged-out request for a signed/unsigned Storage URL returns a 403 status.
3. Write a test asserting that importing `lib/supabase/admin.ts` from a Client Component causes a build error (or simulate it).
4. Write a test asserting cross-tenant reads return 0 rows.
</action>
<acceptance_criteria>
- `tests/security.spec.ts` exists and contains tests for 403 Storage URL, Client B's rows, and admin.ts import.
</acceptance_criteria>
</task>

<schema_push_requirement>
**[BLOCKING] Schema Push Required**
The database schema must be pushed after creation so that types can be generated.
</schema_push_requirement>

## Verification

### Must Haves
- Unauthenticated requests to Storage URLs return 403.
- `lib/supabase/admin.ts` has `import "server-only"`.
- `proxy.ts` exists.
- All 11 base tables are created with `deleted_at`.
- Supabase types are generated and committed.

### Verification Steps
1. Run `npx playwright test tests/security.spec.ts`. It must pass.
2. Check `types/supabase.ts` for the 11 tables.
3. Check `lib/supabase/admin.ts` for `"server-only"`.
