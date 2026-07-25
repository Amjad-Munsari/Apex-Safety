import { getComplianceAggregates } from "@/lib/supabase/dashboard";
import { ACCENT_CLASSES, type Accent } from "@/lib/ui/accent";
import { adminClient } from "@/lib/supabase/admin";
import { Card } from "@/components/ui/card";
import Link from "next/link";
import { ComplianceDocRowItem, type ComplianceDocRow } from "./compliance-doc-row";
import { UploadDocumentModal } from "@/components/admin/upload-document-modal";
import {
  complianceStatusForDate,
  daysUntilExpiry,
  todayIsoInTimeZone,
} from "@/lib/compliance/expiry-status";

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
      .eq("active", true)
      .is("deleted_at", null)
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
  const todayIso = todayIsoInTimeZone();

  const expired = docs.filter(
    (d) => complianceStatusForDate(d.expiry_date, todayIso) === "expired"
  );
  const expiring = docs.filter(
    (d) => complianceStatusForDate(d.expiry_date, todayIso) === "expiring"
  );
  const current = docs.filter(
    (d) => complianceStatusForDate(d.expiry_date, todayIso) === "current"
  );
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
          <div className="flex items-center gap-3 font-mono text-xs tracking-widest text-muted-foreground uppercase">
            <span className="text-teal font-semibold">03</span>
            COMPLIANCE OVERVIEW
          </div>
          <h2 className="font-serif text-[34px] leading-tight text-foreground">Document Compliance</h2>
          <p className="text-muted-foreground text-sm font-sans tracking-wide max-w-xl">
            All {compliance.total} client documents — {pct}% currently compliant.
          </p>
        </div>
        <UploadDocumentModal clients={clients} />
      </div>

      {/* ─── STAT CARDS ─── */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Current", count: compliance.current, accent: "teal" as const, pct: compliance.total > 0 ? Math.round((compliance.current / compliance.total) * 100) : 0 },
          { label: "Expiring (30 days)", count: compliance.expiring, accent: "gold" as const, pct: compliance.total > 0 ? Math.round((compliance.expiring / compliance.total) * 100) : 0 },
          { label: "Expired", count: compliance.expired, accent: "danger" as const, pct: compliance.total > 0 ? Math.round((compliance.expired / compliance.total) * 100) : 0 },
        ].map((stat) => (
          <Card key={stat.label} className="bg-card border-border rounded-sm p-6">
            <div className={`font-mono text-[10px] uppercase tracking-widest mb-3 ${ACCENT_CLASSES[stat.accent].text}`}>{stat.label}</div>
            <div className="font-serif text-4xl text-foreground mb-1">{stat.count}</div>
            <div className="text-xs text-muted-foreground font-mono">{stat.pct}% of total</div>
          </Card>
        ))}
      </div>

      {/* ─── TABS ─── */}
      <div className="flex items-center gap-10 border-b border-border">
        {TABS.map((tab) => {
          const isActive = active === tab.key;
          const href = tab.key === "all" ? "/admin/compliance" : `/admin/compliance?status=${tab.key}`;
          return (
            <Link
              key={tab.key}
              href={href}
              className={`group relative flex items-center gap-2 pb-3 font-mono text-[11px] uppercase tracking-widest transition-colors ${
                isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground/80"
              }`}
            >
              <span>{tab.label}</span>
              <span className={`text-[10px] ${isActive ? "text-foreground/70" : "text-muted-foreground/70"}`}>
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
          {current.length > 0 && <DocTable title="Current" accent="teal" docs={current} todayIso={todayIso} />}
          {expiring.length > 0 && <DocTable title="Expiring Soon (next 30 days)" accent="gold" docs={expiring} todayIso={todayIso} showReminder />}
          {expired.length > 0 && <DocTable title="Expired" accent="danger" docs={expired} todayIso={todayIso} showReminder />}
          {undated.length > 0 && <DocTable title="No Expiry Date" accent="neutral" docs={undated} todayIso={todayIso} />}
        </>
      )}
      {active === "expired" && (
        expired.length > 0
          ? <DocTable title="Expired" accent="danger" docs={expired} todayIso={todayIso} showReminder />
          : <EmptyTab label="No expired documents" />
      )}
      {active === "expiring" && (
        expiring.length > 0
          ? <DocTable title="Expiring Soon (next 30 days)" accent="gold" docs={expiring} todayIso={todayIso} showReminder />
          : <EmptyTab label="No documents expiring in the next 30 days" />
      )}
      {active === "current" && (
        current.length > 0
          ? <DocTable title="Current" accent="teal" docs={current} todayIso={todayIso} />
          : <EmptyTab label="No current documents" />
      )}
      {active === "undated" && (
        undated.length > 0
          ? <DocTable title="No Expiry Date" accent="neutral" docs={undated} todayIso={todayIso} />
          : <EmptyTab label="No documents without an expiry date" />
      )}
    </div>
  );
}

function EmptyTab({ label }: { label: string }) {
  return (
    <Card className="bg-card border-border rounded-sm py-12 text-center text-muted-foreground/50 font-mono text-xs uppercase tracking-widest">
      {label}
    </Card>
  );
}

function DocTable({
  title,
  accent,
  docs,
  todayIso,
  showReminder = false,
}: {
  title: string;
  accent: Accent;
  docs: ComplianceDocRow[];
  todayIso: string;
  showReminder?: boolean;
}) {
  return (
    <Card className="bg-card border-border rounded-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-border flex items-center gap-3">
        <div className={`w-2 h-2 rounded-full ${ACCENT_CLASSES[accent].dot}`} />
        <span className={`font-mono text-[10px] uppercase tracking-widest ${ACCENT_CLASSES[accent].text}`}>{title}</span>
        <span className="font-mono text-[10px] text-muted-foreground/50 ml-auto">{docs.length} docs</span>
      </div>
      <table className="w-full text-left font-sans text-sm">
        <thead className="bg-muted">
          <tr className="text-[10px] font-mono tracking-widest uppercase text-muted-foreground">
            <th className="font-normal px-6 py-3 border-b border-border">Document</th>
            <th className="font-normal px-4 py-3 border-b border-border">Client</th>
            <th className="font-normal px-4 py-3 border-b border-border">Expiry Date</th>
            <th className="font-normal px-4 py-3 border-b border-border">Status</th>
            <th className="font-normal px-4 py-3 border-b border-border text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {docs.map((doc) => {
            const expDate = doc.expiry_date ? new Date(doc.expiry_date) : null;
            const daysLeft = doc.expiry_date
              ? daysUntilExpiry(doc.expiry_date, todayIso)
              : null;
            const expDateLabel = expDate
              ? expDate.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
              : "—";
            return (
              <ComplianceDocRowItem
                key={doc.id}
                doc={doc}
                accent={accent}
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
