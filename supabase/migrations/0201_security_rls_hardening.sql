-- 020_security_rls_hardening.sql
-- Security audit 2026-06-07 remediation (DB layer).
--
-- 1. Admin RLS was DEAD: every *_admin_all policy keyed on
--    auth.jwt()->'app_metadata'->>'role' = 'admin', a claim that nothing in the
--    app ever sets. So RLS granted admins nothing and the app was forced onto
--    the service-role client (RLS bypass) with code-level isAdmin() as the only
--    gate. Rewrite admin policies to check the real admin_users table so RLS is
--    a genuine defense-in-depth layer again. (auth_users_self_select already
--    permits the self-lookup, so the EXISTS subquery does not recurse.)
--
-- 2. Client SELECT policies referenced status vocabularies that never match the
--    values the app stores, so they silently granted nothing:
--      - proposals: policy wanted lowercase 'sent'/'contract_signed'; app stores
--        title-case 'Sent'/'Signed'/'Contract Issued'.
--      - form_submissions: policy wanted status='delivered'; app uses
--        'submitted'/'completed'/'draft'. This also broke the RLS-bound client
--        submission viewer in production (it could read nothing).
--
-- 3. form_submissions client UPDATE had no WITH CHECK, so the post-update row was
--    unconstrained (a client could re-assign their draft to another org).
--
-- All changes are corrective/defense-in-depth. The service-role client bypasses
-- RLS regardless, so admin app flows are unaffected.

-- ── 1. Admin policies → real admin_users check ──────────────────────────────

drop policy if exists "client_users_admin_all" on public.client_users;
create policy "client_users_admin_all" on public.client_users for all
  using (exists (select 1 from public.admin_users au where au.id = auth.uid()))
  with check (exists (select 1 from public.admin_users au where au.id = auth.uid()));

drop policy if exists "clients_admin_all" on public.clients;
create policy "clients_admin_all" on public.clients for all
  using (exists (select 1 from public.admin_users au where au.id = auth.uid()))
  with check (exists (select 1 from public.admin_users au where au.id = auth.uid()));

drop policy if exists "documents_admin_all" on public.documents;
create policy "documents_admin_all" on public.documents for all
  using (exists (select 1 from public.admin_users au where au.id = auth.uid()))
  with check (exists (select 1 from public.admin_users au where au.id = auth.uid()));

drop policy if exists "form_assignments_admin_all" on public.form_assignments;
create policy "form_assignments_admin_all" on public.form_assignments for all
  using (exists (select 1 from public.admin_users au where au.id = auth.uid()))
  with check (exists (select 1 from public.admin_users au where au.id = auth.uid()));

drop policy if exists "form_submissions_admin_all" on public.form_submissions;
create policy "form_submissions_admin_all" on public.form_submissions for all
  using (exists (select 1 from public.admin_users au where au.id = auth.uid()))
  with check (exists (select 1 from public.admin_users au where au.id = auth.uid()));

drop policy if exists "form_templates_admin_all" on public.form_templates;
create policy "form_templates_admin_all" on public.form_templates for all
  using (exists (select 1 from public.admin_users au where au.id = auth.uid()))
  with check (exists (select 1 from public.admin_users au where au.id = auth.uid()));

drop policy if exists "hours_transactions_admin_all" on public.hours_transactions;
create policy "hours_transactions_admin_all" on public.hours_transactions for all
  using (exists (select 1 from public.admin_users au where au.id = auth.uid()))
  with check (exists (select 1 from public.admin_users au where au.id = auth.uid()));

drop policy if exists "proposals_admin_all" on public.proposals;
create policy "proposals_admin_all" on public.proposals for all
  using (exists (select 1 from public.admin_users au where au.id = auth.uid()))
  with check (exists (select 1 from public.admin_users au where au.id = auth.uid()));

drop policy if exists "services_admin_all" on public.services;
create policy "services_admin_all" on public.services for all
  using (exists (select 1 from public.admin_users au where au.id = auth.uid()))
  with check (exists (select 1 from public.admin_users au where au.id = auth.uid()));

drop policy if exists "template_versions_admin_all" on public.template_versions;
create policy "template_versions_admin_all" on public.template_versions for all
  using (exists (select 1 from public.admin_users au where au.id = auth.uid()))
  with check (exists (select 1 from public.admin_users au where au.id = auth.uid()));

drop policy if exists "workflow_errors_admin_all" on public.workflow_errors;
create policy "workflow_errors_admin_all" on public.workflow_errors for all
  using (exists (select 1 from public.admin_users au where au.id = auth.uid()))
  with check (exists (select 1 from public.admin_users au where au.id = auth.uid()));

drop policy if exists "notifications_sent_admin_select" on public.notifications_sent;
create policy "notifications_sent_admin_select" on public.notifications_sent for select
  using (exists (select 1 from public.admin_users au where au.id = auth.uid()));

-- ── 2. Client SELECT policies → match the statuses the app actually stores ──

drop policy if exists "proposals_client_visible" on public.proposals;
create policy "proposals_client_visible" on public.proposals for select
  using (
    status = any (array['Sent', 'Signed', 'Contract Issued'])
    and client_id in (select client_id from public.client_users where id = auth.uid())
  );

-- Replace the never-matching status='delivered' policy with own-rows access.
-- A client may read their OWN submissions (any status — they own them); the
-- app's code-level filters decide what's shown. Cross-tenant is still blocked.
drop policy if exists "form_submissions_client_delivered" on public.form_submissions;
create policy "form_submissions_client_own_select" on public.form_submissions for select
  using (client_id in (select client_id from public.client_users where id = auth.uid()));

-- ── 3. form_submissions client UPDATE → add WITH CHECK ──────────────────────

drop policy if exists "form_submissions_client_update_draft" on public.form_submissions;
create policy "form_submissions_client_update_draft" on public.form_submissions for update
  using (
    status = 'draft'
    and client_id in (select client_id from public.client_users where id = auth.uid())
  )
  with check (
    client_id in (select client_id from public.client_users where id = auth.uid())
  );
