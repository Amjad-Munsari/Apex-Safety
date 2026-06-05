"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
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
  /**
   * The client ID associated with this submission — sourced from the RSC's
   * server-fetched submission.client_id. Forwarded to InterpreterRenderer
   * for upload-flow renderers (signature, multi-photo) and AttachPhotosAffordance.
   * T-14-06-01: originates server-side; not user-controlled.
   */
  clientId: string
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
// Appendix keys live alongside the main-field answers inside answers_json but
// are owned by this component (the interpreter store owns everything else).
const APPENDIX_KEYS = ["__appendix_notes", "__appendix_media"] as const

export function AssessmentClient({ submission, schema, templateName, clientId }: AssessmentClientProps) {
  const router = useRouter()

  const savedAnswers = useMemo(
    () => (submission.answers_json as Record<string, unknown> | null | undefined) ?? {},
    [submission.answers_json],
  )

  // Main-field subset of the saved draft — used to rehydrate the interpreter
  // store on reload (the part the Phase-13 migration stopped restoring).
  const mainInitial = useMemo(() => {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(savedAnswers)) {
      if (!APPENDIX_KEYS.includes(k as (typeof APPENDIX_KEYS)[number])) out[k] = v
    }
    return out
  }, [savedAnswers])

  const [appendixAnswers, setAppendixAnswers] = useState<Record<string, unknown>>({
    __appendix_notes: savedAnswers.__appendix_notes ?? "",
    __appendix_media: savedAnswers.__appendix_media ?? [],
  })
  const [isSaving, setIsSaving] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  // Completion % is owned by the InterpreterRenderer's value store and lifted
  // here so the header progress bar reflects what the user has filled.
  const [progress, setProgress] = useState(0)

  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  // Latest interpreter (main-field) values — a ref so the high-frequency
  // onValuesChange updates never trigger a render (focus-loss Pitfall 6).
  const mainValuesRef = useRef<Record<string, unknown>>(mainInitial)
  // Mirror of appendix state for use inside debounced/unmount closures.
  const appendixRef = useRef<Record<string, unknown>>(appendixAnswers)
  const interpreterRef = useRef<InterpreterRendererHandle>(null)

  // autosaveAnswers OVERWRITES the whole answers_json, so every save must write
  // the union of main + appendix — otherwise one half wipes the other.
  const buildMergedAnswers = useCallback(
    () => ({ ...mainValuesRef.current, ...appendixRef.current }),
    [],
  )

  const triggerAutosave = useCallback(async () => {
    try {
      setIsSaving(true)
      await autosaveAnswers(submission.id, buildMergedAnswers())
    } catch (err) {
      console.error("Autosave failed", err)
      toast.error("Failed to save draft automatically.")
    } finally {
      setIsSaving(false)
    }
  }, [submission.id, buildMergedAnswers])

  // Debounced autosave — shared by both main-field and appendix changes.
  const scheduleAutosave = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => {
      void triggerAutosave()
    }, 800)
  }, [triggerAutosave])

  // Main-field values changed in the interpreter — stash + debounce-save.
  const handleMainValuesChange = useCallback(
    (values: Record<string, unknown>) => {
      mainValuesRef.current = values
      scheduleAutosave()
    },
    [scheduleAutosave],
  )

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
        void triggerAutosave()
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
      appendixRef.current = updated
      scheduleAutosave()
      return updated
    })
  }

  return (
    <div
      className="px-8 pb-10"
      style={{ background: "var(--p-bg)", color: "var(--p-text)" }}
    >
      <AssessmentFormHeader
        submissionId={submission.id}
        clientName={(submission.client as { name?: string } | null | undefined)?.name ?? "Unknown Client"}
        templateName={templateName}
        progress={progress}
        onSaveDraft={async () => {
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current)
            timeoutRef.current = null
          }
          await triggerAutosave()
          toast.success("Draft saved manually")
        }}
        onSubmit={async () => {
          // Flush any pending autosave before the form submit races the
          // server action.
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current)
            timeoutRef.current = null
            await triggerAutosave()
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
        clientId={clientId}
        surface="dark"
        initialValues={mainInitial}
        onValuesChange={handleMainValuesChange}
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
