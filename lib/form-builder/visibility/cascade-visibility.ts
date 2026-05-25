/**
 * lib/form-builder/visibility/cascade-visibility.ts
 *
 * Recursive parent→child visibility cascade.
 *
 * Phase 15 Plan 15-02 — D-01 cascade; D-07 hidden trumps required.
 *
 * Contract:
 * - Mutates the passed-in state map for performance (no copy needed — caller passes fresh map).
 * - Iterates every entity; if state[id].visible === false AND entity has children
 *   (sectionGroup or repeatingSection.children), recursively forces all descendants to
 *   { visible: false, required: false }.
 * - D-07: when forcing visible=false via cascade, also forces required=false.
 * - A hidden child does NOT cascade to its siblings — only parent→descendant propagation.
 */

import type { ProgressSchema, VisibilityState } from "./types";

/**
 * Force an entity (and all its descendants) to hidden+not-required.
 * Recursive so it handles sectionGroup → repeatingSection → grandchild chains.
 */
function forceHidden(
  entityId: string,
  schema: ProgressSchema,
  state: Record<string, VisibilityState>
): void {
  // Force this entity's state to hidden + not required (D-07)
  state[entityId] = { visible: false, required: false };

  // Recurse into children if this entity is a container
  const entity = schema.entities[entityId];
  if (!entity) return;
  const children = entity.children ?? [];
  for (const childId of children) {
    forceHidden(childId, schema, state);
  }
}

/**
 * Cascade visibility state from parent containers to their children.
 *
 * Call AFTER Step 1 (per-entity own-rule evaluation) in evaluateVisibility.
 * Mutates state in place.
 *
 * @param schema - The form schema (only reads entity.children).
 * @param state - Record of VisibilityState keyed by entity ID (mutated).
 */
export function cascadeVisibility(
  schema: ProgressSchema,
  state: Record<string, VisibilityState>
): void {
  // Iterate every entity; if it is hidden AND has children, propagate downward.
  // We do NOT recurse from the top here — instead we let forceHidden handle recursion.
  // This outer loop catches ALL hidden parents (not just those with cascadeable types).
  for (const [entityId, entity] of Object.entries(schema.entities)) {
    if (state[entityId]?.visible === false && Array.isArray(entity.children) && entity.children.length > 0) {
      for (const childId of entity.children) {
        forceHidden(childId, schema, state);
      }
    }
  }
}
