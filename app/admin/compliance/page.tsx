import { getComplianceAggregates } from "@/lib/supabase/dashboard";
import { adminClient } from "@/lib/supabase/admin";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { ArrowLeft, FileText, Building2 } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function CompliancePage() {
  const [compliance, docsRes] = await Promise.all([
    getComplianceAggregates(),
    adminClient
      .from("documents")
      .select(`id, filename, expiry_date, document_category, client:clients(name)`)
      .order("expiry_date", { ascending: true }),
  ]);

  const docs = docsRes.data || [];
  const now = new Date();
  const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const expired = docs.filter((d) => d.expiry_date && new Date(d.expiry_date) < now);
  const expiring = docs.filter((d) => {
    const exp = d.expiry_date ? new Date(d.expiry_date) : null;
    return exp && exp >= now && exp < thirtyDaysFromNow;
  });
  const current = docs.filter((d) => {
    const exp = d.expiry_date ? new Date(d.expiry_date) : null;
    return exp && exp >= thirtyDaysFromNow;
  });

  const pct = compliance.total > 0 ? Math.round((compliance.current / compliance.total) * 100) : 0;

  return (
    <div className="flex flex-col gap-8 pt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* ─── HEADER ─── */}
      <div className="flex justify-between items-end">
        <div className="flex flex-col gap-2">
          <Link href="/admin" className="flex items-center gap-2 text-[#666] hover:text-white transition-colors mb-2">
            <ArrowLeft className="w-4 h-4" />
            <span className="font-mono text-xs uppercase tracking-widest">Back to Dashboard</span>
          </Link>
          <div className="flex items-center gap-3 font-mono text-xs tracking-widest text-[#666] uppercase">
            <span className="text-[#3b8273] font-semibold">04</span>
            COMPLIANCE OVERVIEW
          </div>
          <h2 className="font-serif text-[34px] leading-tight text-white">Document Compliance</h2>
          <p className="text-[#666] text-sm font-sans tracking-wide max-w-xl">
            All {compliance.total} client documents — {pct}% currently compliant.
          </p>
        </div>
      </div>

      {/* ─── STAT CARDS ─── */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Current", count: compliance.current, color: "[#3b8273]", pct: compliance.total > 0 ? Math.round((compliance.current / compliance.total) * 100) : 0 },
          { label: "Expiring (30 days)", count: compliance.expiring, color: "gold", pct: compliance.total > 0 ? Math.round((compliance.expiring / compliance.total) * 100) : 0 },
          { label: "Expired", count: compliance.expired, color: "danger", pct: compliance.total > 0 ? Math.round((compliance.expired / compliance.total) * 100) : 0 },
        ].map((stat) => (
          <Card key={stat.label} className="bg-[#1c1c1c] border-white/5 rounded-sm p-6">
            <div className={`font-mono text-[10px] uppercase tracking-widest text-${stat.color} mb-3`}>{stat.label}</div>
            <div className="font-serif text-4xl text-white mb-1">{stat.count}</div>
            <div className="text-xs text-[#666] font-mono">{stat.pct}% of total</div>
          </Card>
        ))}
      </div>

      {/* ─── EXPIRED ─── */}
      {expired.length > 0 && (
        <DocTable title="Expired" color="danger" docs={expired} now={now} />
      )}

      {/* ─── EXPIRING ─── */}
      {expiring.length > 0 && (
        <DocTable title="Expiring Soon (next 30 days)" color="gold" docs={expiring} now={now} />
      )}

      {/* ─── CURRENT ─── */}
      {current.length > 0 && (
        <DocTable title="Current" color="[#3b8273]" docs={current} now={now} />
      )}
    </div>
  );
}

function DocTable({ title, color, docs, now }: { title: string; color: string; docs: any[]; now: Date }) {
  return (
    <Card className="bg-[#1c1c1c] border-white/5 rounded-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-white/5 flex items-center gap-3">
        <div className={`w-2 h-2 rounded-full bg-${color}`} />
        <span className={`font-mono text-[10px] uppercase tracking-widest text-${color}`}>{title}</span>
        <span className="font-mono text-[10px] text-white/20 ml-auto">{docs.length} docs</span>
      </div>
      <table className="w-full text-left font-sans text-sm">
        <thead className="bg-[#151515]">
          <tr className="text-[10px] font-mono tracking-widest uppercase text-[#555]">
            <th className="font-normal px-6 py-3 border-b border-white/5">Document</th>
            <th className="font-normal px-4 py-3 border-b border-white/5">Client</th>
            <th className="font-normal px-4 py-3 border-b border-white/5">Expiry Date</th>
            <th className="font-normal px-4 py-3 border-b border-white/5">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {docs.map((doc) => {
            const expDate = doc.expiry_date ? new Date(doc.expiry_date) : null;
            const daysLeft = expDate ? Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;
            return (
              <tr key={doc.id} className="hover:bg-white/[0.02] transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <FileText className="w-4 h-4 text-white/20" />
                    <div>
                      <div className="font-medium text-white">{doc.filename}</div>
                      <div className="text-[10px] text-[#666] font-mono uppercase tracking-widest">{doc.document_category}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-center gap-2 text-white/70">
                    <Building2 className="w-3.5 h-3.5" />
                    {(doc.client as any)?.name}
                  </div>
                </td>
                <td className="px-4 py-4 font-mono text-white/50 text-sm">
                  {expDate ? expDate.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                </td>
                <td className="px-4 py-4">
                  {daysLeft !== null && (
                    <Badge variant="outline" className={`border-${color}/40 text-${color} bg-${color}/5 font-mono text-[10px] uppercase tracking-widest`}>
                      {daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d left`}
                    </Badge>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}
