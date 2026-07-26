-- A template is not usable without version 1. Create both rows inside one
-- database function so a version insert failure rolls the template insert back
-- instead of leaving an orphan that the UI reports as successfully created.

create or replace function public.create_customer_template_with_initial_version(
  p_name text,
  p_client_id uuid
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_client_id uuid;
  v_template_id uuid;
  v_name text := btrim(p_name);
begin
  if v_name is null or char_length(v_name) = 0 or char_length(v_name) > 160 then
    raise exception 'Template name must contain between 1 and 160 characters'
      using errcode = '22023';
  end if;

  if v_user_id is null then
    -- Development demo mode uses the service role without an Auth user. The
    -- production server disables demo mode, and no public role receives this
    -- branch's privilege.
    if auth.role() <> 'service_role' then
      raise exception 'Authentication required' using errcode = '42501';
    end if;

    select c.id
      into v_client_id
      from public.clients c
     where c.id = p_client_id
       and c.active = true
       and c.deleted_at is null;
  else
    select cu.client_id
      into v_client_id
      from public.client_users cu
      join public.clients c on c.id = cu.client_id
     where cu.id = v_user_id
       and cu.client_id = p_client_id
       and c.active = true
       and c.deleted_at is null;
  end if;

  if v_client_id is null then
    raise exception 'Active client membership required' using errcode = '42501';
  end if;

  insert into public.form_templates (
    name,
    template_type,
    owner_id,
    owner_type
  )
  values (
    v_name,
    'custom',
    v_client_id,
    'customer'
  )
  returning id into v_template_id;

  insert into public.template_versions (
    template_id,
    version_number,
    schema_json,
    created_by
  )
  values (
    v_template_id,
    1,
    jsonb_build_object(
      'entities', jsonb_build_object(),
      'root', jsonb_build_array()
    ),
    v_user_id
  );

  return v_template_id;
end;
$$;

create or replace function public.create_admin_template_with_initial_version(
  p_name text,
  p_template_type text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_template_id uuid;
  v_name text := btrim(p_name);
  v_template_type text := btrim(p_template_type);
begin
  if v_name is null or char_length(v_name) = 0 or char_length(v_name) > 160 then
    raise exception 'Template name must contain between 1 and 160 characters'
      using errcode = '22023';
  end if;

  if v_template_type is null or char_length(v_template_type) = 0 then
    raise exception 'Template type is required' using errcode = '22023';
  end if;

  if v_user_id is null
     or not exists (
       select 1
         from public.admin_users au
        where au.id = v_user_id
     )
  then
    raise exception 'Active admin membership required' using errcode = '42501';
  end if;

  insert into public.form_templates (
    name,
    template_type,
    owner_id,
    owner_type
  )
  values (
    v_name,
    v_template_type,
    v_user_id,
    'admin'
  )
  returning id into v_template_id;

  insert into public.template_versions (
    template_id,
    version_number,
    schema_json,
    created_by
  )
  values (
    v_template_id,
    1,
    jsonb_build_object(
      'entities', jsonb_build_object(),
      'root', jsonb_build_array()
    ),
    v_user_id
  );

  return v_template_id;
end;
$$;

revoke all on function public.create_customer_template_with_initial_version(text, uuid)
  from public, anon, authenticated;
revoke all on function public.create_admin_template_with_initial_version(text, text)
  from public, anon, authenticated;

grant execute on function public.create_customer_template_with_initial_version(text, uuid)
  to authenticated, service_role;
grant execute on function public.create_admin_template_with_initial_version(text, text)
  to authenticated;
