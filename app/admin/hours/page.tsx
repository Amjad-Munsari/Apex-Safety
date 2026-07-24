import { adminClient } from "@/lib/supabase/admin";
import { Card } from "@/components/ui/card";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function HoursPage() {
  const { data: clients } = await adminClient
    .from("clients")
    .select("id, name, hours_balance")
    .order("hours_balance", { ascending: true });

  const items = clients || [];
  const totalCredits = items.reduce((acc, c) => acc + (c.hours_balance || 0), 0);
  const maxBalance = Math.max(...items.map((c) => c.hours_balance || 0), 1);

  const critical = items.filter((c) => (c.hours_balance || 0) < 12);
  const warning = items.filter((c) => (c.hours_balance || 0) >= 12 && (c.hours_balance || 0) < 40);
  const healthy = items.filter((c) => (c.hours_balance || 0) >= 40);

  return (
    <div className="flex flex-col gap-8 pt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* ─── HEADER ─── */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3 font-mono text-xs tracking-widest text-muted-foreground uppercase">
          <span className="text-foreground/60 font-semibold">05</span>
          CREDIT MANAGEMENT
        </div>
        <h2 className="font-serif text-[34px] leading-tight text-foreground">Credit Balances</h2>
        <p className="text-muted-foreground text-sm font-sans tracking-wide max-w-xl">
          {totalCredits} credits total across {items.length} clients — {critical.length} critical, {warning.length} low.
        </p>
      </div>

      {/* ─── STAT CARDS ─── */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Critical (< 12)", count: critical.length, color: "danger" },
          { label: "Low (12–39)", count: warning.length, color: "gold" },
          { label: "Healthy (40+)", count: healthy.length, color: "teal" },
        ].map((s) => (
          <Card key={s.label} className="bg-card border-border rounded-sm p-6">
            <div className={`font-mono text-[10px] uppercase tracking-widest text-${s.color} mb-3`}>{s.label}</div>
            <div className="font-serif text-4xl text-foreground">{s.count}</div>
          </Card>
        ))}
      </div>

      {/* ─── HOURS TABLE ─── */}
      <Card className="bg-card border-border rounded-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">All Clients — Sorted by Balance</span>
        </div>
        <div className="divide-y divide-border">
          {items.map((client) => {
            const balance = client.hours_balance || 0;
            const isDanger = balance < 12;
            const isWarning = balance < 40;
            const barColor = isDanger ? "bg-danger" : isWarning ? "bg-gold" : "bg-teal";
            const textColor = isDanger ? "text-danger" : isWarning ? "text-gold" : "text-teal";
            const progressWidth = Math.min(100, (balance / maxBalance) * 100);

            return (
              <Link
                key={client.id}
                href={`/admin/clients/${client.id}`}
                className="flex items-center gap-6 px-6 py-4 hover:bg-muted transition-colors group"
              >
                <span className="w-48 truncate text-foreground/80 text-sm font-medium group-hover:text-foreground transition-colors">
                  {client.name}
                </span>
                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className={`h-full ${barColor} transition-all`} style={{ width: `${progressWidth}%` }} />
                </div>
                <span className={`font-mono text-sm ${textColor} w-12 text-right`}>{balance}</span>
                <span className="font-mono text-[10px] text-muted-foreground group-hover:text-foreground/40 transition-colors">&gt;</span>
              </Link>
            );
          })}
          {items.length === 0 && (
            <div className="px-6 py-12 text-center text-muted-foreground font-mono text-xs uppercase tracking-widest">
              No clients found
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
