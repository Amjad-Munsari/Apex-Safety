// Phase 15 — Plan 15-01 Task 1: real visibilityRulesAttribute assertions
import { describe, it, expect } from "vitest";

describe("visibilityRulesAttribute.validate — default coercion", () => {
  it("undefined coerces to { rules: [], logic: 'and' } without throwing", async () => {
    const { visibilityRulesAttribute } = await import(
      "@/lib/form-builder/attributes/visibility-rules"
    );
    const result = visibilityRulesAttribute.validate(undefined);
    expect(result).toEqual({ rules: [], logic: "and" });
  });

  it("null coerces to { rules: [], logic: 'and' } without throwing", async () => {
    const { visibilityRulesAttribute } = await import(
      "@/lib/form-builder/attributes/visibility-rules"
    );
    const result = visibilityRulesAttribute.validate(null);
    expect(result).toEqual({ rules: [], logic: "and" });
  });

  it("wrong-shape root (non-object) throws a descriptive Error", async () => {
    const { visibilityRulesAttribute } = await import(
      "@/lib/form-builder/attributes/visibility-rules"
    );
    expect(() => visibilityRulesAttribute.validate("not-an-object")).toThrow(
      "visibilityRules must be an object"
    );
    expect(() => visibilityRulesAttribute.validate(42)).toThrow(
      "visibilityRules must be an object"
    );
    expect(() => visibilityRulesAttribute.validate(["array"])).toThrow(
      "visibilityRules must be an object"
    );
  });

  it("rule with bad operator throws Error with message containing 'Rule #i'", async () => {
    const { visibilityRulesAttribute } = await import(
      "@/lib/form-builder/attributes/visibility-rules"
    );
    expect(() =>
      visibilityRulesAttribute.validate({
        rules: [
          {
            sourceEntityId: "some-field",
            operator: "unknownOp",
            value: "x",
            action: "show",
          },
        ],
        logic: "and",
      })
    ).toThrow("Rule #0: operator must be one of");
  });

  it("rule with bad action throws Error with message containing 'Rule #i'", async () => {
    const { visibilityRulesAttribute } = await import(
      "@/lib/form-builder/attributes/visibility-rules"
    );
    expect(() =>
      visibilityRulesAttribute.validate({
        rules: [
          {
            sourceEntityId: "some-field",
            operator: "equals",
            value: "x",
            action: "badAction",
          },
        ],
        logic: "and",
      })
    ).toThrow("Rule #0: action must be show, hide, or require");
  });
});
