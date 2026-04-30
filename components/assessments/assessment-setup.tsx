"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { startAssessment } from "@/app/admin/assessments/actions"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Loader2, AlertTriangle } from "lucide-react"

export function AssessmentSetup({
  clientId,
  templateVersionId,
  existingDraft
}: {
  clientId: string
  templateVersionId: string
  existingDraft: any | null
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(!existingDraft)

  useEffect(() => {
    if (!existingDraft) {
      // No draft exists, start fresh immediately
      startAssessment(clientId, templateVersionId)
    }
  }, [clientId, templateVersionId, existingDraft])

  const handleStartFresh = async () => {
    setLoading(true)
    await startAssessment(clientId, templateVersionId)
  }

  const handleResumeDraft = () => {
    router.push(`/admin/assessments/${existingDraft.id}`)
  }

  if (loading) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-slate-950 gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
        <div className="text-amber-500/80 animate-pulse font-medium">Initializing Assessment...</div>
      </div>
    )
  }

  return (
    <div className="flex h-screen w-full items-center justify-center bg-slate-950">
      <AlertDialog open={!!existingDraft}>
        <AlertDialogContent className="border-amber-500/30 bg-slate-900">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-amber-500 font-serif text-xl">
              <AlertTriangle className="h-5 w-5" />
              Resume Existing Draft?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-300 text-base">
              We found an incomplete assessment draft for this client and template. Would you like to resume where you left off, or start a new one?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6">
            <AlertDialogCancel 
              onClick={handleStartFresh}
              className="border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800 hover:text-white"
            >
              Start Fresh
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleResumeDraft}
              className="bg-amber-500 text-black hover:bg-amber-400 font-medium"
            >
              Resume Draft
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
