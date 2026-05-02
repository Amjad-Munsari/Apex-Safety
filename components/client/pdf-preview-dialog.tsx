"use client"

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { FileText, X, Download } from "lucide-react"
import { toast } from "sonner"

interface PdfPreviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  subtitle?: string
  documentId?: string
}

export function PdfPreviewDialog({
  open,
  onOpenChange,
  title,
  subtitle,
  documentId,
}: PdfPreviewDialogProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-[#1a1a1a]/40 backdrop-blur-sm data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <DialogPrimitive.Popup
          className="fixed top-1/2 left-1/2 z-50 grid w-[calc(100%-2rem)] max-w-3xl -translate-x-1/2 -translate-y-1/2 grid-rows-[auto,1fr] rounded-sm bg-[#fbfaf5] ring-1 ring-[#e5e1d8] shadow-[0_8px_32px_rgba(26,26,26,0.18)] outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95"
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-6 px-8 pt-6 pb-4 border-b border-[#e5e1d8]">
            <div className="flex flex-col gap-1 min-w-0">
              <span className="font-mono text-[8.5px] tracking-[0.25em] text-[#8a857f] uppercase font-bold">
                Document Preview
                {documentId && <span className="ml-2 opacity-50">· {documentId}</span>}
              </span>
              <DialogPrimitive.Title className="font-serif text-[20px] text-[#1a1a1a] font-medium tracking-tight leading-tight truncate">
                {title}
              </DialogPrimitive.Title>
              {subtitle && (
                <span className="font-sans text-[11px] text-[#6b6560] tracking-tight mt-0.5">
                  {subtitle}
                </span>
              )}
            </div>
            <DialogPrimitive.Close
              aria-label="Close"
              className="shrink-0 rounded-sm p-1.5 text-[#6b6560] hover:bg-[#f0ede6] hover:text-[#1a1a1a] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3b8273]/30"
            >
              <X className="w-4 h-4" />
            </DialogPrimitive.Close>
          </div>

          {/* Body — mock PDF preview */}
          <div className="bg-[#f0ede6] p-8 overflow-y-auto max-h-[70vh]">
            <div className="mx-auto max-w-2xl bg-white shadow-[0_4px_16px_rgba(26,26,26,0.08)] aspect-[1/1.414] flex flex-col px-12 py-14 text-[#1a1a1a]">
              <div className="flex items-start justify-between mb-10">
                <div>
                  <div className="font-mono text-[8.5px] tracking-[0.25em] text-[#8a857f] uppercase font-bold">888 Safety</div>
                  <div className="font-serif text-[12px] text-[#1a1a1a] font-medium tracking-tight">Compliance Report</div>
                </div>
                {documentId && (
                  <div className="font-mono text-[8.5px] tracking-[0.25em] text-[#8a857f] uppercase font-bold">
                    {documentId}
                  </div>
                )}
              </div>

              <h1 className="font-serif text-[28px] tracking-tight leading-[1.1] mb-4">
                {title}
              </h1>
              {subtitle && (
                <p className="font-sans text-[12px] text-[#6b6560] tracking-tight mb-8">
                  {subtitle}
                </p>
              )}

              <div className="space-y-4 text-[10px] leading-relaxed text-[#1a1a1a]">
                <p className="font-mono text-[8.5px] tracking-[0.25em] text-[#8a857f] uppercase font-bold">
                  01 Executive Summary
                </p>
                <p>
                  This document is a sample preview generated for demonstration purposes. The
                  full report contains detailed findings, photographs, recommendations, and a
                  signed compliance statement from the consulting fire safety officer.
                </p>
                <p className="font-mono text-[8.5px] tracking-[0.25em] text-[#8a857f] uppercase font-bold pt-3">
                  02 Findings
                </p>
                <ul className="list-disc list-inside space-y-1.5">
                  <li>Primary fire detection system: operating within tolerance.</li>
                  <li>Emergency lighting: 4 luminaires flagged for replacement.</li>
                  <li>Means of escape: clear, signed and lit on all routes.</li>
                  <li>Fire door integrity: 1 self-closer requires adjustment.</li>
                </ul>
                <p className="font-mono text-[8.5px] tracking-[0.25em] text-[#8a857f] uppercase font-bold pt-3">
                  03 Risk Rating
                </p>
                <p>
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 border border-[#3b8273]/40 text-[#3b8273] font-mono text-[8.5px] uppercase tracking-[0.2em] font-bold rounded-full">
                    <span className="w-1 h-1 rounded-full bg-[#3b8273]" />
                    Moderate — Tolerable
                  </span>
                </p>
              </div>

              <div className="mt-auto pt-12 flex items-end justify-between font-mono text-[8px] tracking-[0.25em] text-[#8a857f] uppercase font-bold">
                <span>Page 1 of 12</span>
                <span>Generated by 888 Safety · Demo</span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-8 py-4 border-t border-[#e5e1d8] flex items-center justify-between bg-white">
            <span className="font-mono text-[9px] tracking-[0.2em] text-[#8a857f] uppercase font-bold">
              Sample preview — full PDF on download
            </span>
            <button
              type="button"
              onClick={() => toast.success(`Downloading ${title}…`)}
              className="inline-flex items-center gap-2 rounded-sm bg-[#1a1a1a] hover:bg-black text-white h-9 px-5 font-sans text-[10px] font-bold uppercase tracking-[0.2em] transition-all"
            >
              <Download className="w-3 h-3" /> Download PDF
            </button>
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
