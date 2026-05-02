"use client";
import { cn } from "@/lib/utils";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
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

const transactions: Transaction[] = [
  { date: "10 Apr 2026", reference: "INV-2026-044", description: "Top-up - 10 hours", change: "+10h", isPositive: true, balance: "14.5h", method: "PayPal" },
  { date: "04 Apr 2026", reference: "VIS-0412", description: "Site visit - Main Building", change: "-6h", isPositive: false, balance: "4.5h", method: "—" },
  { date: "21 Mar 2026", reference: "VIS-0401", description: "Site visit - Annex Wing", change: "-4h", isPositive: false, balance: "10.5h", method: "—" },
  { date: "28 Feb 2026", reference: "RPT-0088", description: "Report drafting & issue", change: "-2h", isPositive: false, balance: "14.5h", method: "—" },
  { date: "01 Feb 2026", reference: "INV-2026-021", description: "Top-up - 15 hours", change: "+15h", isPositive: true, balance: "16.5h", method: "PayPal" },
  { date: "15 Jan 2026", reference: "VIS-0389", description: "Site visit - Annex Wing", change: "-3.5h", isPositive: false, balance: "1.5h", method: "—" },
];

export default function BillingPage() {
  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-2 duration-500 pb-12">
      {/* ─── PAGE HEADER ─── */}
      <section className="space-y-3">
        <div className="flex items-center gap-3">
           <span className="font-mono text-[10px] text-[#3b8273] tracking-[0.4em] uppercase font-medium">04 Billing</span>
        </div>
        <h2 className="font-serif text-[44px] text-[#1a1a1a] font-normal tracking-tight leading-[1.05]">
          Hours &amp; billing.
        </h2>
      </section>

      {/* ─── CURRENT BALANCE CARD ─── */}
      <div className="bg-white border border-[#e5e1d8] rounded-sm p-8 flex flex-col md:flex-row items-center justify-between gap-8 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
        <div className="space-y-4">
          <span className="font-mono text-[9px] uppercase tracking-[0.4em] font-medium text-[#999]">Current Balance</span>
          <div className="flex items-baseline gap-4">
            <span className="font-serif text-[54px] text-[#9d4033] leading-none tracking-tight">4.5</span>
            <span className="text-[18px] font-sans font-normal text-[#555] tracking-tight">hours remaining</span>
          </div>
          <div className="flex items-center gap-3 font-mono text-[9px] tracking-[0.1em] text-[#bbb] uppercase font-medium">
            <span>18.5h used this year</span>
            <span className="opacity-40 font-sans tracking-normal">&middot;</span>
            <span>last top-up 10 Apr</span>
          </div>
        </div>
        
        <Button
          onClick={() => toast.success("Top-up request sent — Matt will confirm within 24h.")}
          className="bg-[#1a1a1a] hover:bg-black text-white rounded-sm h-10 px-6 font-sans text-[11px] font-bold tracking-tight shadow-none flex items-center gap-3 transition-all group"
        >
          Buy more hours <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
        </Button>
      </div>

      {/* ─── TRANSACTION HISTORY ─── */}
      <section id="history" className="space-y-6 scroll-mt-24">
        <h3 className="font-mono text-[9px] tracking-[0.25em] font-bold text-[#bbb] uppercase px-1">Transaction History</h3>
        
        <div className="bg-white border border-[#e5e1d8] rounded-sm shadow-[0_1px_2px_rgba(0,0,0,0.02)] overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#f9f8f6] border-b border-[#e5e1d8]">
                <th className="px-6 py-3 font-mono text-[9px] uppercase tracking-[0.15em] font-bold text-[#999]">Date</th>
                <th className="px-6 py-3 font-mono text-[9px] uppercase tracking-[0.15em] font-bold text-[#999]">Reference</th>
                <th className="px-6 py-3 font-mono text-[9px] uppercase tracking-[0.15em] font-bold text-[#999]">Description</th>
                <th className="px-6 py-3 font-mono text-[9px] uppercase tracking-[0.15em] font-bold text-[#999] text-right">Change</th>
                <th className="px-6 py-3 font-mono text-[9px] uppercase tracking-[0.15em] font-bold text-[#999] text-right">Balance</th>
                <th className="px-6 py-3 font-mono text-[9px] uppercase tracking-[0.15em] font-bold text-[#999]">Method</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0ede6]">
              {transactions.map((tx, index) => (
                <tr key={index} className="group hover:bg-[#faf9f6]/50 transition-colors">
                  <td className="px-6 py-4 font-mono text-[11px] text-[#1a1a1a] font-medium">{tx.date}</td>
                  <td className="px-6 py-4 font-mono text-[11px] text-[#bbb] font-medium tracking-tight group-hover:text-[#999] transition-colors">{tx.reference}</td>
                  <td className="px-6 py-4 font-sans text-[12px] text-[#1a1a1a] font-bold tracking-tight">{tx.description}</td>
                  <td className={cn(
                    "px-6 py-4 font-mono text-[11px] font-bold text-right",
                    tx.isPositive ? "text-[#3b8273]" : "text-[#1a1a1a]"
                  )}>
                    {tx.change}
                  </td>
                  <td className="px-6 py-4 font-mono text-[11px] text-[#1a1a1a] font-bold text-right">{tx.balance}</td>
                  <td className="px-6 py-4 font-sans text-[11px] text-[#777] font-medium">{tx.method}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
