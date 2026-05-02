"use client";
import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  ChevronDown,
  Download,
  ExternalLink
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { PdfPreviewDialog } from "@/components/client/pdf-preview-dialog";

interface Report {
  id: string;
  number: string;
  title: string;
  location: string;
  date: string;
  consultant: string;
  pages: string;
  status: "FINAL" | "DRAFT" | "PENDING";
}

const reportsData: Report[] = [
  { id: "REP-01", number: "01", title: "Fire Risk Assessment — Type 3", location: "Main Building", date: "22 Nov 2024", consultant: "Matt Dineen", pages: "18 pages", status: "FINAL" },
  { id: "REP-02", number: "02", title: "Fire Risk Assessment — Type 1", location: "Annex Wing", date: "22 Nov 2024", consultant: "Matt Dineen", pages: "11 pages", status: "FINAL" },
  { id: "REP-03", number: "03", title: "Site Risk Assessment — Kitchen", location: "Main Building", date: "04 Sep 2024", consultant: "Matt Dineen", pages: "7 pages", status: "FINAL" },
  { id: "REP-04", number: "04", title: "Legionella Risk Assessment", location: "All plant rooms", date: "19 Jun 2024", consultant: "Matt Dineen", pages: "14 pages", status: "FINAL" },
];

export default function ReportsPage() {
  const [previewReport, setPreviewReport] = useState<Report | null>(null);

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

      {/* ─── REPORTS LIST ─── */}
      <div className="bg-white border border-[#e5e1d8] rounded-sm shadow-[0_1px_2px_rgba(0,0,0,0.02)] overflow-hidden">
        <div className="divide-y divide-[#f0ede6]">
          {reportsData.map((report) => (
            <div key={report.id} className="px-8 py-6 flex flex-col md:flex-row items-center justify-between gap-8 group hover:bg-[#faf9f6]/50 transition-all">

              {/* Left: Number & Info */}
              <div className="flex flex-1 items-center gap-8 min-w-0">
                <span className="font-serif text-[24px] text-[#ccc] group-hover:text-[#aaa] transition-colors tabular-nums shrink-0">
                  {report.number}
                </span>

                <div className="min-w-0">
                  <h4 className="font-sans font-semibold text-[15px] text-[#1a1a1a] tracking-tight group-hover:text-black truncate">
                    {report.title}
                  </h4>
                  <div className="flex items-center gap-2 font-mono text-[9px] tracking-[0.05em] text-[#bbb] uppercase font-medium mt-1.5 whitespace-nowrap overflow-hidden">
                    <span>{report.location}</span>
                    <span className="opacity-40">&middot;</span>
                    <span>{report.date}</span>
                    <span className="opacity-40">&middot;</span>
                    <span>{report.consultant}</span>
                    <span className="opacity-40">&middot;</span>
                    <span>{report.pages}</span>
                  </div>
                </div>
              </div>

              {/* Status Badge */}
              <div className="shrink-0 w-32 flex justify-center">
                <div className={cn(
                  "w-full py-1.5 border rounded-[2px] font-mono text-[9px] uppercase tracking-[0.3em] font-bold leading-none flex items-center justify-center gap-2.5 whitespace-nowrap",
                  report.status === "FINAL" ? "border-[#3b8273]/40 text-[#3b8273]" :
                  report.status === "DRAFT" ? "border-[#c0a66d]/40 text-[#c0a66d]" :
                  "border-[#e06050]/40 text-[#e06050]"
                )}>
                  <div className={cn(
                    "w-1.5 h-1.5 rounded-full shrink-0",
                    report.status === "FINAL" ? "bg-[#3b8273]" :
                    report.status === "DRAFT" ? "bg-[#c0a66d]" :
                    "bg-[#e06050]"
                  )}></div>
                  <span>{report.status}</span>
                </div>
              </div>

              {/* Right: Action */}
              <div className="shrink-0">
                <DropdownMenu>
                  <DropdownMenuTrigger className="flex items-center border border-[#e5e1d8] rounded-sm group/btn cursor-pointer bg-white overflow-hidden h-12 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-all p-0">
                    <div className="w-8 h-full flex items-center justify-center border-r border-[#e5e1d8] group-hover/btn:bg-[#faf9f6] transition-colors">
                      <ChevronDown className="h-3.5 w-3.5 text-[#bbb] group-hover/btn:text-[#1a1a1a] transition-colors" />
                    </div>
                    <div className="px-5 h-full flex items-center justify-center gap-2 group-hover/btn:bg-[#faf9f6] transition-colors min-w-[140px]">
                      <span className="font-sans text-[12px] font-bold tracking-tight text-[#1a1a1a]">Download report</span>
                    </div>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="rounded-sm border-[#e5e1d8] p-1 shadow-md bg-white">
                    <DropdownMenuItem
                      onClick={() => toast.success(`Downloading ${report.title}…`)}
                      className="text-[10px] font-mono font-bold uppercase tracking-widest p-3 cursor-pointer h-10 flex items-center gap-3 text-[#1a1a1a] hover:bg-[#faf9f6]"
                    >
                       <Download className="h-3.5 w-3.5" /> Download PDF
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setPreviewReport(report)}
                      className="text-[10px] font-mono font-bold uppercase tracking-widest p-3 cursor-pointer h-10 flex items-center gap-3 text-[#1a1a1a] hover:bg-[#faf9f6]"
                    >
                       <ExternalLink className="h-3.5 w-3.5" /> View Online
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

            </div>
          ))}
        </div>
      </div>

      <PdfPreviewDialog
        open={previewReport !== null}
        onOpenChange={(o) => !o && setPreviewReport(null)}
        title={previewReport?.title || ""}
        subtitle={previewReport ? `${previewReport.location} · ${previewReport.date} · ${previewReport.consultant}` : undefined}
        documentId={previewReport?.id}
      />
    </div>
  );
}
