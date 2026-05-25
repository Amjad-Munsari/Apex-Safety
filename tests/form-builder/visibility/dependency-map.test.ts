import { describe, it, expect } from "vitest";

// Plan 15-03 Task 1: dependency-map tests
// Uses dynamic await import() to keep production module out of static import graph (vitest isolation).

describe("buildDependencyMap — edge construction", () => {
  it("direct edges: each entity's visibilityRules sources map to sourceEntityId → dependentEntityId", async () => {
    const { buildDependencyMap } = await import(
      "@/lib/form-builder/visibility/dependency-map"
    );

    // Schema: 3 entities, entity B and C have rules referencing entity A as source
    // Entity D has a rule referencing B as source
    const schema = {
      entities: {
        A: {
          type: "textField",
          attributes: {
            visibilityRules: { rules: [], logic: "and" as const },
          },
        },
        B: {
          type: "textField",
          attributes: {
            visibilityRules: {
              rules: [{ sourceEntityId: "A", operator: "equals", value: "yes", action: "show" as const }],
              logic: "and" as const,
            },
          },
        },
        C: {
          type: "textField",
          attributes: {
            visibilityRules: {
              rules: [{ sourceEntityId: "A", operator: "equals", value: "no", action: "hide" as const }],
              logic: "and" as const,
            },
          },
        },
        D: {
          type: "textField",
          attributes: {
            visibilityRules: {
              rules: [{ sourceEntityId: "B", operator: "equals", value: "foo", action: "show" as const }],
              logic: "and" as const,
            },
          },
        },
      },
    };

    const map = buildDependencyMap(schema);

    // A is a source for B and C
    expect(map.direct.get("A")).toBeDefined();
    expect(map.direct.get("A")!.has("B")).toBe(true);
    expect(map.direct.get("A")!.has("C")).toBe(true);

    // B is a source for D
    expect(map.direct.get("B")).toBeDefined();
    expect(map.direct.get("B")!.has("D")).toBe(true);

    // D is not a source for anyone
    expect(map.direct.get("D")).toBeUndefined();
  });

  it("computed edges: computedField's computedInputs create inputId → computedFieldId edges (D-02)", async () => {
    const { buildDependencyMap } = await import(
      "@/lib/form-builder/visibility/dependency-map"
    );

    // A computedField that takes 2 inputs: likelihood and consequence
    const schema = {
      entities: {
        likelihood: {
          type: "numberField",
          attributes: {
            visibilityRules: { rules: [], logic: "and" as const },
          },
        },
        consequence: {
          type: "numberField",
          attributes: {
            visibilityRules: { rules: [], logic: "and" as const },
          },
        },
        riskScore: {
          type: "computedField",
          attributes: {
            visibilityRules: { rules: [], logic: "and" as const },
            computedInputs: { likelihood: "likelihood", consequence: "consequence" },
          },
        },
      },
    };

    const map = buildDependencyMap(schema);

    // riskScore computedField has 2 inputs
    expect(map.computedInputs.get("riskScore")).toBeDefined();
    expect(map.computedInputs.get("riskScore")!.has("likelihood")).toBe(true);
    expect(map.computedInputs.get("riskScore")!.has("consequence")).toBe(true);

    // Non-computed fields are not in computedInputs map
    expect(map.computedInputs.get("likelihood")).toBeUndefined();
  });

  it("entities with no visibilityRules still build an empty direct entry (tolerance)", async () => {
    const { buildDependencyMap } = await import(
      "@/lib/form-builder/visibility/dependency-map"
    );

    // Entity with no visibilityRules attribute at all
    const schema = {
      entities: {
        A: {
          type: "textField",
          attributes: {},
        },
      },
    };

    const map = buildDependencyMap(schema);
    // Should not throw; direct should have no entry for A since A is no source
    expect(map.direct.get("A")).toBeUndefined();
    // No computed edges either
    expect(map.computedInputs.size).toBe(0);
  });

  it("computedField with empty string inputs are excluded from computedInputs (only non-empty strings)", async () => {
    const { buildDependencyMap } = await import(
      "@/lib/form-builder/visibility/dependency-map"
    );

    const schema = {
      entities: {
        score: {
          type: "computedField",
          attributes: {
            computedInputs: { likelihood: "likelihoodId", consequence: "" }, // consequence is empty string
          },
        },
      },
    };

    const map = buildDependencyMap(schema);
    const inputs = map.computedInputs.get("score");
    expect(inputs).toBeDefined();
    // Only non-empty strings are included
    expect(inputs!.has("likelihoodId")).toBe(true);
    expect(inputs!.has("")).toBe(false);
    expect(inputs!.size).toBe(1);
  });
});
