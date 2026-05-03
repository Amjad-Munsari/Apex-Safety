"use client"

import React, { use, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  ChevronLeft,
  Download,
  ExternalLink,
  Calendar,
  Clock,
  FileText,
} from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { PdfPreviewDialog } from "@/components/client/pdf-preview-dialog"

type AssessmentStatus = "completed" | "in_progress" | "scheduled"

interface AssessmentDetail {
  id: string
  name: string
  type: string
  date: string
  status: AssessmentStatus
}

const ASSESSMENT_FIXTURES: Record<string, AssessmentDetail> = {
  "ASMT-8801": {
    id: "ASMT-8801",
    name: "Monthly Fire Safety Check — April 2026",
    type: "Fire Risk Assessment (Type 3)",
    date: "18 Apr 2026",
    status: "in_progress",
  },
  "ASMT-8802": {
    id: "ASMT-8802",
    name: "Quarterly Site Risk Audit",
    type: "Site Risk Assessment",
    date: "21 Apr 2026",
    status: "scheduled",
  },
  "REP-4402": {
    id: "REP-4402",
    name: "Fire Risk Assessment (Type 3)",
    type: "Fire Risk Assessment (Type 3)",
    date: "12 Mar 2026",
    status: "completed",
  },
  "REP-4391": {
    id: "REP-4391",
    name: "Annual Safety Review",
    type: "Annual Review",
    date: "05 Feb 2026",
    status: "completed",
  },
}

const STATUS_LABEL: Record<AssessmentStatus, string> = {
  completed: "Completed",
  in_progress: "In Progress",
  scheduled: "Scheduled",
}

const STATUS_PILL: Record<AssessmentStatus, { border: string; text: string; dot: string }> = {
  completed: { border: "border-[#3b8273]", text: "text-[#3b8273]", dot: "bg-[#3b8273]" },
  in_progress: { border: "border-[#c0a66d]", text: "text-[#c0a66d]", dot: "bg-[#c0a66d]" },
  scheduled: { border: "border-[#8a857f]", text: "text-[#6b6560]", dot: "bg-[#8a857f]" },
}

export default function ClientAssessmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const [previewOpen, setPreviewOpen] = useState(false)

  const assessment: AssessmentDetail = ASSESSMENT_FIXTURES[id] ?? {
    id,
    name: "Assessment",
    type: "—",
    date: "—",
    status: "scheduled",
  }

  const pill = STATUS_PILL[assessment.status]

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* Back link */}
      <Link
        href="/client/assessments"
        className="inline-flex items-center gap-2 text-[#6b6560] hover:text-black transition-colors"
      >
        <ChevronLeft className="w-3.5 h-3.5" />
        <span className="font-mono text-[9px] uppercase tracking-[0.25em] font-bold">
          Back to Assessments
        </span>
      </Link>

      {/* Hero */}
      <section className="space-y-3">
        <div className="flex items-center gap-3 font-mono text-[8px] tracking-[0.3em] uppercase font-bold">
          <span className="text-[#8a857f]">{assessment.id}</span>
          <span className="text-[#d8d4cc]">·</span>
          <span className="text-[#8a857f]">{assessment.type}</span>
        </div>
        <div className="flex items-end justify-between gap-6 flex-wrap">
          <div className="space-y-2">
            <h2 className="font-serif text-[32px] text-[#1a1a1a] font-medium tracking-tight leading-[1.05]">
              {assessment.name}.
            </h2>
            <div className="flex items-center gap-4 font-mono text-[9px] tracking-[0.25em] uppercase font-bold">
              <span className="flex items-center gap-1.5 text-[#6b6560]">
                <Calendar className="w-3 h-3" />
                {assessment.date}
              </span>
              <span className="text-[#d8d4cc]">·</span>
              <span
                className={cn(
                  "px-2.5 py-1 border rounded-full leading-none flex items-center gap-1.5 text-[8px] tracking-[0.16em]",
                  pill.border,
                  pill.text
                )}
              >
                <span className={cn("w-0.5 h-0.5 rounded-full", pill.dot)} />
                {STATUS_LABEL[assessment.status].toUpperCase().split("").join(" ")}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Body — status-specific */}
      <section className="bg-white border border-[#e5e1d8] rounded-sm p-8 shadow-sm">
        {assessment.status === "completed" && (
          <div className="flex flex-col gap-6">
            <div className="flex items-start gap-5">
              <div className="w-10 h-10 rounded-sm bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div className="space-y-1.5">
                <h4 className="font-serif text-[18px] text-[#1a1a1a] font-medium leading-tight">
                  Report delivered
                </h4>
                <p className="text-[#6b6560] text-[13px] font-sans tracking-tight max-w-xl">
                  Matt's signed-off report is attached below. Download the PDF for your records, or
                  preview it inline.
                </p>
              </div>
            </div>
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
          </div>
        )}

        {assessment.status === "in_progress" && (
          <div className="flex items-start gap-5">
            <div className="w-10 h-10 rounded-sm bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div className="space-y-1.5 max-w-xl">
              <h4 className="font-serif text-[18px] text-[#1a1a1a] font-medium leading-tight">
                Matt is currently working on this assessment.
              </h4>
              <p className="text-[#6b6560] text-[13px] font-sans tracking-tight">
                You'll be notified by email as soon as the report is ready. No action is required
                from you — site visits, evidence capture and write-up all happen on Matt's side.
              </p>
            </div>
          </div>
        )}

        {assessment.status === "scheduled" && (
          <div className="flex items-start gap-5">
            <div className="w-10 h-10 rounded-sm bg-[#f5f3ee] text-[#6b6560] flex items-center justify-center shrink-0">
              <Calendar className="w-5 h-5" />
            </div>
            <div className="space-y-1.5 max-w-xl">
              <h4 className="font-serif text-[18px] text-[#1a1a1a] font-medium leading-tight">
                Scheduled for {assessment.date}.
              </h4>
              <p className="text-[#6b6560] text-[13px] font-sans tracking-tight">
                Matt will visit on the scheduled date to carry out this assessment on-site. If you
                need to reschedule, message him directly.
              </p>
            </div>
          </div>
        )}
      </section>

      <PdfPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        title={assessment.name}
        subtitle={`${assessment.id} · ${assessment.date}`}
        documentId={assessment.id}
      />
    </div>
  )
}
