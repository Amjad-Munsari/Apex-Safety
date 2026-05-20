"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { autosaveAnswers, submitAssessment } from "@/app/admin/assessments/actions"
import { AssessmentFormHeader } from "@/components/assessments/assessment-form-header"
import { FormRenderer } from "@/components/forms/form-renderer"
import { AppendixField } from "@/components/assessments/appendix-field"
import { toast } from "sonner"
import { FormSchema, normalizeFormSchema } from "@/types/forms"

interface AssessmentClientProps {
  submission: any
}

export function AssessmentClient({ submission }: AssessmentClientProps) {
  const router = useRouter()
  // Some templates were published with a flat { fields: [...] } shape and no
  // sections wrapper. normalizeFormSchema() coerces them into the canonical
  // shape so the renderer and progress calc don't need to special-case it.
  const schema: FormSchema = normalizeFormSchema(submission.template?.schema_json)

  const [answers, setAnswers] = useState<Record<string, any>>(submission.answers_json || {})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const pendingAnswersRef = useRef<Record<string, any>>(answers)

  // Calculate progress: simple implementation counting required fields.
  // We assume all fields are required for this demo.
  const calculateProgress = useCallback((currentAnswers: Record<string, any>) => {
    let totalFields = 0
    let filledFields = 0

    schema.sections.forEach(section => {
      section.fields.forEach(field => {
        totalFields++
        const val = currentAnswers[field.id]
        if (val !== undefined && val !== null && val !== "" && (!Array.isArray(val) || val.length > 0)) {
          filledFields++
        }
      })
    })

    // Add 2 fields for appendix (notes, media) if we consider them part of progress.
    // For now, let's just base it strictly on schema fields.
    if (totalFields === 0) return 100
    return Math.min(100, Math.round((filledFields / totalFields) * 100))
  }, [schema])

  const progress = calculateProgress(answers)

  const triggerAutosave = useCallback(async (latestAnswers: Record<string, any>) => {
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
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        // Fire synchronously on unload
        const data = new Blob([JSON.stringify(pendingAnswersRef.current)], { type: 'application/json' })
        // Use sendBeacon or just ignore since next time draft will be slightly old
      }
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && timeoutRef.current) {
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

  const handleFieldChange = (id: string, value: any) => {
    setAnswers(prev => {
      const updated = { ...prev, [id]: value }
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

  const handleSaveDraft = async () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    await triggerAutosave(answers)
    toast.success("Draft saved manually")
  }

  const handleSubmit = async () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    try {
      setIsSubmitting(true)
      const res = await submitAssessment(submission.id, answers)
      toast.success("Assessment Submitted")
      router.push(`/admin/clients/${res.clientId}`)
    } catch (err) {
      console.error("Submit failed", err)
      toast.error("Failed to submit assessment")
      setIsSubmitting(false)
    }
  }

  return (
    <div
      className="min-h-screen px-8 pb-24"
      style={{ background: "var(--p-bg)", color: "var(--p-text)" }}
    >
      <AssessmentFormHeader
        submissionId={submission.id}
        clientName={submission.client?.name || "Unknown Client"}
        templateName={submission.template?.form_template?.name || "Unknown Template"}
        progress={progress}
        onSaveDraft={handleSaveDraft}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
        isSaving={isSaving}
      />

      <FormRenderer
        schema={schema}
        data={answers}
        onChange={handleFieldChange}
      />

      <div className="max-w-3xl mx-auto">
        <AppendixField
          notesValue={answers.__appendix_notes || ""}
          mediaValue={answers.__appendix_media || []}
          onChangeNotes={(val) => handleFieldChange("__appendix_notes", val)}
          onChangeMedia={(urls) => handleFieldChange("__appendix_media", urls)}
        />
      </div>
    </div>
  )
}
