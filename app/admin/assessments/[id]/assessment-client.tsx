"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { autosaveAnswers } from "@/app/admin/assessments/actions"
import { AssessmentFormHeader } from "@/components/assessments/assessment-form-header"
import {
  InterpreterRenderer,
  type InterpreterRendererHandle,
} from "@/components/form-interpreter/interpreter-renderer"
import { AppendixField } from "@/components/assessments/appendix-field"
import { toast } from "sonner"
import type { FormBuilderSchema } from "@/lib/form-builder"

interface AssessmentClientProps {
  submission: {
    id: string
    client_id?: string | null
    answers_json?: Record<string, unknown> | null
    status?: string
    client?: { name?: string } | null
    [key: string]: unknown
  }
  schema: FormBuilderSchema
  templateName: string
}

/**
 * Assessment fill client component.
 *
 * Migration note (Plan 13-03 Task 3):
 * - Migrated to the coltorapps InterpreterRenderer (pinned version schema).
 * - The debounced autosave lifecycle is preserved for the appendix fields.
 * - The interpreter renderer owns its own value state and handles submit via
 *   submitAssessmentAction internally. The explicit submit is the primary
 *   persistence point; autosave here covers only appendix (notes, media).
 * - normalizeFormSchema() call removed — schema arrives in coltorapps shape directly.
 */
export function AssessmentClient({ submission, schema, templateName }: AssessmentClientProps) {
  const router = useRouter()
  const [appendixAnswers, setAppendixAnswers] = useState<Record<string, unknown>>({
    __appendix_notes: (submission.answers_json as Record<string, unknown> | null | undefined)?.__appendix_notes ?? "",
    __appendix_media: (submission.answers_json as Record<string, unknown> | null | undefined)?.__appendix_media ?? [],
  })
  const [isSaving, setIsSaving] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  // Completion % is owned by the InterpreterRenderer's value store and lifted
  // here so the header progress bar reflects what the user has filled.
  const [progress, setProgress] = useState(0)

  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const pendingAnswersRef = useRef<Record<string, unknown>>(appendixAnswers)
  const interpreterRef = useRef<InterpreterRendererHandle>(null)

  const triggerAutosave = useCallback(async (latestAnswers: Record<string, unknown>) => {
    try {
      setIsSaving(true)
      await autosaveAnswers(submission.id, latestAnswers)
    } catch (err) {
      console.error("Autosave failed", err)
      toast.error("Failed to save draft automatically.")
    } finally {
      setIsSaving(false)
    }
  }, [submission.id])

  // Cleanup pending saves on unmount / visibility change
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden" && timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        triggerAutosave(pendingAnswersRef.current)
      }
    }

    window.addEventListener("beforeunload", handleBeforeUnload)
    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [triggerAutosave])

  const handleAppendixChange = (key: string, value: unknown) => {
    setAppendixAnswers((prev) => {
      const updated = { ...prev, [key]: value }
      pendingAnswersRef.current = updated

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      timeoutRef.current = setTimeout(() => {
        triggerAutosave(updated)
      }, 800)

      return updated
    })
  }

  return (
    <div
      className="min-h-full px-8 pb-24"
      style={{ background: "var(--p-bg)", color: "var(--p-text)" }}
    >
      <AssessmentFormHeader
        submissionId={submission.id}
        clientName={(submission.client as { name?: string } | null | undefined)?.name ?? "Unknown Client"}
        templateName={templateName}
        progress={progress}
        onSaveDraft={async () => {
          await triggerAutosave(pendingAnswersRef.current)
          toast.success("Draft saved manually")
        }}
        onSubmit={async () => {
          // Flush any pending appendix autosave before the form submit
          // races the server action.
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current)
            timeoutRef.current = null
            await triggerAutosave(pendingAnswersRef.current)
          }
          const ok = await interpreterRef.current?.submit()
          if (ok) {
            toast.success("Assessment submitted")
            router.push(
              submission.client_id
                ? `/admin/clients/${submission.client_id}`
                : "/admin"
            )
          }
        }}
        isSubmitting={isSubmitting}
        isSaving={isSaving}
      />

      {/* InterpreterRenderer owns the fill state and validation; the header
          gold button is the canonical submit CTA and drives it via ref.
          schema arrives in coltorapps shape from the RSC — no normalizeFormSchema needed. */}
      <InterpreterRenderer
        ref={interpreterRef}
        schema={schema}
        submissionId={submission.id}
        surface="dark"
        onProgressChange={setProgress}
        onSubmittingChange={setIsSubmitting}
      />

      <div className="max-w-3xl mx-auto">
        <AppendixField
          notesValue={(appendixAnswers.__appendix_notes as string) ?? ""}
          mediaValue={(appendixAnswers.__appendix_media as string[]) ?? []}
          onChangeNotes={(val) => handleAppendixChange("__appendix_notes", val)}
          onChangeMedia={(urls) => handleAppendixChange("__appendix_media", urls)}
        />
      </div>
    </div>
  )
}
