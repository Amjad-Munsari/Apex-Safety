"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { ChevronDown } from "lucide-react";

export type WorkflowErrorRow = {
  id: string;
  workflow_name: string;
  error_message: string | null;
  created_at: string;
  submission_id: string | null;
  severity: string | null;
  client_name: string | null;
  assessment_date: string | null;
  type: string | null;
  report_storage_path: string | null;
};

const severityColor: Record<string, string> = {
  high: "text-danger",
  medium: "text-gold",
  low: "text-white/40",
};

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-mono text-[10px] uppercase tracking-widest text-[#555]">{label}</span>
      <span className="text-white/70 text-xs break-words">{value}</span>
    </div>
  );
}

export function WorkflowErrorsTable({ rows }: { rows: WorkflowErrorRow[] }) {
  // Independent toggles — any number of rows can be open at once.
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <Card className="bg-[#1c1c1c] border-white/5 rounded-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-white/5 flex items-center gap-3">
        <span className="font-mono text-[10px] uppercase tracking-widest text-[#555]">Workflow Errors This Month</span>
        <span className="font-mono text-[10px] text-white/20 ml-auto">{rows.length} records</span>
      </div>
      {rows.length > 0 ? (
        <>
          <table className="w-full text-left font-sans text-sm">
            <thead className="bg-[#151515]">
              <tr className="text-[10px] font-mono tracking-widest uppercase text-[#555]">
                <th className="font-normal px-6 py-3 border-b border-white/5">Workflow</th>
                <th className="font-normal px-4 py-3 border-b border-white/5">Message</th>
                <th className="font-normal px-4 py-3 border-b border-white/5">Severity</th>
                <th className="font-normal px-4 py-3 border-b border-white/5">Submission</th>
                <th className="font-normal px-4 py-3 border-b border-white/5">When</th>
                <th className="font-normal px-4 py-3 border-b border-white/5 w-8" aria-hidden />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {rows.map((e) => {
                const open = openIds.has(e.id);
                return (
                  <Fragment key={e.id}>
                    <tr
                      onClick={() => toggle(e.id)}
                      aria-expanded={open}
                      className="hover:bg-white/[0.02] transition-colors align-top cursor-pointer"
                    >
                      <td className="px-6 py-4 font-mono text-xs text-white/80">{e.workflow_name}</td>
                      <td className="px-4 py-4 text-white/70 text-xs max-w-md truncate">{e.error_message}</td>
                      <td className="px-4 py-4">
                        <span
                          className={`font-mono text-[10px] uppercase tracking-widest ${
                            severityColor[(e.severity ?? "").toLowerCase()] || "text-white/40"
                          }`}
                        >
                          {e.severity || "—"}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        {e.submission_id ? (
                          <span className="font-mono text-[10px] text-white/60">
                            {String(e.submission_id).slice(0, 8)}
                          </span>
                        ) : (
                          <span className="font-mono text-[10px] text-white/30">—</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-white/50 font-mono text-xs whitespace-nowrap">
                        {new Date(e.created_at).toLocaleString("en-GB", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-4 py-4 text-white/30">
                        <ChevronDown
                          className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`}
                        />
                      </td>
                    </tr>
                    {open ? (
                      <tr className="bg-[#151515]">
                        <td colSpan={6} className="px-6 py-5 border-l-2 border-white/10">
                          <div className="flex flex-col gap-4">
                            <div className="flex flex-col gap-1">
                              <span className="font-mono text-[10px] uppercase tracking-widest text-[#555]">
                                Full message
                              </span>
                              <span className="text-white/80 text-xs break-words whitespace-pre-wrap">
                                {e.error_message || "—"}
                              </span>
                            </div>

                            {(e.client_name || e.assessment_date || e.type || e.report_storage_path) ? (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {e.client_name ? <DetailItem label="Client" value={e.client_name} /> : null}
                                {e.assessment_date ? (
                                  <DetailItem label="Assessment date" value={e.assessment_date} />
                                ) : null}
                                {e.type ? <DetailItem label="Type" value={e.type} /> : null}
                                {e.report_storage_path ? (
                                  <DetailItem label="Report storage path" value={e.report_storage_path} />
                                ) : null}
                              </div>
                            ) : null}

                            {e.submission_id ? (
                              <Link
                                href={`/admin/assessments/${e.submission_id}/review`}
                                className="font-mono text-[10px] uppercase tracking-widest text-white/60 hover:text-white transition-colors w-fit"
                              >
                                Open assessment review →
                              </Link>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
          {rows.length === 25 ? (
            <div className="px-6 py-2 text-[10px] font-mono text-white/30">
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
