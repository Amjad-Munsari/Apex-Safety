/**
 * lib/form-builder/visibility/combine-rules.ts
 *
 * Combines evaluated show/hide rule results using AND/OR logic with D-07 hide-wins.
 *
 * Phase 15 Plan 15-02 — D-07: hide wins over show.
 *
 * Contract:
 * - Input: Array<{ fired: boolean; action: "show" | "hide" }> plus logic: "and"|"or".
 * - anyHideFired → return false (hide wins, D-07).
 * - No show rules AND no hide fires → return true (require-only list doesn't affect visibility).
 * - Show rules: AND = every show rule fired; OR = any show rule fired.
 */

export type ShowHideResult = {
  fired: boolean;
  action: "show" | "hide";
};

/**
 * Combine show/hide rule results per logic with D-07 hide-wins enforcement.
 *
 * @param results - Array of evaluated show/hide rule results (require rules are not passed here).
 * @param logic - "and" or "or" combination mode for show rules.
 * @returns boolean — true = entity should be visible; false = hidden.
 */
export function combineShowHide(
  results: ShowHideResult[],
  logic: "and" | "or"
): boolean {
  // D-07: hide wins — any fired hide rule overrides everything.
  const anyHideFired = results.some((r) => r.action === "hide" && r.fired);
  if (anyHideFired) return false;

  // Filter to show rules only.
  const showResults = results.filter((r) => r.action === "show");

  // No show rules and no hide fires → visible by default.
  // (A rule list of all `require` actions does not affect visibility — D-07.)
  if (showResults.length === 0) return true;

  // Evaluate show rules per logic.
  if (logic === "and") {
    return showResults.every((r) => r.fired);
  } else {
    return showResults.some((r) => r.fired);
  }
}
