/**
 * lib/form-builder/visibility/should-be-processed.ts
 *
 * Shared shouldBeProcessed body — attached to EVERY entity definition (all 13).
 *
 * coltorapps calls this on every interpreter store value change. When it returns
 * false, the entity (and ALL its children) is not rendered and not validated,
 * which is exactly the D-01 / D-07 hidden-cascade contract.
 *
 * --- Resolved A3 spike outcome (root-only entitiesValues) ---
 * Per the A3 investigation: coltorapps passes `entitiesValues` at the ROOT level
 * only (i.e., `entitiesValues[entityId]` for root-level entities and direct
 * instance values). Instance-template children inside a `repeatingSection` are
 * NOT coltorapps entities and are NEVER passed to `shouldBeProcessed`.
 * See: components/form-interpreter/repeating-section-renderer.tsx lines 22-25.
 *
 * This means per-instance visibility inside a repeatingSection is handled
 * separately via `evaluateVisibilityForInstance` in plan 15-04's
 * RepeatingSectionRenderer modification — NOT here.
 *
 * --- Hot-path invariant ---
 * iterates only this entity's own visibilityRules; never walks the schema.
 * Bounded by the per-entity rule count. Zero schema I/O.
 *
 * --- Wave 0 strategy ---
 * This file ships in Wave 0 as the REAL implementation. It inlines the
 * evaluateRule + combineShowHide logic directly to avoid importing Wave-1
 * modules that do not exist yet. Plan 15-02 ships the standalone
 * `evaluate-rule.ts` and `combine-rules.ts` modules (which these tests
 * import via dynamic await import). Those modules are the separately-tested
 * equivalents of the inline logic here — they do NOT overwrite this file.
 *
 * Plans 15-01 and 15-02 MUST NOT include this path in their files_modified.
 */

// ── Inline evaluation helpers (Wave-0 self-contained) ────────────────────────
// These mirror the contracts in evaluate-rule.ts and combine-rules.ts (Wave 1).
// When Wave 1 ships, the test files import those modules; this file keeps its
// own copies to avoid a static-import dependency on not-yet-existing modules.

type VisibilityRuleAction = "show" | "hide" | "require";
type VisibilityRuleOperator =
  | "equals"
  | "notEquals"
  | "contains"
  | "greaterThan"
  | "lessThan"
  | "isEmpty"
  | "isNotEmpty";

interface ShowHideRuleResult {
  fired: boolean;
  action: "show" | "hide";
}

/**
 * Evaluate a single visibility rule operator against a source value.
 * Pitfall 3: orphan-source (sourceEntityId not in entitiesValues) returns false
 * (the source value is undefined → isEmpty returns true, others return false).
 * NEVER throws.
 */
function evaluateRuleInline(
  operator: string,
  sourceValue: unknown,
  ruleValue: unknown
): boolean {
  switch (operator as VisibilityRuleOperator) {
    case "equals":
      // eslint-disable-next-line eqeqeq
      return sourceValue == ruleValue;
    case "notEquals":
      // eslint-disable-next-line eqeqeq
      return sourceValue != ruleValue;
    case "contains":
      if (typeof sourceValue !== "string" || typeof ruleValue !== "string") return false;
      return sourceValue.includes(ruleValue);
    case "greaterThan":
      return Number(sourceValue) > Number(ruleValue);
    case "lessThan":
      return Number(sourceValue) < Number(ruleValue);
    case "isEmpty":
      if (sourceValue === undefined || sourceValue === null || sourceValue === "") return true;
      if (Array.isArray(sourceValue)) return sourceValue.length === 0;
      if (typeof sourceValue === "object") {
        const inst = (sourceValue as Record<string, unknown>).instances;
        if (Array.isArray(inst)) return inst.length === 0;
      }
      return false;
    case "isNotEmpty":
      if (sourceValue === undefined || sourceValue === null || sourceValue === "") return false;
      if (Array.isArray(sourceValue)) return sourceValue.length > 0;
      if (typeof sourceValue === "object") {
        const inst = (sourceValue as Record<string, unknown>).instances;
        if (Array.isArray(inst)) return inst.length > 0;
      }
      return true;
    default:
      return false;
  }
}

/**
 * Combine show/hide rule results according to logic ("and" | "or") and
 * the D-07 hide-wins-over-show rule.
 * If hideRules fire → entity is hidden (returns false).
 * If showRules fire per logic → entity is shown (returns true).
 * If no rule fires → entity is visible (no rule = always-show default).
 */
function combineShowHideInline(
  results: ShowHideRuleResult[],
  logic: "and" | "or"
): boolean {
  const hideResults = results.filter((r) => r.action === "hide");
  const showResults = results.filter((r) => r.action === "show");

  // D-07: hide wins over show
  const anyHideFired = hideResults.some((r) => r.fired);
  if (anyHideFired) return false;

  // If no show rules, entity is visible (pure hide rules with none firing → show)
  if (showResults.length === 0) return true;

  // Evaluate show rules per logic
  if (logic === "and") {
    return showResults.every((r) => r.fired);
  } else {
    return showResults.some((r) => r.fired);
  }
}

// ── Public export ─────────────────────────────────────────────────────────────

type ShouldBeProcessedContext = {
  entity: {
    id: string;
    attributes: { visibilityRules?: unknown; required?: unknown };
  };
  entitiesValues: Record<string, unknown>;
};

type InternalVisibilityRules = {
  rules: Array<{
    sourceEntityId: string;
    operator: string;
    value: unknown;
    action: VisibilityRuleAction;
  }>;
  logic: "and" | "or";
};

/**
 * Factory that returns the `shouldBeProcessed` hook body.
 * Call once per entity definition:
 *   shouldBeProcessed: makeShouldBeProcessed()
 *
 * The returned hook is invoked by coltorapps on every interpreter store
 * value change. It evaluates ONLY the show/hide rules on the entity being
 * asked about. Require rules are a renderer-level concern handled via
 * evaluateVisibility (plan 15-02).
 */
export function makeShouldBeProcessed() {
  return function shouldBeProcessed(context: ShouldBeProcessedContext): boolean {
    const rawRules = context.entity.attributes.visibilityRules as
      | InternalVisibilityRules
      | undefined;

    // Defence-in-depth: default-coerce if attribute factory did not run yet.
    // (The attribute factory in plan 15-01 also default-coerces undefined → default.)
    const rules: InternalVisibilityRules = rawRules ?? { rules: [], logic: "and" };

    // Fast path: no rules → always visible
    if (rules.rules.length === 0) return true;

    // Filter to show/hide rules only (require rules do not affect visibility)
    const showHideRules = rules.rules.filter(
      (r): r is typeof r & { action: "show" | "hide" } =>
        r.action === "show" || r.action === "hide"
    );

    // Only require rules → entity is visible
    if (showHideRules.length === 0) return true;

    // Evaluate each show/hide rule — NEVER throws (Pitfall 3: orphan source → false)
    const results: ShowHideRuleResult[] = showHideRules.map((r) => ({
      fired: evaluateRuleInline(
        r.operator,
        context.entitiesValues[r.sourceEntityId],
        r.value
      ),
      action: r.action,
    }));

    return combineShowHideInline(results, rules.logic);
  };
}
