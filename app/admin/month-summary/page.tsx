import { adminClient } from "@/lib/supabase/admin";
import { getWorkflowErrorsSince } from "@/lib/supabase/dashboard";
import { Card } from "@/components/ui/card";
import Link from "next/link";
import { WorkflowErrorsTable } from "./_components/workflow-errors-table";

export const dynamic = "force-dynamic";

export default async function MonthSummaryPage() {
  const now = new Date();
  // UTC boundary. The old `new Date(y, m, 1)` built LOCAL midnight and then
  // serialised as UTC, so during BST the window opened at 23:00 on the last day
  // of the previous month and counted an hour of it.
  const startOfMonth = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
  ).toISOString();
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

  // Static class strings, NOT `text-${color}`. Tailwind scans source text for
  // class candidates, so an interpolated name is never seen by the compiler —
  // an interpolated utility only renders when some unrelated file happens to use
  // the same literal, which is how the Assessments tile broke: its colour was
  // "white" → `text-white`, a class that IS generated (billing uses it), so the
  // count rendered white-on-white and read as a missing number.
  const stats = [
    {
      num: "01",
      label: "Assessments",
      count: assessmentsRes.count || 0,
      className: "text-foreground",
      sub: "form submissions",
    },
    {
      num: "02",
      label: "Documents Uploaded",
      count: documentsRes.count || 0,
      className: "text-teal",
      sub: "compliance docs",
    },
    {
      num: "03",
      label: "Proposals Raised",
      count: proposalsRes.count || 0,
      className: "text-gold",
      sub: "new proposals",
    },
    {
      num: "04",
      label: "Workflow Errors",
      count: errorsRes.count || 0,
      className:
        errorsRes.count && errorsRes.count > 0 ? "text-danger" : "text-muted-foreground",
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
    in_progress: "text-muted-foreground",
    submitted: "text-foreground/60",
    draft_ready_for_review: "text-gold",
    completed: "text-teal",
    ai_draft_failed: "text-danger",
    // Legacy
    draft: "text-muted-foreground",
    delivered: "text-teal",
  };

  return (
    <div className="flex flex-col gap-8 pt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* ─── HEADER ─── */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3 font-mono text-xs tracking-widest text-muted-foreground uppercase">
          <span className="text-teal font-semibold">06</span>
          MONTHLY REPORT
        </div>
        <h2 className="font-serif text-[34px] leading-tight text-foreground">Month Summary</h2>
        <p className="text-muted-foreground text-sm font-sans tracking-wide max-w-xl">
          Activity overview for {monthName}.
        </p>
      </div>

      {/* ─── STAT CARDS ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.num} className="bg-card border-border rounded-sm p-6">
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
              <span className="text-muted-foreground/50">{stat.num}</span> {stat.label}
            </div>
            <div className={`font-serif text-5xl mb-1 ${stat.className}`}>{stat.count}</div>
            <div className="text-xs text-muted-foreground font-mono">{stat.sub}</div>
          </Card>
        ))}
      </div>

      {/* ─── RECENT ASSESSMENTS ─── */}
      <Card className="bg-card border-border rounded-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center gap-3">
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Assessments This Month</span>
          <span className="font-mono text-[10px] text-muted-foreground/50 ml-auto">{recentAssessments?.length || 0} records</span>
        </div>
        {recentAssessments && recentAssessments.length > 0 ? (
          <table className="w-full text-left font-sans text-sm">
            <thead className="bg-muted">
              <tr className="text-[10px] font-mono tracking-widest uppercase text-muted-foreground">
                <th className="font-normal px-6 py-3 border-b border-border">Client</th>
                <th className="font-normal px-4 py-3 border-b border-border">Template</th>
                <th className="font-normal px-4 py-3 border-b border-border">Date</th>
                <th className="font-normal px-4 py-3 border-b border-border">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
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
                <tr key={a.id} className="group relative hover:bg-muted/50 transition-colors cursor-pointer">
                  <td className="px-6 py-4 text-foreground font-medium">
                    <Link
                      href={href}
                      className="absolute inset-0 z-0"
                      aria-label={`Open ${a.client?.name || "assessment"}`}
                    />
                    <span className="relative z-10 pointer-events-none">{a.client?.name || "—"}</span>
                  </td>
                  <td className="px-4 py-4 text-foreground/60 text-xs">
                    <span className="relative z-10 pointer-events-none">{a.template?.form_templates?.name || "—"}</span>
                  </td>
                  <td className="px-4 py-4 text-muted-foreground font-mono text-xs">
                    <span className="relative z-10 pointer-events-none">
                      {new Date(a.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`relative z-10 pointer-events-none inline-flex items-center justify-between gap-3 w-full font-mono text-[10px] uppercase tracking-widest ${statusColor[a.status] || "text-muted-foreground"}`}>
                      {statusLabel[a.status] || a.status}
                      <span className="text-muted-foreground/50">&rarr;</span>
                    </span>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="px-6 py-12 text-center text-muted-foreground/50 font-mono text-xs uppercase tracking-widest">
            No assessments this month
          </div>
        )}
      </Card>

      {/* ─── WORKFLOW ERRORS (row-level, D-11(c) acceptance surface) ─── */}
      <WorkflowErrorsTable rows={recentErrors} />
    </div>
  );
}
