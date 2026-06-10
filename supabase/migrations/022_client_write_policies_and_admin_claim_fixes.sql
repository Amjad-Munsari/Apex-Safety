-- ─────────────────────────────────────────────────────────────────────────────
-- 022_client_write_policies_and_admin_claim_fixes.sql
--
-- Two clusters of RLS fixes found by the 2026-06-10 security audit:
--
-- A. form_assignments had NO client UPDATE/INSERT policy (001 gave clients
--    SELECT only). Every client-session write to the table silently no-oped
--    at the DB layer (RLS suppresses rows, returns no error):
--      - transitionAssignmentStatus: assignments never flipped to
--        in_progress/completed when a client filled a form
--      - forkAssignedTemplate: the fork succeeded but the assignment was never
--        rewired to the fork — the client kept filling the master template
--      - inline recurrence: the claim-stamp UPDATE and the next-occurrence
--        INSERT both no-oped (cron PASS B, running service-role, was the only
--        path that ever generated occurrences)
--
-- B. Dead-JWT-claim admin policies. 020_security_rls_hardening replaced
--    `app_metadata.role = 'admin'` (a claim the app never sets) with a real
--    admin_users membership check on 11 tables, but missed proposal_signatures
--    (added by the parallel 020_proposal_signing migration) and all five
--    storage.objects admin policies from 001. Those policies never matched, so
--    the RLS layer offered no admin governance on those objects at all.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── A1. form_assignments: client UPDATE (own org only, org pinned) ──────────
-- WITH CHECK keeps client_id inside the caller's org so a row can never be
-- reassigned to another tenant.

drop policy if exists "form_assignments_client_update" on public.form_assignments;
create policy "form_assignments_client_update" on public.form_assignments for update
  using (client_id in (select client_id from public.client_users where id = auth.uid()))
  with check (client_id in (select client_id from public.client_users where id = auth.uid()));

-- ── A2. form_assignments: client INSERT (inline recurrence) ─────────────────
-- generateNextOccurrence runs inside the submitting client's session; the new
-- occurrence row must carry the caller's own client_id.

drop policy if exists "form_assignments_client_insert" on public.form_assignments;
create policy "form_assignments_client_insert" on public.form_assignments for insert
  with check (client_id in (select client_id from public.client_users where id = auth.uid()));

-- ── A3. form_submissions INSERT: assignment must belong to the same org ─────
-- The 001 policy only pinned client_id, so a client could INSERT a submission
-- referencing ANOTHER org's assignment_id (cross-tenant reference pollution in
-- admin views). NULL assignment_id (customer self-fill, D-16) stays allowed.

drop policy if exists "form_submissions_client_insert" on public.form_submissions;
create policy "form_submissions_client_insert" on public.form_submissions for insert
  with check (
    client_id in (select client_id from public.client_users where id = auth.uid())
    and (
      assignment_id is null
      or exists (
        select 1 from public.form_assignments fa
        where fa.id = form_submissions.assignment_id
          and fa.client_id = form_submissions.client_id
      )
    )
  );

-- ── A4. form_submissions client UPDATE: pin the reachable status values ─────
-- The 020 WITH CHECK pinned client_id but not status, so a client could flip
-- their draft straight to 'completed'/'delivered' via a raw PostgREST call,
-- skipping the app's submit pipeline (validation, scrub, webhook). Clients may
-- only keep a row at 'draft' (autosave) or advance it to 'submitted'.

drop policy if exists "form_submissions_client_update_draft" on public.form_submissions;
create policy "form_submissions_client_update_draft" on public.form_submissions for update
  using (
    status = 'draft'
    and client_id in (select client_id from public.client_users where id = auth.uid())
  )
  with check (
    client_id in (select client_id from public.client_users where id = auth.uid())
    and status in ('draft', 'submitted')
  );

-- ── B1. proposal_signatures: live admin check ────────────────────────────────

drop policy if exists "proposal_signatures_admin_select" on public.proposal_signatures;
create policy "proposal_signatures_admin_select" on public.proposal_signatures for select
  using (exists (select 1 from public.admin_users au where au.id = auth.uid()));

-- ── B2. storage.objects: live admin checks (same bucket scoping as 001) ─────

drop policy if exists "client_documents_admin_all" on storage.objects;
create policy "client_documents_admin_all" on storage.objects for all
  using (
    bucket_id = 'client-documents'
    and exists (select 1 from public.admin_users au where au.id = auth.uid())
  );

drop policy if exists "reports_admin_all" on storage.objects;
create policy "reports_admin_all" on storage.objects for all
  using (
    bucket_id = 'reports'
    and exists (select 1 from public.admin_users au where au.id = auth.uid())
  );

drop policy if exists "proposals_storage_admin_all" on storage.objects;
create policy "proposals_storage_admin_all" on storage.objects for all
  using (
    bucket_id = 'proposals'
    and exists (select 1 from public.admin_users au where au.id = auth.uid())
  );

drop policy if exists "form_media_admin_all" on storage.objects;
create policy "form_media_admin_all" on storage.objects for all
  using (
    bucket_id = 'form-media'
    and exists (select 1 from public.admin_users au where au.id = auth.uid())
  );

drop policy if exists "brand_assets_admin_manage" on storage.objects;
create policy "brand_assets_admin_manage" on storage.objects for all
  using (
    bucket_id = 'brand-assets'
    and exists (select 1 from public.admin_users au where au.id = auth.uid())
  );
