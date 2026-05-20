"use client"

import { useState } from "react"
import { useInterpreterStore, InterpreterEntities } from "@coltorapps/builder-react"
import { validateEntitiesValues } from "@coltorapps/builder"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { formBuilder, type FormBuilderSchema } from "@/lib/form-builder"
// submitAssessmentAction is implemented in Plan 13-03 Task 2
import { submitAssessmentAction } from "@/app/admin/assessments/actions"
import { TextFieldRenderer } from "./text-field-renderer"
import { NumberFieldRenderer } from "./number-field-renderer"
import { DateFieldRenderer } from "./date-field-renderer"
import { SelectFieldRenderer } from "./select-field-renderer"
import { TextareaFieldRenderer } from "./textarea-field-renderer"
import { CheckboxFieldRenderer } from "./checkbox-field-renderer"
import { SectionGroupRenderer } from "./section-group-renderer"

interface InterpreterRendererProps {
  schema: FormBuilderSchema
  submissionId: string
  surface?: "dark" | "cream"
}

const surfaceTokens = {
  dark: {
    form: "bg-transparent",
    submitBtn: "bg-white text-black hover:bg-white/90",
    submitWrapper: "flex justify-end mt-8",
  },
  cream: {
    form: "bg-transparent",
    submitBtn: "bg-[#1a1a1a] text-white hover:bg-[#1a1a1a]/90",
    submitWrapper: "flex justify-end mt-8",
  },
} as const

export function InterpreterRenderer({
  schema,
  submissionId,
  surface = "cream",
}: InterpreterRendererProps) {
  const t = surfaceTokens[surface]
  const [isSubmitting, setIsSubmitting] = useState(false)

  const interpreterStore = useInterpreterStore(formBuilder, schema, {
    events: {
      onEntityValueUpdated(payload) {
        void interpreterStore.validateEntityValue(payload.entityId)
      },
    },
  })

  // Per-entity renderer components — wrap each with the surface prop.
  // These use EntityComponentProps from @coltorapps/builder-react.
  const components = {
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
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const values = interpreterStore.getEntitiesValues()

    // Client-side validation first — surfaces inline per-entity errors
    const result = await validateEntitiesValues(values, formBuilder, schema)
    if (!result.success) {
      // Per UI-SPEC: errors render inline below each field (not as a top summary).
      // The onEntityValueUpdated event will have already populated store errors
      // for touched fields; the server action will re-validate on submit.
      return
    }

    try {
      setIsSubmitting(true)
      await submitAssessmentAction(submissionId, values)
    } catch {
      toast.error("Submission failed. Check your connection and try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={cn("max-w-2xl mx-auto py-8 px-4 md:py-12 md:px-0 flex flex-col gap-6", t.form)}
    >
      <InterpreterEntities
        interpreterStore={interpreterStore}
        components={components}
      />

      <div className={cn(t.submitWrapper)}>
        <Button
          type="submit"
          disabled={isSubmitting}
          className={cn("w-full md:w-auto", t.submitBtn)}
        >
          {isSubmitting ? "Submitting…" : "Submit form"}
        </Button>
      </div>
    </form>
  )
}
