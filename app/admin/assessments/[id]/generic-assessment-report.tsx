"use client"

import Link from "next/link"
import { ArrowLeft, Download, FileText } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

interface Props {
  id: string
}

const SECTIONS: Array<{ heading: string; body: string }> = [
  {
    heading: "Building information",
    body:
      "Single mid-rise of mixed use; ground floor reception with managed access, occupied floors above. Construction is RC frame with masonry infill, plasterboard internal partitions, and a concrete stair core serving as the primary protected escape route.",
  },
  {
    heading: "Fire risk findings",
    body:
      "Three remedial items flagged. None constitute an immediate evacuation risk. Two relate to housekeeping in the protected stair; the third concerns missing fire-stopping around recently installed comms cabling on level 2.",
  },
  {
    heading: "Recommendations",
    body:
      "Engage a third-party fire-stopping contractor for the comms riser within 14 days. Refresh the housekeeping standard for stair cores and add a 28-day audit cadence. No structural or strategic changes recommended.",
  },
  {
    heading: "Compliance status",
    body:
      "Compliant subject to closure of the items above. Existing fire strategy remains fit for purpose. Next review due 12 months from issue date.",
  },
]

export function GenericAssessmentReport({ id }: Props) {
  const reference = id.length > 12 ? `ASMT-${id.slice(0, 8).toUpperCase()}` : `ASMT-${id.toUpperCase()}`

  return (
    <div className="flex flex-col gap-8 pt-8 pb-20 max-w-5xl mx-auto w-full animate-in-fade">
      {/* Back */}
      <Link
        href="/admin/clients"
        className="flex items-center gap-2 text-white/40 hover:text-white transition-colors w-fit"
      >
        <ArrowLeft className="w-4 h-4" />
        <span className="font-mono text-xs uppercase tracking-widest">Back to clients</span>
      </Link>

      {/* Hero */}
      <div className="flex justify-between items-end gap-6">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3 font-mono text-xs tracking-widest text-[#666] uppercase">
            <span className="text-gold font-semibold">03</span>
            Report view
          </div>
          <h2 className="font-serif text-[34px] leading-tight text-white">
            Fire Risk Assessment.
          </h2>
          <p className="text-white/50 text-sm font-sans tracking-wide max-w-xl">
            Archived report — read only.
          </p>
        </div>
        <Button
          variant="outline"
          className="no-print gap-2"
          onClick={() => window.print()}
        >
          <Download className="w-3.5 h-3.5" />
          Download PDF
        </Button>
      </div>

      {/* Meta strip */}
      <Card className="bg-[#1c1c1c] border-white/5 rounded-sm px-6 py-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <Meta label="Reference" value={reference} mono />
          <Meta
            label="Status"
            value={
              <Badge className="border border-success/40 text-success bg-transparent">
                Delivered
              </Badge>
            }
          />
          <Meta label="Assessor" value="Matt Hollis" />
          <Meta
            label="Issued"
            value={new Date().toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          />
        </div>
      </Card>

      {/* Sections */}
      <div className="flex flex-col gap-4">
        {SECTIONS.map((section, i) => (
          <Card key={section.heading} className="bg-[#1c1c1c] border-white/5 rounded-sm px-6 py-6">
            <div className="flex items-center gap-3 mb-3">
              <span className="font-mono text-[10px] uppercase tracking-widest text-gold">
                {String(i + 1).padStart(2, "0")}
              </span>
              <FileText className="w-3.5 h-3.5 text-white/40" />
              <h3 className="font-serif text-lg text-white">{section.heading}</h3>
            </div>
            <p className="text-white/70 text-sm leading-relaxed font-sans max-w-3xl">
              {section.body}
            </p>
          </Card>
        ))}
      </div>
    </div>
  )
}

function Meta({
  label,
  value,
  mono,
}: {
  label: string
  value: React.ReactNode
  mono?: boolean
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="font-mono text-[10px] uppercase tracking-widest text-white/40">
        {label}
      </span>
      <span className={`text-white/90 text-sm ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  )
}
