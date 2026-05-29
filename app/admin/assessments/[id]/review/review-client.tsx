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

interface AudioMediaRow {
  field_id: string
  storage_path: string
  transcript: string | null
}

interface RawAnswerRow {
  id: string
  label: string
  value: string
}

// Coltorapps-style schema shape (matches expandRepeatingSections in lib/form-builder).
interface SchemaJsonShape {
  entities?: Record<
    string,
    {
      type: string
      children?: string[]
      attributes?: Record<string, unknown>
    }
  >
}

// Heuristics for what we treat as a "leaf input field" worth showing as a
// raw-answer row. We deliberately exclude pure layout/grouping containers; any
// entity that has an answer in `answers_json` is shown regardless of type
// (defensive against future field types) via the value-existence check below.
const NON_INPUT_ENTITY_TYPES = new Set([
  "section",
  "group",
  "repeatingSection",
  "page",
  "row",
  "column",
  "divider",
  "heading",
  "paragraph",
])

function asString(value: unknown): string {
  if (value === null || value === undefined) return ""
  if (typeof value === "string") return value
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  // Objects / arrays (e.g. repeatingSection { instances: [...] }) — JSON-encode
  // so Matt sees the raw structure without crashing the row renderer.
  try {
    return JSON.stringify(value)
  } catch {
    return "[unrenderable value]"
  }
}

function buildRawAnswerRows(
  schemaJson: SchemaJsonShape | null,
  answers: Record<string, unknown> | null | undefined,
  audioMedia: AudioMediaRow[],
): RawAnswerRow[] {
  if (!schemaJson?.entities) return []
  const answersMap = (answers ?? {}) as Record<string, unknown>
  const audioByField = new Map<string, AudioMediaRow>()
  for (const row of audioMedia) {
    audioByField.set(row.field_id, row)
  }

  const rows: RawAnswerRow[] = []
  for (const [entityId, entity] of Object.entries(schemaJson.entities)) {
    if (entity && NON_INPUT_ENTITY_TYPES.has(entity.type)) continue

    const label =
      (entity?.attributes?.label as string | undefined)?.trim() || entityId

    // 1. Typed answer from answers_json wins.
    const typedAnswer = answersMap[entityId]
    let value = asString(typedAnswer).trim()

    // 2. Fall back to STT transcript from field_media if no typed answer.
    if (!value) {
      const audio = audioByField.get(entityId)
      if (audio) {
        value = audio.transcript?.trim() || "(audio attached, no transcript yet)"
      }
    }

    // 3. Show "—" (project empty-state convention, never fake-data) when
    //    neither source resolves AND the field is in the schema. We still
    //    include it so Matt sees the field was offered but not answered.
    if (!value) value = "—"

    rows.push({ id: entityId, label, value })
  }

  return rows
}

export function ReviewClient({
  submission,
  schemaJson,
  audioMedia,
}: {
  submission: any
  schemaJson: SchemaJsonShape | null
  audioMedia: AudioMediaRow[]
}) {
  const router = useRouter()
  const [generating, setGenerating] = useState(false)
  const [approving, setApproving] = useState(false)

  // Track editable draft in state so the Approve action reads current values
  const [draft, setDraft] = useState<Draft | null>(submission.draft_report_json ?? null)

  // ── Raw Answers & STT rows (D-04) ─────────────────────────────────────────
  const rawRows = buildRawAnswerRows(
    schemaJson,
    submission.answers_json as Record<string, unknown> | null | undefined,
    audioMedia,
  )

  // One-time auto-expand heuristic per D-04: open when a draft exists but the
  // report has NOT been approved yet (no report_storage_path) — i.e. the draft
  // was freshly generated and Matt is seeing it for the first time. When the
  // draft has been approved (report_storage_path set) we collapse so re-visits
  // are quiet. When there is no draft at all, also open so Matt can see source
  // data immediately while deciding whether to generate.
  const justGenerated =
    Boolean(submission.draft_report_json) && !submission.report_storage_path
  const panelDefaultOpen = !draft || justGenerated

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
      // D-08: non-blocking notice when the n8n delivery email failed but
      // the PDF + status flip succeeded server-side. Wording matches
      // CONTEXT §D-08 verbatim.
      if (result.deliveryEmailFailed) {
        toast.warning("Report saved, email retry queued")
      } else {
        toast.success("PDF generated and saved!")
      }
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
    // D-11: when the prior AI generation failed, the row stays at
    // status='ai_draft_failed' until Matt retries from here. Headline,
    // copy, and button label flip to the retry path; the underlying
    // handleGenerate handler is the same — generateReportDraft will clear
    // the failed state on success or re-log workflow_errors on repeat.
    const failed = submission.status === "ai_draft_failed"
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <h2 className="font-serif text-2xl text-white">
          {failed ? "AI Draft Failed" : "No AI Draft Yet"}
        </h2>
        <p className="text-white/50 text-sm max-w-md text-center">
          {failed
            ? "The previous AI generation failed. See /admin/month-summary for the logged error, then retry."
            : "The assessment has been submitted. Click below to generate an AI draft from the raw answers."}
        </p>
        <Button
          id="generate-draft-btn"
          onClick={handleGenerate}
          disabled={generating}
          className="bg-white text-black hover:bg-white/90 mt-4"
        >
          {generating ? "Generating..." : failed ? "Retry Draft" : "Generate AI Draft"}
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

      {/* Raw Answers & STT panel (D-04) — collapsible source-of-truth view, ABOVE the editable draft */}
      <details
        {...(panelDefaultOpen ? { open: true } : {})}
        className="group border border-white/10 rounded-md bg-white/[0.02]"
      >
        <summary className="font-mono uppercase tracking-[0.2em] text-[10px] text-white/40 cursor-pointer hover:text-white/60 px-4 py-3 list-none flex items-center justify-between">
          <span>Raw Answers &amp; STT</span>
          <span className="text-white/30 group-open:rotate-90 transition-transform">›</span>
        </summary>
        <div className="px-4 pb-4 pt-1 border-t border-white/5">
          {rawRows.length === 0 ? (
            <p className="text-white/40 text-xs py-2">
              No pinned schema available for this submission — raw answers cannot be rendered.
            </p>
          ) : (
            <div>
              {rawRows.map((row) => (
                <div key={row.id} className="flex gap-2 py-1.5 border-b border-white/5">
                  <span className="text-white/40 text-xs font-mono w-1/3">{row.label}</span>
                  <span className="text-white/70 text-sm flex-1 whitespace-pre-wrap break-words">{row.value || "—"}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </details>

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
