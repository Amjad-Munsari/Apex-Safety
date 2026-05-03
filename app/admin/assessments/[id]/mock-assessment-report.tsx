"use client"

import Link from "next/link"
import { ArrowLeft, Download, FileText } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"

interface Props {
  clientId: string
  clientName: string
  index: number
}

const REPORT_TYPES = [
  "Fire Risk Assessment (Type 3)",
  "Quarterly Site Risk Audit",
  "Annual Safety Review",
  "Fire Door Inspection",
]

const HAZARD_SAMPLES: Array<{ location: string; description: string; severity: "Low" | "Medium" | "High"; action: string }> = [
  { location: "Kitchen / extract canopy", description: "Grease accumulation in upper duct above acceptable limits.", severity: "Medium", action: "Schedule TR19 deep clean within 30 days; record on PPM." },
  { location: "Stair core (East)", description: "Final exit signage partially obscured by stored items.", severity: "Low", action: "Relocate items; confirm 1.2m clear escape width." },
  { location: "Comms riser, level 2", description: "Fire-rated penetration seals missing around new data cable runs.", severity: "High", action: "Engage fire-stopping contractor; certify within 14 days." },
]

function severityTone(severity: "Low" | "Medium" | "High") {
  switch (severity) {
    case "High":
      return { ring: "ring-danger/40", text: "text-danger", dot: "bg-danger" }
    case "Medium":
      return { ring: "ring-gold/40", text: "text-gold", dot: "bg-gold" }
    default:
      return { ring: "ring-success/40", text: "text-success", dot: "bg-success" }
  }
}

export function MockAssessmentReport({ clientId, clientName, index }: Props) {
  const reportType = REPORT_TYPES[index % REPORT_TYPES.length]
  const reference = `ASMT-${(clientId.slice(0, 4).toUpperCase())}${index + 1}`
  const issued = new Date()
  issued.setDate(issued.getDate() - (45 + index * 30))
  const issuedLabel = issued.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })

  return (
    <div className="flex flex-col gap-8 pt-8 animate-in-fade">
      {/* Back */}
      <Link href={`/admin/clients/${clientId}`} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors w-fit">
        <ArrowLeft className="w-4 h-4" />
        <span className="font-mono text-xs uppercase tracking-widest">Back to client</span>
      </Link>

      {/* Hero */}
      <div className="flex justify-between items-end gap-6">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3 font-mono text-xs tracking-widest text-muted-foreground uppercase">
            <span className="text-gold font-semibold">03</span>
            REPORT VIEW
          </div>
          <h2 className="font-serif text-[34px] leading-tight text-foreground">
            {reportType}.
          </h2>
          <p className="text-muted-foreground text-sm font-sans tracking-wide max-w-xl">
            Delivered to {clientName} on {issuedLabel}. Archived copy — read only.
          </p>
        </div>
        <Button variant="outline" className="gap-2" onClick={() => toast.success("PDF export queued")}>
          <Download className="w-3.5 h-3.5" />
          Download PDF
        </Button>
      </div>

      {/* Meta strip */}
      <Card className="px-6 py-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <Meta label="Reference" value={reference} mono />
          <Meta label="Status" value={<Badge variant="outline" className="border-success/40 text-success">Delivered</Badge>} />
          <Meta label="Client" value={clientName} />
          <Meta label="Issued" value={issuedLabel} />
        </div>
      </Card>

      {/* PDF preview placeholder */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        <div className="bg-[#f4f1ea] rounded-sm overflow-hidden ring-1 ring-foreground/10 shadow-2xl shadow-black/40">
          <div className="aspect-[210/297] w-full p-12 text-[#1a1a1a] font-serif relative">
            <div className="flex justify-between items-start mb-12">
              <div>
                <div className="font-serif text-[28px] leading-tight">888 Safety<br />&amp; Training.</div>
              </div>
              <div className="text-right font-mono text-[9px] uppercase tracking-[0.2em] text-[#888] leading-relaxed">
                <div>matt@888safetyandtraining.com</div>
                <div>Wakefield</div>
                <div className="mt-2 text-[#1a1a1a]">{reference}</div>
              </div>
            </div>

            <div className="space-y-2 mb-8">
              <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#888]">
                {reportType} · {issuedLabel}
              </div>
              <h1 className="font-serif text-[32px] leading-tight">{clientName}.</h1>
            </div>

            <div className="font-mono text-[9px] uppercase tracking-[0.25em] text-[#888] mb-3">01 · Executive Summary</div>
            <p className="font-sans text-[12px] leading-relaxed text-[#1a1a1a]/80 mb-8">
              Site walked through with the duty holder. Three remedial actions are flagged below; none represent an immediate
              evacuation risk. Existing fire strategy remains fit for purpose subject to closure of the items in section 02.
            </p>

            <div className="font-mono text-[9px] uppercase tracking-[0.25em] text-[#888] mb-3">02 · Hazards &amp; Actions</div>
            <div className="border-t border-[#1a1a1a]/10">
              {HAZARD_SAMPLES.map((h, i) => (
                <div key={i} className="grid grid-cols-[24px_1fr_auto] gap-4 py-3 border-b border-[#1a1a1a]/10 items-start">
                  <span className="font-mono text-[10px] text-[#888] mt-0.5">{String(i + 1).padStart(2, "0")}</span>
                  <div>
                    <div className="font-sans text-[12px] text-[#1a1a1a]">{h.location}</div>
                    <div className="font-sans text-[11px] text-[#666] leading-relaxed">{h.description}</div>
                  </div>
                  <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#1a1a1a]">{h.severity}</span>
                </div>
              ))}
            </div>

            <div className="absolute bottom-8 left-12 right-12 flex justify-between font-mono text-[8.5px] uppercase tracking-[0.2em] text-[#888]">
              <span>Page 1 of 1</span>
              <span>{reference}</span>
              <span>Issued {issuedLabel}</span>
            </div>
          </div>
        </div>

        {/* Side column: hazard breakdown */}
        <div className="flex flex-col gap-4">
          <Card className="px-6 py-4">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Findings</span>
            </div>
            <div className="flex flex-col gap-3">
              {HAZARD_SAMPLES.map((h, i) => {
                const tone = severityTone(h.severity)
                return (
                  <div key={i} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <span className="text-foreground text-xs">{h.location}</span>
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full ring-1 ${tone.ring} ${tone.text} font-mono text-[10px] uppercase tracking-widest`}>
                        <span className={`size-1.5 rounded-full ${tone.dot}`} />
                        {h.severity}
                      </span>
                    </div>
                    <p className="text-muted-foreground text-xs/relaxed">{h.action}</p>
                  </div>
                )
              })}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

function Meta({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{label}</span>
      <span className={`text-foreground text-sm ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  )
}
