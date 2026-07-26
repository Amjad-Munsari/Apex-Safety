-- PayPal credentials are operational configuration. A rotation creates a new
-- immutable Vault record rather than replacing the one an already-approved
-- order may still need for capture.

alter table public.app_settings
  add column if not exists paypal_enabled boolean not null default false,
  add column if not exists paypal_mode text not null default 'live',
  add column if not exists paypal_client_id_hint text,
  add column if not exists paypal_verified_at timestamptz,
  add column if not exists paypal_credentials_updated_at timestamptz,
  add column if not exists paypal_config_version bigint;

alter table public.app_settings
  drop constraint if exists app_settings_paypal_mode_check,
  add constraint app_settings_paypal_mode_check
    check (paypal_mode in ('sandbox', 'live')),
  drop constraint if exists app_settings_paypal_client_id_hint_check,
  add constraint app_settings_paypal_client_id_hint_check
    check (paypal_client_id_hint is null or char_length(paypal_client_id_hint) between 1 and 8);

create table if not exists public.paypal_runtime_credential_versions (
  config_version bigint primary key,
  vault_secret_name text not null unique,
  paypal_mode text not null check (paypal_mode in ('sandbox', 'live')),
  created_at timestamptz not null default now()
);

create table if not exists public.paypal_pending_checkouts (
  order_id text primary key check (char_length(order_id) between 1 and 255),
  client_id uuid not null references public.clients(id) on delete cascade,
  package_id text not null check (char_length(package_id) between 1 and 100),
  config_version bigint not null references public.paypal_runtime_credential_versions(config_version),
  paypal_mode text not null check (paypal_mode in ('sandbox', 'live')),
  created_at timestamptz not null default now(),
  credited_at timestamptz
);

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_constraint
     where conname = 'app_settings_paypal_config_version_fkey'
       and conrelid = 'public.app_settings'::regclass
  ) then
    alter table public.app_settings
      add constraint app_settings_paypal_config_version_fkey
      foreign key (paypal_config_version)
      references public.paypal_runtime_credential_versions(config_version);
  end if;
end;
$$;

alter table public.paypal_runtime_credential_versions enable row level security;
alter table public.paypal_pending_checkouts enable row level security;
revoke all on table public.paypal_runtime_credential_versions, public.paypal_pending_checkouts
  from public, anon, authenticated;

-- Writes the credential pair and its non-secret metadata in one database
-- transaction. The advisory lock serializes version allocation and first-save
-- races, while PostgreSQL rolls back the Vault record if metadata cannot commit.
create or replace function public.set_paypal_runtime_credentials(
  p_client_id text,
  p_client_secret text,
  p_mode text
)
returns table (
  enabled boolean,
  paypal_mode text,
  client_id_hint text,
  verified_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_client_id text := btrim(p_client_id);
  v_client_secret text := btrim(p_client_secret);
  v_mode text := lower(btrim(p_mode));
  v_payload text;
  v_version bigint;
  v_secret_name text;
  v_now timestamptz := pg_catalog.now();
  v_hint text;
  v_enabled boolean := true;
begin
  if v_mode is null or v_mode not in ('sandbox', 'live') then
    raise exception 'paypal_mode_invalid' using errcode = '22023';
  end if;
  if v_client_id is null or char_length(v_client_id) not between 1 and 512
     or v_client_id ~ '[[:cntrl:]]' then
    raise exception 'paypal_client_id_invalid' using errcode = '22023';
  end if;
  if v_client_secret is null or char_length(v_client_secret) not between 1 and 1024
     or v_client_secret ~ '[[:cntrl:]]' then
    raise exception 'paypal_client_secret_invalid' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('merlin_paypal_runtime_credentials', 0)
  );

  -- A first connection starts enabled. On rotation, preserve Matt's current
  -- pause state instead of silently reopening new payment creation.
  select s.paypal_enabled into v_enabled
    from public.app_settings as s
   where s.id = 1
     and s.paypal_config_version is not null;
  v_enabled := coalesce(v_enabled, true);

  select coalesce(max(v.config_version), 0) + 1
    into v_version
    from public.paypal_runtime_credential_versions as v;
  v_secret_name := 'merlin_paypal_runtime_credentials_v' || v_version::text;
  v_payload := pg_catalog.jsonb_build_object(
    'client_id', v_client_id,
    'client_secret', v_client_secret
  )::text;
  v_hint := '…' || pg_catalog.right(v_client_id, 4);

  perform vault.create_secret(
    v_payload,
    v_secret_name,
    '888 Safety PayPal runtime credentials version ' || v_version::text
  );

  insert into public.paypal_runtime_credential_versions (
    config_version,
    vault_secret_name,
    paypal_mode
  ) values (v_version, v_secret_name, v_mode);

  insert into public.app_settings (
    id,
    paypal_enabled,
    paypal_mode,
    paypal_client_id_hint,
    paypal_verified_at,
    paypal_credentials_updated_at,
    paypal_config_version,
    updated_at
  ) values (1, v_enabled, v_mode, v_hint, v_now, v_now, v_version, v_now)
  on conflict (id) do update
    set paypal_enabled = excluded.paypal_enabled,
        paypal_mode = excluded.paypal_mode,
        paypal_client_id_hint = excluded.paypal_client_id_hint,
        paypal_verified_at = excluded.paypal_verified_at,
        paypal_credentials_updated_at = excluded.paypal_credentials_updated_at,
        paypal_config_version = excluded.paypal_config_version,
        updated_at = excluded.updated_at;

  return query select v_enabled, v_mode, v_hint, v_now;
end;
$$;

-- Returns the active pair only to server-side service-role code. It always
-- emits one row after this migration so callers can distinguish unconfigured
-- from an old deployment that genuinely lacks these RPCs.
create or replace function public.get_paypal_runtime_credentials()
returns table (
  configured boolean,
  enabled boolean,
  paypal_mode text,
  client_id text,
  client_secret text,
  revision text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_enabled boolean := false;
  v_mode text := 'live';
  v_version bigint;
  v_secret_name text;
  v_payload text;
  v_json jsonb;
  v_client_id text;
  v_client_secret text;
begin
  select s.paypal_enabled, s.paypal_mode, s.paypal_config_version, v.vault_secret_name
    into v_enabled, v_mode, v_version, v_secret_name
    from public.app_settings as s
    left join public.paypal_runtime_credential_versions as v
      on v.config_version = s.paypal_config_version
   where s.id = 1;

  if v_secret_name is null then
    return query select false, false, coalesce(v_mode, 'live'), null::text, null::text, null::text;
    return;
  end if;

  select ds.decrypted_secret into v_payload
    from vault.decrypted_secrets as ds
   where ds.name = v_secret_name
   limit 1;
  if v_payload is null then
    raise exception 'paypal_credentials_missing' using errcode = '22023';
  end if;

  begin
    v_json := v_payload::jsonb;
    v_client_id := v_json ->> 'client_id';
    v_client_secret := v_json ->> 'client_secret';
  exception when others then
    raise exception 'paypal_credentials_corrupt' using errcode = '22023';
  end;
  if v_client_id is null or v_client_secret is null then
    raise exception 'paypal_credentials_corrupt' using errcode = '22023';
  end if;

  return query select true, coalesce(v_enabled, false), coalesce(v_mode, 'live'),
    v_client_id, v_client_secret, v_version::text;
end;
$$;

-- Resolves the historical credentials attached to a checkout. Mapping data is
-- server-only, and a missing mapping deliberately signals the legacy fallback
-- path for orders created before this migration.
create or replace function public.get_paypal_checkout_runtime_config(p_order_id text)
returns table (
  mapped boolean,
  pending_client_id uuid,
  pending_package_id text,
  paypal_mode text,
  config_version bigint,
  paypal_client_id text,
  paypal_client_secret text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_client_id uuid;
  v_package_id text;
  v_mode text;
  v_version bigint;
  v_secret_name text;
  v_payload text;
  v_json jsonb;
  v_paypal_client_id text;
  v_paypal_client_secret text;
begin
  if p_order_id is null or char_length(p_order_id) not between 1 and 255 then
    raise exception 'paypal_order_id_invalid' using errcode = '22023';
  end if;

  select p.client_id, p.package_id, p.paypal_mode, p.config_version, v.vault_secret_name
    into v_client_id, v_package_id, v_mode, v_version, v_secret_name
    from public.paypal_pending_checkouts as p
    join public.paypal_runtime_credential_versions as v
      on v.config_version = p.config_version
   where p.order_id = p_order_id;

  if not found then
    return query select false, null::uuid, null::text, null::text, null::bigint, null::text, null::text;
    return;
  end if;
  if v_mode is distinct from (select v.paypal_mode from public.paypal_runtime_credential_versions as v where v.config_version = v_version) then
    raise exception 'paypal_checkout_config_corrupt' using errcode = '22023';
  end if;

  select ds.decrypted_secret into v_payload
    from vault.decrypted_secrets as ds
   where ds.name = v_secret_name
   limit 1;
  if v_payload is null then
    raise exception 'paypal_checkout_credentials_missing' using errcode = '22023';
  end if;
  begin
    v_json := v_payload::jsonb;
    v_paypal_client_id := v_json ->> 'client_id';
    v_paypal_client_secret := v_json ->> 'client_secret';
  exception when others then
    raise exception 'paypal_checkout_credentials_corrupt' using errcode = '22023';
  end;
  if v_paypal_client_id is null or v_paypal_client_secret is null then
    raise exception 'paypal_checkout_credentials_corrupt' using errcode = '22023';
  end if;

  return query select true, v_client_id, v_package_id, v_mode, v_version,
    v_paypal_client_id, v_paypal_client_secret;
end;
$$;

create or replace function public.record_paypal_pending_checkout(
  p_order_id text,
  p_client_id uuid,
  p_package_id text,
  p_config_version bigint,
  p_paypal_mode text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing public.paypal_pending_checkouts%rowtype;
begin
  if p_order_id is null or char_length(p_order_id) not between 1 and 255
     or p_client_id is null or p_package_id is null or char_length(p_package_id) not between 1 and 100
     or p_config_version is null or p_paypal_mode is null or p_paypal_mode not in ('sandbox', 'live') then
    raise exception 'paypal_pending_checkout_invalid' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.paypal_runtime_credential_versions as v
     where v.config_version = p_config_version and v.paypal_mode = p_paypal_mode
  ) then
    raise exception 'paypal_checkout_config_not_found' using errcode = '22023';
  end if;

  insert into public.paypal_pending_checkouts (
    order_id, client_id, package_id, config_version, paypal_mode
  ) values (
    p_order_id, p_client_id, p_package_id, p_config_version, p_paypal_mode
  ) on conflict (order_id) do nothing;

  select p.* into v_existing from public.paypal_pending_checkouts as p where p.order_id = p_order_id;
  if v_existing.client_id is distinct from p_client_id
     or v_existing.package_id is distinct from p_package_id
     or v_existing.config_version is distinct from p_config_version
     or v_existing.paypal_mode is distinct from p_paypal_mode then
    raise exception 'paypal_pending_checkout_conflict' using errcode = '23505';
  end if;
end;
$$;

create or replace function public.mark_paypal_pending_checkout_credited(p_order_id text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.paypal_pending_checkouts
     set credited_at = coalesce(credited_at, pg_catalog.now())
   where order_id = p_order_id;
$$;

-- Pausing stops new order creation but retains all credential versions so
-- previously approved orders can still be captured and credited safely.
create or replace function public.set_paypal_payments_enabled(p_enabled boolean)
returns table (
  enabled boolean,
  paypal_mode text,
  client_id_hint text,
  verified_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_version bigint;
  v_mode text;
  v_hint text;
  v_verified_at timestamptz;
  v_secret_name text;
  v_payload text;
  v_json jsonb;
begin
  if p_enabled is null then
    raise exception 'paypal_enabled_invalid' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('merlin_paypal_runtime_credentials', 0)
  );
  select s.paypal_config_version, s.paypal_mode, s.paypal_client_id_hint, s.paypal_verified_at
    into v_version, v_mode, v_hint, v_verified_at
    from public.app_settings as s
   where s.id = 1;
  if p_enabled then
    if v_version is null then
      raise exception 'paypal_credentials_not_configured' using errcode = '22023';
    end if;
    select v.vault_secret_name into v_secret_name
      from public.paypal_runtime_credential_versions as v
     where v.config_version = v_version;
    if v_secret_name is null then
      raise exception 'paypal_credentials_not_configured' using errcode = '22023';
    end if;
    select ds.decrypted_secret into v_payload
      from vault.decrypted_secrets as ds
     where ds.name = v_secret_name
     limit 1;
    if v_payload is null then
      raise exception 'paypal_credentials_missing' using errcode = '22023';
    end if;
    begin
      v_json := v_payload::jsonb;
    exception when others then
      raise exception 'paypal_credentials_corrupt' using errcode = '22023';
    end;
    if coalesce(v_json ->> 'client_id', '') = ''
       or coalesce(v_json ->> 'client_secret', '') = '' then
      raise exception 'paypal_credentials_corrupt' using errcode = '22023';
    end if;
  end if;
  update public.app_settings
     set paypal_enabled = p_enabled, updated_at = pg_catalog.now()
   where id = 1;
  if not found then
    raise exception 'paypal_settings_missing' using errcode = '23503';
  end if;
  return query select p_enabled, coalesce(v_mode, 'live'), v_hint, v_verified_at;
end;
$$;

-- A conservative recovery buffer: credited checkout mappings remain for 90
-- days, while every uncredited mapping remains until a capture retry can repair
-- it. A version is removed only after it is non-current, old itself, and has no
-- retained checkout reference.
create or replace function public.cleanup_paypal_runtime_records(
  p_retention_days integer default 90
)
returns table (
  checkouts_deleted integer,
  versions_deleted integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cutoff timestamptz;
  v_current_version bigint;
  v_checkouts_deleted integer := 0;
  v_versions_deleted integer := 0;
  v_candidate record;
begin
  if p_retention_days is null or p_retention_days < 1 or p_retention_days > 3650 then
    raise exception 'paypal_retention_days_invalid' using errcode = '22023';
  end if;
  v_cutoff := pg_catalog.now() - pg_catalog.make_interval(days => p_retention_days);
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('merlin_paypal_runtime_credentials', 0)
  );

  select s.paypal_config_version into v_current_version
    from public.app_settings as s
   where s.id = 1;

  delete from public.paypal_pending_checkouts as p
   where p.created_at < v_cutoff
     and p.credited_at is not null;
  get diagnostics v_checkouts_deleted = row_count;

  for v_candidate in
    select v.config_version, v.vault_secret_name
      from public.paypal_runtime_credential_versions as v
     where v.config_version is distinct from v_current_version
       and v.created_at < v_cutoff
       and not exists (
         select 1 from public.paypal_pending_checkouts as p
          where p.config_version = v.config_version
       )
     for update
  loop
    -- This delete and the version-row delete share the function transaction:
    -- a FK race rolls back both rather than leaving a version without Vault data.
    delete from vault.secrets as s where s.name = v_candidate.vault_secret_name;
    delete from public.paypal_runtime_credential_versions as v
     where v.config_version = v_candidate.config_version;
    if found then
      v_versions_deleted := v_versions_deleted + 1;
    end if;
  end loop;

  return query select v_checkouts_deleted, v_versions_deleted;
end;
$$;

revoke all on function public.set_paypal_runtime_credentials(text, text, text),
  public.get_paypal_runtime_credentials(),
  public.get_paypal_checkout_runtime_config(text),
  public.record_paypal_pending_checkout(text, uuid, text, bigint, text),
  public.mark_paypal_pending_checkout_credited(text),
  public.set_paypal_payments_enabled(boolean),
  public.cleanup_paypal_runtime_records(integer)
  from public, anon, authenticated;

grant execute on function public.set_paypal_runtime_credentials(text, text, text),
  public.get_paypal_runtime_credentials(),
  public.get_paypal_checkout_runtime_config(text),
  public.record_paypal_pending_checkout(text, uuid, text, bigint, text),
  public.mark_paypal_pending_checkout_credited(text),
  public.set_paypal_payments_enabled(boolean),
  public.cleanup_paypal_runtime_records(integer)
  to service_role;
