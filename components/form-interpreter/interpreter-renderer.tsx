"use client"

import { forwardRef, useImperativeHandle, useMemo, useState } from "react"
import { useInterpreterStore, InterpreterEntities } from "@coltorapps/builder-react"
import { validateEntitiesValues } from "@coltorapps/builder"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { formBuilder, type FormBuilderSchema } from "@/lib/form-builder"
import { computeFormProgress } from "@/lib/form-builder/progress"
// submitAssessmentAction is implemented in Plan 13-03 Task 2
import { submitAssessmentAction } from "@/app/admin/assessments/actions"
import { TextFieldRenderer } from "./text-field-renderer"
import { NumberFieldRenderer } from "./number-field-renderer"
import { DateFieldRenderer } from "./date-field-renderer"
import { SelectFieldRenderer } from "./select-field-renderer"
import { TextareaFieldRenderer } from "./textarea-field-renderer"
import { CheckboxFieldRenderer } from "./checkbox-field-renderer"
import { SectionGroupRenderer } from "./section-group-renderer"

export interface InterpreterRendererHandle {
  /** Returns true on successful server submit, false on validation failure or error. */
  submit: () => Promise<boolean>
}

interface InterpreterRendererProps {
  schema: FormBuilderSchema
  submissionId: string
  surface?: "dark" | "cream"
  /** Called with the completion percentage (0-100) whenever a field value changes. */
  onProgressChange?: (pct: number) => void
  /** Called whenever the submission in-flight state changes. */
  onSubmittingChange?: (isSubmitting: boolean) => void
}

const surfaceTokens = {
  dark: { form: "bg-transparent" },
  cream: { form: "bg-transparent" },
} as const

export const InterpreterRenderer = forwardRef<
  InterpreterRendererHandle,
  InterpreterRendererProps
>(function InterpreterRenderer(
  { schema, submissionId, surface = "cream", onProgressChange, onSubmittingChange },
  ref,
) {
  const t = surfaceTokens[surface]
  const [isSubmitting, setIsSubmitting] = useState(false)

  const interpreterStore = useInterpreterStore(formBuilder, schema, {
    events: {
      onEntityValueUpdated(payload) {
        void interpreterStore.validateEntityValue(payload.entityId)
        // Recompute completion % on every value change so the header
        // progress bar stays in sync with what the user has filled.
        onProgressChange?.(
          computeFormProgress(schema, interpreterStore.getEntitiesValues())
        )
      },
    },
  })

  // Per-entity renderer components — wrap each with the surface prop.
  // Memoised on `surface` because coltorapps remounts entities when the
  // `components` map identity changes, which steals focus on every keystroke
  // (each entity-value update fires onProgressChange → parent re-renders →
  // this component re-renders → fresh `components` object → remount).
  const components = useMemo(() => ({
    textField: ({ entity, setValue, validateValue, resetError, resetValue, clearValue }: Parameters<typeof TextFieldRenderer>[0]) =>
      <TextFieldRenderer entity={entity} setValue={setValue} validateValue={validateValue} resetError={resetError} resetValue={resetValue} clearValue={clearValue} surface={surface} />,
    numberField: ({ entity, setValue, validateValue, resetError, resetValue, clearValue }: Parameters<typeof NumberFieldRenderer>[0]) =>
      <NumberFieldRenderer entity={entity} setValue={setValue} validateValue={validateValue} resetError={resetError} resetValue={resetValue} clearValue={clearValue} surface={surface} />,
    dateField: ({ entity, setValue, validateValue, resetError, resetValue, clearValue }: Parameters<typeof DateFieldRenderer>[0]) =>
      <DateFieldRenderer entity={entity} setValue={setValue} validateValue={validateValue} resetError={resetError} resetValue={resetValue} clearValue={clearValue} surface={surface} />,
    selectField: ({ entity, setValue, validateValue, resetError, resetValue, clearValue }: Parameters<typeof SelectFieldRenderer>[0]) =>
      <SelectFieldRenderer entity={entity} setValue={setValue} validateValue={validateValue} resetError={resetError} resetValue={resetValue} clearValue={clearValue} surface={surface} />,
    textareaField: ({ entity, setValue, validateValue, resetError, resetValue, clearValue }: Parameters<typeof TextareaFieldRenderer>[0]) =>
      <TextareaFieldRenderer entity={entity} setValue={setValue} validateValue={validateValue} resetError={resetError} resetValue={resetValue} clearValue={clearValue} surface={surface} />,
    checkboxField: ({ entity, setValue, validateValue, resetError, resetValue, clearValue }: Parameters<typeof CheckboxFieldRenderer>[0]) =>
      <CheckboxFieldRenderer entity={entity} setValue={setValue} validateValue={validateValue} resetError={resetError} resetValue={resetValue} clearValue={clearValue} surface={surface} />,
    sectionGroup: ({ entity, children, setValue, validateValue, resetError, resetValue, clearValue }: Parameters<typeof SectionGroupRenderer>[0]) =>
      <SectionGroupRenderer entity={entity} children={children} setValue={setValue} validateValue={validateValue} resetError={resetError} resetValue={resetValue} clearValue={clearValue} surface={surface} />,
  }), [surface])

  const submit = async (): Promise<boolean> => {
    if (isSubmitting) return false

    const values = interpreterStore.getEntitiesValues()

    // Client-side validation first. Validate every entity so untouched
    // required fields surface their inline errors (otherwise only fields the
    // user has interacted with show errors via onEntityValueUpdated).
    for (const entityId of Object.keys(values)) {
      void interpreterStore.validateEntityValue(entityId)
    }
    const result = await validateEntitiesValues(values, formBuilder, schema)
    if (!result.success) {
      toast.error("Please fill in all required fields before submitting.")
      return false
    }

    try {
      setIsSubmitting(true)
      onSubmittingChange?.(true)
      await submitAssessmentAction(submissionId, values)
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : "Submission failed."
      toast.error(message)
      return false
    } finally {
      setIsSubmitting(false)
      onSubmittingChange?.(false)
    }
  }

  useImperativeHandle(ref, () => ({ submit }))

  return (
    <div
      className={cn("max-w-2xl mx-auto py-8 px-4 md:py-12 md:px-0 flex flex-col gap-6", t.form)}
    >
      <InterpreterEntities
        interpreterStore={interpreterStore}
        components={components}
      />
    </div>
  )
})
