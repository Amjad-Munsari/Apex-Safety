"use client";

import { FileDownloadMenu } from "@/components/client/file-download-menu";
import { openReport } from "@/app/client/reports/open-report";

interface Props {
  /** form_submissions.id — the report to download. */
  documentId: string;
}

export function ReportActions({ documentId }: Props) {
  return (
    <div className="pt-1">
      <FileDownloadMenu
        label="Download report"
        onDownload={() => openReport(documentId, "download")}
        onView={() => openReport(documentId, "view")}
      />
    </div>
  );
}
