"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { generateReportDraft, finalizeReport } from "../../actions"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

type Severity = "Low" | "Medium" | "High" | "Critical"
type ComplianceStatus = "Pass" | "Action Required" | "Fail"

interface Hazard {
  location: string
  description: string
  severity: Severity
  recommendedAction: string
}

interface Draft {
  executiveSummary: string
  hazards: Hazard[]
  complianceStatus: ComplianceStatus
}

const SEVERITY_COLORS: Record<Severity, string> = {
  Low: "#3b8273",
  Medium: "#d97706",
  High: "#dc2626",
  Critical: "#7c3aed",
}

export function ReviewClient({ submission }: { submission: any }) {
  const router = useRouter()
  const [generating, setGenerating] = useState(false)
  const [approving, setApproving] = useState(false)

  // Track editable draft in state so the Approve action reads current values
  const [draft, setDraft] = useState<Draft | null>(submission.draft_report_json ?? null)

  // ── Generate AI Draft ─────────────────────────────────────────────────────
  const handleGenerate = async () => {
    setGenerating(true)
    try {
      await generateReportDraft(submission.id)
      toast.success("AI draft generated successfully")
      router.refresh()
    } catch (err: any) {
      toast.error(err.message || "Failed to generate draft")
    } finally {
      setGenerating(false)
    }
  }

  // ── Approve & Generate PDF ────────────────────────────────────────────────
  const handleApprove = async () => {
    if (!draft) return
    setApproving(true)
    try {
      const result = await finalizeReport(submission.id, draft)
      toast.success("PDF generated and saved!")
      if (result.downloadUrl) {
        window.open(result.downloadUrl, "_blank")
      }
      router.refresh()
    } catch (err: any) {
      toast.error(err.message || "Failed to generate PDF")
    } finally {
      setApproving(false)
    }
  }

  // ── Empty state ───────────────────────────────────────────────────────────
  if (!draft) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <h2 className="font-serif text-2xl text-white">No AI Draft Yet</h2>
        <p className="text-white/50 text-sm max-w-md text-center">
          The assessment has been submitted. Click below to generate an AI draft from the raw answers.
        </p>
        <Button
          id="generate-draft-btn"
          onClick={handleGenerate}
          disabled={generating}
          className="bg-white text-black hover:bg-white/90 mt-4"
        >
          {generating ? "Generating..." : "Generate AI Draft"}
        </Button>
      </div>
    )
  }

  // ── Review UI ─────────────────────────────────────────────────────────────
  return (
    <div className="max-w-4xl mx-auto py-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
      {/* Header */}
      <div className="space-y-1">
        <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/40">Phase 7 · AI Report Pipeline</p>
        <h1 className="font-serif text-3xl text-white">Review Report Draft</h1>
        <p className="text-white/40 text-sm">Edit the AI-generated content below before generating the final PDF.</p>
      </div>

      {/* Executive Summary */}
      <div className="space-y-2">
        <label className="text-[10px] uppercase tracking-widest text-white/40 font-mono">Executive Summary</label>
        <textarea
          id="executive-summary"
          rows={5}
          className="w-full bg-white/[0.03] border border-white/10 rounded-md p-4 text-white/80 focus:ring-1 focus:ring-white/20 focus:outline-none text-sm resize-none"
          value={draft.executiveSummary}
          onChange={(e) => setDraft({ ...draft, executiveSummary: e.target.value })}
        />
      </div>

      {/* Compliance Status */}
      <div className="space-y-2">
        <label className="text-[10px] uppercase tracking-widest text-white/40 font-mono">Overall Compliance Status</label>
        <select
          id="compliance-status"
          className="w-full bg-white/[0.03] border border-white/10 rounded-md px-4 py-3 text-white/80 focus:ring-1 focus:ring-white/20 focus:outline-none text-sm"
          value={draft.complianceStatus}
          onChange={(e) => setDraft({ ...draft, complianceStatus: e.target.value as ComplianceStatus })}
        >
          <option value="Pass" className="bg-black">Pass</option>
          <option value="Action Required" className="bg-black">Action Required</option>
          <option value="Fail" className="bg-black">Fail</option>
        </select>
      </div>

      {/* Hazards */}
      <div className="space-y-3">
        <label className="text-[10px] uppercase tracking-widest text-white/40 font-mono">
          Hazards Detected ({draft.hazards.length})
        </label>
        {draft.hazards.map((hazard, i) => (
          <div
            key={i}
            className="p-5 border border-white/10 rounded-md space-y-4 bg-white/[0.02]"
            style={{ borderLeftColor: SEVERITY_COLORS[hazard.severity], borderLeftWidth: 3 }}
          >
            <div className="flex gap-4 items-end">
              <div className="flex-1 space-y-1">
                <span className="text-[9px] text-white/30 uppercase font-mono tracking-widest">Location</span>
                <input
                  className="w-full bg-transparent border-b border-white/10 text-white text-sm py-1 focus:outline-none focus:border-white/30"
                  value={hazard.location}
                  onChange={(e) => {
                    const updated = [...draft.hazards]
                    updated[i] = { ...updated[i], location: e.target.value }
                    setDraft({ ...draft, hazards: updated })
                  }}
                />
              </div>
              <div className="w-36 space-y-1">
                <span className="text-[9px] text-white/30 uppercase font-mono tracking-widest">Severity</span>
                <select
                  className="w-full bg-transparent border-b border-white/10 text-white text-sm py-1 focus:outline-none focus:border-white/30"
                  value={hazard.severity}
                  onChange={(e) => {
                    const updated = [...draft.hazards]
                    updated[i] = { ...updated[i], severity: e.target.value as Severity }
                    setDraft({ ...draft, hazards: updated })
                  }}
                >
                  {(["Low", "Medium", "High", "Critical"] as Severity[]).map((s) => (
                    <option key={s} value={s} className="bg-black" style={{ color: SEVERITY_COLORS[s] }}>{s}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-1">
              <span className="text-[9px] text-white/30 uppercase font-mono tracking-widest">Description</span>
              <textarea
                rows={2}
                className="w-full bg-transparent border border-white/10 rounded px-3 py-2 text-white/80 text-sm focus:outline-none focus:border-white/30 resize-none"
                value={hazard.description}
                onChange={(e) => {
                  const updated = [...draft.hazards]
                  updated[i] = { ...updated[i], description: e.target.value }
                  setDraft({ ...draft, hazards: updated })
                }}
              />
            </div>
            <div className="space-y-1">
              <span className="text-[9px] text-white/30 uppercase font-mono tracking-widest">Recommended Action</span>
              <textarea
                rows={2}
                className="w-full bg-transparent border border-white/10 rounded px-3 py-2 text-white/80 text-sm focus:outline-none focus:border-white/30 resize-none"
                value={hazard.recommendedAction}
                onChange={(e) => {
                  const updated = [...draft.hazards]
                  updated[i] = { ...updated[i], recommendedAction: e.target.value }
                  setDraft({ ...draft, hazards: updated })
                }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Action Bar */}
      <div className="flex justify-between items-center pt-6 border-t border-white/10">
        <Button
          variant="outline"
          onClick={handleGenerate}
          disabled={generating || approving}
          className="border-white/10 text-white/50 hover:text-white hover:bg-white/5 text-sm"
        >
          {generating ? "Regenerating..." : "↺ Regenerate Draft"}
        </Button>
        <Button
          id="approve-generate-btn"
          onClick={handleApprove}
          disabled={approving || generating}
          className="bg-white text-black hover:bg-white/90 text-sm px-6 h-10"
        >
          {approving ? "Generating PDF..." : "Approve & Generate PDF →"}
        </Button>
      </div>
    </div>
  )
}
