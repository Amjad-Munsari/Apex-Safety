import { createClient } from "@/lib/supabase/server";
import { getClientContext } from "@/lib/auth-helpers";
import { ReportsList } from "./reports-list";

export const dynamic = "force-dynamic";

export interface Report {
  id: string;
  number: string;
  title: string;
  location: string;
  date: string;
  consultant: string;
  pages: string;
  status: "FINAL" | "DRAFT" | "PENDING";
}

const DATE_FMT: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };

function statusFor(s: string): Report["status"] {
  if (s === "completed") return "FINAL";
  if (s === "ai_draft_failed") return "PENDING";
  return "DRAFT";
}

export default async function ReportsPage() {
  const ctx = await getClientContext();
  if (!ctx) {
    return <ReportsEmpty headline="Sign in to view your reports." body="Once your account is linked to a client, completed assessments will appear here." />;
  }

  const supabase = await createClient();
  const { data: client } = await supabase
    .from("clients")
    .select("site_address")
    .eq("id", ctx.client_id)
    .maybeSingle();

  // Surface completed + draft-ready assessments. Submissions still in progress
  // are filtered out — they're not deliverables yet.
  const { data: submissions } = await supabase
    .from("form_submissions")
    .select(`
      id,
      status,
      created_at,
      submitted_at,
      report_storage_path,
      template:template_versions(form_templates(name))
    `)
    .eq("client_id", ctx.client_id)
    .in("status", ["completed", "draft_ready_for_review", "ai_draft_failed"])
    .is("deleted_at", null)
    .order("submitted_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  const reports: Report[] = (submissions ?? []).map((row, idx) => {
    const tpl = (row.template as { form_templates?: { name?: string } | null } | null)?.form_templates?.name ?? "Assessment";
    const when = row.submitted_at ?? row.created_at;
    return {
      id: row.id,
      number: String(idx + 1).padStart(2, "0"),
      title: tpl,
      location: client?.site_address ?? "—",
      date: new Date(when).toLocaleDateString("en-GB", DATE_FMT),
      consultant: "Matt Robinson",
      pages: row.report_storage_path ? "PDF" : "—",
      status: statusFor(row.status),
    };
  });

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* ─── PAGE HEADER ─── */}
      <section className="space-y-3">
        <div className="flex items-center gap-3">
           <span className="font-mono text-[10px] text-[#3b8273] tracking-[0.4em] uppercase font-medium">03 Deliverables</span>
        </div>
        <h2 className="font-serif text-[44px] text-[#1a1a1a] font-normal tracking-tight leading-[1.05]">
          Assessments &amp; reports.
        </h2>
      </section>

      {reports.length === 0 ? (
        <ReportsEmpty headline="No reports yet." body="Completed assessments your consultant approves will appear here as downloadable PDFs." />
      ) : (
        <ReportsList reports={reports} />
      )}
    </div>
  );
}

function ReportsEmpty({ headline, body }: { headline: string; body: string }) {
  return (
    <div className="bg-white border border-[#e5e1d8] rounded-sm shadow-[0_1px_2px_rgba(0,0,0,0.02)] px-10 py-16 text-center">
      <p className="font-serif text-[20px] text-[#1a1a1a] mb-3">{headline}</p>
      <p className="font-sans text-[13px] text-[#8a857f] max-w-md mx-auto leading-relaxed">{body}</p>
    </div>
  );
}
