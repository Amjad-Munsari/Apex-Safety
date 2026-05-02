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
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-md border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/client/assessments">
            <Button variant="ghost" size="icon" className="text-slate-400">
              <ChevronLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="h-6 w-[1px] bg-slate-800" />
          <div className="flex flex-col">
            <span className="font-mono text-[10px] uppercase tracking-widest text-slate-500">
              Assessment {id.slice(0, 8).toUpperCase()}
            </span>
            <span className="font-sans text-sm text-slate-200 font-medium">
              {HARDCODED_FRA_TEMPLATE.title}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            className="text-slate-400 gap-2"
            onClick={handleSaveDraft}
            disabled={savingDraft}
          >
            <Save className="h-4 w-4" />
            <span className="hidden sm:inline">{savingDraft ? "Saving…" : "Save Draft"}</span>
          </Button>
          <Button
            className="bg-amber-600 hover:bg-amber-500 text-white gap-2 px-6"
            onClick={handleComplete}
          >
            <Send className="h-4 w-4" />
            Complete
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-6 py-12">
        <FormRenderer
          schema={HARDCODED_FRA_TEMPLATE}
          data={data}
          onChange={handleFieldChange}
        />
      </main>

      <footer className="fixed bottom-6 right-6 pointer-events-none z-50">
        <div className="bg-slate-900/90 backdrop-blur border border-slate-800 px-4 py-2 rounded-full flex items-center gap-3 shadow-2xl pointer-events-auto">
          <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[0.6rem] uppercase tracking-widest text-slate-400 font-bold">
            Cloud Sync Active
          </span>
        </div>
      </footer>
    </div>
  )
}
