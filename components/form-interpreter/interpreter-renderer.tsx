"use client"

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react"
import { useInterpreterStore, InterpreterEntities } from "@coltorapps/builder-react"
import { validateEntitiesValues } from "@coltorapps/builder"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { formBuilder, type FormBuilderSchema } from "@/lib/form-builder"
import { computeFormProgress } from "@/lib/form-builder/progress"
import { evaluateVisibility } from "@/lib/form-builder/visibility/evaluate-visibility"
import { pruneSchemaForValidation } from "@/lib/form-builder/prune-schema-for-validation"
import { validateInstanceRequired } from "@/lib/form-builder/validate-instance-required"
// submitAssessmentAction is implemented in Plan 13-03 Task 2
import { submitAssessmentAction } from "@/app/admin/assessments/actions"
import { TextFieldRenderer } from "./text-field-renderer"
import { NumberFieldRenderer } from "./number-field-renderer"
import { DateFieldRenderer } from "./date-field-renderer"
import { SelectFieldRenderer } from "./select-field-renderer"
import { TextareaFieldRenderer } from "./textarea-field-renderer"
import { CheckboxFieldRenderer } from "./checkbox-field-renderer"
import { SectionGroupRenderer } from "./section-group-renderer"
// Phase 14 — 6 specialty renderers (Plans 14-04 + 14-05, wired in Plan 14-06)
import { SignatureFieldRenderer } from "./signature-field-renderer"
import { RatingFieldRenderer } from "./rating-field-renderer"
import { MultiPhotoFieldRenderer } from "./multi-photo-field-renderer"
import { GeolocationFieldRenderer } from "./geolocation-field-renderer"
import { ComputedFieldRenderer } from "./computed-field-renderer"
import { RepeatingSectionRenderer } from "./repeating-section-renderer"
import type { EntityComponentProps } from "@coltorapps/builder-react"
import type { signatureFieldEntity } from "@/lib/form-builder/entities/signature-field"
import type { ratingFieldEntity } from "@/lib/form-builder/entities/rating-field"
import type { multiPhotoFieldEntity } from "@/lib/form-builder/entities/multi-photo-field"
import type { geolocationFieldEntity } from "@/lib/form-builder/entities/geolocation-field"
import type { computedFieldEntity } from "@/lib/form-builder/entities/computed-field"
import type { repeatingSectionEntity } from "@/lib/form-builder/entities/repeating-section"

export interface InterpreterRendererHandle {
  /** Returns true on successful server submit, false on validation failure or error. */
  submit: () => Promise<boolean>
}

interface InterpreterRendererProps {
  schema: FormBuilderSchema
  submissionId: string
  /**
   * The client ID associated with this submission — sourced from the RSC's
   * server-fetched submission.client_id (T-14-06-01: not user input).
   * Required for upload-flow renderers (signature, multi-photo) and the
   * AttachPhotosAffordance component that calls uploadMediaAction.
   */
  clientId: string
  surface?: "dark" | "cream"
  /** Called with the completion percentage (0-100) whenever a field value changes. */
  onProgressChange?: (pct: number) => void
  /** Called whenever the submission in-flight state changes. */
  onSubmittingChange?: (isSubmitting: boolean) => void
  /**
   * Override the default submit action. When supplied, InterpreterRenderer
   * calls onSubmit(values) instead of submitAssessmentAction(submissionId, values).
   * Phase 16 fill flows use this to swap in the assigned-fill and
   * customer-template-fill submit actions.
   *
   * Note: submissionId is still required (Phase 14 specialty renderers
   * consume it for upload paths) — this prop only diverts the FINAL submit.
   */
  onSubmit?: (values: Record<string, unknown>) => Promise<void>
}

const surfaceTokens = {
  dark: { form: "bg-transparent" },
  cream: { form: "bg-transparent" },
} as const

export const InterpreterRenderer = forwardRef<
  InterpreterRendererHandle,
  InterpreterRendererProps
>(function InterpreterRenderer(
  { schema, submissionId, clientId, surface = "cream", onProgressChange, onSubmittingChange, onSubmit },
  ref,
) {
  const t = surfaceTokens[surface]
  const [isSubmitting, setIsSubmitting] = useState(false)

  const interpreterStore = useInterpreterStore(formBuilder, schema, {
    events: {
      onEntityValueUpdated(payload) {
        // Skip validateEntityValue for computedField — coltorapps treats it as "not
        // eligible for validation" and throws. computedField is read-only (validator
        // is a passthrough) so there's nothing to validate anyway. Without this skip,
        // ComputedFieldRenderer's setValue write trips the throw.
        const entityType = schema.entities[payload.entityId]?.type
        if (entityType !== "computedField") {
          void interpreterStore.validateEntityValue(payload.entityId)
        }
        // Recompute completion % on every value change so the header
        // progress bar stays in sync with what the user has filled.
        // Phase 15: pass visibility map so hidden fields drop from the denominator (D-07).
        const values = interpreterStore.getEntitiesValues()
        const visibility = evaluateVisibility(schema, values)
        onProgressChange?.(computeFormProgress(schema, values, visibility))
      },
    },
  })

  /**
   * propsRef — stable ref that mirrors props which change on each render but
   * must NOT be added to the components useMemo dependency array.
   *
   * Why: coltorapps remounts entities when the `components` map identity changes
   * (Phase 13 13-04 UAT focus-loss fix / RESEARCH Pitfall 6). Adding
   * clientId / submissionId / schema / interpreterStore to useMemo deps would
   * re-create the map on every keystroke (because interpreterStore mutates its
   * internal state), causing input focus loss.
   *
   * Solution (Phase 14): mirror those props via useRef. The wrapper functions
   * inside useMemo read propsRef.current at component-render time — closures
   * see fresh values without the useMemo firing on every update. deps stay [surface].
   *
   * "Keystroke updates do NOT trigger remounts of text inputs" remains the hard
   * correctness constraint. This ref pattern is the only safe way to pass
   * per-render props into the memoised components map.
   *
   * @see RESEARCH Pitfall 6 (focus-loss on every keystroke)
   * @see Phase 13 13-04 UAT (the original focus-loss discovery + fix)
   */
  const propsRef = useRef({
    clientId,
    submissionId,
    schema,
    interpreterStore,
    // Phase 15: visibility map threaded via ref so useMemo deps stay [surface] (Pitfall 5 / Phase 14-06 invariant).
    // evaluateVisibility is pure and cheap — runs once per render on the current store snapshot.
    visibility: evaluateVisibility(schema, interpreterStore.getEntitiesValues()),
  })
  useEffect(() => {
    const values = interpreterStore.getEntitiesValues()
    propsRef.current = {
      clientId,
      submissionId,
      schema,
      interpreterStore,
      visibility: evaluateVisibility(schema, values),
    }
  })

  // Per-entity renderer components — wrap each with the surface prop.
  // Memoised on `surface` because coltorapps remounts entities when the
  // `components` map identity changes, which steals focus on every keystroke
  // (each entity-value update fires onProgressChange → parent re-renders →
  // this component re-renders → fresh `components` object → remount).
  //
  // Phase 14 note: clientId / submissionId / interpreterStore / schema are
  // read from propsRef.current inside each wrapper — NOT captured at useMemo
  // time — so the wrappers always see fresh values without deps widening.
  const components = useMemo(() => ({
    // ── Phase 13 base renderers ────────────────────────────────────────────
    // Phase 15: dynamicRequired is a PRIMITIVE boolean read from propsRef.current.visibility
    // at call time — NOT at useMemo creation time. This satisfies Pitfall 5 (passing an
    // object reference would widen the effective dep scope and cause focus loss).
    textField: ({ entity, setValue, validateValue, resetError, resetValue, clearValue }: Parameters<typeof TextFieldRenderer>[0]) =>
      <TextFieldRenderer entity={entity} setValue={setValue} validateValue={validateValue} resetError={resetError} resetValue={resetValue} clearValue={clearValue} surface={surface} dynamicRequired={propsRef.current.visibility[entity.id]?.required ?? false} />,
    numberField: ({ entity, setValue, validateValue, resetError, resetValue, clearValue }: Parameters<typeof NumberFieldRenderer>[0]) =>
      <NumberFieldRenderer entity={entity} setValue={setValue} validateValue={validateValue} resetError={resetError} resetValue={resetValue} clearValue={clearValue} surface={surface} dynamicRequired={propsRef.current.visibility[entity.id]?.required ?? false} />,
    dateField: ({ entity, setValue, validateValue, resetError, resetValue, clearValue }: Parameters<typeof DateFieldRenderer>[0]) =>
      <DateFieldRenderer entity={entity} setValue={setValue} validateValue={validateValue} resetError={resetError} resetValue={resetValue} clearValue={clearValue} surface={surface} dynamicRequired={propsRef.current.visibility[entity.id]?.required ?? false} />,
    selectField: ({ entity, setValue, validateValue, resetError, resetValue, clearValue }: Parameters<typeof SelectFieldRenderer>[0]) =>
      <SelectFieldRenderer entity={entity} setValue={setValue} validateValue={validateValue} resetError={resetError} resetValue={resetValue} clearValue={clearValue} surface={surface} dynamicRequired={propsRef.current.visibility[entity.id]?.required ?? false} />,
    textareaField: ({ entity, setValue, validateValue, resetError, resetValue, clearValue }: Parameters<typeof TextareaFieldRenderer>[0]) =>
      <TextareaFieldRenderer entity={entity} setValue={setValue} validateValue={validateValue} resetError={resetError} resetValue={resetValue} clearValue={clearValue} surface={surface} dynamicRequired={propsRef.current.visibility[entity.id]?.required ?? false} />,
    checkboxField: ({ entity, setValue, validateValue, resetError, resetValue, clearValue }: Parameters<typeof CheckboxFieldRenderer>[0]) =>
      <CheckboxFieldRenderer entity={entity} setValue={setValue} validateValue={validateValue} resetError={resetError} resetValue={resetValue} clearValue={clearValue} surface={surface} dynamicRequired={propsRef.current.visibility[entity.id]?.required ?? false} />,
    // sectionGroup: NO dynamicRequired — container; cascade handled by shouldBeProcessed
    sectionGroup: ({ entity, children, setValue, validateValue, resetError, resetValue, clearValue }: Parameters<typeof SectionGroupRenderer>[0]) =>
      <SectionGroupRenderer entity={entity} children={children} setValue={setValue} validateValue={validateValue} resetError={resetError} resetValue={resetValue} clearValue={clearValue} surface={surface} />,

    // ── Phase 14 specialty renderers (Plans 14-04 + 14-05) ────────────────
    // All 6 wrappers read propsRef.current at call time (per-entity render) —
    // never at useMemo creation time. This is the propsRef pattern.
    // Note: parameter types use EntityComponentProps<typeof entity> (the coltorapps
    // contract) rather than Parameters<typeof Renderer>[0] (which includes extra props
    // like clientId that are supplied by the wrapper, not by coltorapps).
    signatureField: (p: EntityComponentProps<typeof signatureFieldEntity>) =>
      <SignatureFieldRenderer {...p} surface={surface} clientId={propsRef.current.clientId} submissionId={propsRef.current.submissionId} dynamicRequired={propsRef.current.visibility[p.entity.id]?.required ?? false} />,
    ratingField: (p: EntityComponentProps<typeof ratingFieldEntity>) =>
      <RatingFieldRenderer {...p} surface={surface} clientId={propsRef.current.clientId} submissionId={propsRef.current.submissionId} dynamicRequired={propsRef.current.visibility[p.entity.id]?.required ?? false} />,
    multiPhotoField: (p: EntityComponentProps<typeof multiPhotoFieldEntity>) =>
      <MultiPhotoFieldRenderer {...p} surface={surface} clientId={propsRef.current.clientId} submissionId={propsRef.current.submissionId} dynamicRequired={propsRef.current.visibility[p.entity.id]?.required ?? false} />,
    geolocationField: (p: EntityComponentProps<typeof geolocationFieldEntity>) =>
      <GeolocationFieldRenderer {...p} surface={surface} clientId={propsRef.current.clientId} submissionId={propsRef.current.submissionId} dynamicRequired={propsRef.current.visibility[p.entity.id]?.required ?? false} />,
    // computedField: NO dynamicRequired (computedField has no requiredAttribute — UI-SPEC §computedField-specific)
    computedField: (p: EntityComponentProps<typeof computedFieldEntity>) =>
      <ComputedFieldRenderer {...p} surface={surface} interpreterStore={propsRef.current.interpreterStore} />,
    // repeatingSection requires schema to look up child entity types for inline rendering
    // and interpreterStore so per-instance visibility cascade can see ancestor-scope sources.
    repeatingSection: (p: EntityComponentProps<typeof repeatingSectionEntity>) =>
      <RepeatingSectionRenderer {...p} surface={surface} schema={propsRef.current.schema} interpreterStore={propsRef.current.interpreterStore} />,
  // deps stay [surface] — see propsRef JSDoc above for why this is correct.
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    const result = await validateEntitiesValues(values, formBuilder, pruneSchemaForValidation(schema))
    if (!result.success) {
      toast.error("Please fill in all required fields before submitting.")
      return false
    }

    // Per-instance required enforcement — coltorapps does not walk instances[]
    // and the pruned schema deliberately stops the walk at repeatingSection.
    const instanceFailures = validateInstanceRequired(schema, values as Record<string, unknown>)
    if (instanceFailures.length > 0) {
      const first = instanceFailures[0]
      toast.error(
        `Fill "${first.childLabel}" in ${first.repSectionLabel} #${first.instanceIndex + 1}` +
          (instanceFailures.length > 1 ? ` (+${instanceFailures.length - 1} more)` : "")
      )
      return false
    }

    try {
      setIsSubmitting(true)
      onSubmittingChange?.(true)
      if (onSubmit) {
        await onSubmit(values)
      } else {
        await submitAssessmentAction(submissionId, values)
      }
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
