/**
 * ComputedFieldRenderer
 *
 * Read-only PAS 79 risk badge. Subscribes selectively to the two dependency
 * entity values (likelihood + consequence) via useInterpreterEntitiesValues,
 * recomputing the badge on every change.
 *
 * Cross-plan dependency (RESEARCH Pitfall 5):
 *   `interpreterStore` is a required prop. Plan 14-06 (interpreter-renderer.tsx
 *   components map) plumbs it from InterpreterRenderer → ComputedFieldRenderer.
 *   Other renderers do not receive the store reference; this renderer is the sole
 *   consumer of useInterpreterEntitiesValues in Phase 14.
 *
 * States:
 *   1. Configuration error — inputs.likelihood or inputs.consequence entity IDs
 *      are empty/undefined in the builder config. Show "not configured" pill.
 *   2. Pending — either dependency value is unset or non-numeric. Show "fill in"
 *      pending pill.
 *   3. Computed — both inputs are valid integers in [1,5]. Show the PAS 79 badge
 *      with the correct Tailwind colour class (green/amber/red).
 *
 * Accessibility: role="status" aria-live="polite" on the result badge so screen
 * readers announce updates when dependency values change (UI-SPEC §Accessibility).
 *
 * No animation on badge update — the colour change IS the signal (UI-SPEC §Reactivity).
 *
 * Security note (T-14-05-03): computePAS79RiskLevel returns null for non-numeric
 * inputs (attrs.inputs misconfigured to point at non-numeric entity) — renderer
 * safely falls back to "pending" pill. No crash, no incorrect badge.
 *
 * AttachPhotosAffordance (D-05): wired identically to GeolocationFieldRenderer
 * — when `attrs.attachPhotos === true` AND `clientId` + `submissionId` are
 * supplied by the components map wrapper. Code audit 2026-05-29 closed the
 * Plan 14-06 carry-forward.
 */
"use client"

import { useInterpreterEntitiesValues } from "@coltorapps/builder-react"
import type { InterpreterStore } from "@coltorapps/builder"
import { cn } from "@/lib/utils"
import type { EntityComponentProps } from "@coltorapps/builder-react"
import type { computedFieldEntity } from "@/lib/form-builder/entities/computed-field"
import type { formBuilder } from "@/lib/form-builder"
import { computePAS79RiskLevel } from "@/lib/form-builder/risk/pas79"
import { AttachPhotosAffordance } from "./attach-photos-affordance"

type Props = EntityComponentProps<typeof computedFieldEntity> & {
  surface?: "dark" | "cream"
  /**
   * The interpreter store reference from InterpreterRenderer.
   *
   * This prop is mandatory and is plumbed in by Plan 14-06's components map
   * wrapper (interpreter-renderer.tsx). The useInterpreterEntitiesValues hook
   * requires the store instance — it cannot be obtained from entity props alone.
   *
   * See RESEARCH Pitfall 5: "useInterpreterEntitiesValues Requires interpreterStore
   * Reference". The other renderers do not need this prop; computedFieldRenderer
   * is the only Phase 14 renderer that subscribes to other entity values.
   */
  interpreterStore: InterpreterStore<typeof formBuilder>
  /** Wired by components map for AttachPhotosAffordance (D-05). Optional —
   *  affordance is skipped if either is missing. */
  clientId?: string
  submissionId?: string
}

const surfaceTokens = {
  dark: {
    label: "text-white/70",
    helpText: "text-white/40",
    placeholder: "border-white/10 text-white/40",
  },
  cream: {
    label: "text-foreground",
    helpText: "text-muted-foreground",
    placeholder: "border-border text-muted-foreground",
  },
} as const

export function ComputedFieldRenderer({ entity, interpreterStore, surface = "cream", clientId, submissionId }: Props) {
  const t = surfaceTokens[surface]
  const attrs = entity.attributes

  // Read computed input entity IDs from attrs.computedInputs.
  // computedInputs is Record<string, string> mapping input names → entity IDs.
  const inputs = (attrs.computedInputs ?? {}) as Record<string, string>
  const likelihoodId: string | undefined = inputs.likelihood || undefined
  const consequenceId: string | undefined = inputs.consequence || undefined

  // Determine whether inputs are configured (non-empty entity IDs).
  const isConfigured = Boolean(likelihoodId && consequenceId)

  // Selective subscription — re-renders ONLY when likelihood or consequence values change.
  // useInterpreterEntitiesValues must be called unconditionally (React hooks rules).
  // Pass an empty array when not configured so the hook is always called with a valid array.
  const entityIds = isConfigured
    ? [likelihoodId as string, consequenceId as string]
    : []
  const values = useInterpreterEntitiesValues(interpreterStore, entityIds)

  // Configuration error state — entity IDs not set in the builder.
  if (!isConfigured) {
    return (
      <div className="flex flex-col gap-1.5">
        <label className={cn("text-sm font-semibold", t.label)}>{attrs.label as string}</label>
          <div
          className={cn(
            "px-4 py-3 rounded-sm text-sm border border-dashed",
            t.placeholder
          )}
        >
          Computed field not configured — set inputs in the builder.
        </div>
      </div>
    )
  }

  // Coerce values to numbers (inputs[id] may be undefined if entities aren't yet filled).
  const likelihoodRaw = likelihoodId ? values[likelihoodId] : undefined
  const consequenceRaw = consequenceId ? values[consequenceId] : undefined
  const likelihoodNum =
    likelihoodRaw !== undefined && likelihoodRaw !== null ? Number(likelihoodRaw) : undefined
  const consequenceNum =
    consequenceRaw !== undefined && consequenceRaw !== null ? Number(consequenceRaw) : undefined

  // Call computePAS79RiskLevel — returns null for undefined/out-of-range inputs (Pitfall 4).
  // Read-only display: the computed value is derived on every render from the
  // dependency inputs and is NOT persisted to the interpreter store. Visibility
  // rules that reference this computedField as a source compute the same value
  // inline via augmentAnswersWithComputedValues — see shouldBeProcessed and
  // evaluateVisibility. On submission, the persisted answers_json includes the
  // dependency inputs (likelihood, consequence) but not the derived risk level;
  // downstream consumers (AI report, review UI) can recompute as needed.
  const result = computePAS79RiskLevel(
    likelihoodNum !== undefined && !isNaN(likelihoodNum) ? likelihoodNum : undefined,
    consequenceNum !== undefined && !isNaN(consequenceNum) ? consequenceNum : undefined
  )

  return (
    <div className="flex flex-col gap-1.5">
      {/* Field label — no required asterisk (computedField has no requiredAttribute) */}
      <label className={cn("text-sm font-semibold", t.label)}>{attrs.label as string}</label>
      {attrs.helpText && (
        <p className={cn("text-xs", t.helpText)}>{attrs.helpText as string}</p>
      )}

      {result ? (
        /* Computed badge — role="status" aria-live="polite" for accessibility */
        <div
          role="status"
          aria-live="polite"
          className={cn(
            "px-4 py-3 rounded-sm text-sm font-semibold border",
            result.colourClass
          )}
        >
          {result.level} — Score: {result.score}
        </div>
      ) : (
        /* Pending state — either dependency is unset or out of range */
        <div
          role="status"
          aria-live="polite"
          className={cn(
            "px-4 py-3 rounded-sm text-sm border border-dashed",
            t.placeholder
          )}
        >
          Fill in likelihood and consequence fields above to compute risk.
        </div>
      )}

      {/* NOTE: computedField is read-only — no setValue, no error display, no user input. */}
      {attrs.attachPhotos && clientId && submissionId && (
        <AttachPhotosAffordance
          submissionId={submissionId}
          entityId={entity.id}
          fieldLabel={attrs.label as string}
          surface={surface}
          clientId={clientId}
        />
      )}
    </div>
  )
}
