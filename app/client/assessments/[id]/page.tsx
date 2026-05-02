"use client"

import React, { use, useState } from "react"
import { FormRenderer } from "@/components/forms/form-renderer"
import { Button } from "@/components/ui/button"
import { ChevronLeft, Save, Send } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { HARDCODED_FRA_TEMPLATE } from "@/lib/forms/fra-template"

export default function ClientAssessmentFillPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const [data, setData] = useState<Record<string, any>>({})
  const [savingDraft, setSavingDraft] = useState(false)

  const handleFieldChange = (fieldId: string, value: any) => {
    setData((prev) => ({ ...prev, [fieldId]: value }))
  }

  const handleSaveDraft = () => {
    setSavingDraft(true)
    setTimeout(() => {
      setSavingDraft(false)
      toast.success("Draft saved locally")
    }, 400)
  }

  const handleComplete = () => {
    toast.success("Assessment submitted for review")
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* Back link */}
      <Link
        href="/client/assessments"
        className="inline-flex items-center gap-2 text-[#999] hover:text-black transition-colors"
      >
        <ChevronLeft className="w-3.5 h-3.5" />
        <span className="font-mono text-[9px] uppercase tracking-[0.25em] font-bold">
          Back to Assessments
        </span>
      </Link>

      {/* Hero */}
      <section className="space-y-3">
        <div className="flex items-center gap-3 font-mono text-[9px] tracking-[0.25em] text-[#999] uppercase font-bold">
          <span className="text-[#3b8273]">Assessment {id.slice(0, 8).toUpperCase()}</span>
          <span className="opacity-30">·</span>
          <span>In progress</span>
        </div>
        <div className="flex items-end justify-between gap-6 flex-wrap">
          <div className="space-y-1">
            <h2 className="font-serif text-[32px] text-[#1a1a1a] font-medium tracking-tight leading-[1.05]">
              {HARDCODED_FRA_TEMPLATE.title}.
            </h2>
            <p className="text-[#888] text-[13px] font-sans tracking-tight max-w-xl">
              Continue where you left off. Save a draft any time, or submit when every section is complete.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={handleSaveDraft}
              disabled={savingDraft}
              className="rounded-sm border-[#e5e1d8] bg-transparent hover:bg-[#f9f8f6] text-[#1a1a1a] text-[10px] uppercase tracking-[0.2em] font-bold h-10 px-5 shadow-none"
            >
              <Save className="h-3.5 w-3.5 mr-2" />
              {savingDraft ? "Saving…" : "Save draft"}
            </Button>
            <Button
              onClick={handleComplete}
              className="bg-amber-600 hover:bg-amber-500 text-white text-[10px] uppercase tracking-[0.2em] font-bold h-10 px-6 rounded-sm shadow-none"
            >
              <Send className="h-3.5 w-3.5 mr-2" />
              Complete &rarr;
            </Button>
          </div>
        </div>
      </section>

      {/* Form */}
      <section>
        <FormRenderer
          schema={HARDCODED_FRA_TEMPLATE}
          data={data}
          onChange={handleFieldChange}
          surface="cream"
        />
      </section>

      {/* Sync status */}
      <div className="fixed bottom-6 right-6 pointer-events-none z-40">
        <div className="bg-white/95 backdrop-blur border border-[#e5e1d8] px-4 py-2 rounded-full flex items-center gap-3 shadow-sm pointer-events-auto">
          <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#666] font-bold">
            Cloud sync active
          </span>
        </div>
      </div>
    </div>
  )
}
