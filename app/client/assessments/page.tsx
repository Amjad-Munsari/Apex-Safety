"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ChevronRight, Download, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { PdfPreviewDialog } from "@/components/client/pdf-preview-dialog";

type AssessmentStatus = "completed" | "in_progress" | "scheduled";

interface AssessmentRow {
  id: string;
  name: string;
  date: string;
  status: AssessmentStatus;
}

const ASSESSMENTS: AssessmentRow[] = [
  { id: "ASMT-8801", name: "Monthly Fire Safety Check — April 2026", date: "18 Apr 2026", status: "in_progress" },
  { id: "ASMT-8802", name: "Quarterly Site Risk Audit", date: "21 Apr 2026", status: "scheduled" },
  { id: "REP-4402", name: "Fire Risk Assessment (Type 3)", date: "12 Mar 2026", status: "completed" },
  { id: "REP-4391", name: "Annual Safety Review", date: "05 Feb 2026", status: "completed" },
];

const STATUS_LABEL: Record<AssessmentStatus, string> = {
  completed: "Completed",
  in_progress: "In Progress",
  scheduled: "Scheduled",
};

const STATUS_PILL: Record<AssessmentStatus, { border: string; text: string; dot: string }> = {
  completed: { border: "border-[#3b8273]", text: "text-[#3b8273]", dot: "bg-[#3b8273]" },
  in_progress: { border: "border-[#c0a66d]", text: "text-[#c0a66d]", dot: "bg-[#c0a66d]" },
  scheduled: { border: "border-[#8a857f]", text: "text-[#6b6560]", dot: "bg-[#8a857f]" },
};

const STATUS_ORDER: Record<AssessmentStatus, number> = {
  in_progress: 0,
  scheduled: 1,
  completed: 2,
};

export default function AssessmentListPage() {
  const [previewRow, setPreviewRow] = useState<AssessmentRow | null>(null);

  const sorted = [...ASSESSMENTS].sort(
    (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
  );

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* ─── HEADER ─── */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[8px] text-[#8a857f] tracking-[0.3em] font-bold uppercase">
            05 Assessments
          </span>
        </div>
        <div className="space-y-1">
          <h2 className="font-serif text-[32px] text-[#1a1a1a] font-medium tracking-tight leading-[1.1]">
            Assessments
          </h2>
          <p className="text-[#6b6560] text-[13px] font-sans tracking-tight max-w-xl">
            Matt carries out your fire-safety inspections on-site and uploads the signed-off report
            here. Download a completed report, or check progress on a visit in flight.
          </p>
        </div>
      </div>

      {/* ─── TABLE ─── */}
      <section className="space-y-4">
        <div className="bg-white border border-[#e5e1d8] rounded-sm shadow-sm overflow-hidden">
          {/* Column header */}
          <div className="hidden md:grid grid-cols-[minmax(0,1fr)_140px_140px_220px] gap-4 px-6 py-3 border-b border-[#f0ede6] font-mono text-[8px] tracking-[0.25em] text-[#8a857f] uppercase font-bold">
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
                  className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_140px_140px_220px] gap-4 px-6 py-4 items-center hover:bg-[#faf9f6]/80 transition-all group"
                >
                  {/* Name */}
                  <Link href={`/client/assessments/${row.id}`} className="min-w-0 space-y-1">
                    <div className="font-sans font-extrabold text-[14px] text-[#1a1a1a] tracking-tight group-hover:text-black truncate">
                      {row.name}
                    </div>
                    <div className="font-mono text-[8px] tracking-[0.25em] text-[#8a857f] uppercase font-bold">
                      {row.id}
                    </div>
                  </Link>

                  {/* Date */}
                  <div className="font-mono text-[10px] tracking-[0.15em] text-[#6b6560] uppercase font-bold">
                    <span className="md:hidden text-[#8a857f] mr-2">Date:</span>
                    {row.date}
                  </div>

                  {/* Status */}
                  <div>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 px-2.5 py-1 border rounded-full font-mono text-[8px] uppercase tracking-[0.16em] font-bold leading-none",
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
                          className="rounded-sm border-[#1a1a1a] bg-transparent text-[#1a1a1a] hover:bg-[#1a1a1a]! hover:text-white! h-8 px-4 font-bold text-[8.5px] uppercase tracking-[0.25em] shadow-none transition-all"
                        >
                          <ExternalLink className="w-3 h-3 mr-1.5" />
                          View Report
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => toast.success(`Downloading ${row.id}.pdf…`)}
                          aria-label={`Download ${row.id} PDF`}
                          className="rounded-sm border-[#e5e1d8] bg-transparent hover:bg-[#f9f8f6]! h-8 px-3 shadow-none"
                        >
                          <Download className="w-3.5 h-3.5 text-[#6b6560]" />
                        </Button>
                      </>
                    ) : (
                      <Link href={`/client/assessments/${row.id}`}>
                        <Button
                          variant="outline"
                          className="rounded-sm border-[#e5e1d8] bg-transparent text-[#1a1a1a] hover:bg-[#f9f8f6] h-8 px-4 font-bold text-[8.5px] uppercase tracking-[0.25em] shadow-none transition-all"
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

      {/* ─── FOOTNOTE ─── */}
      <div className="pt-8 text-center">
        <p className="font-mono text-[9px] text-[#8a857f] tracking-[0.2em] uppercase font-bold">
          All data synced with 888 Safety Cloud &middot; Last updated 2m ago
        </p>
      </div>

      <PdfPreviewDialog
        open={previewRow !== null}
        onOpenChange={(o) => !o && setPreviewRow(null)}
        title={previewRow?.name || ""}
        subtitle={previewRow ? `${previewRow.id} · ${previewRow.date}` : undefined}
        documentId={previewRow?.id}
      />
    </div>
  );
}
