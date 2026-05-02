"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import {
  ClipboardCheck,
  Clock,
  ChevronRight,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import { PdfPreviewDialog } from "@/components/client/pdf-preview-dialog";

interface CompletedReport {
  id: string;
  title: string;
  date: string;
  status: string;
  client: string;
}

const completedReports: CompletedReport[] = [
  { id: "REP-4402", title: "Fire Risk Assessment (Type 3)", date: "12 Mar 2026", status: "DELIVERED", client: "Hallam House Care Home" },
  { id: "REP-4391", title: "Annual Safety Review", date: "05 Feb 2026", status: "DELIVERED", client: "Hallam House Care Home" },
];

export default function AssessmentListPage() {
  const [previewReport, setPreviewReport] = useState<CompletedReport | null>(null);
  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* ─── HEADER ─── */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
           <span className="font-mono text-[8px] text-[#999] tracking-[0.3em] font-bold uppercase">05 Assessments</span>
        </div>
        <div className="flex items-end justify-between">
          <div className="space-y-1">
            <h2 className="font-serif text-[32px] text-[#1a1a1a] font-medium tracking-tight leading-[1.1]">Forms & Assessments</h2>
            <p className="text-[#888] text-[13px] font-sans tracking-tight">
              Manage your safety inspections and view completed compliance reports.
            </p>
          </div>
          <Link href="/client/forms/new">
            <Button className="bg-amber-600 hover:bg-amber-500 text-white text-[10px] uppercase tracking-[0.2em] font-bold h-10 px-6 rounded-sm shadow-none">
              New Inspection &rarr;
            </Button>
          </Link>
        </div>
      </div>

      {/* ─── SECTION 01: OPEN ASSIGNMENTS ─── */}
      <section className="space-y-4">
        <div className="flex items-center gap-3">
           <span className="font-mono text-[8px] text-[#999] tracking-[0.3em] font-bold uppercase">Open</span>
           <div className="h-[1px] flex-1 bg-[#f0ede6]"></div>
        </div>

        <div className="bg-white border border-[#e5e1d8] rounded-sm divide-y divide-[#f0ede6] shadow-sm overflow-hidden">
          {[
            { id: "ASMT-8801", title: "Monthly Fire Safety Check — April 2026", status: "DUE TODAY", type: "due", date: "18 Apr", template: "Fire Risk Assessment (Type 3)" },
            { id: "ASMT-8802", title: "Quarterly Site Risk Audit", status: "DUE IN 3 DAYS", type: "upcoming", date: "21 Apr", template: "Site Risk Assessment" },
          ].map((item) => (
            <Link key={item.id} href={`/client/assessments/${item.id}`} className="px-6 py-5 flex items-center justify-between group hover:bg-[#faf9f6]/80 transition-all">
              <div className="flex items-start gap-5">
                <div className={cn(
                  "w-10 h-10 rounded-sm flex items-center justify-center shrink-0",
                  item.type === "due" ? "bg-amber-50 text-amber-600" : "bg-slate-50 text-slate-400"
                )}>
                  <ClipboardCheck className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-sans font-extrabold text-[15px] text-[#1a1a1a] tracking-tight group-hover:text-black">{item.title}</h4>
                  <div className="flex items-center gap-3 font-mono text-[8px] tracking-[0.25em] text-[#999] uppercase font-bold">
                     <span>{item.id}</span>
                     <span className="opacity-30">&middot;</span>
                     <span>{item.template}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-6">
                <div className="text-right">
                  <div className={cn(
                    "text-[10px] font-mono font-bold uppercase tracking-widest",
                    item.type === "due" ? "text-amber-600" : "text-[#999]"
                  )}>
                    {item.status}
                  </div>
                  <div className="text-[11px] text-[#bbb] mt-0.5">Due {item.date}</div>
                </div>
                <ChevronRight className="w-4 h-4 text-[#ddd] group-hover:text-amber-500 transition-colors" />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ─── SECTION 02: RECENTLY COMPLETED ─── */}
      <section className="space-y-4">
        <div className="flex items-center gap-3">
           <span className="font-mono text-[8px] text-[#999] tracking-[0.3em] font-bold uppercase">Completed Reports</span>
           <div className="h-[1px] flex-1 bg-[#f0ede6]"></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {completedReports.map((report) => (
            <div key={report.id} className="bg-white border border-[#e5e1d8] rounded-sm p-6 space-y-4 hover:shadow-md transition-all group">
              <div className="flex justify-between items-start">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-sm">
                  <FileText className="w-5 h-5" />
                </div>
                <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 font-mono text-[8px] tracking-widest uppercase">
                  {report.status}
                </Badge>
              </div>

              <div className="space-y-1">
                <h4 className="font-serif text-[18px] text-[#1a1a1a] font-medium leading-tight">{report.title}</h4>
                <div className="flex items-center gap-2 font-mono text-[8px] tracking-[0.1em] text-[#999] uppercase font-bold">
                   <span>{report.id}</span>
                   <span className="opacity-30">&middot;</span>
                   <span>{report.date}</span>
                </div>
              </div>

              <div className="pt-2 flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setPreviewReport(report)}
                  className="flex-1 rounded-sm border-[#e5e1d8] bg-transparent text-[#1a1a1a] hover:bg-[#f9f8f6]! hover:text-[#1a1a1a]! h-9 text-[9px] uppercase tracking-widest font-bold shadow-none"
                >
                  View PDF
                </Button>
                <Button
                  variant="outline"
                  onClick={() => toast.info(`Audit history for ${report.id} — last opened 2m ago.`)}
                  aria-label={`View audit history for ${report.id}`}
                  className="rounded-sm border-[#e5e1d8] bg-transparent hover:bg-[#f9f8f6]! h-9 px-3 shadow-none"
                >
                  <Clock className="w-3.5 h-3.5 text-[#999]" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── EMPTY STATE FOOTNOTE ─── */}
      <div className="pt-8 text-center">
        <p className="font-mono text-[9px] text-[#bbb] tracking-[0.2em] uppercase font-bold">
          All data synced with 888 Safety Cloud &middot; Last updated 2m ago
        </p>
      </div>

      <PdfPreviewDialog
        open={previewReport !== null}
        onOpenChange={(o) => !o && setPreviewReport(null)}
        title={previewReport?.title || ""}
        subtitle={previewReport ? `${previewReport.client} · ${previewReport.date}` : undefined}
        documentId={previewReport?.id}
      />
    </div>
  );
}
