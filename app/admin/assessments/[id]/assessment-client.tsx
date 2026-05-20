"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { autosaveAnswers } from "@/app/admin/assessments/actions"
import { AssessmentFormHeader } from "@/components/assessments/assessment-form-header"
import { InterpreterRenderer } from "@/components/form-interpreter/interpreter-renderer"
import { AppendixField } from "@/components/assessments/appendix-field"
import { toast } from "sonner"
import type { FormBuilderSchema } from "@/lib/form-builder"

interface AssessmentClientProps {
  submission: {
    id: string
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
  const [appendixAnswers, setAppendixAnswers] = useState<Record<string, unknown>>({
    __appendix_notes: (submission.answers_json as Record<string, unknown> | null | undefined)?.__appendix_notes ?? "",
    __appendix_media: (submission.answers_json as Record<string, unknown> | null | undefined)?.__appendix_media ?? [],
  })
  const [isSaving, setIsSaving] = useState(false)

  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const pendingAnswersRef = useRef<Record<string, unknown>>(appendixAnswers)

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
      className="min-h-screen px-8 pb-24"
      style={{ background: "var(--p-bg)", color: "var(--p-text)" }}
    >
      <AssessmentFormHeader
        submissionId={submission.id}
        clientName={(submission.client as { name?: string } | null | undefined)?.name ?? "Unknown Client"}
        templateName={templateName}
        progress={0}
        onSaveDraft={async () => {
          await triggerAutosave(pendingAnswersRef.current)
          toast.success("Draft saved manually")
        }}
        onSubmit={async () => {
          // The InterpreterRenderer owns the form submit action.
          // This header submit button is a secondary trigger; the primary
          // "Submit form" button is inside the InterpreterRenderer.
          toast.info("Use the 'Submit form' button in the form below to submit.")
        }}
        isSubmitting={false}
        isSaving={isSaving}
      />

      {/* InterpreterRenderer owns the fill state and submit action.
          It validates client-side via validateEntitiesValues, then calls
          submitAssessmentAction (server-side validated, version-pinned).
          schema arrives in coltorapps shape from the RSC — no normalizeFormSchema needed. */}
      <InterpreterRenderer
        schema={schema}
        submissionId={submission.id}
        surface="dark"
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
