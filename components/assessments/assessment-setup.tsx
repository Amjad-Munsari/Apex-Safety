"use client"

import { useEffect } from "react"
import { startAssessment } from "@/app/admin/assessments/actions"

export function AssessmentSetup({
  clientId,
  templateVersionId,
  existingDraft
}: {
  clientId: string
  templateVersionId: string
  existingDraft: any | null
}) {
  // Placeholder: in Wave 2 we will add the Draft Recovery AlertDialog.
  // For now, just start fresh immediately.
  useEffect(() => {
    startAssessment(clientId, templateVersionId)
  }, [clientId, templateVersionId])

  return (
    <div className="flex h-screen w-full items-center justify-center bg-slate-950">
      <div className="text-amber-500 animate-pulse">Initializing Assessment...</div>
    </div>
  )
}
