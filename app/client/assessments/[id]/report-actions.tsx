"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, ExternalLink } from "lucide-react";
import { PdfPreviewDialog } from "@/components/client/pdf-preview-dialog";

interface Props {
  title: string;
  subtitle?: string;
  documentId?: string;
}

export function ReportActions({ title, subtitle, documentId }: Props) {
  const [previewOpen, setPreviewOpen] = useState(false);

  return (
    <>
      <div className="flex flex-wrap gap-2.5 pt-1">
        <Button
          onClick={() => setPreviewOpen(true)}
          variant="outline"
          className="rounded-sm border-[#1a1a1a] bg-transparent text-[#1a1a1a] hover:bg-[#1a1a1a]! hover:text-white! h-10 px-6 font-bold text-[10px] uppercase tracking-[0.25em] shadow-none transition-all"
        >
          <ExternalLink className="w-3.5 h-3.5 mr-2" />
          View Report
        </Button>
        <Button
          onClick={() => setPreviewOpen(true)}
          variant="outline"
          className="rounded-sm border-[#e5e1d8] bg-transparent text-[#1a1a1a] hover:bg-[#f9f8f6] h-10 px-6 font-bold text-[10px] uppercase tracking-[0.25em] shadow-none transition-all"
        >
          <Download className="w-3.5 h-3.5 mr-2" />
          Download PDF
        </Button>
      </div>

      <PdfPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        title={title}
        subtitle={subtitle}
        documentId={documentId}
      />
    </>
  );
}
