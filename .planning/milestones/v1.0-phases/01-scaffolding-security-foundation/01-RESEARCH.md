# Phase 1: Scaffolding + Security Foundation - Research

## Technical Approach

### 1. Supabase Initialization
- Create Supabase project in eu-west-2 region manually or via CLI (as noted in FOUND-01, this must be done once at the beginning).
- Enable Auth providers: Email, Magic Link.
- Generate and store `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in environment variables.

### 2. Next.js 16 Codemod & Setup
- `middleware.ts` is deprecated in Next.js 16. Replace it with `proxy.ts`.
- Ensure all request APIs (`cookies()`, `headers()`) are `await`ed, as they are async in Next.js 16.
- The `revalidateTag` signature requires updating to Next.js 16 patterns.

### 3. Server-Only Admin Client
- Create `lib/supabase/admin.ts`.
- Add `import "server-only";` at the very top.
- Export a Supabase client instantiated with `SUPABASE_SERVICE_ROLE_KEY` to bypass RLS. This client must never be imported into client components.

### 4. Database Schema (Migration 001)
- Create migration script containing 11 tables: `clients`, `client_users`, `admin_users`, `documents`, `form_templates`, `template_versions`, `form_submissions`, `field_media`, `notifications_sent`, `workflow_errors`, `hours_transactions`.
- Every table MUST have a `deleted_at` column of type `timestamptz` (soft-delete).
- Create `admin_users` table to enforce admin access checking server-side.

### 5. Row-Level Security (RLS)
- RLS must be enabled on all tables holding client data.
- Standard client access policy: `auth.uid()` matches the user's mapped `client_id` via `client_users`.
- Cross-tenant reads: Ensure policy explicitly restricts rows where `client_id` != user's `client_id`.

### 6. Storage Buckets
- Buckets to create:
  - `client-documents` (private)
  - `reports` (private)
  - `proposals` (private)
  - `form-media` (private)
  - `brand-assets` (public)
- Storage RLS: Check `storage.foldername(name)[1]` against the caller's `client_id`. Example policy for read access:
  ```sql
  create policy "Client can read own folder"
  on storage.objects for select
  using ( bucket_id = 'reports' and (storage.foldername(name))[1] = get_user_client_id(auth.uid()::uuid)::text );
  ```

### 7. Auth Flows
- Use `@supabase/ssr` to configure Next.js app router auth.
- Admin login: standard email/password form.
- Client invite: utilize Supabase Admin API to invite user via magic link.
- Session sign-out: Route handler or server action that calls `supabase.auth.signOut()`.

### 8. Twilio Sender ID Registration
- Initiate registration of UK sender ID "888Safety". This is an external process and requires logging in to Twilio console and submitting the regulatory bundle/sender ID request.

## Dependencies & Blockers
- **Blocker:** FOUND-01 (Supabase region lock).
- **Blocker:** OPS-05 (Twilio sender ID).
