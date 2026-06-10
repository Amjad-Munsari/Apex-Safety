"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ChevronRight, Download, ExternalLink } from "lucide-react";
import { PdfPreviewDialog } from "@/components/client/pdf-preview-dialog";
import type { AssessmentRow, AssessmentStatus } from "./status";

const STATUS_LABEL: Record<AssessmentStatus, string> = {
  completed: "Completed",
  submitted: "Submitted",
  in_progress: "In Progress",
  scheduled: "Scheduled",
};

const STATUS_PILL: Record<AssessmentStatus, { border: string; text: string; dot: string }> = {
  completed: { border: "border-[#3b8273]", text: "text-[#3b8273]", dot: "bg-[#3b8273]" },
  submitted: { border: "border-[#4f6d8f]", text: "text-[#4f6d8f]", dot: "bg-[#4f6d8f]" },
  in_progress: { border: "border-[#c0a66d]", text: "text-[#8a6d24]", dot: "bg-[#c0a66d]" },
  scheduled: { border: "border-[#8a857f]", text: "text-[#6b6560]", dot: "bg-[#8a857f]" },
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
  const [previewRow, setPreviewRow] = useState<AssessmentRow | null>(null);

  const sorted = [...rows].sort(
    (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
  );

  return (
    <>
      {/* ─── TABLE ─── */}
      <section className="space-y-4">
        <div className="bg-white border border-[#e5e1d8] rounded-sm shadow-sm overflow-hidden">
          {/* Column header */}
          <div className="hidden md:grid grid-cols-[minmax(0,1fr)_140px_140px_220px] gap-4 px-6 py-3 border-b border-[#f0ede6] font-mono text-[10px] tracking-[0.25em] text-[#6b6560] uppercase font-bold">
            <span>Name</span>
            <span>Date</span>
            <span>Status</span>
            <span className="text-right">Actions</span>
          </div>

          <div className="divide-y divide-[#f0ede6]">
            {sorted.map((row) => {
              const pill = STATUS_PILL[row.status];
              const isCompleted = row.status === "completed";
              return (
                <div
                  key={row.id}
                  className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_140px_140px_220px] gap-4 px-6 py-4 items-center hover:bg-[#faf9f6]/80 transition-colors group"
                >
                  {/* Name */}
                  <Link href={`/client/assessments/${row.id}`} className="min-w-0 space-y-1">
                    <div className="font-sans font-extrabold text-[14px] text-[#1a1a1a] tracking-tight group-hover:text-black truncate">
                      {row.name}
                    </div>
                  </Link>

                  {/* Date */}
                  <div className="font-mono text-[10px] tracking-[0.15em] text-[#6b6560] uppercase font-bold">
                    <span className="md:hidden text-[#6b6560] mr-2">Date:</span>
                    {row.date}
                  </div>

                  {/* Status */}
                  <div>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 px-2.5 py-1 border rounded-full font-mono text-[10px] uppercase tracking-[0.16em] font-bold leading-none",
                        pill.border,
                        pill.text
                      )}
                    >
                      <span className={cn("w-0.5 h-0.5 rounded-full", pill.dot)} />
                      {STATUS_LABEL[row.status].toUpperCase().split("").join(" ")}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-start md:justify-end gap-2">
                    {isCompleted ? (
                      <>
                        <Button
                          variant="outline"
                          onClick={() => setPreviewRow(row)}
                          className="rounded-sm border-[#1a1a1a] bg-transparent text-[#1a1a1a] hover:bg-[#1a1a1a]! hover:text-white! h-8 px-4 font-bold text-[10px] uppercase tracking-[0.25em] shadow-none transition-colors"
                        >
                          <ExternalLink className="w-3 h-3 mr-1.5" />
                          View Report
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => setPreviewRow(row)}
                          aria-label={`Download ${row.name} PDF`}
                          className="rounded-sm border-[#e5e1d8] bg-transparent hover:bg-[#f9f8f6]! h-8 px-3 shadow-none"
                        >
                          <Download className="w-3.5 h-3.5 text-[#6b6560]" />
                        </Button>
                      </>
                    ) : (
                      <Link href={`/client/assessments/${row.id}`}>
                        <Button
                          variant="outline"
                          className="rounded-sm border-[#e5e1d8] bg-transparent text-[#1a1a1a] hover:bg-[#f9f8f6] h-8 px-4 font-bold text-[10px] uppercase tracking-[0.25em] shadow-none transition-colors"
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

      <PdfPreviewDialog
        open={previewRow !== null}
        onOpenChange={(o) => !o && setPreviewRow(null)}
        title={previewRow?.name || ""}
        subtitle={previewRow ? previewRow.date : undefined}
        documentId={previewRow?.id}
      />
    </>
  );
}
