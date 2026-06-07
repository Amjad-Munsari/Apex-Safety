import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { getClientContext } from "@/lib/auth-helpers";
import { ComplianceView, type ComplianceCategory, type ComplianceDoc, type ComplianceStatus } from "./compliance-view";

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

function computeStatus(expiryIso: string | null, now: Date, thirtyDays: Date): ComplianceStatus {
  if (!expiryIso) return "CURRENT";
  const exp = new Date(expiryIso);
  if (exp < now) return "EXPIRED";
  if (exp < thirtyDays) return "EXPIRING";
  return "CURRENT";
}

function groupByCategory(docs: DocumentRow[]): ComplianceCategory[] {
  const now = new Date();
  const thirtyDays = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const buckets = new Map<string, ComplianceDoc[]>();

  for (const d of docs) {
    const category = (d.document_category ?? "Uncategorized").trim() || "Uncategorized";
    const ui: ComplianceDoc = {
      id: d.id,
      title: d.filename,
      size: formatSize(d.file_size_bytes),
      issued: formatDate(d.uploaded_at),
      expires: d.expiry_date ? formatDate(d.expiry_date) : null,
      status: computeStatus(d.expiry_date, now, thirtyDays),
    };
    const arr = buckets.get(category);
    if (arr) arr.push(ui);
    else buckets.set(category, [ui]);
  }

  return Array.from(buckets.entries())
    .map(([name, documents]) => ({ name: name.toUpperCase(), count: documents.length, documents }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function fetchClientDocuments(): Promise<ComplianceCategory[]> {
  const ctx = await getClientContext();
  if (!ctx) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("documents")
    .select("id, filename, document_category, expiry_date, uploaded_at, file_size_bytes")
    .eq("client_id", ctx.client_id)
    .is("deleted_at", null)
    .order("expiry_date", { ascending: true, nullsFirst: false });

  if (error) {
    console.error("[client/compliance] failed to load documents", error);
    return [];
  }

  return groupByCategory((data ?? []) as DocumentRow[]);
}

export default async function CompliancePage() {
  const categories = await fetchClientDocuments();

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <section className="space-y-3">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[10px] text-teal tracking-[0.4em] uppercase font-medium">
            02 By Category
          </span>
        </div>
        <h2 className="font-serif text-[44px] text-[#1a1a1a] font-normal tracking-tight leading-[1.05]">
          Your compliance documents.
        </h2>
      </section>

      {categories.length === 0 ? (
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
    <div className="bg-white border border-[#e5e1d8] rounded-sm shadow-[0_1px_2px_rgba(0,0,0,0.02)] px-10 py-16 text-center">
      <p className="font-serif text-[20px] text-[#1a1a1a] mb-3">No documents yet.</p>
      <p className="font-sans text-[13px] text-[#8a857f] max-w-md mx-auto leading-relaxed">
        Compliance documents your consultant uploads — risk assessments, training certificates,
        certificates of inspection — will appear here, grouped by category.
      </p>
    </div>
  );
}
