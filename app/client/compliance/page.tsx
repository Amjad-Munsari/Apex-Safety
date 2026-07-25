import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { getClientContext } from "@/lib/auth-helpers";
import { ComplianceView, type ComplianceCategory, type ComplianceDoc, type ComplianceStatus } from "./compliance-view";
import { ClientDataLoadError } from "@/components/client/data-load-error";
import {
  complianceStatusForDate,
  todayIsoInTimeZone,
} from "@/lib/compliance/expiry-status";

export const dynamic = "force-dynamic";

interface DocumentRow {
  id: string;
  filename: string;
  document_category: string | null;
  expiry_date: string | null;
  uploaded_at: string;
  file_size_bytes: number | null;
}

const DATE_FMT: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-GB", DATE_FMT);
}

function formatSize(bytes: number | null): string {
  if (bytes === null || bytes <= 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function computeStatus(expiryIso: string | null, todayIso: string): ComplianceStatus {
  const status = complianceStatusForDate(expiryIso, todayIso);
  // Undated documents remain usable records and are shown as Current on the
  // client surface; the admin compliance screen separates them.
  return status === "undated" ? "CURRENT" : status.toUpperCase() as ComplianceStatus;
}

function groupByCategory(docs: DocumentRow[]): ComplianceCategory[] {
  const todayIso = todayIsoInTimeZone();
  const buckets = new Map<string, ComplianceDoc[]>();

  for (const d of docs) {
    const category = (d.document_category ?? "Uncategorized").trim() || "Uncategorized";
    const ui: ComplianceDoc = {
      id: d.id,
      title: d.filename,
      size: formatSize(d.file_size_bytes),
      issued: formatDate(d.uploaded_at),
      expires: d.expiry_date ? formatDate(d.expiry_date) : null,
      status: computeStatus(d.expiry_date, todayIso),
    };
    const arr = buckets.get(category);
    if (arr) arr.push(ui);
    else buckets.set(category, [ui]);
  }

  return Array.from(buckets.entries())
    .map(([name, documents]) => ({ name: name.toUpperCase(), count: documents.length, documents }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function fetchClientDocuments(): Promise<{
  categories: ComplianceCategory[];
  failed: boolean;
}> {
  const ctx = await getClientContext();
  if (!ctx) return { categories: [], failed: false };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("documents")
    .select("id, filename, document_category, expiry_date, uploaded_at, file_size_bytes")
    .eq("client_id", ctx.client_id)
    .is("deleted_at", null)
    .order("expiry_date", { ascending: true, nullsFirst: false });

  if (error) {
    console.error("[client/compliance] failed to load documents", error);
    return { categories: [], failed: true };
  }

  return {
    categories: groupByCategory((data ?? []) as DocumentRow[]),
    failed: false,
  };
}

export default async function CompliancePage() {
  const { categories, failed } = await fetchClientDocuments();

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <section className="space-y-3">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[10px] text-teal tracking-[0.4em] uppercase font-medium">
            02 By Category
          </span>
        </div>
        <h2 className="font-serif text-[44px] text-foreground font-normal tracking-tight leading-[1.05]">
          Your compliance documents.
        </h2>
      </section>

      {failed ? (
        <ClientDataLoadError itemName="compliance documents" />
      ) : categories.length === 0 ? (
        <ComplianceEmpty />
      ) : (
        <Suspense fallback={null}>
          <ComplianceView categories={categories} />
        </Suspense>
      )}
    </div>
  );
}

function ComplianceEmpty() {
  return (
    <div className="bg-card border border-border rounded-sm shadow-[0_1px_2px_rgba(0,0,0,0.02)] px-10 py-16 text-center">
      <p className="font-serif text-[20px] text-foreground mb-3">No documents yet.</p>
      <p className="font-sans text-[13px] text-muted-foreground max-w-md mx-auto leading-relaxed">
        Compliance documents your consultant uploads — risk assessments, training certificates,
        certificates of inspection — will appear here, grouped by category.
      </p>
    </div>
  );
}
