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

import {
  getCurrentFormSchema,
  augmentAnswersWithComputedValues,
} from "./compute-computed-values";
// Bug fix: the render gate MUST share the SAME comparison helpers as the
// submit/scrub gate (evaluate-rule.ts). Previously this file used strict `===`
// for equals/notEquals and a bare `Number()` for greaterThan/lessThan, while
// evaluate-rule.ts used coerced `valuesEqual` / `toNumeric`. The divergence let
// a field be rendered-as-visible by one gate yet scrubbed-as-hidden by the
// other, silently dropping the user's answer on submit. Importing the helpers
// guarantees both gates agree on every operator.
import { valuesEqual, toNumeric } from "./evaluate-rule";

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
      // Coerced equality — shares evaluate-rule.ts's `valuesEqual` so the
      // render-gate path (shouldBeProcessed) and the dynamicRequired/progress/
      // scrub path (evaluateVisibility) agree for numeric/date/multi-select
      // sources (string-vs-number `===` was always false before).
      return valuesEqual(sourceValue, ruleValue);
    case "notEquals":
      return !valuesEqual(sourceValue, ruleValue);
    case "contains":
      if (typeof sourceValue !== "string" || typeof ruleValue !== "string") return false;
      return sourceValue.includes(ruleValue);
    case "greaterThan": {
      // Shared `toNumeric` (Number-first, Date.parse fallback, NaN-on-blank) so
      // numeric operands like "6" / "12" compare as numbers, not Date epochs,
      // and the two gates never disagree. false when either side is NaN.
      const src = toNumeric(sourceValue);
      const rule = toNumeric(ruleValue);
      if (isNaN(src) || isNaN(rule)) return false;
      return src > rule;
    }
    case "lessThan": {
      const src = toNumeric(sourceValue);
      const rule = toNumeric(ruleValue);
      if (isNaN(src) || isNaN(rule)) return false;
      return src < rule;
    }
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
 *
 * Computed-source rules (D-02): rules whose sourceEntityId is a computedField
 * (e.g. "show Mitigation when PAS 79 = Intolerable") need the computed value
 * derived from the inputs, not the raw entitiesValues slot (which is undefined
 * because computedFields are read-only display widgets). We bridge by reading
 * the schema from the module-level registry that InterpreterRenderer fills
 * (see lib/form-builder/visibility/compute-computed-values.ts) and augmenting
 * entitiesValues with each computedField's derived value before rule eval.
 *
 * Without this, coltorapps' render gate would always evaluate computed-source
 * rules against undefined, hiding the dependent field forever.
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

    // Augment with computed values so rules sourced from a computedField see
    // the live derived value rather than the perma-undefined raw slot.
    const schema = getCurrentFormSchema();
    const valuesForRules = schema
      ? augmentAnswersWithComputedValues(schema, context.entitiesValues)
      : context.entitiesValues;

    // Evaluate each show/hide rule — NEVER throws (Pitfall 3: orphan source → false)
    const results: ShowHideRuleResult[] = showHideRules.map((r) => ({
      fired: evaluateRuleInline(
        r.operator,
        valuesForRules[r.sourceEntityId],
        r.value
      ),
      action: r.action,
    }));

    return combineShowHideInline(results, rules.logic);
  };
}
