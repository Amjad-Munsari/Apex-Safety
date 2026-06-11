"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { FileDownloadMenu } from "@/components/client/file-download-menu";
import { StatusPill, type StatusTone } from "@/components/client/status-pill";
import { openReport } from "../reports/open-report";
import type { AssessmentRow, AssessmentStatus } from "./status";

const STATUS_LABEL: Record<AssessmentStatus, string> = {
  completed: "Completed",
  submitted: "Submitted",
  in_progress: "In Progress",
  scheduled: "Scheduled",
};

const TONE: Record<AssessmentStatus, StatusTone> = {
  completed: "success",
  submitted: "info",
  in_progress: "warning",
  scheduled: "neutral",
};

const STATUS_ORDER: Record<AssessmentStatus, number> = {
  in_progress: 0,
  scheduled: 1,
  submitted: 2,
  completed: 3,
};

interface Props {
  rows: AssessmentRow[];
}

export function AssessmentsList({ rows }: Props) {
  const sorted = [...rows].sort(
    (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
  );

  return (
    <section className="space-y-4">
      <div className="bg-white border border-[#e5e1d8] rounded-sm shadow-[0_1px_2px_rgba(0,0,0,0.02)] overflow-hidden">
        {/* Column header */}
        <div className="hidden md:grid grid-cols-[minmax(0,1fr)_140px_140px_220px] gap-4 px-6 py-3 border-b border-[#f0ede6] font-mono text-[8px] tracking-[0.25em] text-[#8a857f] uppercase font-bold">
          <span>Name</span>
          <span>Date</span>
          <span>Status</span>
          <span className="text-right">Actions</span>
        </div>

        <div className="divide-y divide-[#f0ede6]">
          {sorted.map((row) => {
            const isCompleted = row.status === "completed";
            return (
              <div
                key={row.id}
                className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_140px_140px_220px] gap-4 px-6 py-4 items-center hover:bg-[#faf9f6]/80 transition-all group"
              >
                {/* Name */}
                <Link href={`/client/assessments/${row.id}`} className="min-w-0 space-y-1">
                  <div className="font-sans font-semibold text-[15px] text-[#1a1a1a] tracking-tight group-hover:text-black truncate">
                    {row.name}
                  </div>
                </Link>

                {/* Date */}
                <div className="font-mono text-[10px] tracking-[0.15em] text-[#6b6560] uppercase font-bold">
                  <span className="md:hidden text-[#8a857f] mr-2">Date:</span>
                  {row.date}
                </div>

                {/* Status */}
                <div>
                  <StatusPill tone={TONE[row.status]} label={STATUS_LABEL[row.status]} />
                </div>

                {/* Actions */}
                <div className="flex items-center justify-start md:justify-end gap-2">
                  {isCompleted ? (
                    <FileDownloadMenu
                      size="sm"
                      label="Download report"
                      onDownload={() => openReport(row.id, "download")}
                      onView={() => openReport(row.id, "view")}
                    />
                  ) : (
                    <Link href={`/client/assessments/${row.id}`}>
                      <Button
                        variant="outline"
                        className="rounded-sm border-[#e5e1d8] bg-transparent text-[#1a1a1a] hover:bg-[#f9f8f6] h-9 px-4 font-bold text-[8.5px] uppercase tracking-[0.25em] shadow-none transition-all"
                      >
                        View
                        <ChevronRight className="w-3 h-3 ml-1" />
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
