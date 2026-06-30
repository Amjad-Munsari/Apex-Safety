"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { ArrowRight, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { HOURS_PACKAGES } from "@/lib/billing/packages";
import type { TransactionView } from "@/lib/billing/history";

interface BillingClientProps {
  balance: number;
  lastTopUpLabel: string | null;
  usedThisYearHours: number;
  transactions: TransactionView[];
  /** When false, the checkout is disabled and shows "Payments coming soon". */
  paypalEnabled: boolean;
}

function formatBalanceDisplay(hours: number): string {
  return Number.isInteger(hours) ? hours.toString() : hours.toFixed(1);
}

function formatHours(hours: number): string {
  const abs = Math.abs(hours);
  return Number.isInteger(abs) ? abs.toString() : abs.toFixed(1);
}

export default function BillingClient({
  balance: initialBalance,
  lastTopUpLabel,
  usedThisYearHours,
  transactions,
  paypalEnabled,
}: BillingClientProps) {
  const router = useRouter();
  const [balance, setBalance] = useState(initialBalance);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selected, setSelected] = useState<number>(1); // default to 10h (popular)
  const [redirecting, setRedirecting] = useState(false);

  const handledReturn = useRef(false);

  async function captureOrder(orderId: string, done: () => void) {
    const toastId = toast.loading("Confirming your payment…");
    try {
      const res = await fetch("/api/paypal/capture-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.error ?? "capture_failed");
      }
      if (typeof data.balance === "number") setBalance(data.balance);
      toast.success(
        data.alreadyProcessed
          ? "Payment already confirmed — your balance is up to date."
          : "Payment received — hours added to your balance.",
        { id: toastId }
      );
      router.refresh(); // re-pull the server-rendered ledger + summary
    } catch {
      toast.error("We couldn't confirm your payment. Please contact your consultant.", {
        id: toastId,
      });
    } finally {
      done();
    }
  }

  // ── Handle the redirect back from PayPal ──────────────────────────────────
  // PayPal appends ?token=<orderId>&PayerID=<id> on approval, and ?token=<orderId>
  // (no PayerID) on cancel. We distinguish the two by PayerID presence.
  useEffect(() => {
    if (handledReturn.current) return;
    const params = new URLSearchParams(window.location.search);
    const orderId = params.get("token");
    if (!orderId) return;
    handledReturn.current = true;

    // Clean the query string so a refresh/back doesn't re-trigger.
    const clearQuery = () => router.replace("/client/billing");

    if (params.get("PayerID")) {
      // Defer off the effect tick: the capture round-trip updates balance state
      // only after the network call resolves, never as a synchronous re-render.
      queueMicrotask(() => void captureOrder(orderId, clearQuery));
    } else {
      toast("Payment cancelled — no hours were purchased.");
      clearQuery();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Start checkout: create an order, redirect to PayPal ───────────────────
  const openCheckout = () => {
    if (!paypalEnabled) return;
    setSelected(1);
    setRedirecting(false);
    setDialogOpen(true);
  };

  const handlePay = async () => {
    const pkg = HOURS_PACKAGES[selected];
    setRedirecting(true);
    try {
      const res = await fetch("/api/paypal/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageId: pkg.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.approveUrl) {
        throw new Error(data.error ?? "order_creation_failed");
      }
      window.location.href = data.approveUrl as string;
    } catch {
      setRedirecting(false);
      toast.error("Couldn't start checkout. Please try again.");
    }
  };

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-2 duration-500 pb-12">
      {/* ─── PAGE HEADER ─── */}
      <section className="space-y-3">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[10px] text-teal tracking-[0.4em] uppercase font-medium">
            08 Billing
          </span>
        </div>
        <h2 className="font-serif text-[44px] text-foreground font-normal tracking-tight leading-[1.05]">
          Hours &amp; billing.
        </h2>
      </section>

      {/* ─── CURRENT BALANCE CARD ─── */}
      <div className="bg-card border border-border rounded-sm p-8 flex flex-col md:flex-row items-center justify-between gap-8 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
        <div className="space-y-4">
          <span className="font-mono text-[9px] uppercase tracking-[0.4em] font-medium text-muted-foreground">
            Current Balance
          </span>
          <div className="flex items-baseline gap-4">
            <span
              className={cn(
                "font-serif text-[54px] leading-none tracking-tight transition-colors",
                balance < 5 ? "text-danger" : "text-foreground"
              )}
            >
              {formatBalanceDisplay(balance)}
            </span>
            <span className="text-[18px] font-sans font-normal text-muted-foreground tracking-tight">
              hours remaining
            </span>
          </div>
          <div className="flex items-center gap-3 font-mono text-[9px] tracking-[0.1em] text-muted-foreground uppercase font-medium">
            <span>{formatHours(usedThisYearHours)}h used this year</span>
            {lastTopUpLabel && (
              <>
                <span className="opacity-60 font-sans tracking-normal">&middot;</span>
                <span>last top-up {lastTopUpLabel}</span>
              </>
            )}
          </div>
        </div>

        {paypalEnabled ? (
          <Button
            onClick={openCheckout}
            className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-sm h-10 px-6 font-sans text-[11px] font-bold tracking-tight shadow-none flex items-center gap-3 transition-colors group"
          >
            Buy more hours{" "}
            <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
          </Button>
        ) : (
          <Button
            disabled
            className="bg-muted text-muted-foreground rounded-sm h-10 px-6 font-sans text-[11px] font-bold tracking-tight shadow-none cursor-not-allowed"
          >
            Payments coming soon
          </Button>
        )}
      </div>

      {/* ─── TRANSACTION HISTORY ─── */}
      <section id="history" className="space-y-6 scroll-mt-24">
        <h3 className="font-mono text-[9px] tracking-[0.25em] font-bold text-muted-foreground uppercase px-1">
          Transaction History
        </h3>

        {transactions.length === 0 ? (
          <div className="bg-card border border-border rounded-sm shadow-[0_1px_2px_rgba(0,0,0,0.02)] px-10 py-16 text-center">
            <p className="font-serif text-[20px] text-foreground mb-3">No transactions yet.</p>
            <p className="font-sans text-[13px] text-muted-foreground max-w-md mx-auto leading-relaxed">
              Top-ups and hours drawn down against site visits will be itemised here. For a
              statement in the meantime, message your consultant.
            </p>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-sm shadow-[0_1px_2px_rgba(0,0,0,0.02)] divide-y divide-border">
            {transactions.map((tx) => {
              const credit = tx.hoursAmount >= 0;
              return (
                <div key={tx.id} className="flex items-center justify-between px-6 py-4 gap-4">
                  <div className="flex flex-col gap-1 min-w-0">
                    <span className="font-sans text-[13px] text-foreground font-medium truncate">
                      {tx.title}
                    </span>
                    <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
                      {tx.dateLabel}
                      {tx.gbpAmount != null && ` · £${tx.gbpAmount.toLocaleString()}`}
                    </span>
                  </div>
                  <span
                    className={cn(
                      "font-serif text-[20px] tracking-tight tabular-nums shrink-0",
                      credit ? "text-teal" : "text-foreground"
                    )}
                  >
                    {credit ? "+" : "−"}
                    {formatHours(tx.hoursAmount)}h
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ─── CHECKOUT DIALOG ─── */}
      <Dialog open={dialogOpen} onOpenChange={(open) => !redirecting && setDialogOpen(open)}>
        <DialogContent
          showCloseButton={!redirecting}
          className="bg-card text-foreground ring-1 ring-border sm:max-w-md p-6 gap-5"
        >
          {redirecting ? (
            <div className="py-12 flex flex-col items-center justify-center gap-4">
              <Loader2 className="h-6 w-6 text-amber-600 animate-spin" />
              <div className="space-y-1 text-center">
                <DialogTitle className="font-serif text-[18px] text-foreground font-medium tracking-tight">
                  Redirecting to PayPal…
                </DialogTitle>
                <DialogDescription className="text-[12px] text-muted-foreground font-sans tracking-tight">
                  You&apos;ll be taken to PayPal to complete payment securely.
                </DialogDescription>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <div className="font-mono text-[9px] uppercase tracking-[0.25em] text-muted-foreground font-bold">
                  Step 1 of 1 &middot; Top-up
                </div>
                <DialogTitle className="font-serif text-[22px] text-foreground font-medium tracking-tight leading-tight">
                  Buy more hours.
                </DialogTitle>
                <DialogDescription className="text-[12px] text-muted-foreground font-sans tracking-tight">
                  Pick a package. Hours are credited to your balance the moment payment clears.
                </DialogDescription>
              </div>

              <div className="space-y-2.5">
                {HOURS_PACKAGES.map((pkg, index) => {
                  const isSelected = selected === index;
                  return (
                    <button
                      key={pkg.id}
                      type="button"
                      onClick={() => setSelected(index)}
                      className={cn(
                        "w-full text-left rounded-sm px-4 py-3.5 flex items-center gap-4 transition-colors relative",
                        isSelected
                          ? "ring-2 ring-amber-500 bg-amber-50/60"
                          : "ring-1 ring-border bg-card hover:ring-border hover:bg-muted"
                      )}
                    >
                      <div className="flex items-baseline gap-1.5 min-w-[64px]">
                        <span
                          className={cn(
                            "font-serif text-[28px] leading-none tracking-tight",
                            isSelected ? "text-amber-700" : "text-foreground"
                          )}
                        >
                          {pkg.hours}
                        </span>
                        <span className="font-sans text-[11px] text-muted-foreground font-medium">hours</span>
                      </div>

                      <div className="flex-1 flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[9px] uppercase tracking-[0.2em] font-bold text-muted-foreground">
                            £{pkg.perHour}/hour
                          </span>
                          {pkg.popular && (
                            <span className="font-mono text-[10px] uppercase tracking-[0.2em] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-sm">
                              Most popular
                            </span>
                          )}
                        </div>
                        {pkg.saveLabel && (
                          <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-teal font-bold">
                            {pkg.saveLabel}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                        <span
                          className={cn(
                            "font-serif text-[20px] tracking-tight transition-colors",
                            isSelected ? "text-amber-700" : "text-foreground"
                          )}
                        >
                          £{pkg.priceGBP.toLocaleString()}
                        </span>
                        <div
                          className={cn(
                            "h-4 w-4 rounded-full flex items-center justify-center transition-colors",
                            isSelected ? "bg-amber-500" : "ring-1 ring-border bg-card"
                          )}
                        >
                          {isSelected && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground font-bold text-center">
                Secure checkout via PayPal &middot; VAT included
              </div>

              <DialogFooter className="gap-2 mt-1">
                <Button
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                  className="rounded-sm border-border bg-transparent hover:bg-muted text-foreground text-[10px] uppercase tracking-[0.2em] font-bold h-10 px-5 shadow-none"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handlePay}
                  className="bg-amber-600 hover:bg-amber-500 text-white rounded-sm h-10 px-6 text-[10px] uppercase tracking-[0.2em] font-bold shadow-none flex items-center gap-2"
                >
                  Pay £{HOURS_PACKAGES[selected].priceGBP.toLocaleString()} via PayPal
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
