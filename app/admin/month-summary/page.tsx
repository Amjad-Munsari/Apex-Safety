import { adminClient } from "@/lib/supabase/admin";
import { getWorkflowErrorsSince } from "@/lib/supabase/dashboard";
import { Card } from "@/components/ui/card";
import Link from "next/link";
import { WorkflowErrorsTable } from "./_components/workflow-errors-table";

export const dynamic = "force-dynamic";

export default async function MonthSummaryPage() {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const monthName = now.toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  const [assessmentsRes, documentsRes, proposalsRes, errorsRes, recentErrors] = await Promise.all([
    adminClient
      .from("form_submissions")
      .select("*", { count: "exact", head: true })
      .gte("created_at", startOfMonth),
    adminClient
      .from("documents")
      .select("*", { count: "exact", head: true })
      .gte("uploaded_at", startOfMonth),
    adminClient
      .from("proposals")
      .select("*", { count: "exact", head: true })
      .gte("created_at", startOfMonth),
    adminClient
      .from("workflow_errors")
      .select("*", { count: "exact", head: true })
      .gte("created_at", startOfMonth),
    // Same enrichment (friendly title/message + resolved client/form names) as
    // the dashboard and /admin/errors surfaces.
    getWorkflowErrorsSince(startOfMonth, 25),
  ]);

  // Recent assessments this month
  type RecentAssessmentRow = {
    id: string
    status: string
    created_at: string
    client: { name: string } | null
    template: { form_templates: { name: string } | null } | null
  }
  const { data: recentAssessmentsRaw } = await adminClient
    .from("form_submissions")
    .select(`
      id,
      status,
      created_at,
      client:clients(name),
      template:template_versions(form_templates(name))
    `)
    .gte("created_at", startOfMonth)
    .order("created_at", { ascending: false })
    .limit(10);
  const recentAssessments = (recentAssessmentsRaw ?? []) as unknown as RecentAssessmentRow[];

  const stats = [
    {
      num: "01",
      label: "Assessments",
      count: assessmentsRes.count || 0,
      color: "white",
      sub: "form submissions",
    },
    {
      num: "02",
      label: "Documents Uploaded",
      count: documentsRes.count || 0,
      color: "teal",
      sub: "compliance docs",
    },
    {
      num: "03",
      label: "Proposals Raised",
      count: proposalsRes.count || 0,
      color: "gold",
      sub: "new proposals",
    },
    {
      num: "04",
      label: "Workflow Errors",
      count: errorsRes.count || 0,
      color: errorsRes.count && errorsRes.count > 0 ? "danger" : "[#555]",
      sub: "n8n errors",
    },
  ];

  const statusLabel: Record<string, string> = {
    // D-09 canonical taxonomy (per 07-CONTEXT.md)
    in_progress: "In Progress",
    submitted: "Submitted",
    draft_ready_for_review: "Awaiting Review",
    completed: "Completed",
    ai_draft_failed: "AI Draft Failed",
    // Legacy keys retained for pre-D-09 rows
    draft: "Draft",
    delivered: "Delivered",
  };

  const statusColor: Record<string, string> = {
    // D-09 canonical taxonomy
    in_progress: "text-white/40",
    submitted: "text-white/60",
    draft_ready_for_review: "text-gold",
    completed: "text-teal",
    ai_draft_failed: "text-danger",
    // Legacy
    draft: "text-[#555]",
    delivered: "text-teal",
  };

  return (
    <div className="flex flex-col gap-8 pt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* ─── HEADER ─── */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3 font-mono text-xs tracking-widest text-[#666] uppercase">
          <span className="text-teal font-semibold">06</span>
          MONTHLY REPORT
        </div>
        <h2 className="font-serif text-[34px] leading-tight text-white">Month Summary</h2>
        <p className="text-[#666] text-sm font-sans tracking-wide max-w-xl">
          Activity overview for {monthName}.
        </p>
      </div>

      {/* ─── STAT CARDS ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.num} className="bg-[#1c1c1c] border-white/5 rounded-sm p-6">
            <div className="font-mono text-[10px] uppercase tracking-widest text-[#555] mb-3 flex items-center gap-2">
              <span className="text-white/20">{stat.num}</span> {stat.label}
            </div>
            <div className={`font-serif text-5xl text-${stat.color} mb-1`}>{stat.count}</div>
            <div className="text-xs text-[#444] font-mono">{stat.sub}</div>
          </Card>
        ))}
      </div>

      {/* ─── WORKFLOW ERRORS (row-level, D-11(c) acceptance surface) ─── */}
      <WorkflowErrorsTable rows={recentErrors} />

      {/* ─── RECENT ASSESSMENTS ─── */}
      <Card className="bg-[#1c1c1c] border-white/5 rounded-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-white/5 flex items-center gap-3">
          <span className="font-mono text-[10px] uppercase tracking-widest text-[#555]">Assessments This Month</span>
          <span className="font-mono text-[10px] text-white/20 ml-auto">{recentAssessments?.length || 0} records</span>
        </div>
        {recentAssessments && recentAssessments.length > 0 ? (
          <table className="w-full text-left font-sans text-sm">
            <thead className="bg-[#151515]">
              <tr className="text-[10px] font-mono tracking-widest uppercase text-[#555]">
                <th className="font-normal px-6 py-3 border-b border-white/5">Client</th>
                <th className="font-normal px-4 py-3 border-b border-white/5">Template</th>
                <th className="font-normal px-4 py-3 border-b border-white/5">Date</th>
                <th className="font-normal px-4 py-3 border-b border-white/5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {recentAssessments.map((a) => {
                // Editable drafts open the fill page; everything else opens the
                // read-only review surface. The fill page autosaves on mount
                // (interpreter cascade-clear) and only matches status='draft',
                // so sending a submitted/completed assessment there throws.
                const editable = a.status === "draft" || a.status === "in_progress";
                const href = editable
                  ? `/admin/assessments/${a.id}`
                  : `/admin/assessments/${a.id}/review`;
                return (
                <tr key={a.id} className="group relative hover:bg-white/[0.02] transition-colors cursor-pointer">
                  <td className="px-6 py-4 text-white font-medium">
                    <Link
                      href={href}
                      className="absolute inset-0 z-0"
                      aria-label={`Open ${a.client?.name || "assessment"}`}
                    />
                    <span className="relative z-10 pointer-events-none">{a.client?.name || "—"}</span>
                  </td>
                  <td className="px-4 py-4 text-white/60 text-xs">
                    <span className="relative z-10 pointer-events-none">{a.template?.form_templates?.name || "—"}</span>
                  </td>
                  <td className="px-4 py-4 text-white/50 font-mono text-xs">
                    <span className="relative z-10 pointer-events-none">
                      {new Date(a.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`relative z-10 pointer-events-none inline-flex items-center justify-between gap-3 w-full font-mono text-[10px] uppercase tracking-widest ${statusColor[a.status] || "text-white/40"}`}>
                      {statusLabel[a.status] || a.status}
                      <span className="text-white/20">&rarr;</span>
                    </span>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="px-6 py-12 text-center text-white/20 font-mono text-xs uppercase tracking-widest">
            No assessments this month
          </div>
        )}
      </Card>
    </div>
  );
}
