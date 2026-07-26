import { createClient } from "@/lib/supabase/server";
import { getClientContext } from "@/lib/auth-helpers";
import { isPayPalEnabled } from "@/lib/paypal";
import {
  deriveBillingSummary,
  toTransactionView,
  type HoursTransactionRow,
} from "@/lib/billing/history";
import BillingClient from "./billing-client";
import { ClientDataLoadError } from "@/components/client/data-load-error";

export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const ctx = await getClientContext();
  if (!ctx) {
    return (
      <div className="space-y-4">
        <h2 className="font-serif text-[30px] text-foreground">Sign in to continue.</h2>
        <p className="text-muted-foreground text-[13px]">
          Your billing appears once your account is linked to a client.
        </p>
      </div>
    );
  }

  const supabase = await createClient();

  const [
    { data: client, error: clientError },
    { data: txRows, error: transactionsError },
    paypalEnabled,
  ] = await Promise.all([
    supabase.from("clients").select("hours_balance").eq("id", ctx.client_id).single(),
    supabase
      .from("hours_transactions")
      .select("id, created_at, transaction_type, hours_amount, gbp_amount, notes, paypal_order_id")
      .eq("client_id", ctx.client_id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(50),
    isPayPalEnabled(),
  ]);

  if (clientError || transactionsError) {
    console.error("[client/billing] failed to load billing data", {
      clientError,
      transactionsError,
    });
    return <ClientDataLoadError itemName="billing history" />;
  }

  const rows = (txRows ?? []) as HoursTransactionRow[];
  const summary = deriveBillingSummary(rows, new Date().toISOString());

  return (
    <BillingClient
      balance={Number(client?.hours_balance ?? 0)}
      lastTopUpLabel={summary.lastTopUpLabel}
      usedThisYearCredits={summary.usedThisYearCredits}
      transactions={rows.map(toTransactionView)}
      paypalEnabled={paypalEnabled}
    />
  );
}
