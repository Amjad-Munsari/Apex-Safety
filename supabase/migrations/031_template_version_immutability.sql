-- Published and referenced form versions are records of what was actually
-- assigned and submitted. Application saves already append a new row; no
-- signed-in user needs UPDATE or DELETE on template_versions.
--
-- service_role deliberately keeps its RLS bypass for migrations and controlled
-- fixture cleanup. Public/admin/customer application sessions get only the
-- minimum SELECT/INSERT access their append-only flows require.

drop policy if exists "template_versions_admin_all" on public.template_versions;
drop policy if exists "template_versions_admin_select" on public.template_versions;
drop policy if exists "template_versions_admin_insert" on public.template_versions;
drop policy if exists "template_versions_client_own_update" on public.template_versions;

create policy "template_versions_admin_select"
  on public.template_versions
  for select
  using (
    exists (
      select 1
      from public.admin_users au
      where au.id = auth.uid()
    )
  );

create policy "template_versions_admin_insert"
  on public.template_versions
  for insert
  with check (
    exists (
      select 1
      from public.admin_users au
      where au.id = auth.uid()
    )
  );

-- App code never rewrites an existing version. This trigger also protects
-- published/referenced history from accidental service-role UPDATEs while still
-- allowing controlled fixture deletion through service_role.
create or replace function public.prevent_material_template_version_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.published_at is not null
     or exists (
       select 1
       from public.form_assignments fa
       where fa.template_version_id = old.id
     )
     or exists (
       select 1
       from public.form_submissions fs
       where fs.template_version_id = old.id
     )
  then
    raise exception 'Published or referenced template versions are immutable'
      using errcode = '55000';
  end if;

  return new;
end;
$$;

drop trigger if exists template_versions_prevent_material_update
  on public.template_versions;

create trigger template_versions_prevent_material_update
before update on public.template_versions
for each row
execute function public.prevent_material_template_version_update();

revoke all on function public.prevent_material_template_version_update()
  from public, anon, authenticated;

-- Template rows are also historical parents: hard-deleting one cascades into
-- every template_versions row. Application "delete" actions now set deleted_at,
-- so signed-in users need SELECT/INSERT/UPDATE but never DELETE.
drop policy if exists "form_templates_admin_all" on public.form_templates;
drop policy if exists "form_templates_admin_select" on public.form_templates;
drop policy if exists "form_templates_admin_insert" on public.form_templates;
drop policy if exists "form_templates_admin_update" on public.form_templates;
drop policy if exists "form_templates_client_own_delete" on public.form_templates;

create policy "form_templates_admin_select"
  on public.form_templates
  for select
  using (
    exists (
      select 1
      from public.admin_users au
      where au.id = auth.uid()
    )
  );

create policy "form_templates_admin_insert"
  on public.form_templates
  for insert
  with check (
    owner_type = 'admin'
    and exists (
      select 1
      from public.admin_users au
      where au.id = auth.uid()
    )
  );

create policy "form_templates_admin_update"
  on public.form_templates
  for update
  using (
    owner_type = 'admin'
    and exists (
      select 1
      from public.admin_users au
      where au.id = auth.uid()
    )
  )
  with check (
    owner_type = 'admin'
    and exists (
      select 1
      from public.admin_users au
      where au.id = auth.uid()
    )
  );
