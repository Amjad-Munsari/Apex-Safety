// Phase 15 Plan 15-02 Task 1 — real assertions for evaluateRule
import { describe, it, expect } from "vitest";

// Dynamic import convention (tests/form-builder/attributes.test.ts pattern)
const getModule = async () =>
  await import("@/lib/form-builder/visibility/evaluate-rule");

describe("evaluateRule — operator matrix", () => {
  it("equals: returns true when source value matches rule value", async () => {
    const { evaluateRule } = await getModule();
    expect(evaluateRule("equals", "Yes", "Yes")).toBe(true);
    expect(evaluateRule("equals", "Yes", "No")).toBe(false);
    expect(evaluateRule("equals", 42, 42)).toBe(true);
    expect(evaluateRule("equals", 42, 43)).toBe(false);
    expect(evaluateRule("equals", true, true)).toBe(true);
    expect(evaluateRule("equals", true, false)).toBe(false);
    // D-10: literal string comparison for select sources — no special-casing
    expect(evaluateRule("equals", "Some", "Yes")).toBe(false);
    expect(evaluateRule("equals", "N/A", "N/A")).toBe(true);
  });

  it("notEquals: returns true when source value does not match rule value", async () => {
    const { evaluateRule } = await getModule();
    expect(evaluateRule("notEquals", "Yes", "No")).toBe(true);
    expect(evaluateRule("notEquals", "Yes", "Yes")).toBe(false);
    // notEquals is also true when sourceValue is undefined unless ruleValue is also undefined
    expect(evaluateRule("notEquals", undefined, "Yes")).toBe(true);
    expect(evaluateRule("notEquals", undefined, undefined)).toBe(false);
    // D-10: notEquals "N/A" works as literal
    expect(evaluateRule("notEquals", "Cooking", "N/A")).toBe(true);
    expect(evaluateRule("notEquals", "N/A", "N/A")).toBe(false);
  });

  it("contains: returns true when source string contains rule value", async () => {
    const { evaluateRule } = await getModule();
    expect(evaluateRule("contains", "hello world", "world")).toBe(true);
    expect(evaluateRule("contains", "hello world", "foo")).toBe(false);
    // Case-sensitive
    expect(evaluateRule("contains", "Hello", "hello")).toBe(false);
    expect(evaluateRule("contains", "Hello", "Hello")).toBe(true);
    // Returns false when source is undefined/null
    expect(evaluateRule("contains", undefined, "foo")).toBe(false);
    expect(evaluateRule("contains", null, "foo")).toBe(false);
  });

  it("greaterThan: returns true when source number is greater than rule value", async () => {
    const { evaluateRule } = await getModule();
    expect(evaluateRule("greaterThan", 5, 3)).toBe(true);
    expect(evaluateRule("greaterThan", 3, 5)).toBe(false);
    expect(evaluateRule("greaterThan", 5, 5)).toBe(false);
    // Coerce numeric strings
    expect(evaluateRule("greaterThan", "10", "5")).toBe(true);
    // Returns false when either side is NaN or undefined
    expect(evaluateRule("greaterThan", undefined, 5)).toBe(false);
    expect(evaluateRule("greaterThan", 5, undefined)).toBe(false);
    expect(evaluateRule("greaterThan", "abc", 5)).toBe(false);
  });

  it("lessThan: returns true when source number is less than rule value", async () => {
    const { evaluateRule } = await getModule();
    expect(evaluateRule("lessThan", 3, 5)).toBe(true);
    expect(evaluateRule("lessThan", 5, 3)).toBe(false);
    expect(evaluateRule("lessThan", 5, 5)).toBe(false);
    // Coerce numeric strings
    expect(evaluateRule("lessThan", "2", "10")).toBe(true);
    // Returns false when either side is NaN or undefined
    expect(evaluateRule("lessThan", undefined, 5)).toBe(false);
    expect(evaluateRule("lessThan", 5, undefined)).toBe(false);
  });

  it("isEmpty: returns true when source value is empty (undefined, null, empty string, empty array)", async () => {
    const { evaluateRule } = await getModule();
    expect(evaluateRule("isEmpty", undefined)).toBe(true);
    expect(evaluateRule("isEmpty", null)).toBe(true);
    expect(evaluateRule("isEmpty", "")).toBe(true);
    expect(evaluateRule("isEmpty", [])).toBe(true);
    expect(evaluateRule("isEmpty", {})).toBe(true);
    // Repeating section empty value (RESEARCH §Pattern 5)
    expect(evaluateRule("isEmpty", { instances: [] })).toBe(true);
    // Non-empty values
    expect(evaluateRule("isEmpty", "hello")).toBe(false);
    expect(evaluateRule("isEmpty", [1])).toBe(false);
    expect(evaluateRule("isEmpty", { instances: [{}] })).toBe(false);
  });

  it("isNotEmpty: returns true when source value is non-empty", async () => {
    const { evaluateRule } = await getModule();
    expect(evaluateRule("isNotEmpty", "hello")).toBe(true);
    expect(evaluateRule("isNotEmpty", [1])).toBe(true);
    expect(evaluateRule("isNotEmpty", { instances: [{}] })).toBe(true);
    // Empty values
    expect(evaluateRule("isNotEmpty", undefined)).toBe(false);
    expect(evaluateRule("isNotEmpty", null)).toBe(false);
    expect(evaluateRule("isNotEmpty", "")).toBe(false);
    expect(evaluateRule("isNotEmpty", [])).toBe(false);
    expect(evaluateRule("isNotEmpty", { instances: [] })).toBe(false);
  });

  it("unknown operator: returns false without throwing (Pitfall 3 defensive)", async () => {
    const { evaluateRule } = await getModule();
    expect(evaluateRule("unknownOp", "foo", "bar")).toBe(false);
    expect(evaluateRule("", "foo", "bar")).toBe(false);
    expect(() => evaluateRule("rm -rf", "foo", "bar")).not.toThrow();
  });
});

describe("evaluateRule — source type matrix", () => {
  it("text field source: equals/notEquals/contains operators", async () => {
    const { evaluateRule } = await getModule();
    expect(evaluateRule("equals", "Commercial", "Commercial", "textField")).toBe(true);
    expect(evaluateRule("notEquals", "Residential", "Commercial", "textField")).toBe(true);
    expect(evaluateRule("contains", "Fire door inspection", "door", "textField")).toBe(true);
  });

  it("number field source: greaterThan/lessThan/equals operators", async () => {
    const { evaluateRule } = await getModule();
    expect(evaluateRule("greaterThan", 5, 3, "numberField")).toBe(true);
    expect(evaluateRule("lessThan", 2, 10, "numberField")).toBe(true);
    expect(evaluateRule("equals", 7, 7, "numberField")).toBe(true);
  });

  it("select field source: string label comparison (D-10 — no special-casing)", async () => {
    const { evaluateRule } = await getModule();
    // D-10: "Some", "Yes", "N/A" are distinct option labels
    expect(evaluateRule("equals", "Yes", "Yes", "selectField")).toBe(true);
    expect(evaluateRule("equals", "Some", "Yes", "selectField")).toBe(false);
    expect(evaluateRule("equals", "N/A", "N/A", "selectField")).toBe(true);
    expect(evaluateRule("notEquals", "N/A", "N/A", "selectField")).toBe(false);
    // Pitfall 4: notEquals "N/A" for the FRA "Cooking" row
    expect(evaluateRule("notEquals", "Cooking", "N/A", "selectField")).toBe(true);
  });

  it("checkbox field source: equals with boolean rule values", async () => {
    const { evaluateRule } = await getModule();
    expect(evaluateRule("equals", true, true, "checkboxField")).toBe(true);
    expect(evaluateRule("equals", false, false, "checkboxField")).toBe(true);
    expect(evaluateRule("equals", true, false, "checkboxField")).toBe(false);
  });

  it("date field source: greaterThan/lessThan use Date.parse comparison", async () => {
    const { evaluateRule } = await getModule();
    // "2026-06-01" is after "2026-01-01"
    expect(evaluateRule("greaterThan", "2026-06-01", "2026-01-01", "dateField")).toBe(true);
    expect(evaluateRule("lessThan", "2026-01-01", "2026-06-01", "dateField")).toBe(true);
    expect(evaluateRule("equals", "2026-05-26", "2026-05-26", "dateField")).toBe(true);
  });
});

describe("evaluateRule — acceptance criteria assertions", () => {
  it("evaluateRule('isEmpty', { instances: [] }) returns true (repeatingSection empty value)", async () => {
    const { evaluateRule } = await getModule();
    expect(evaluateRule("isEmpty", { instances: [] })).toBe(true);
  });

  it("evaluateRule('notEquals', 'N/A', 'N/A') returns false (D-10 literal string)", async () => {
    const { evaluateRule } = await getModule();
    expect(evaluateRule("notEquals", "N/A", "N/A")).toBe(false);
  });
});
