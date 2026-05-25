import { createAttribute } from "@coltorapps/builder";

// D-06: Fixed operator set per Phase 15 spec.
export const VALID_OPERATORS = new Set([
  "equals",
  "notEquals",
  "contains",
  "greaterThan",
  "lessThan",
  "isEmpty",
  "isNotEmpty",
]);

// D-07: Fixed action set per Phase 15 spec.
export const VALID_ACTIONS = new Set(["show", "hide", "require"]);

// D-05: VisibilityRule shape
export interface VisibilityRule {
  sourceEntityId: string;
  operator:
    | "equals"
    | "notEquals"
    | "contains"
    | "greaterThan"
    | "lessThan"
    | "isEmpty"
    | "isNotEmpty";
  value: string | number | boolean | null;
  action: "show" | "hide" | "require";
}

// D-05: VisibilityRules shape
export interface VisibilityRules {
  rules: VisibilityRule[];
  logic: "and" | "or";
}

// Default value: no rules, AND logic.
// ALWAYS returned for undefined/null — pre-Phase-15 template_versions.schema_json
// rows must validate cleanly (Phase 13 RESEARCH Pitfall 1 / A4).
const DEFAULT: VisibilityRules = { rules: [], logic: "and" };

export const visibilityRulesAttribute = createAttribute({
  name: "visibilityRules",
  validate(value) {
    // Pitfall 1: default-coerce missing value so legacy schemas continue to work.
    if (value === undefined || value === null) return DEFAULT;

    // Non-object root (string, array, number) → throw.
    if (typeof value !== "object" || Array.isArray(value)) {
      throw new Error(
        "visibilityRules must be an object with `rules` and `logic`."
      );
    }

    const v = value as Record<string, unknown>;

    // logic: preserve "or"; coerce everything else (including missing) to "and".
    const logic: "and" | "or" = v.logic === "or" ? "or" : "and";

    // rules: must be an array if present; throw otherwise.
    if (v.rules !== undefined && !Array.isArray(v.rules)) {
      throw new Error("visibilityRules.rules must be an array.");
    }

    const rawRules: unknown[] = Array.isArray(v.rules) ? v.rules : [];

    const rules: VisibilityRule[] = rawRules.map((r, i) => {
      if (!r || typeof r !== "object" || Array.isArray(r)) {
        throw new Error(`Rule #${i} is not an object.`);
      }
      const raw = r as Record<string, unknown>;

      // sourceEntityId: must be a non-empty string.
      if (
        typeof raw.sourceEntityId !== "string" ||
        raw.sourceEntityId.length === 0
      ) {
        throw new Error(
          `Rule #${i}: sourceEntityId must be a non-empty string.`
        );
      }

      // operator: must be one of the seven D-06 values.
      if (
        typeof raw.operator !== "string" ||
        !VALID_OPERATORS.has(raw.operator)
      ) {
        throw new Error(
          `Rule #${i}: operator must be one of ${[...VALID_OPERATORS].join(", ")}.`
        );
      }

      // action: must be one of the three D-07 values.
      if (typeof raw.action !== "string" || !VALID_ACTIONS.has(raw.action)) {
        throw new Error(`Rule #${i}: action must be show, hide, or require.`);
      }

      return {
        sourceEntityId: raw.sourceEntityId,
        operator: raw.operator as VisibilityRule["operator"],
        // value defaults to null when missing (D-05).
        value: (raw.value ?? null) as VisibilityRule["value"],
        action: raw.action as VisibilityRule["action"],
      };
    });

    return { rules, logic };
  },
});
