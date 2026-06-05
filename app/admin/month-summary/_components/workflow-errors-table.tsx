import Link from "next/link";
import { Card } from "@/components/ui/card";
import { describeWorkflowError } from "@/lib/workflow-errors";
import type { WorkflowErrorWithDetails } from "@/lib/supabase/dashboard";

const severityColor: Record<string, string> = {
  high: "text-danger",
  medium: "text-gold",
  low: "text-white/40",
};

export function WorkflowErrorsTable({ rows }: { rows: WorkflowErrorWithDetails[] }) {
  return (
    <Card className="bg-[#1c1c1c] border-white/5 rounded-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-white/5 flex items-center gap-3">
        <span className="font-mono text-[10px] uppercase tracking-widest text-[#555]">Workflow Errors This Month</span>
        <span className="font-mono text-[10px] text-white/20 ml-auto">{rows.length} records</span>
      </div>

      {rows.length > 0 ? (
        <>
          <div className="divide-y divide-white/5">
            {rows.map((e) => {
              const friendly = describeWorkflowError(e.workflow_name);
              return (
                <div key={e.id} className="px-6 py-7 flex justify-between items-stretch gap-6">
                  {/* Left: what failed + details */}
                  <div className="min-w-0 flex-1">
                    <div className="text-white/90 font-semibold text-base">{friendly.title}</div>
                    <div className="text-white/50 text-xs mt-1.5 max-w-lg">{friendly.message}</div>

                    {e.details.length > 0 ? (
                      <div className="flex flex-wrap gap-x-8 gap-y-2 mt-5">
                        {e.details.map((d) => (
                          <div key={d.label} className="flex items-baseline gap-2">
                            <span className="font-mono text-[10px] uppercase tracking-widest text-[#555]">{d.label}</span>
                            <span className="text-white/80 text-xs">{d.value}</span>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  {/* Right: severity + when (top), review link aligned to the
                      bottom so it sits level with the details row */}
                  <div className="flex flex-col items-end shrink-0 text-right">
                    <div className="flex flex-col items-end gap-1.5">
                      {e.severity ? (
                        <span
                          className={`font-mono text-[10px] uppercase tracking-widest ${
                            severityColor[e.severity.toLowerCase()] || "text-white/40"
                          }`}
                        >
                          {e.severity}
                        </span>
                      ) : null}
                      <span className="text-white/50 font-mono text-xs whitespace-nowrap">
                        {new Date(e.created_at).toLocaleString("en-GB", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    {e.submissionId ? (
                      <Link
                        href={`/admin/assessments/${e.submissionId}/review`}
                        className="font-mono text-[10px] uppercase tracking-widest text-white/60 hover:text-white transition-colors whitespace-nowrap mt-auto pt-4"
                      >
                        Open assessment review →
                      </Link>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
          {rows.length === 25 ? (
            <div className="px-6 py-2 text-[10px] font-mono text-white/30 border-t border-white/5">
              Showing 25 most recent — see direct DB query for full month
            </div>
          ) : null}
        </>
      ) : (
        <div className="px-6 py-12 text-center text-white/20 font-mono text-xs uppercase tracking-widest">
          No workflow errors this month
        </div>
      )}
    </Card>
  );
}
