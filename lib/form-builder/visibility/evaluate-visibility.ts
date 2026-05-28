/**
 * lib/form-builder/visibility/evaluate-visibility.ts
 *
 * Schema-walking visibility evaluator — the single shared evaluator consumed by:
 * (a) coltorapps shouldBeProcessed hook (show/hide)
 * (b) renderer wrappers (dynamic required)
 * (c) computeFormProgress (drop hidden from denominator)
 * (d) stripHiddenAnswers (server-side scrub)
 *
 * Phase 15 Plan 15-02 — D-07 hide-wins/hidden-trumps-required; D-01 cascade.
 *
 * Exports:
 * - evaluateVisibility(schema, answers): Record<entityId, VisibilityState>
 * - evaluateVisibilityForInstance(schema, answers, repSectionId, instanceIndex): Record<childId, VisibilityState>
 */

import type { ProgressSchema, VisibilityState } from "./types";
import { evaluateRule } from "./evaluate-rule";
import { combineShowHide } from "./combine-rules";
import { cascadeVisibility } from "./cascade-visibility";
import { augmentAnswersWithComputedValues } from "./compute-computed-values";

/**
 * Return the entity type of a given sourceEntityId from schema.entities.
 * Used as a hint for evaluateRule (currently informational).
 */
function sourceTypeOf(schema: ProgressSchema, sourceEntityId: string): string | undefined {
  return schema.entities[sourceEntityId]?.type;
}

/**
 * Evaluate visibility and required state for every entity in the schema
 * given the current answers snapshot.
 *
 * Step 1: Per-entity own-rule evaluation (show/hide + require).
 * Step 2: cascadeVisibility — propagate parent hidden state to descendants.
 *
 * @param schema - Form schema (entities map).
 * @param answers - Current answer values keyed by entity ID (root-level only).
 * @returns Record<entityId, VisibilityState>
 */
export function evaluateVisibility(
  schema: ProgressSchema,
  answers: Record<string, unknown>
): Record<string, VisibilityState> {
  const out: Record<string, VisibilityState> = {};

  // Step 0: augment answers with computedField values so rules sourced from a
  // computedField (D-02) evaluate against the live computed level rather than
  // the always-undefined store slot for the read-only computedField.
  const answersWithComputed = augmentAnswersWithComputedValues(schema, answers);

  // Step 1: per-entity own-rule evaluation
  for (const [id, entity] of Object.entries(schema.entities)) {
    const rulesAttr = entity.attributes?.visibilityRules as
      | { rules: Array<{ sourceEntityId: string; operator: string; value: unknown; action: string }>; logic: "and" | "or" }
      | undefined;

    const rules = rulesAttr?.rules ?? [];
    const logic: "and" | "or" = rulesAttr?.logic ?? "and";

    // Split rules by action
    const showHideRules = rules.filter((r) => r.action === "show" || r.action === "hide");
    const requireRules = rules.filter((r) => r.action === "require");

    // Compute own visibility
    let ownVisible = true;
    if (showHideRules.length > 0) {
      const results = showHideRules.map((r) => ({
        fired: evaluateRule(
          r.operator,
          answersWithComputed[r.sourceEntityId],
          r.value,
          sourceTypeOf(schema, r.sourceEntityId)
        ),
        action: r.action as "show" | "hide",
      }));
      ownVisible = combineShowHide(results, logic);
    }

    // Compute required
    const staticRequired = entity.attributes?.required === true;
    const dynamicRequired = requireRules.some((r) =>
      evaluateRule(
        r.operator,
        answersWithComputed[r.sourceEntityId],
        r.value,
        sourceTypeOf(schema, r.sourceEntityId)
      )
    );

    let required = staticRequired || dynamicRequired;

    // D-07: hidden trumps required
    if (!ownVisible) required = false;

    out[id] = { visible: ownVisible, required };
  }

  // Step 2: cascade — if a parent container is hidden, all descendants become hidden+not-required
  cascadeVisibility(schema, out);

  return out;
}

/**
 * Evaluate visibility and required state for the CHILDREN of a specific repeatingSection
 * instance.
 *
 * Per the RESOLVED A3 spike (15-RESEARCH Open Questions #1): instance-template children are
 * NOT coltorapps entities and thus shouldBeProcessed is NEVER called for them. Per-instance
 * visibility is owned entirely by RepeatingSectionRenderer (plan 15-04) via this function.
 *
 * This function builds a synthetic answers map for the instance, routing:
 * - Child entity values: from answers[repSectionId].instances[instanceIndex][childId]
 * - Root entity values: from answers[rootId] (pass-through)
 *
 * @param schema - Form schema.
 * @param answers - Full answers map (root-level).
 * @param repSectionId - Entity ID of the repeatingSection.
 * @param instanceIndex - Zero-based instance index.
 * @returns Record<childEntityId, VisibilityState>
 */
export function evaluateVisibilityForInstance(
  schema: ProgressSchema,
  answers: Record<string, unknown>,
  repSectionId: string,
  instanceIndex: number
): Record<string, VisibilityState> {
  const repSectionEntity = schema.entities[repSectionId];
  if (!repSectionEntity) return {};

  const childIds = repSectionEntity.children ?? [];

  // Extract per-instance values from the repeatingSection answer shape
  const repValue = answers[repSectionId] as { instances?: Array<Record<string, unknown>> } | undefined;
  const instanceData: Record<string, unknown> = repValue?.instances?.[instanceIndex] ?? {};

  // Build synthetic answers map:
  // - For children: use the instance-local value
  // - For root entities (potential ancestor-scope sources per D-03): use answers[rootId]
  const syntheticAnswers: Record<string, unknown> = { ...answers };
  for (const childId of childIds) {
    syntheticAnswers[childId] = instanceData[childId];
  }

  // Build a synthetic schema that only contains the child entities (for evaluation)
  // plus any root entities referenced as sources (all of schema.entities).
  // We evaluate against the full schema but only return child entity states.
  const result = evaluateVisibility(schema, syntheticAnswers);

  // Return only the child-level states (caller is RepeatingSectionRenderer for a specific instance)
  const childResult: Record<string, VisibilityState> = {};
  for (const childId of childIds) {
    if (result[childId]) {
      childResult[childId] = result[childId];
    }
  }

  return childResult;
}
