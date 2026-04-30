"use client"

import { Button } from "@/components/ui/button"
import { Loader2, ArrowLeft } from "lucide-react"
import Link from "next/link"

interface AssessmentFormHeaderProps {
  clientName: string
  templateName: string
  progress: number
  onSaveDraft: () => void
  onSubmit: () => void
  isSubmitting: boolean
  isSaving: boolean
}

export function AssessmentFormHeader({
  clientName,
  templateName,
  progress,
  onSaveDraft,
  onSubmit,
  isSubmitting,
  isSaving
}: AssessmentFormHeaderProps) {
  return (
    <div className="sticky top-0 z-30 bg-black/95 backdrop-blur border-b border-white/5 py-4 -mx-8 px-8 mb-8 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/admin" className="text-slate-500 hover:text-white transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h2 className="text-xl font-serif text-white">{clientName}</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs font-mono text-slate-500 uppercase tracking-widest">{templateName}</span>
              <span className="text-slate-700">&bull;</span>
              <span className="text-xs text-amber-500 font-medium">Draft</span>
              {isSaving && <Loader2 className="h-3 w-3 animate-spin text-slate-500 ml-2" />}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-8">
          {/* Progress Bar */}
          <div className="flex flex-col items-end gap-1.5 w-32 hidden sm:flex">
            <div className="text-[10px] font-mono text-slate-400 tracking-wider">
              {Math.round(progress)}% COMPLETE
            </div>
            <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-500 transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={onSaveDraft}
              disabled={isSubmitting}
              className="border-white/10 bg-transparent text-slate-300 hover:bg-white/5 hover:text-white font-medium px-6"
            >
              Save Draft
            </Button>
            <Button
              onClick={onSubmit}
              disabled={progress < 100 || isSubmitting}
              className="bg-amber-500 text-black hover:bg-amber-400 font-medium px-6"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting
                </>
              ) : (
                "Submit Assessment"
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
