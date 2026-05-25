// Phase 15 Plan 15-02 Task 2 — real assertions for evaluateVisibility
import { describe, it, expect } from "vitest";

const getModule = async () =>
  await import("@/lib/form-builder/visibility/evaluate-visibility");

// Minimal schema builder helper
function makeSchema(
  entities: Record<
    string,
    { type?: string; attributes?: Record<string, unknown>; children?: string[] }
  >
) {
  return { entities };
}

describe("evaluateVisibility — integration (evaluate + combine + cascade)", () => {
  it("basic integration: entity with matching show rule is visible in result", async () => {
    const { evaluateVisibility } = await getModule();

    const schema = makeSchema({
      sourceField: { type: "selectField", attributes: {} },
      targetField: {
        type: "textField",
        attributes: {
          visibilityRules: {
            rules: [
              {
                sourceEntityId: "sourceField",
                operator: "equals",
                value: "Yes",
                action: "show",
              },
            ],
            logic: "and",
          },
        },
      },
    });

    // Source = "Yes" → show rule fires → targetField should be visible
    const result = evaluateVisibility(schema, {
      sourceField: "Yes",
      targetField: "",
    });

    expect(result.targetField.visible).toBe(true);
    expect(result.sourceField.visible).toBe(true);
  });

  it("entity with non-matching show rule is hidden (show rule doesn't fire)", async () => {
    const { evaluateVisibility } = await getModule();

    const schema = makeSchema({
      sourceField: { type: "selectField", attributes: {} },
      targetField: {
        type: "textField",
        attributes: {
          visibilityRules: {
            rules: [
              {
                sourceEntityId: "sourceField",
                operator: "equals",
                value: "Yes",
                action: "show",
              },
            ],
            logic: "and",
          },
        },
      },
    });

    // Source = "No" → show rule doesn't fire → targetField should be hidden
    const result = evaluateVisibility(schema, {
      sourceField: "No",
      targetField: "",
    });

    expect(result.targetField.visible).toBe(false);
  });

  it("require rule fires: entity with matching require rule has required=true in result", async () => {
    const { evaluateVisibility } = await getModule();

    const schema = makeSchema({
      conditionField: { type: "selectField", attributes: {} },
      requirableField: {
        type: "textField",
        attributes: {
          // No static required — only dynamic
          visibilityRules: {
            rules: [
              {
                sourceEntityId: "conditionField",
                operator: "equals",
                value: "Poor",
                action: "require",
              },
            ],
            logic: "and",
          },
        },
      },
    });

    // conditionField = "Poor" → require rule fires → requirableField.required === true
    const result = evaluateVisibility(schema, {
      conditionField: "Poor",
      requirableField: "",
    });

    expect(result.requirableField.required).toBe(true);
    expect(result.requirableField.visible).toBe(true); // require rule doesn't affect visibility
  });

  it("hidden trumps required (D-07): entity hidden by a hide rule is not required even if a require rule fires", async () => {
    const { evaluateVisibility } = await getModule();

    const schema = makeSchema({
      sourceField: { type: "selectField", attributes: {} },
      targetField: {
        type: "textField",
        attributes: {
          required: true, // static required
          visibilityRules: {
            rules: [
              {
                sourceEntityId: "sourceField",
                operator: "equals",
                value: "Hidden",
                action: "hide",
              },
              {
                sourceEntityId: "sourceField",
                operator: "equals",
                value: "Hidden",
                action: "require",
              },
            ],
            logic: "and",
          },
        },
      },
    });

    // sourceField = "Hidden" → hide fires AND require fires; hidden trumps → required=false
    const result = evaluateVisibility(schema, {
      sourceField: "Hidden",
      targetField: "",
    });

    expect(result.targetField.visible).toBe(false);
    expect(result.targetField.required).toBe(false); // D-07: hidden trumps required
  });

  it("static required + no rules → required=true and visible=true", async () => {
    const { evaluateVisibility } = await getModule();

    const schema = makeSchema({
      plainField: {
        type: "textField",
        attributes: { required: true },
      },
    });

    const result = evaluateVisibility(schema, { plainField: "" });
    expect(result.plainField.visible).toBe(true);
    expect(result.plainField.required).toBe(true);
  });

  it("cascade: hidden sectionGroup parent hides children, required becomes false", async () => {
    const { evaluateVisibility } = await getModule();

    const schema = makeSchema({
      toggle: { type: "checkboxField", attributes: {} },
      section1: {
        type: "sectionGroup",
        children: ["childField"],
        attributes: {
          visibilityRules: {
            rules: [
              {
                sourceEntityId: "toggle",
                operator: "equals",
                value: true,
                action: "hide",
              },
            ],
            logic: "and",
          },
        },
      },
      childField: {
        type: "textField",
        attributes: { required: true },
      },
    });

    // toggle = true → section1 hidden → childField cascades to hidden, required=false
    const result = evaluateVisibility(schema, { toggle: true });
    expect(result.section1.visible).toBe(false);
    expect(result.childField.visible).toBe(false);
    expect(result.childField.required).toBe(false); // D-07: cascade forces required=false
  });
});

describe("evaluateVisibilityForInstance — per-instance repeatingSection", () => {
  it("evaluates instance-local sibling values for require rule", async () => {
    const { evaluateVisibilityForInstance } = await getModule();

    const schema = makeSchema({
      doorSection: {
        type: "repeatingSection",
        children: ["doorCondition", "repairUrgency"],
      },
      doorCondition: { type: "selectField", attributes: {} },
      repairUrgency: {
        type: "selectField",
        attributes: {
          visibilityRules: {
            rules: [
              {
                sourceEntityId: "doorCondition",
                operator: "equals",
                value: "Poor",
                action: "require",
              },
            ],
            logic: "and",
          },
        },
      },
    });

    const answers = {
      doorSection: {
        instances: [
          { doorCondition: "Poor", repairUrgency: "" },    // instance 0: condition=Poor
          { doorCondition: "Good", repairUrgency: "" },    // instance 1: condition=Good
        ],
      },
    };

    // Instance 0: doorCondition = "Poor" → require fires → repairUrgency.required = true
    const result0 = evaluateVisibilityForInstance(schema, answers, "doorSection", 0);
    expect(result0.repairUrgency.required).toBe(true);
    expect(result0.repairUrgency.visible).toBe(true);

    // Instance 1: doorCondition = "Good" → require doesn't fire → repairUrgency.required = false
    const result1 = evaluateVisibilityForInstance(schema, answers, "doorSection", 1);
    expect(result1.repairUrgency.required).toBe(false);
  });

  it("two instances with different sibling values yield different per-instance visibility", async () => {
    const { evaluateVisibilityForInstance } = await getModule();

    const schema = makeSchema({
      repSection: {
        type: "repeatingSection",
        children: ["sourceChild", "targetChild"],
      },
      sourceChild: { type: "selectField", attributes: {} },
      targetChild: {
        type: "textField",
        attributes: {
          visibilityRules: {
            rules: [
              {
                sourceEntityId: "sourceChild",
                operator: "equals",
                value: "Show",
                action: "show",
              },
            ],
            logic: "and",
          },
        },
      },
    });

    const answers = {
      repSection: {
        instances: [
          { sourceChild: "Show", targetChild: "" },    // instance 0: show fires
          { sourceChild: "Hide", targetChild: "" },    // instance 1: show doesn't fire
        ],
      },
    };

    const result0 = evaluateVisibilityForInstance(schema, answers, "repSection", 0);
    expect(result0.targetChild.visible).toBe(true);

    const result1 = evaluateVisibilityForInstance(schema, answers, "repSection", 1);
    expect(result1.targetChild.visible).toBe(false);
  });
});
