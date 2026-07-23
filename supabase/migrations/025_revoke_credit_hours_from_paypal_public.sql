-- ─────────────────────────────────────────────────────────────────────────────
-- 025_revoke_credit_hours_from_paypal_public.sql
--
-- SECURITY FIX (pre-launch audit, 2026-07-23): credit_hours_from_paypal is a
-- SECURITY DEFINER function that inserts an hours_transactions row and bumps
-- clients.hours_balance. Migration 001 created it without a REVOKE, so Postgres
-- left the default EXECUTE grant to PUBLIC in place — meaning the anon key that
-- ships in the client bundle could POST /rest/v1/rpc/credit_hours_from_paypal
-- with any client_id and arbitrary p_hours to credit unlimited hours without
-- paying (confirmed exploitable on the live project via pg_proc.proacl:
-- {=X, anon=X, authenticated=X, service_role=X}).
--
-- The only legitimate caller is app/api/paypal/capture-order/route.ts, which
-- invokes the RPC via the service_role client AFTER verifying the captured
-- amount, package, and buyer against PayPal. service_role therefore retains
-- EXECUTE; anon / authenticated / PUBLIC must not have it.
--
-- Idempotent: REVOKE of an absent grant is a no-op, so this is safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

revoke execute on function public.credit_hours_from_paypal(uuid, text, numeric, numeric)
  from public, anon, authenticated;

-- Belt-and-braces: service_role is the only grantee the app relies on.
grant execute on function public.credit_hours_from_paypal(uuid, text, numeric, numeric)
  to service_role;
