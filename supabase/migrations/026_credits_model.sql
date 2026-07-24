-- ─────────────────────────────────────────────────────────────────────────────
-- 026_credits_model.sql
--
-- Retained-balance system is now denominated in CREDITS, not hours (Finley,
-- 2026-07). 1 hour = 4 credits initially; Matt can amend the rate himself.
--
-- Deliberately NO column renames: clients.hours_balance and
-- hours_transactions.hours_amount keep their names and now carry integer credit
-- amounts. Renaming a live SECURITY DEFINER function signature and every column
-- reference is churn with zero user value and real deploy risk, so the unit
-- change is documented via COMMENT ON COLUMN and the values are reinterpreted in
-- application code. Balances are stored, never derived from hours × rate, so a
-- future rate change never retroactively alters an existing balance.
--
-- credits_per_hour is a *reference rate* only — used for display hints and the
-- adjust-balance dialog's hours⇄credits convenience conversion at the moment of
-- use. CHECK (>= 1) keeps it a positive integer; rounding in the app absorbs
-- odd rates.
--
-- OPERATIONAL CUTOVER CONTRACT: apply this migration and deploy the credits
-- build back-to-back, with NO admin balance writes in between. The guard below
-- takes an EXCLUSIVE lock so a concurrent PayPal capture can't slip a fresh
-- hours-denominated row in mid-migration, but the post-commit / pre-deploy
-- window (where the old hours build could still write) is closed operationally,
-- not by SQL — do the deploy immediately after this commits.
-- ─────────────────────────────────────────────────────────────────────────────

-- Guard: reinterpreting the unit in place is only safe on data that predates the
-- credits model — i.e. no balance data at all. Prod is empty today, but this
-- migration must not DEPEND on that snapshot: fail loudly if any balance/ledger
-- data exists so a stale hours value is never silently relabelled as credits.
-- Convert balances (× the agreed rate) and ledger rows manually before applying.
do $$
begin
  -- Lock both tables for the rest of the migration transaction FIRST: without it
  -- the checks below are point-in-time and a concurrent capture could insert a
  -- fresh hours-denominated row between the check and commit. The EXCLUSIVE lock
  -- (blocks writes, allows reads) is held until this migration commits, so it
  -- also covers the DDL and function creation that follow.
  lock table public.clients, public.hours_transactions in exclusive mode;

  if exists (select 1 from public.hours_transactions) then
    raise exception 'migration 026: hours_transactions already has rows — convert the hours ledger to credits manually before applying (credits model)';
  end if;
  if exists (select 1 from public.clients where hours_balance <> 0) then
    raise exception 'migration 026: some clients have a non-zero hours_balance — convert balances to credits manually before applying (credits model)';
  end if;
end $$;

alter table app_settings
  add column if not exists credits_per_hour int not null default 4 check (credits_per_hour >= 1);

comment on column clients.hours_balance is
  'Retained balance, denominated in credits since 2026-07 (credits model). Integer credit amount; name kept for compatibility.';

comment on column hours_transactions.hours_amount is
  'Signed ledger movement, denominated in credits since 2026-07 (credits model). Integer credit amount; name kept for compatibility.';

-- ─────────────────────────────────────────────────────────────────────────────
-- adjust_client_credits — atomic, concurrency-safe manual balance adjustment.
--
-- The old server action did read → absolute write → best-effort ledger insert,
-- which (a) lost concurrent PayPal top-ups (last-absolute-write wins) and (b)
-- could move the balance without a matching audit row if the separate insert
-- failed. This RPC does it all in one transaction, mirroring
-- credit_hours_from_paypal (migration 001): it locks the client row FOR UPDATE,
-- applies a RELATIVE update, and inserts the ledger row atomically.
--
-- Distinct exception tokens let the calling server action map failures to typed
-- error returns. The whole-credit invariant, active-client check, and overdraft
-- are all enforced here UNDER the row lock (the server action also pre-checks
-- shape and active as a fast path, but this is the authoritative gate for any
-- caller under concurrency — including a deactivation that races this write).
--
-- Definer hardening: SET search_path = '' pins name resolution so a malicious
-- search_path can't shadow clients/hours_transactions, and every reference is
-- schema-qualified accordingly. (This is stricter than the older
-- credit_hours_from_paypal, which predates the convention and does not set it.)
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function adjust_client_credits(
  p_client_id uuid,
  p_adjustment numeric,
  p_description text
) returns numeric as $$
declare
  v_balance numeric;
  v_active boolean;
  v_new_balance numeric;
begin
  -- Whole, non-zero credits only.
  if p_adjustment is null or p_adjustment <> trunc(p_adjustment) then
    raise exception 'credits_not_integer';
  end if;
  if p_adjustment = 0 then
    raise exception 'credits_zero';
  end if;

  -- Serialize against concurrent credits (PayPal capture / other admin edits)
  -- and read `active` under the same lock so a deactivation can't race the write.
  select hours_balance, active into v_balance, v_active
    from public.clients where id = p_client_id for update;
  if not found then
    raise exception 'client_not_found';
  end if;
  if not v_active then
    raise exception 'client_inactive';
  end if;

  v_new_balance := v_balance + p_adjustment;
  if v_new_balance < 0 then
    raise exception 'credits_overdraft';
  end if;

  update public.clients set hours_balance = v_new_balance where id = p_client_id;

  insert into public.hours_transactions (client_id, transaction_type, hours_amount, notes)
  values (p_client_id, 'manual_adjustment', p_adjustment, p_description);

  return v_new_balance;
end;
$$ language plpgsql security definer set search_path = '';

-- Grant hygiene (mirrors migration 025 for credit_hours_from_paypal): a
-- SECURITY DEFINER function that moves balances must not be callable by the anon
-- key that ships in the client bundle. Only the service_role client — used by the
-- admin server action behind a requireAdmin() gate — may execute it.
revoke execute on function public.adjust_client_credits(uuid, numeric, text)
  from public, anon, authenticated;
grant execute on function public.adjust_client_credits(uuid, numeric, text)
  to service_role;
