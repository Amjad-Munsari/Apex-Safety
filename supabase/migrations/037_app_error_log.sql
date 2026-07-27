-- 037_app_error_log.sql
--
-- A durable, queryable record of every error the platform observes, wherever it
-- happens: server renders, route handlers, server actions, cron ticks, browser
-- sessions, and outbound provider calls.
--
-- Why this exists alongside `workflow_errors`:
--   `workflow_errors` is Matt's *operational* surface. It answers "did an email,
--   a report, or an automation fail for a client?" and its rows are written
--   deliberately, one per business workflow, with friendly copy in the admin UI.
--   Flooding it with React render errors and browser exceptions would destroy
--   that signal.
--   `app_error_log` is the *engineering* surface. Nothing is hand-picked: every
--   captured throw lands here with its stack, route, actor, and release, so a
--   fault anywhere in the build can be reconstructed after the fact. Vercel's
--   runtime logs cannot do this job — they are short-lived, per-deployment, and
--   Matt has no access to them.
--
-- Both are kept. A workflow failure typically writes one row to each.
--
-- Writes are service-role only, exactly like the money RPCs in 025/026: the
-- logger runs server-side under the service key. Browser-reported errors reach
-- this table only through an authenticated route handler that re-derives the
-- actor server-side — the browser never writes a row directly, and never
-- chooses its own `actor_id`.

create table if not exists public.app_error_log (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),

  -- 'error' is a real fault. 'warning' is a degraded path that recovered (a
  -- best-effort write that failed, a fallback that engaged). 'info' is reserved
  -- for deliberate breadcrumbs around money and signing.
  severity text not null default 'error'
    check (severity in ('error', 'warning', 'info')),

  -- Where the throw was captured, not what it was about.
  source text not null
    check (source in ('render', 'route', 'action', 'proxy', 'cron', 'browser', 'job', 'external')),

  -- Logical area, dot-scoped: 'paypal.capture', 'signing.redeem',
  -- 'notifications.dispatch'. Free text so a new subsystem needs no migration,
  -- but bounded so it stays greppable.
  area text not null check (char_length(area) between 1 and 120),

  message text not null check (char_length(message) between 1 and 4000),
  error_name text check (error_name is null or char_length(error_name) <= 200),

  -- Truncated by the logger before it gets here; the constraint is a backstop
  -- so one pathological stack cannot bloat the table.
  stack text check (stack is null or char_length(stack) <= 20000),

  -- Next.js replaces Server Component errors with an opaque digest in the
  -- browser. Storing it is what lets a screenshot of "Digest: 1234567890" be
  -- tied back to the real stack.
  digest text check (digest is null or char_length(digest) <= 200),

  route_path text,      -- route file, e.g. /admin/clients/[id]
  request_path text,    -- resource path actually requested
  request_method text check (request_method is null or char_length(request_method) <= 10),

  -- Correlates the browser report, the server render, and the route handler
  -- involved in the same request.
  request_id text check (request_id is null or char_length(request_id) <= 200),

  actor_type text check (actor_type in ('admin', 'client', 'anon', 'system')),
  actor_id uuid,
  client_id uuid,       -- deliberately NOT a foreign key: a log row must survive
                        -- the deletion of the org it refers to.

  release text,         -- deployment commit SHA
  environment text,     -- production | preview | development

  -- Stable grouping key: same fault, same fingerprint, so repeats collapse in
  -- the admin view instead of burying everything else.
  fingerprint text not null check (char_length(fingerprint) between 1 and 200),

  -- Redacted, size-capped structured detail. Never raw request bodies.
  context jsonb not null default '{}'::jsonb,

  resolved boolean not null default false,
  resolved_at timestamptz,
  resolved_by uuid
);

comment on table public.app_error_log is
  'Engineering-grade error log: every captured fault with stack, route, actor and release. Operational/business failures also write to workflow_errors.';
comment on column public.app_error_log.fingerprint is
  'Stable grouping key derived from area + error name + normalised message. Repeats of the same fault share it.';
comment on column public.app_error_log.context is
  'Redacted structured detail. The logger strips secret-shaped keys and caps size before insert.';

create index if not exists app_error_log_occurred_at_idx
  on public.app_error_log (occurred_at desc);
create index if not exists app_error_log_unresolved_idx
  on public.app_error_log (occurred_at desc) where resolved = false;
create index if not exists app_error_log_fingerprint_idx
  on public.app_error_log (fingerprint, occurred_at desc);
create index if not exists app_error_log_area_idx
  on public.app_error_log (area, occurred_at desc);
create index if not exists app_error_log_severity_idx
  on public.app_error_log (severity, occurred_at desc);

alter table public.app_error_log enable row level security;

-- Browser roles get nothing by default. Admins read through the policy below;
-- the logger writes as service_role, which bypasses RLS.
revoke all on table public.app_error_log from public, anon, authenticated;
grant select on table public.app_error_log to authenticated;

drop policy if exists "app_error_log_admin_select" on public.app_error_log;
create policy "app_error_log_admin_select" on public.app_error_log for select
  using (exists (select 1 from public.admin_users au where au.id = auth.uid()));

drop policy if exists "app_error_log_admin_update" on public.app_error_log;
create policy "app_error_log_admin_update" on public.app_error_log for update
  using (exists (select 1 from public.admin_users au where au.id = auth.uid()))
  with check (exists (select 1 from public.admin_users au where au.id = auth.uid()));

grant update (resolved, resolved_at, resolved_by) on public.app_error_log to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Retention
--
-- An error log that grows without bound eventually becomes the outage. Resolved
-- rows are cheap to drop early; unresolved ones are kept long enough to survive
-- a quiet period plus an investigation. Called from the existing daily expiry
-- cron rather than a new schedule.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.cleanup_app_error_log(
  p_resolved_retention_days integer default 30,
  p_unresolved_retention_days integer default 180
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted integer;
begin
  if p_resolved_retention_days < 1 or p_unresolved_retention_days < 1 then
    raise exception 'retention_out_of_range';
  end if;

  delete from public.app_error_log
   where (resolved = true
          and occurred_at < now() - make_interval(days => p_resolved_retention_days))
      or (resolved = false
          and occurred_at < now() - make_interval(days => p_unresolved_retention_days));

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.cleanup_app_error_log(integer, integer) from public, anon, authenticated;
grant execute on function public.cleanup_app_error_log(integer, integer) to service_role;
