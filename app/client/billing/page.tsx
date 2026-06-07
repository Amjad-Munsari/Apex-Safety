"use client";
import { useState } from "react";
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

interface Transaction {
  date: string;
  reference: string;
  description: string;
  change: string;
  isPositive: boolean;
  balance: string;
  method: string;
}

interface HoursPackage {
  hours: number;
  price: number;
  perHour: number;
  saveLabel?: string;
  popular?: boolean;
}

const PACKAGES: HoursPackage[] = [
  { hours: 5, price: 495, perHour: 99 },
  { hours: 10, price: 950, perHour: 95, saveLabel: "Save £40", popular: true },
  { hours: 20, price: 1800, perHour: 90, saveLabel: "Save £180" },
];

const INITIAL_TRANSACTIONS: Transaction[] = [
  { date: "10 Apr 2026", reference: "INV-2026-044", description: "Top-up - 10 hours", change: "+10h", isPositive: true, balance: "14.5h", method: "PayPal" },
  { date: "04 Apr 2026", reference: "VIS-0412", description: "Site visit - Main Building", change: "-6h", isPositive: false, balance: "4.5h", method: "—" },
  { date: "21 Mar 2026", reference: "VIS-0401", description: "Site visit - Annex Wing", change: "-4h", isPositive: false, balance: "10.5h", method: "—" },
  { date: "28 Feb 2026", reference: "RPT-0088", description: "Report drafting & issue", change: "-2h", isPositive: false, balance: "14.5h", method: "—" },
  { date: "01 Feb 2026", reference: "INV-2026-021", description: "Top-up - 15 hours", change: "+15h", isPositive: true, balance: "16.5h", method: "PayPal" },
  { date: "15 Jan 2026", reference: "VIS-0389", description: "Site visit - Annex Wing", change: "-3.5h", isPositive: false, balance: "1.5h", method: "—" },
];

const TODAY_LABEL = "03 May 2026";

function formatBalance(hours: number): string {
  return Number.isInteger(hours) ? `${hours}h` : `${hours.toFixed(1)}h`;
}

function formatBalanceDisplay(hours: number): string {
  return Number.isInteger(hours) ? hours.toString() : hours.toFixed(1);
}

export default function BillingPage() {
  const [balance, setBalance] = useState(4.5);
  const [transactions, setTransactions] = useState<Transaction[]>(INITIAL_TRANSACTIONS);
  const [lastTopUp, setLastTopUp] = useState("10 Apr");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selected, setSelected] = useState<number>(1); // default to 10h (popular)
  const [processing, setProcessing] = useState(false);

  const openCheckout = () => {
    setSelected(1);
    setProcessing(false);
    setDialogOpen(true);
  };

  const handlePay = () => {
    const pkg = PACKAGES[selected];
    setProcessing(true);

    setTimeout(() => {
      const newBalance = balance + pkg.hours;
      const reference = `INV-2026-${String(Math.floor(Math.random() * 900) + 100).padStart(3, "0")}`;
      const newTx: Transaction = {
        date: TODAY_LABEL,
        reference,
        description: `Top-up - ${pkg.hours} hours`,
        change: `+${pkg.hours}h`,
        isPositive: true,
        balance: formatBalance(newBalance),
        method: "PayPal",
      };

      setBalance(newBalance);
      setTransactions((prev) => [newTx, ...prev]);
      setLastTopUp(TODAY_LABEL.split(" ").slice(0, 2).join(" "));
      setProcessing(false);
      setDialogOpen(false);

      toast.success(`Payment processed — ${pkg.hours} hours added to your balance.`);
    }, 1400);
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
        <h2 className="font-serif text-[44px] text-[#1a1a1a] font-normal tracking-tight leading-[1.05]">
          Hours &amp; billing.
        </h2>
      </section>

      {/* ─── CURRENT BALANCE CARD ─── */}
      <div className="bg-white border border-[#e5e1d8] rounded-sm p-8 flex flex-col md:flex-row items-center justify-between gap-8 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
        <div className="space-y-4">
          <span className="font-mono text-[9px] uppercase tracking-[0.4em] font-medium text-[#8a857f]">
            Current Balance
          </span>
          <div className="flex items-baseline gap-4">
            <span
              className={cn(
                "font-serif text-[54px] leading-none tracking-tight transition-colors",
                balance < 5 ? "text-[#9d4033]" : "text-[#1a1a1a]"
              )}
            >
              {formatBalanceDisplay(balance)}
            </span>
            <span className="text-[18px] font-sans font-normal text-[#6b6560] tracking-tight">
              hours remaining
            </span>
          </div>
          <div className="flex items-center gap-3 font-mono text-[9px] tracking-[0.1em] text-[#8a857f] uppercase font-medium">
            <span>18.5h used this year</span>
            <span className="opacity-60 font-sans tracking-normal">&middot;</span>
            <span>last top-up {lastTopUp}</span>
          </div>
        </div>

        <Button
          onClick={openCheckout}
          className="bg-[#1a1a1a] hover:bg-black text-white rounded-sm h-10 px-6 font-sans text-[11px] font-bold tracking-tight shadow-none flex items-center gap-3 transition-all group"
        >
          Buy more hours{" "}
          <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
        </Button>
      </div>

      {/* ─── TRANSACTION HISTORY ─── */}
      <section id="history" className="space-y-6 scroll-mt-24">
        <h3 className="font-mono text-[9px] tracking-[0.25em] font-bold text-[#8a857f] uppercase px-1">
          Transaction History
        </h3>

        <div className="bg-white border border-[#e5e1d8] rounded-sm shadow-[0_1px_2px_rgba(0,0,0,0.02)] overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#f9f8f6] border-b border-[#e5e1d8]">
                <th className="px-6 py-3 font-mono text-[9px] uppercase tracking-[0.15em] font-bold text-[#8a857f]">Date</th>
                <th className="px-6 py-3 font-mono text-[9px] uppercase tracking-[0.15em] font-bold text-[#8a857f]">Reference</th>
                <th className="px-6 py-3 font-mono text-[9px] uppercase tracking-[0.15em] font-bold text-[#8a857f]">Description</th>
                <th className="px-6 py-3 font-mono text-[9px] uppercase tracking-[0.15em] font-bold text-[#8a857f] text-right">Change</th>
                <th className="px-6 py-3 font-mono text-[9px] uppercase tracking-[0.15em] font-bold text-[#8a857f] text-right">Balance</th>
                <th className="px-6 py-3 font-mono text-[9px] uppercase tracking-[0.15em] font-bold text-[#8a857f]">Method</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0ede6]">
              {transactions.map((tx, index) => (
                <tr key={`${tx.reference}-${index}`} className="group hover:bg-[#faf9f6]/50 transition-colors">
                  <td className="px-6 py-4 font-mono text-[11px] text-[#1a1a1a] font-medium">{tx.date}</td>
                  <td className="px-6 py-4 font-mono text-[11px] text-[#8a857f] font-medium tracking-tight group-hover:text-[#1a1a1a] transition-colors">{tx.reference}</td>
                  <td className="px-6 py-4 font-sans text-[12px] text-[#1a1a1a] font-bold tracking-tight">{tx.description}</td>
                  <td
                    className={cn(
                      "px-6 py-4 font-mono text-[11px] font-bold text-right",
                      tx.isPositive ? "text-teal" : "text-[#1a1a1a]"
                    )}
                  >
                    {tx.change}
                  </td>
                  <td className="px-6 py-4 font-mono text-[11px] text-[#1a1a1a] font-bold text-right">{tx.balance}</td>
                  <td className="px-6 py-4 font-sans text-[11px] text-[#6b6560] font-medium">{tx.method}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ─── CHECKOUT DIALOG ─── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent
          showCloseButton={!processing}
          className="bg-white text-[#1a1a1a] ring-1 ring-[#e5e1d8] sm:max-w-md p-6 gap-5"
        >
          {processing ? (
            <div className="py-12 flex flex-col items-center justify-center gap-4">
              <Loader2 className="h-6 w-6 text-amber-600 animate-spin" />
              <div className="space-y-1 text-center">
                <DialogTitle className="font-serif text-[18px] text-[#1a1a1a] font-medium tracking-tight">
                  Processing payment…
                </DialogTitle>
                <DialogDescription className="text-[12px] text-[#6b6560] font-sans tracking-tight">
                  Connecting to PayPal &middot; do not close this window.
                </DialogDescription>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <div className="font-mono text-[9px] uppercase tracking-[0.25em] text-[#8a857f] font-bold">
                  Step 1 of 1 &middot; Top-up
                </div>
                <DialogTitle className="font-serif text-[22px] text-[#1a1a1a] font-medium tracking-tight leading-tight">
                  Buy more hours.
                </DialogTitle>
                <DialogDescription className="text-[12px] text-[#6b6560] font-sans tracking-tight">
                  Pick a package. Hours are credited to your balance the moment payment clears.
                </DialogDescription>
              </div>

              <div className="space-y-2.5">
                {PACKAGES.map((pkg, index) => {
                  const isSelected = selected === index;
                  return (
                    <button
                      key={pkg.hours}
                      type="button"
                      onClick={() => setSelected(index)}
                      className={cn(
                        "w-full text-left rounded-sm px-4 py-3.5 flex items-center gap-4 transition-all relative",
                        isSelected
                          ? "ring-2 ring-amber-500 bg-amber-50/60"
                          : "ring-1 ring-[#e5e1d8] bg-white hover:ring-[#cfc8b8] hover:bg-[#faf9f6]"
                      )}
                    >
                      <div className="flex items-baseline gap-1.5 min-w-[64px]">
                        <span
                          className={cn(
                            "font-serif text-[28px] leading-none tracking-tight",
                            isSelected ? "text-amber-700" : "text-[#1a1a1a]"
                          )}
                        >
                          {pkg.hours}
                        </span>
                        <span className="font-sans text-[11px] text-[#6b6560] font-medium">hours</span>
                      </div>

                      <div className="flex-1 flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[9px] uppercase tracking-[0.2em] font-bold text-[#8a857f]">
                            £{pkg.perHour}/hour
                          </span>
                          {pkg.popular && (
                            <span className="font-mono text-[8px] uppercase tracking-[0.2em] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-sm">
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
                            isSelected ? "text-amber-700" : "text-[#1a1a1a]"
                          )}
                        >
                          £{pkg.price.toLocaleString()}
                        </span>
                        <div
                          className={cn(
                            "h-4 w-4 rounded-full flex items-center justify-center transition-all",
                            isSelected ? "bg-amber-500" : "ring-1 ring-[#e5e1d8] bg-white"
                          )}
                        >
                          {isSelected && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-[#8a857f] font-bold text-center">
                Secure checkout via PayPal &middot; VAT included
              </div>

              <DialogFooter className="gap-2 mt-1">
                <Button
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                  className="rounded-sm border-[#e5e1d8] bg-transparent hover:bg-[#f9f8f6] text-[#1a1a1a] text-[10px] uppercase tracking-[0.2em] font-bold h-10 px-5 shadow-none"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handlePay}
                  className="bg-amber-600 hover:bg-amber-500 text-white rounded-sm h-10 px-6 text-[10px] uppercase tracking-[0.2em] font-bold shadow-none flex items-center gap-2"
                >
                  Pay £{PACKAGES[selected].price.toLocaleString()} via PayPal
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
