-- ─────────────────────────────────────────────────────────────────────────────
-- 030_rate_limit.sql
--
-- Generic fixed-window rate limiter, added for the public password-reset action.
--
-- WHY: requestPasswordReset (app/login/forgot/actions.ts) is callable by anyone
-- and always answers { ok: true } so it never discloses whether an account
-- exists — correct, but with no rate limit a caller could flood a known address
-- with reset emails (inbox flooding, Resend quota burn) and enumerate at speed.
--
-- Postgres rather than a third-party limiter: the database is already here, the
-- volumes involved are trivial, and it avoids adding an external dependency (and
-- its own outage mode) to the password-reset path.
--
-- DESIGN
--   - Fixed window, not sliding: one row per (key, window start). Coarser than a
--     sliding window but it makes the whole check a single atomic UPSERT with no
--     read-modify-write race, which matters more here than precision.
--   - The RPC returns a boolean instead of raising, because the caller must
--     behave IDENTICALLY whether or not the limit tripped — raising would leak
--     the difference through timing/error paths and undo the anti-enumeration
--     property the action is built around.
--   - Keys are opaque text supplied by the caller (e.g. 'pwreset:<email>'), so
--     the same primitive serves any future endpoint.
--   - SECURITY DEFINER + `set search_path = ''` + service_role-only EXECUTE,
--     matching the conventions established by migrations 025/026/027.
--
-- Idempotent: IF NOT EXISTS on the table/index, CREATE OR REPLACE on the
-- function, and the REVOKE/GRANT pair is a no-op on re-run.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.rate_limit_hits (
  bucket_key   text        not null,
  window_start timestamptz not null,
  hits         integer     not null default 0,
  primary key (bucket_key, window_start)
);

comment on table public.rate_limit_hits is
  'Fixed-window counters for public endpoints. Written only by check_rate_limit(); prune with delete where window_start < now() - interval ''1 day''.';

-- Cheap pruning of expired windows.
create index if not exists rate_limit_hits_window_start_idx
  on public.rate_limit_hits (window_start);

alter table public.rate_limit_hits enable row level security;
revoke all on public.rate_limit_hits from anon, authenticated;

/**
 * Consume one unit against `p_key`. Returns TRUE when the call is allowed and
 * FALSE when the window is exhausted.
 *
 * The UPSERT is the whole concurrency story: `on conflict do update` increments
 * under a row lock, so N concurrent callers produce N as the count with no lost
 * updates, and the decision is made on the returned value.
 */
create or replace function public.check_rate_limit(
  p_key             text,
  p_max             integer,
  p_window_seconds  integer
) returns boolean as $$
declare
  v_window_start timestamptz;
  v_hits         integer;
begin
  if p_key is null or length(trim(p_key)) = 0 then
    raise exception 'rate_limit_key_required';
  end if;
  if p_max < 1 or p_window_seconds < 1 then
    raise exception 'rate_limit_bad_bounds';
  end if;

  -- Truncate now() to the start of its window: to_timestamp(floor(epoch/len)*len).
  v_window_start := to_timestamp(
    floor(extract(epoch from clock_timestamp()) / p_window_seconds) * p_window_seconds
  );

  insert into public.rate_limit_hits (bucket_key, window_start, hits)
  values (p_key, v_window_start, 1)
  on conflict (bucket_key, window_start)
    do update set hits = public.rate_limit_hits.hits + 1
  returning hits into v_hits;

  -- Opportunistic cleanup: ~1 call in 100 clears windows older than a day, so
  -- the table cannot grow without bound and no cron is required.
  if random() < 0.01 then
    delete from public.rate_limit_hits
     where window_start < clock_timestamp() - interval '1 day';
  end if;

  return v_hits <= p_max;
end;
$$ language plpgsql security definer set search_path = '';

revoke execute on function public.check_rate_limit(text, integer, integer)
  from public, anon, authenticated;

grant execute on function public.check_rate_limit(text, integer, integer)
  to service_role;
