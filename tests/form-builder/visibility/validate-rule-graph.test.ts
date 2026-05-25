import { describe, it, expect } from "vitest";

// Plan 15-03 Task 2: validateRuleGraph tests
// 7 Wave-0 test cases + 1 extra malformed-schema robustness test.
// Uses dynamic await import() to keep production module out of static import graph (vitest isolation).

// ── Schema helpers ────────────────────────────────────────────────────────────

function makeEntity(
  type: string,
  opts: {
    rules?: Array<{ sourceEntityId: string; operator: string; value: unknown; action: "show" | "hide" | "require" }>;
    logic?: "and" | "or";
    computedInputs?: Record<string, string>;
    label?: string;
  } = {}
) {
  return {
    type,
    attributes: {
      label: opts.label,
      visibilityRules: {
        rules: opts.rules ?? [],
        logic: opts.logic ?? ("and" as const),
      },
      ...(opts.computedInputs !== undefined ? { computedInputs: opts.computedInputs } : {}),
    },
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("validateRuleGraph — cycle detection + scope validation (D-08/D-09)", () => {
  it("linear chain (A→B→C with no back-edge) passes validation successfully", async () => {
    const { validateRuleGraph } = await import(
      "@/lib/form-builder/visibility/validate-rule-graph"
    );

    // A is a source for B; B is a source for C — linear, no cycle
    const schema = {
      entities: {
        A: makeEntity("textField", { label: "Field A" }),
        B: makeEntity("textField", {
          label: "Field B",
          rules: [{ sourceEntityId: "A", operator: "equals", value: "yes", action: "show" }],
        }),
        C: makeEntity("textField", {
          label: "Field C",
          rules: [{ sourceEntityId: "B", operator: "equals", value: "yes", action: "show" }],
        }),
      },
    };

    const result = validateRuleGraph(schema);
    expect(result.ok).toBe(true);
    expect(result.cycles).toHaveLength(0);
    expect(result.scopeErrors.filter((e) => e.severity !== "advisory")).toHaveLength(0);
  });

  it("direct cycle A→B→A is rejected with an error listing both entity IDs", async () => {
    const { validateRuleGraph } = await import(
      "@/lib/form-builder/visibility/validate-rule-graph"
    );

    // B depends on A; A depends on B → direct cycle
    const schema = {
      entities: {
        A: makeEntity("textField", {
          label: "Field A",
          rules: [{ sourceEntityId: "B", operator: "equals", value: "yes", action: "show" }],
        }),
        B: makeEntity("textField", {
          label: "Field B",
          rules: [{ sourceEntityId: "A", operator: "equals", value: "yes", action: "show" }],
        }),
      },
    };

    const result = validateRuleGraph(schema);
    expect(result.ok).toBe(false);
    expect(result.cycles.length).toBeGreaterThan(0);

    // The cycle path should include both A and B
    const cycleIds = result.cycles[0].path;
    expect(cycleIds).toContain("A");
    expect(cycleIds).toContain("B");
  });

  it("computed-mediated cycle (A has rule on computedField; A is also computedField's input) is detected (Pitfall 8)", async () => {
    const { validateRuleGraph } = await import(
      "@/lib/form-builder/visibility/validate-rule-graph"
    );

    // A is a number input to computedField (risk score)
    // riskScore is a computedField with A as input
    // A has a show rule that references riskScore as source → cycle: A → riskScore → A
    const schema = {
      entities: {
        A: makeEntity("numberField", {
          label: "Likelihood",
          rules: [{ sourceEntityId: "riskScore", operator: "equals", value: "Intolerable", action: "show" }],
        }),
        riskScore: makeEntity("computedField", {
          label: "Risk Score",
          computedInputs: { likelihood: "A" },
        }),
      },
    };

    const result = validateRuleGraph(schema);
    expect(result.ok).toBe(false);
    expect(result.cycles.length).toBeGreaterThan(0);

    // At least one edge in the cycle should be via "computed"
    const hasComputedEdge = result.cycles.some((cycle) =>
      cycle.edges.some((edge) => edge.via === "computed")
    );
    expect(hasComputedEdge).toBe(true);

    // Verify that direct-only traversal would miss this cycle:
    // riskScore has NO visibilityRules rules referencing A, so it wouldn't appear in direct edges
    // Only the computedInputs edge (A is input to riskScore) creates the cycle.
    // The computed-mediated cycle requires BOTH edge classes to be detected.
    const cycleIds = result.cycles[0].path;
    expect(cycleIds).toContain("A");
    expect(cycleIds).toContain("riskScore");
  });

  it("ancestor-scope reference (field inside repeatingSection references root field) passes validation (D-03)", async () => {
    const { validateRuleGraph } = await import(
      "@/lib/form-builder/visibility/validate-rule-graph"
    );

    // repChild is inside myRepSection; rootField is at root level
    // repChild references rootField → ancestor-scope, ALLOWED per D-03
    const schema = {
      entities: {
        rootField: makeEntity("selectField", { label: "Site Type" }),
        myRepSection: {
          type: "repeatingSection",
          attributes: {
            visibilityRules: { rules: [], logic: "and" as const },
          },
          children: ["repChild"],
        },
        repChild: makeEntity("textField", {
          label: "Repair Urgency",
          rules: [{ sourceEntityId: "rootField", operator: "equals", value: "Commercial", action: "show" }],
        }),
      },
    };

    const result = validateRuleGraph(schema);
    expect(result.ok).toBe(true);
    expect(result.cycles).toHaveLength(0);
    const hardErrors = result.scopeErrors.filter((e) => e.severity !== "advisory");
    expect(hardErrors).toHaveLength(0);
  });

  it("cross-instance reference is rejected with reason='cross-instance'", async () => {
    const { validateRuleGraph } = await import(
      "@/lib/form-builder/visibility/validate-rule-graph"
    );

    // repChildA is inside repSectionA; repChildB is inside repSectionB
    // repChildA references repChildB → cross-instance, REJECTED per D-03
    const schema = {
      entities: {
        repSectionA: {
          type: "repeatingSection",
          attributes: { visibilityRules: { rules: [], logic: "and" as const } },
          children: ["repChildA"],
        },
        repChildA: makeEntity("textField", {
          label: "Child A",
          rules: [{ sourceEntityId: "repChildB", operator: "equals", value: "Poor", action: "show" }],
        }),
        repSectionB: {
          type: "repeatingSection",
          attributes: { visibilityRules: { rules: [], logic: "and" as const } },
          children: ["repChildB"],
        },
        repChildB: makeEntity("textField", { label: "Child B" }),
      },
    };

    const result = validateRuleGraph(schema);
    expect(result.ok).toBe(false);
    const crossInstanceErrors = result.scopeErrors.filter(
      (e) => e.reason === "cross-instance"
    );
    expect(crossInstanceErrors.length).toBeGreaterThan(0);
    expect(crossInstanceErrors[0].consumerId).toBe("repChildA");
    expect(crossInstanceErrors[0].sourceId).toBe("repChildB");
  });

  it("root field referencing a field inside a repeatingSection is rejected with reason='root-references-inside-repeating'", async () => {
    const { validateRuleGraph } = await import(
      "@/lib/form-builder/visibility/validate-rule-graph"
    );

    // rootField has a rule referencing repChild (inside myRepSection) → REJECTED per D-03
    const schema = {
      entities: {
        rootField: makeEntity("textField", {
          label: "Root Field",
          rules: [{ sourceEntityId: "repChild", operator: "equals", value: "yes", action: "show" }],
        }),
        myRepSection: {
          type: "repeatingSection",
          attributes: { visibilityRules: { rules: [], logic: "and" as const } },
          children: ["repChild"],
        },
        repChild: makeEntity("textField", { label: "Rep Child" }),
      },
    };

    const result = validateRuleGraph(schema);
    expect(result.ok).toBe(false);
    const rootRefInsideErrors = result.scopeErrors.filter(
      (e) => e.reason === "root-references-inside-repeating"
    );
    expect(rootRefInsideErrors.length).toBeGreaterThan(0);
    expect(rootRefInsideErrors[0].consumerId).toBe("rootField");
    expect(rootRefInsideErrors[0].sourceId).toBe("repChild");
  });

  it("orphan sourceEntityId (references non-existent entity) emits an advisory entry, does not hard-reject (Pitfall 3 / A6)", async () => {
    const { validateRuleGraph } = await import(
      "@/lib/form-builder/visibility/validate-rule-graph"
    );

    // fieldA references nonExistentId which is not in schema.entities
    const schema = {
      entities: {
        fieldA: makeEntity("textField", {
          label: "Field A",
          rules: [{ sourceEntityId: "nonExistentId", operator: "equals", value: "yes", action: "show" }],
        }),
      },
    };

    const result = validateRuleGraph(schema);
    // Orphan-source alone does NOT set ok=false
    expect(result.ok).toBe(true);
    // But there should be an advisory entry
    const advisoryEntries = result.scopeErrors.filter(
      (e) => e.reason === "orphan-source" && e.severity === "advisory"
    );
    expect(advisoryEntries.length).toBeGreaterThan(0);
    expect(advisoryEntries[0].sourceId).toBe("nonExistentId");
    expect(advisoryEntries[0].consumerId).toBe("fieldA");
  });

  it("malformed schema (null entities, missing rules) does not throw — returns ok or structured errors", async () => {
    const { validateRuleGraph } = await import(
      "@/lib/form-builder/visibility/validate-rule-graph"
    );

    // Completely empty schema
    expect(() => validateRuleGraph({ entities: {} })).not.toThrow();
    const emptyResult = validateRuleGraph({ entities: {} });
    expect(emptyResult.ok).toBe(true);
    expect(emptyResult.cycles).toHaveLength(0);
    expect(emptyResult.scopeErrors).toHaveLength(0);

    // Schema with entity that has no visibilityRules attribute
    expect(() =>
      validateRuleGraph({
        entities: {
          A: { type: "textField", attributes: {} },
        },
      })
    ).not.toThrow();
  });

  it("CycleError edges array correctly tags via='direct' vs via='computed' for each hop", async () => {
    const { validateRuleGraph } = await import(
      "@/lib/form-builder/visibility/validate-rule-graph"
    );

    // Direct cycle: A→B→A (both via "direct")
    const schema = {
      entities: {
        A: makeEntity("textField", {
          label: "A",
          rules: [{ sourceEntityId: "B", operator: "equals", value: "x", action: "show" }],
        }),
        B: makeEntity("textField", {
          label: "B",
          rules: [{ sourceEntityId: "A", operator: "equals", value: "x", action: "show" }],
        }),
      },
    };

    const result = validateRuleGraph(schema);
    expect(result.cycles.length).toBeGreaterThan(0);
    const edges = result.cycles[0].edges;
    // All edges should be via "direct" in this case
    expect(edges.every((e) => e.via === "direct")).toBe(true);
  });
});
