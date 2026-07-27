// Phase 15 Plan 15-02 Task 3 — real assertions for stripHiddenAnswers
import { describe, it, expect } from "vitest";
import type { VisibilityState } from "@/lib/form-builder/visibility/types";

const getModule = async () =>
  await import("@/lib/form-builder/visibility/strip-hidden-answers");

// Minimal schema helper
function makeSchema(
  entities: Record<
    string,
    { type?: string; attributes?: Record<string, unknown>; children?: string[] }
  >
) {
  return { entities };
}

describe("stripHiddenAnswers — server-side scrub", () => {
  it("hidden field is stripped from answers output", async () => {
    const { stripHiddenAnswers } = await getModule();

    const schema = makeSchema({
      visibleField: { type: "textField" },
      hiddenField: { type: "textField" },
    });

    const answers = {
      visibleField: "hello",
      hiddenField: "should be stripped",
    };

    const visibility: Record<string, VisibilityState> = {
      visibleField: { visible: true, required: false },
      hiddenField: { visible: false, required: false },
    };

    const result = stripHiddenAnswers(schema, answers, visibility);

    expect(result).toHaveProperty("visibleField", "hello");
    expect(result).not.toHaveProperty("hiddenField");
  });

  it("cascade strip: hidden parent (sectionGroup) causes all children to be stripped", async () => {
    const { stripHiddenAnswers } = await getModule();

    const schema = makeSchema({
      section1: { type: "sectionGroup", children: ["child1", "child2"] },
      child1: { type: "textField" },
      child2: { type: "textField" },
    });

    const answers = {
      section1: undefined,
      child1: "value1",
      child2: "value2",
    };

    // section1 and its children are all hidden (cascaded)
    const visibility: Record<string, VisibilityState> = {
      section1: { visible: false, required: false },
      child1: { visible: false, required: false },
      child2: { visible: false, required: false },
    };

    const result = stripHiddenAnswers(schema, answers, visibility);

    expect(result).not.toHaveProperty("section1");
    expect(result).not.toHaveProperty("child1");
    expect(result).not.toHaveProperty("child2");
  });

  it("per-instance repeatingSection scrub: each instance is evaluated independently and hidden fields are stripped", async () => {
    const { stripHiddenAnswers } = await getModule();

    const answers = {
      doorSection: {
        instances: [
          { doorCondition: "Poor", repairUrgency: "Urgent" },   // instance 0: both visible
          { doorCondition: "Good", repairUrgency: "N/A" },       // instance 1: repairUrgency hidden
        ],
      },
    };

    // Top-level doorSection visible; children need per-instance eval
    // In instance 0: repairUrgency visible (doorCondition="Poor" → require fires)
    // In instance 1: repairUrgency hidden (doorCondition="Good" → no rule fires, assume show rule)
    // We simulate visibility maps as if instance 0 repairUrgency is visible, instance 1 is hidden
    // by using evaluateVisibilityForInstance in the implementation.
    // Here we construct a schema where repairUrgency has a show-rule based on doorCondition.
    const schemaWithRules = makeSchema({
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
                action: "show",
              },
            ],
            logic: "and",
          },
        },
      },
    });

    // Root visibility: doorSection is visible
    const visibility: Record<string, VisibilityState> = {
      doorSection: { visible: true, required: false },
      doorCondition: { visible: true, required: false },
      repairUrgency: { visible: true, required: false },
    };

    const result = stripHiddenAnswers(schemaWithRules, answers, visibility) as {
      doorSection: { instances: Array<Record<string, unknown>> };
    };

    expect(result.doorSection).toBeDefined();
    const instances = result.doorSection.instances;
    expect(instances).toHaveLength(2);

    // Instance 0: doorCondition="Poor" → show rule fires → repairUrgency is visible → kept
    expect(instances[0]).toHaveProperty("doorCondition", "Poor");
    expect(instances[0]).toHaveProperty("repairUrgency", "Urgent");

    // Instance 1: doorCondition="Good" → show rule doesn't fire → repairUrgency is hidden → stripped
    expect(instances[1]).toHaveProperty("doorCondition", "Good");
    expect(instances[1]).not.toHaveProperty("repairUrgency");
  });

  it("hidden-but-required field is silently dropped without throwing an error", async () => {
    const { stripHiddenAnswers } = await getModule();

    const schema = makeSchema({
      hiddenRequiredField: {
        type: "textField",
        attributes: { required: true },
      },
    });

    const answers = {
      hiddenRequiredField: "some value",
    };

    // Field is hidden AND was required — D-07 means required=false when hidden
    // Function must NEVER throw even with required=true in static attributes
    const visibility: Record<string, VisibilityState> = {
      hiddenRequiredField: { visible: false, required: false },
    };

    // Must not throw
    expect(() => stripHiddenAnswers(schema, answers, visibility)).not.toThrow();

    const result = stripHiddenAnswers(schema, answers, visibility);
    // The hidden field must be stripped from output
    expect(result).not.toHaveProperty("hiddenRequiredField");
  });

  it("unknown keys (not present in schema.entities) are silently dropped", async () => {
    const { stripHiddenAnswers } = await getModule();

    const schema = makeSchema({
      knownField: { type: "textField" },
    });

    const answers = {
      knownField: "hello",
      orphanedKey: "from old schema version",
    };

    const visibility: Record<string, VisibilityState> = {
      knownField: { visible: true, required: false },
    };

    const result = stripHiddenAnswers(schema, answers, visibility);

    expect(result).toHaveProperty("knownField", "hello");
    // Unknown key must be silently dropped
    expect(result).not.toHaveProperty("orphanedKey");
  });
});
