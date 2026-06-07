import { getComplianceAggregates } from "@/lib/supabase/dashboard";
import { adminClient } from "@/lib/supabase/admin";
import { Card } from "@/components/ui/card";
import Link from "next/link";
import { ComplianceDocRowItem, type ComplianceDocRow } from "./compliance-doc-row";
import { UploadDocumentModal } from "@/components/admin/upload-document-modal";

export const dynamic = "force-dynamic";

type FilterKey = "all" | "current" | "expiring" | "expired" | "undated";

const TABS: { key: FilterKey; label: string }[] = [
  { key: "all",      label: "All" },
  { key: "current",  label: "Current" },
  { key: "expiring", label: "Expiring (30 days)" },
  { key: "expired",  label: "Expired" },
  { key: "undated",  label: "No Expiry Date" },
];

export default async function CompliancePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const sp = await searchParams;
  const active: FilterKey = ((): FilterKey => {
    const v = sp.status;
    if (v === "current" || v === "expiring" || v === "expired" || v === "undated" || v === "all") return v;
    return "all";
  })();

  const [compliance, docsRes, clientsRes] = await Promise.all([
    getComplianceAggregates(),
    adminClient
      .from("documents")
      .select(`id, filename, expiry_date, document_category, client:clients(id, name)`)
      .order("expiry_date", { ascending: true }),
    adminClient
      .from("clients")
      .select("id, name")
      .is("deleted_at", null)
      .eq("active", true)
      .order("name", { ascending: true }),
  ]);

  const clients = (clientsRes.data ?? []) as { id: string; name: string }[];

  const docs = (docsRes.data || []) as unknown as ComplianceDocRow[];
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
  // Documents with no expiry date belong to none of the date buckets above.
  // They were previously counted in "All" (docs.length) but rendered in no
  // table at all — invisible. Surface them in their own section.
  const undated = docs.filter((d) => !d.expiry_date);

  const counts: Record<FilterKey, number> = {
    all: docs.length,
    current: current.length,
    expiring: expiring.length,
    expired: expired.length,
    undated: undated.length,
  };

  const pct = compliance.total > 0 ? Math.round((compliance.current / compliance.total) * 100) : 0;

  return (
    <div className="flex flex-col gap-8 pt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* ─── HEADER ─── */}
      <div className="flex justify-between items-end">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3 font-mono text-xs tracking-widest text-[#666] uppercase">
            <span className="text-teal font-semibold">03</span>
            COMPLIANCE OVERVIEW
          </div>
          <h2 className="font-serif text-[34px] leading-tight text-white">Document Compliance</h2>
          <p className="text-[#666] text-sm font-sans tracking-wide max-w-xl">
            All {compliance.total} client documents — {pct}% currently compliant.
          </p>
        </div>
        <UploadDocumentModal clients={clients} />
      </div>

      {/* ─── STAT CARDS ─── */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Current", count: compliance.current, color: "teal", pct: compliance.total > 0 ? Math.round((compliance.current / compliance.total) * 100) : 0 },
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

      {/* ─── TABS ─── */}
      <div className="flex items-center gap-10 border-b border-white/5">
        {TABS.map((tab) => {
          const isActive = active === tab.key;
          const href = tab.key === "all" ? "/admin/compliance" : `/admin/compliance?status=${tab.key}`;
          return (
            <Link
              key={tab.key}
              href={href}
              className={`group relative flex items-center gap-2 pb-3 font-mono text-[11px] uppercase tracking-widest transition-colors ${
                isActive ? "text-white" : "text-white/40 hover:text-white/80"
              }`}
            >
              <span>{tab.label}</span>
              <span className={`text-[10px] ${isActive ? "text-white/70" : "text-white/30"}`}>
                {counts[tab.key]}
              </span>
              {isActive && <span className="absolute -bottom-px left-0 right-0 h-0.5 bg-gold" />}
            </Link>
          );
        })}
      </div>

      {/* ─── TABLES (filtered by tab) ─── */}
      {active === "all" && (
        <>
          {current.length > 0 && <DocTable title="Current" color="teal" docs={current} now={now} />}
          {expiring.length > 0 && <DocTable title="Expiring Soon (next 30 days)" color="gold" docs={expiring} now={now} showReminder />}
          {expired.length > 0 && <DocTable title="Expired" color="danger" docs={expired} now={now} showReminder />}
          {undated.length > 0 && <DocTable title="No Expiry Date" color="white/40" docs={undated} now={now} />}
        </>
      )}
      {active === "expired" && (
        expired.length > 0
          ? <DocTable title="Expired" color="danger" docs={expired} now={now} showReminder />
          : <EmptyTab label="No expired documents" />
      )}
      {active === "expiring" && (
        expiring.length > 0
          ? <DocTable title="Expiring Soon (next 30 days)" color="gold" docs={expiring} now={now} showReminder />
          : <EmptyTab label="No documents expiring in the next 30 days" />
      )}
      {active === "current" && (
        current.length > 0
          ? <DocTable title="Current" color="teal" docs={current} now={now} />
          : <EmptyTab label="No current documents" />
      )}
      {active === "undated" && (
        undated.length > 0
          ? <DocTable title="No Expiry Date" color="white/40" docs={undated} now={now} />
          : <EmptyTab label="No documents without an expiry date" />
      )}
    </div>
  );
}

function EmptyTab({ label }: { label: string }) {
  return (
    <Card className="bg-[#1c1c1c] border-white/5 rounded-sm py-12 text-center text-white/20 font-mono text-xs uppercase tracking-widest">
      {label}
    </Card>
  );
}

function DocTable({
  title,
  color,
  docs,
  now,
  showReminder = false,
}: {
  title: string;
  color: string;
  docs: ComplianceDocRow[];
  now: Date;
  showReminder?: boolean;
}) {
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
            <th className="font-normal px-4 py-3 border-b border-white/5 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {docs.map((doc) => {
            const expDate = doc.expiry_date ? new Date(doc.expiry_date) : null;
            const daysLeft = expDate ? Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;
            const expDateLabel = expDate
              ? expDate.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
              : "—";
            return (
              <ComplianceDocRowItem
                key={doc.id}
                doc={doc}
                color={color}
                daysLeft={daysLeft}
                expDateLabel={expDateLabel}
                showReminder={showReminder}
              />
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}
