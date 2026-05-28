/**
 * Inline computation of computedField values for use inside the visibility evaluator.
 *
 * Why: rules can reference a computedField as their source (D-02 — "show Mitigation
 * when PAS 79 === Intolerable"). The computedField renderer is read-only and does NOT
 * persist its result to the interpreter store (calling setValue from a render effect
 * trips coltorapps' validateEntityValue guard). So `answers[computedFieldId]` is always
 * undefined and any rule sourced from it would silently fail.
 *
 * This helper returns a clone of the answers map augmented with computed values for
 * every computedField in the schema. evaluateVisibility / evaluateVisibilityForInstance
 * call this before per-entity rule evaluation so the rules see live computed values.
 */
import type { ProgressSchema } from "./types"
import { computePAS79RiskLevel } from "../risk/pas79"

export function augmentAnswersWithComputedValues(
  schema: ProgressSchema,
  answers: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...answers }

  for (const [entityId, entity] of Object.entries(schema.entities)) {
    if (entity.type !== "computedField") continue
    const attrs = (entity.attributes ?? {}) as Record<string, unknown>
    const formula = attrs.formula as string | undefined
    const inputs = (attrs.computedInputs ?? {}) as Record<string, string>

    if (formula === "pas79") {
      const likelihoodId = inputs.likelihood
      const consequenceId = inputs.consequence
      const likelihoodRaw = likelihoodId ? answers[likelihoodId] : undefined
      const consequenceRaw = consequenceId ? answers[consequenceId] : undefined
      const likelihoodNum =
        likelihoodRaw !== undefined && likelihoodRaw !== null ? Number(likelihoodRaw) : undefined
      const consequenceNum =
        consequenceRaw !== undefined && consequenceRaw !== null ? Number(consequenceRaw) : undefined
      const result = computePAS79RiskLevel(
        likelihoodNum !== undefined && !isNaN(likelihoodNum) ? likelihoodNum : undefined,
        consequenceNum !== undefined && !isNaN(consequenceNum) ? consequenceNum : undefined
      )
      if (result) out[entityId] = result.level
    }
    // Future formulas (DSEAR, COSHH, etc.) plug in here.
  }

  return out
}
