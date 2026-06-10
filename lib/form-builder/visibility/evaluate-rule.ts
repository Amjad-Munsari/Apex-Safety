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

/**
 * Exported (bug fix): the render gate `shouldBeProcessed` must use the EXACT
 * same numeric coercion as this submit/scrub gate. Previously it used a bare
 * `Number()` for greaterThan/lessThan, so the two gates could disagree and an
 * answer rendered-as-visible would be scrubbed-as-hidden on submit.
 */
export function toNumeric(value: unknown): number {
  if (value === undefined || value === null) return NaN;
  if (typeof value === "string") {
    // Number FIRST (bug fix): a numeric operand like "6" / "12" must compare as a
    // number, not as a Date epoch. Date.parse("12") yields a bogus timestamp on
    // some engines, so a Date-first order made greaterThan/lessThan compare
    // epoch-ms against a small number — always wrong. Guard empty/whitespace
    // strings to NaN because Number("") === 0 / Number(" ") === 0 would otherwise
    // coerce blanks to 0 and spuriously pass a > comparison.
    const trimmed = value.trim();
    if (trimmed === "") return NaN;
    const asNum = Number(trimmed);
    if (!isNaN(asNum)) return asNum;
    // Genuine non-numeric string → fall back to Date.parse for ISO date operands
    // (e.g. "2026-01-01"), whose epoch-ms ordering is the intended comparison.
    const asDate = Date.parse(value);
    if (!isNaN(asDate)) return asDate;
    return NaN;
  }
  if (typeof value === "number") return value;
  return NaN;
}

/**
 * Strict finite-number parse for equality coercion. Unlike toNumeric this does
 * NOT fall back to Date.parse (which would turn an ISO date string into an epoch
 * ms number) and rejects empty / whitespace-only strings (Number("") === 0).
 * Returns null when the value is not an unambiguous finite number — callers then
 * fall back to string comparison so plain-string equality is unchanged.
 */
function asFiniteNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") return null;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

// Matches yyyy-mm-dd (the value shape produced by <input type="date"> and the
// dateField renderer). Used to avoid date-coercing plain string labels.
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}/;

/**
 * Normalize a value to a yyyy-mm-dd ISO date string for date equality, or null
 * when it is not a usable date. Only string/number/Date inputs are considered;
 * plain string labels that don't parse as dates return null so the caller falls
 * back to string comparison.
 */
function toIsoDate(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
  }
  if (typeof value === "number") {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }
  if (typeof value === "string") {
    const ms = Date.parse(value);
    return isNaN(ms) ? null : new Date(ms).toISOString().slice(0, 10);
  }
  return null;
}

/**
 * Equality with type coercion (Bug fix: numeric/date `equals` silently never
 * fired because live answers are numbers/Dates while stored rule values are
 * strings, so strict `===` between string and number is always false).
 *
 * Precedence:
 *  1. Multi-select source (Array sourceValue): array-includes membership.
 *  2. Numeric: when the source is a numberField, or both sides parse as finite
 *     numbers, compare numerically.
 *  3. Date: when the source is a dateField, or both sides normalize to an ISO
 *     date, compare yyyy-mm-dd strings.
 *  4. Fallback: strict `===` — preserves existing plain-string / boolean
 *     semantics exactly (e.g. "Some" !== "Yes", "N/A" === "N/A", true === true).
 */
export function valuesEqual(
  sourceValue: unknown,
  ruleValue: unknown,
  sourceType?: string
): boolean {
  // 1. Multi-select (selectField with allowMultiple) stores an array of selected
  //    option values; "equals <option>" means the option is among the selected.
  if (Array.isArray(sourceValue)) {
    return sourceValue.some((item) => valuesEqual(item, ruleValue, sourceType));
  }

  // 2. Numeric comparison.
  const srcNum = asFiniteNumber(sourceValue);
  const ruleNum = asFiniteNumber(ruleValue);
  if (sourceType === "numberField" || sourceType === "computedField") {
    // Authoritative numeric source — compare numerically when both parse.
    if (srcNum !== null && ruleNum !== null) return srcNum === ruleNum;
  } else if (srcNum !== null && ruleNum !== null) {
    // Untyped/other source but both sides are unambiguous finite numbers.
    return srcNum === ruleNum;
  }

  // 3. Date comparison (normalize to yyyy-mm-dd).
  if (
    sourceType === "dateField" ||
    (typeof sourceValue === "string" &&
      typeof ruleValue === "string" &&
      ISO_DATE_RE.test(sourceValue) &&
      ISO_DATE_RE.test(ruleValue))
  ) {
    const srcDate = toIsoDate(sourceValue);
    const ruleDate = toIsoDate(ruleValue);
    if (srcDate !== null && ruleDate !== null) return srcDate === ruleDate;
  }

  // 4. Fallback — unchanged strict equality for strings/booleans/etc.
  return sourceValue === ruleValue;
}

/**
 * Evaluate a single visibility rule operator against a source value.
 *
 * @param operator - One of the 7 D-06 operators.
 * @param sourceValue - The current value of the source entity (from entitiesValues).
 * @param ruleValue - The literal value declared in the rule (string, number, boolean, null).
 * @param sourceType - Optional entity type hint (e.g., "dateField", "numberField")
 *   used by equals/notEquals to coerce number/date sources before comparing.
 * @returns boolean — true when the rule condition is met.
 */
export function evaluateRule(
  operator: string,
  sourceValue: unknown,
  ruleValue?: unknown,
  sourceType?: string
): boolean {
  switch (operator) {
    case "equals":
      // Type-coerced equality: numeric/date sources are normalized before
      // comparing (string-vs-number `===` is always false); multi-select sources
      // match on array membership. Plain string/boolean labels (D-10: "Some",
      // "Yes", "N/A") fall through to strict `===` unchanged.
      return valuesEqual(sourceValue, ruleValue, sourceType);

    case "notEquals":
      // Inverse of equals. Preserves prior behaviour where an undefined source is
      // "not equal" to a defined ruleValue (undefined !== "Yes" → true), while
      // gaining the same number/date/multi-select coercion as equals.
      return !valuesEqual(sourceValue, ruleValue, sourceType);

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
