/**
 * RepeatingSectionRenderer
 *
 * Manages N instances of a declared template-children entity set. Each instance
 * has independent value state owned locally in React state and mirrored to the
 * interpreter store via setValue({ instances: [...] }) on every mutation.
 *
 * Cross-plan dependency (Plan 14-06):
 *   The `schema` prop is required — it lets the renderer look up child entity
 *   definitions to render the correct input type for each template child.
 *   Plan 14-06 plumbs `schema` from interpreter-renderer.tsx into the components
 *   map wrapper for repeatingSection.
 *
 * RESEARCH Pitfall 3 — setValue contract:
 *   The interpreter store stores ONE value per entity ID. A repeatingSection with
 *   N instances must store ALL instances as a single value object:
 *     { instances: [...] }
 *   Every addInstance / removeInstance / updateInstance call MUST pass the FULL
 *   updated instances array to setValue. Partial updates lose instance data in
 *   answers_json on the server.
 *
 * Instance children are NOT registered with the interpreter store (D-02):
 *   Children inside an instance are NOT coltorapps entities — they are template
 *   IDs in schema.entities[repeatingSectionId].children. Their values live inside
 *   instances[index][childEntityId], NOT in the interpreter store directly.
 *   The renderer renders them as controlled inputs and manages their values.
 *
 * Per-instance validation gap (T-14-02-03 / RESEARCH Open Question #1):
 *   coltorapps validateEntitiesValues does NOT recurse into the instances[] array.
 *   Required asterisks are shown on child inputs but are not blocking at client-
 *   side validation time in Phase 14. The server-side gap is accepted within the
 *   admin trust boundary. A follow-up plan should add an explicit per-instance
 *   validation loop in submitAssessmentAction.
 *
 * Specialty-inside-repeating constraint (CONTEXT §deferred):
 *   Specialty fields (signature, rating, multi-photo, geolocation, computed,
 *   repeatingSection) are not supported inside repeating sections in Phase 14.
 *   Reason: each specialty renderer has its own cross-plan prop requirements
 *   (e.g., computed needs interpreterStore, signature needs upload wiring).
 *   Replicating that plumbing inside instances doubles complexity for marginal
 *   value — FRA fire-doors scenario only needs text + select + checkbox children.
 *   Shown inline as a destructive text message.
 *
 * TODO (Plan 14-06): wire schema prop via the components map wrapper.
 */
"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import type { EntityComponentProps } from "@coltorapps/builder-react"
import type { repeatingSectionEntity } from "@/lib/form-builder/entities/repeating-section"
import type { FormBuilderSchema } from "@/lib/form-builder"
import { ChevronDown, ChevronUp, Plus, X } from "lucide-react"
import { evaluateVisibilityForInstance } from "@/lib/form-builder/visibility/evaluate-visibility"

type InstanceValues = Record<string, unknown>

type Props = EntityComponentProps<typeof repeatingSectionEntity> & {
  surface?: "dark" | "cream"
  /**
   * The form schema, needed to look up child entity types and attributes for
   * inline rendering inside instances. Plan 14-06 plumbs this from
   * interpreter-renderer.tsx (the components map wrapper receives the schema
   * from InterpreterRenderer props and threads it here).
   */
  schema: FormBuilderSchema
}

const surfaceTokens = {
  dark: {
    title: "text-white",
    description: "text-white/50",
    divider: "border-white/10",
    instanceCard: "bg-white/5 border-white/10",
    instanceHeader: "text-white/40",
    instanceNumber: "font-mono text-[10px] uppercase tracking-widest text-white/40",
    collapseBtn: "text-white/40 hover:text-white/70",
    removeBtn: "text-white/40 hover:text-[#8b2b21]",
    addButton: "border-white/20 text-white/50 hover:border-white/40 hover:text-white/80",
    addButtonDisabled: "border-white/10 text-white/20 cursor-not-allowed",
    badge: "font-mono text-[10px] uppercase tracking-widest text-[#3b8273]",
    muted: "text-white/40",
    inputBase: "bg-transparent border-white/10 text-white placeholder-white/30",
    checkboxLabel: "text-white/70",
    specialtyError: "text-[#8b2b21]",
  },
  cream: {
    title: "text-[#1a1a1a]",
    description: "text-[#6b6560]",
    divider: "border-[#e5e1d8]",
    instanceCard: "bg-white border-[#e5e1d8]",
    instanceHeader: "text-[#6b6560]",
    instanceNumber: "font-mono text-[10px] uppercase tracking-widest text-[#6b6560]",
    collapseBtn: "text-[#6b6560] hover:text-[#1a1a1a]",
    removeBtn: "text-[#6b6560] hover:text-[#8b2b21]",
    addButton: "border-[#e5e1d8] text-[#6b6560] hover:border-[#1a1a1a] hover:text-[#1a1a1a]",
    addButtonDisabled: "border-[#e5e1d8] text-[#c5c0bb] cursor-not-allowed",
    badge: "font-mono text-[10px] uppercase tracking-widest text-[#3b8273]",
    muted: "text-[#6b6560]",
    inputBase: "bg-white border-[#e5e1d8] text-[#1a1a1a] placeholder-[#c5c0bb]",
    checkboxLabel: "text-[#1a1a1a]",
    specialtyError: "text-[#8b2b21]",
  },
} as const

/** Specialty entity types not supported inside repeating sections in Phase 14. */
const SPECIALTY_TYPES = new Set([
  "signatureField",
  "ratingField",
  "multiPhotoField",
  "geolocationField",
  "computedField",
  "repeatingSection",
])

/**
 * Renders a single child entity as a controlled inline input.
 * Supports basic types only (Phase 14 scope). Specialty types render
 * a "not supported" destructive message (constraint per CONTEXT §deferred).
 */
function ChildInput({
  childId,
  entityDef,
  value,
  onChange,
  surface,
  t,
  dynamicRequired = false,
}: {
  childId: string
  entityDef: FormBuilderSchema["entities"][string]
  value: unknown
  onChange: (v: unknown) => void
  surface: "dark" | "cream"
  t: (typeof surfaceTokens)["dark"] | (typeof surfaceTokens)["cream"]
  /** Phase 15: dynamic required from evaluateVisibilityForInstance for this child in this instance. */
  dynamicRequired?: boolean
}) {
  const type = entityDef.type
  const attrs = (entityDef.attributes ?? {}) as Record<string, unknown>
  const label = (attrs.label as string | undefined) ?? childId
  // Phase 15: required shows asterisk if static attr OR dynamicRequired rule fires
  const required = ((attrs.required as boolean | undefined) ?? false) || dynamicRequired
  const placeholder = (attrs.placeholder as string | undefined) ?? ""
  const helpText = (attrs.helpText as string | undefined) ?? ""

  const sharedInputClass = cn(
    "w-full rounded-sm border px-3 py-2 text-sm outline-none transition-colors",
    t.inputBase
  )

  // Specialty fields inside repeating sections are NOT supported in Phase 14.
  // See JSDoc above for reasoning.
  if (SPECIALTY_TYPES.has(type)) {
    return (
      <div className="flex flex-col gap-1">
        <span className="text-xs font-semibold">{label}</span>
        <p className={cn("text-xs", t.specialtyError)}>
          Specialty fields are not supported inside repeating sections in Phase 14.
        </p>
      </div>
    )
  }

  if (type === "checkboxField") {
    return (
      <label className={cn("flex items-center gap-2 cursor-pointer", t.checkboxLabel)}>
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
          className="h-4 w-4 rounded-sm"
        />
        <span className="text-sm">
          {label}
          {required && <span className="ml-1 text-[#8b2b21]">*</span>}
        </span>
      </label>
    )
  }

  if (type === "textareaField") {
    return (
      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold">
          {label}
          {required && <span className="ml-1 text-[#8b2b21]">*</span>}
        </label>
        <textarea
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={cn(sharedInputClass, "min-h-[80px] resize-y")}
        />
        {helpText && <p className={cn("text-xs", t.muted)}>{helpText}</p>}
      </div>
    )
  }

  if (type === "selectField") {
    const options = (attrs.options as Array<{ value: string; label: string }> | undefined) ?? []
    const allowMultiple = (attrs.allowMultiple as boolean | undefined) ?? false
    if (allowMultiple) {
      // Multi-select inside repeating sections is not supported in Phase 14.
      return (
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold">{label}</label>
          <p className={cn("text-xs", t.specialtyError)}>
            Multi-select not supported inside repeating sections.
          </p>
        </div>
      )
    }
    return (
      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold">
          {label}
          {required && <span className="ml-1 text-[#8b2b21]">*</span>}
        </label>
        <select
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className={cn(sharedInputClass, "cursor-pointer")}
        >
          <option value="">— select —</option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {helpText && <p className={cn("text-xs", t.muted)}>{helpText}</p>}
      </div>
    )
  }

  // textField, numberField, dateField
  const inputType =
    type === "numberField" ? "number" : type === "dateField" ? "date" : "text"

  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold">
        {label}
        {required && <span className="ml-1 text-[#8b2b21]">*</span>}
      </label>
      <input
        type={inputType}
        value={(value as string | number) ?? ""}
        onChange={(e) =>
          onChange(type === "numberField" ? e.target.valueAsNumber : e.target.value)
        }
        placeholder={placeholder}
        className={sharedInputClass}
      />
      {helpText && <p className={cn("text-xs", t.muted)}>{helpText}</p>}
    </div>
  )
}

export function RepeatingSectionRenderer({
  entity,
  setValue,
  surface = "cream",
  schema,
}: Props) {
  const t = surfaceTokens[surface]
  const attrs = entity.attributes
  // Current snapshot of all interpreter store values — needed for evaluateVisibilityForInstance.
  // We use entity.value to access the current instances (already stored there by coltorapps).
  // The full answer map is reconstructed below for the visibility evaluator.
  const allValues: Record<string, unknown> = { [entity.id]: entity.value }

  const sectionTitle = (attrs.title as string | undefined) ?? ""
  const sectionDescription = (attrs.description as string | undefined) ?? ""
  const minInstances = (attrs.minInstances as number | undefined) ?? 0
  const maxInstances = (attrs.maxInstances as number | undefined) ?? undefined

  // Look up template child entity IDs from the schema.
  // schema.entities[entity.id].children contains the template entity IDs.
  const schemaEntity = schema.entities[entity.id] as
    | (FormBuilderSchema["entities"][string] & { children?: string[] })
    | undefined
  const childIds: string[] = schemaEntity?.children ?? []

  // ─── Instance state machine (RESEARCH lines 855-887) ─────────────────────
  // Initialise from stored value (e.g., on page refresh or resume).
  // Pitfall 3: every mutation must call setValue({ instances: newInstances }).
  const [instances, setInstances] = useState<InstanceValues[]>(() => {
    const stored = entity.value as { instances?: InstanceValues[] } | undefined
    return stored?.instances ?? []
  })

  // Track collapsed instance card indices.
  const [collapsedIndices, setCollapsedIndices] = useState<Set<number>>(new Set())

  // Show min-instance validation message once the user has interacted.
  const [showMinError, setShowMinError] = useState(false)

  // ─── Mutators ─────────────────────────────────────────────────────────────
  // CRITICAL: every mutator must call setValue({ instances: newInstances })
  // with the FULL updated array (Pitfall 3 — partial setValue loses instances).

  const addInstance = () => {
    if (maxInstances !== undefined && instances.length >= maxInstances) return
    const newInstances = [...instances, {}]
    setInstances(newInstances)
    setValue({ instances: newInstances })
    // Show min error once user has started adding (helps visibility).
    if (newInstances.length < minInstances) {
      setShowMinError(true)
    } else {
      setShowMinError(false)
    }
  }

  const removeInstance = (index: number) => {
    const newInstances = instances.filter((_, i) => i !== index)
    setInstances(newInstances)
    setValue({ instances: newInstances })
    // Update collapsed tracking: shift indices above removed item.
    setCollapsedIndices((prev) => {
      const next = new Set<number>()
      prev.forEach((idx) => {
        if (idx < index) next.add(idx)
        else if (idx > index) next.add(idx - 1)
        // idx === index is removed
      })
      return next
    })
    // Re-evaluate min error after removal.
    if (newInstances.length > 0 && newInstances.length < minInstances) {
      setShowMinError(true)
    }
  }

  const updateInstance = (index: number, childId: string, value: unknown) => {
    const newInstances = instances.map((inst, i) =>
      i === index ? { ...inst, [childId]: value } : inst
    )
    setInstances(newInstances)
    setValue({ instances: newInstances })
  }

  const toggleCollapse = (index: number) => {
    setCollapsedIndices((prev) => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }

  // ─── Derived state ────────────────────────────────────────────────────────
  const atMax = maxInstances !== undefined && instances.length >= maxInstances
  const belowMin = minInstances > 0 && instances.length < minInstances

  return (
    <section
      role="group"
      aria-label={sectionTitle || "Repeating section"}
      className="flex flex-col gap-4"
    >
      {/* Section heading row */}
      <div>
        <div className="flex items-baseline justify-between gap-4">
          <h2 className={cn("font-serif text-lg font-normal leading-[1.3]", t.title)}>
            {sectionTitle}
          </h2>
          {/* Instance count badge — teal mono (UI-SPEC) */}
          <span className={t.badge}>
            {instances.length} {instances.length === 1 ? "instance" : "instances"}
          </span>
        </div>
        {sectionDescription && (
          <p className={cn("mt-1 text-sm", t.description)}>{sectionDescription}</p>
        )}
        <hr className={cn("mt-2 border-t", t.divider)} />
      </div>

      {/* Instance cards */}
      {instances.length > 0 && (
        <div className="flex flex-col gap-3">
          {instances.map((instance, idx) => {
            const isCollapsed = collapsedIndices.has(idx)
            return (
              <div
                key={idx}
                role="group"
                aria-label={`Instance ${idx + 1}`}
                className={cn("rounded-sm border", t.instanceCard)}
              >
                {/* Card header */}
                <div className="flex items-center justify-between px-3 h-9">
                  {/* Instance number */}
                  <span className={t.instanceNumber}>#{idx + 1}</span>

                  {/* Header actions */}
                  <div className="flex items-center gap-1">
                    {/* Collapse / expand */}
                    <button
                      type="button"
                      onClick={() => toggleCollapse(idx)}
                      aria-label={
                        isCollapsed
                          ? `Expand instance ${idx + 1}`
                          : `Collapse instance ${idx + 1}`
                      }
                      aria-expanded={!isCollapsed}
                      className={cn(
                        "flex items-center justify-center h-7 w-7 rounded-sm transition-colors",
                        t.collapseBtn
                      )}
                    >
                      {isCollapsed ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronUp className="h-4 w-4" />
                      )}
                    </button>

                    {/* Remove (no confirmation dialog — UI-SPEC §Destructive Actions) */}
                    <button
                      type="button"
                      onClick={() => removeInstance(idx)}
                      aria-label={`Remove instance ${idx + 1}`}
                      className={cn(
                        "flex items-center justify-center h-7 w-7 rounded-sm transition-colors",
                        t.removeBtn
                      )}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Card body — collapsible */}
                {!isCollapsed && childIds.length > 0 && (
                  <div className={cn("px-3 pb-3 flex flex-col gap-4 border-t", t.divider)}>
                    <div className="pt-3 flex flex-col gap-4">
                      {(() => {
                        // Phase 15: compute per-instance visibility once per render.
                        // evaluateVisibilityForInstance builds a synthetic answers map
                        // routing instance-local values + root values (ancestor scope D-03).
                        const instanceVis = evaluateVisibilityForInstance(
                          schema,
                          allValues,
                          entity.id,
                          idx
                        )
                        return childIds.map((childId) => {
                          const childEntity = schema.entities[childId]
                          if (!childEntity) return null
                          // Gate rendering: if the child is explicitly hidden by a rule, unmount it.
                          // This mirrors how shouldBeProcessed works at the root entity level.
                          if (instanceVis[childId]?.visible === false) return null
                          return (
                            <ChildInput
                              key={childId}
                              childId={childId}
                              entityDef={childEntity}
                              value={instance[childId]}
                              onChange={(v) => updateInstance(idx, childId, v)}
                              surface={surface}
                              t={t}
                              dynamicRequired={instanceVis[childId]?.required ?? false}
                            />
                          )
                        })
                      })()}
                    </div>
                  </div>
                )}

                {/* Empty body placeholder when no children configured */}
                {!isCollapsed && childIds.length === 0 && (
                  <div className={cn("px-3 pb-3 pt-2 text-xs border-t", t.divider, t.muted)}>
                    No fields configured for this section.
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Add instance button */}
      <button
        type="button"
        onClick={addInstance}
        disabled={atMax}
        aria-label={`Add ${sectionTitle || "instance"}`}
        className={cn(
          "w-full flex items-center justify-center gap-2 h-10 rounded-sm border border-dashed text-sm transition-colors",
          atMax ? t.addButtonDisabled : t.addButton
        )}
      >
        <Plus className="h-4 w-4" />
        <span>Add {sectionTitle || "instance"}</span>
      </button>

      {/* Max instances reached message */}
      {atMax && (
        <p className={cn("text-xs", t.muted)}>
          Maximum {maxInstances} {maxInstances === 1 ? "instance" : "instances"} reached.
        </p>
      )}

      {/* Min instances violation — shown after user interaction */}
      {showMinError && belowMin && (
        <p className={cn("text-xs", t.specialtyError)}>
          {sectionTitle || "This section"} requires at least {minInstances}{" "}
          {minInstances === 1 ? "instance" : "instances"}.
        </p>
      )}
    </section>
  )
}
