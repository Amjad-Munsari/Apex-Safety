/**
 * lib/form-builder/visibility/evaluate-rule.ts
 *
 * Pure function that evaluates a single visibility rule operator against a source value.
 *
 * Phase 15 Plan 15-02 — D-06 operator set, D-10 literal string semantics.
 *
 * Contract:
 * - Returns boolean — never throws.
 * - Unknown operator returns false (Pitfall 3: orphan-source defensive).
 * - D-10: "Some", "Yes", "N/A" are plain string labels — no engine special-casing.
 * - isEmpty / isNotEmpty handle: undefined, null, "", [], {}, {instances:[]} shapes.
 * - greaterThan / lessThan: coerce numeric strings; parse date strings via Date.parse;
 *   returns false when either side is NaN or undefined.
 */

function isEmptyValue(value: unknown): boolean {
  if (value === undefined || value === null || value === "") return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") {
    const v = value as Record<string, unknown>;
    // {instances: []} — empty repeatingSection value (RESEARCH §Pattern 5)
    if (Array.isArray(v.instances)) return v.instances.length === 0;
    // Plain empty object {}
    return Object.keys(v).length === 0;
  }
  return false;
}

function toNumeric(value: unknown): number {
  if (value === undefined || value === null) return NaN;
  // Date string: parse via Date.parse; timestamp is numeric
  if (typeof value === "string") {
    const asDate = Date.parse(value);
    if (!isNaN(asDate)) return asDate;
    const asNum = Number(value);
    return asNum;
  }
  if (typeof value === "number") return value;
  return NaN;
}

/**
 * Evaluate a single visibility rule operator against a source value.
 *
 * @param operator - One of the 7 D-06 operators.
 * @param sourceValue - The current value of the source entity (from entitiesValues).
 * @param ruleValue - The literal value declared in the rule (string, number, boolean, null).
 * @param sourceType - Optional entity type hint (e.g., "dateField") for disambiguation.
 *   Currently informational — the operator logic handles coercion generically.
 * @returns boolean — true when the rule condition is met.
 */
export function evaluateRule(
  operator: string,
  sourceValue: unknown,
  ruleValue?: unknown,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _sourceType?: string
): boolean {
  switch (operator) {
    case "equals":
      // Strict triple-equals for select sources; compares string label to ruleValue (D-10).
      return sourceValue === ruleValue;

    case "notEquals":
      // True when not equal; also true when sourceValue is undefined unless ruleValue is also undefined.
      return sourceValue !== ruleValue;

    case "contains":
      // Text/textarea only; case-sensitive substring; false when source is undefined/null.
      if (typeof sourceValue !== "string" || typeof ruleValue !== "string") return false;
      return sourceValue.includes(ruleValue);

    case "greaterThan": {
      // Number/date/computedField; coerce numeric strings; false for NaN or undefined.
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
      return isEmptyValue(sourceValue);

    case "isNotEmpty":
      return !isEmptyValue(sourceValue);

    default:
      // Unknown operator — return false, never throw (Pitfall 3 defensive).
      return false;
  }
}
