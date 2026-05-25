/**
 * lib/form-builder/visibility/strip-hidden-answers.ts
 *
 * Server-side hidden-subtree scrub. Called in submitAssessmentAction between
 * validateEntitiesValues and the DB write (plan 15-05 wires this).
 *
 * Phase 15 Plan 15-02 — D-01: preserve on hide, drop on submit.
 *
 * Contract:
 * - NEVER throws — hidden-but-required field is silently dropped.
 *   Dynamic required===false for hidden fields (D-07) means submission can complete.
 * - Unknown keys (no entity in schema) are silently dropped.
 * - visibility[id]?.visible === false → drop entirely.
 * - repeatingSection with instances array: per-instance scrub via evaluateVisibilityForInstance;
 *   instance row is preserved even when all children are scrubbed.
 * - All other entity types: pass value through (if visible).
 *
 * Reference implementation: 15-RESEARCH §Pattern 7 lines 672-702.
 */

import type { ProgressSchema, VisibilityState } from "./types";
import { evaluateVisibilityForInstance } from "./evaluate-visibility";

/**
 * Strip hidden answers from a validated answers map.
 *
 * @param schema - Form schema (reads entity types and children).
 * @param answers - Validated answer values (from validateEntitiesValues result.data).
 * @param visibility - Visibility state from evaluateVisibility(schema, answers).
 * @returns Scrubbed answers record — hidden entity keys removed.
 */
export function stripHiddenAnswers(
  schema: ProgressSchema,
  answers: Record<string, unknown>,
  visibility: Record<string, VisibilityState>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  for (const [id, value] of Object.entries(answers)) {
    // Unknown key (no entity in schema) → silently drop (matches existing pattern)
    const entity = schema.entities[id];
    if (!entity) continue;

    // Hidden entity → drop entirely (D-01)
    if (visibility[id]?.visible === false) continue;

    // repeatingSection with instances array: per-instance child scrub
    if (entity.type === "repeatingSection") {
      const v = value as { instances?: Array<Record<string, unknown>> } | undefined | null;
      if (!v || !Array.isArray(v.instances)) {
        // Not a valid repeatingSection value — pass through as-is
        out[id] = value;
        continue;
      }

      const scrubbedInstances = v.instances.map((instance, idx) => {
        // Evaluate per-instance visibility for each child
        const instVis = evaluateVisibilityForInstance(schema, answers, id, idx);
        const scrubbedInst: Record<string, unknown> = {};

        for (const [childId, childVal] of Object.entries(instance)) {
          // Only keep the child if its per-instance visibility is true (or unknown → keep)
          if (instVis[childId]?.visible === false) continue;
          scrubbedInst[childId] = childVal;
        }

        // Preserve the instance row even when empty (zero-children-visible is still a valid instance)
        return scrubbedInst;
      });

      out[id] = { instances: scrubbedInstances };
    } else {
      // All other entity types: pass value through (already confirmed visible above)
      out[id] = value;
    }
  }

  return out;
}
