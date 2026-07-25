-- ─────────────────────────────────────────────────────────────────────────────
-- 027_credit_hours_from_paypal_search_path.sql
--
-- HYGIENE (checkout review, 2026-07-25): credit_hours_from_paypal was created in
-- migration 001 as SECURITY DEFINER *without* `set search_path = ''`, so its
-- unqualified `hours_transactions` / `clients` references resolve through the
-- caller's search_path. Migration 026's adjust_client_credits pins its path;
-- this brings the older definer function in line.
--
-- Not exploitable today: migration 025 left EXECUTE with service_role only, and
-- the sole caller (app/api/paypal/capture-order/route.ts) is server-side, so no
-- untrusted role can set a search_path for this function to inherit. Fixing it
-- anyway removes the standing footgun — the next grant, or a definer trigger
-- that ends up calling it, shouldn't have to re-derive that argument.
--
-- Behaviour is unchanged: same signature, same two statements, same semantics.
-- Only name resolution is pinned and every reference schema-qualified. Body kept
-- as-is otherwise — p_hours carries integer CREDITS since migration 026 (the
-- parameter name and NUMERIC type are deliberately untouched; renaming a live
-- SECURITY DEFINER signature in prod for cosmetics is risk with no benefit).
--
-- Idempotent: CREATE OR REPLACE on the identical signature, and re-running the
-- REVOKE/GRANT pair from 025 is a no-op. `CREATE OR REPLACE` preserves the
-- existing ACL, but the grants are re-asserted below so this migration lands the
-- intended end state even if applied out of order relative to 025.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.credit_hours_from_paypal(
  p_client_id uuid,
  p_order_id text,
  p_hours numeric(10,2),
  p_gbp numeric(10,2)
) returns void as $$
begin
  insert into public.hours_transactions (
    client_id, paypal_order_id, transaction_type, hours_amount, gbp_amount
  )
  values (p_client_id, p_order_id, 'purchase', p_hours, p_gbp);

  update public.clients
     set hours_balance = hours_balance + p_hours
   where id = p_client_id;
end;
$$ language plpgsql security definer set search_path = '';

-- Re-assert migration 025's grant state: service_role is the only legitimate
-- caller (the capture route verifies the PayPal amount, package, and buyer
-- before invoking this), so PUBLIC / anon / authenticated must not have EXECUTE.
revoke execute on function public.credit_hours_from_paypal(uuid, text, numeric, numeric)
  from public, anon, authenticated;

grant execute on function public.credit_hours_from_paypal(uuid, text, numeric, numeric)
  to service_role;
