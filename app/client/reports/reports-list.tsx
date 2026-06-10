"use client";
import { FileDownloadMenu } from "@/components/client/file-download-menu";
import { StatusPill, type StatusTone } from "@/components/client/status-pill";
import { openReport } from "./open-report";
import type { Report } from "./page";

interface Props {
  reports: Report[];
}

const TONE: Record<Report["status"], StatusTone> = {
  FINAL: "success",
  DRAFT: "warning",
  PENDING: "danger",
};

export function ReportsList({ reports }: Props) {
  return (
    <div className="bg-white border border-[#e5e1d8] rounded-sm shadow-[0_1px_2px_rgba(0,0,0,0.02)] overflow-hidden">
      <div className="divide-y divide-[#f0ede6]">
        {reports.map((report) => (
          <div key={report.id} className="px-8 py-6 flex flex-col md:flex-row items-center justify-between gap-8 group hover:bg-[#faf9f6]/50 transition-all">

            {/* Left: Number & Info */}
            <div className="flex flex-1 items-center gap-8 min-w-0">
              <span className="font-serif text-[24px] text-[#8a857f] group-hover:text-[#1a1a1a] transition-colors tabular-nums shrink-0">
                {report.number}
              </span>

              <div className="min-w-0">
                <h4 className="font-sans font-semibold text-[15px] text-[#1a1a1a] tracking-tight group-hover:text-black truncate">
                  {report.title}
                </h4>
                <div className="flex items-center gap-2 font-mono text-[9px] tracking-[0.05em] text-[#8a857f] uppercase font-medium mt-1.5 whitespace-nowrap overflow-hidden">
                  <span>{report.location}</span>
                  <span className="opacity-60">&middot;</span>
                  <span>{report.date}</span>
                  <span className="opacity-60">&middot;</span>
                  <span>{report.consultant}</span>
                  <span className="opacity-60">&middot;</span>
                  <span>{report.pages}</span>
                </div>
              </div>
            </div>

            {/* Status */}
            <div className="shrink-0 w-32 flex justify-center">
              <StatusPill tone={TONE[report.status]} label={report.status} />
            </div>

            {/* Right: Action */}
            <div className="shrink-0">
              <FileDownloadMenu
                label="Download report"
                onDownload={() => openReport(report.id, "download")}
                onView={() => openReport(report.id, "view")}
              />
            </div>

          </div>
        ))}
      </div>
    </div>
  );
}
