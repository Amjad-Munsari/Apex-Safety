// Phase 15 Plan 15-02 Task 2 — real assertions for cascadeVisibility
// + smoke-test for makeShouldBeProcessed (plan 15-00 hook, now callable with Wave-1 modules)
import { describe, it, expect } from "vitest";

const getCascade = async () =>
  await import("@/lib/form-builder/visibility/cascade-visibility");

const getShouldBeProcessed = async () =>
  await import("@/lib/form-builder/visibility/should-be-processed");

// Minimal schema builder helpers for tests
function makeSchema(
  entities: Record<
    string,
    { type?: string; attributes?: Record<string, unknown>; children?: string[] }
  >
) {
  return { entities };
}

describe("cascadeVisibility — parent-child hide cascade", () => {
  it("hidden parent causes all children to be hidden (sectionGroup cascade)", async () => {
    const { cascadeVisibility } = await getCascade();

    const schema = makeSchema({
      section1: { type: "sectionGroup", children: ["field1", "field2"] },
      field1: { type: "textField" },
      field2: { type: "textField" },
    });

    const state: Record<string, { visible: boolean; required: boolean }> = {
      section1: { visible: false, required: false },
      field1: { visible: true, required: true },
      field2: { visible: true, required: false },
    };

    cascadeVisibility(schema, state);

    // Children must become hidden + not required (D-07: hidden trumps required)
    expect(state.field1.visible).toBe(false);
    expect(state.field1.required).toBe(false);
    expect(state.field2.visible).toBe(false);
    expect(state.field2.required).toBe(false);
  });

  it("hidden sectionGroup causes grandchildren (nested fields) to be hidden", async () => {
    const { cascadeVisibility } = await getCascade();

    const schema = makeSchema({
      outerSection: { type: "sectionGroup", children: ["innerSection"] },
      innerSection: { type: "sectionGroup", children: ["child1", "child2", "child3"] },
      child1: { type: "textField" },
      child2: { type: "textField" },
      child3: { type: "textField" },
    });

    const state: Record<string, { visible: boolean; required: boolean }> = {
      outerSection: { visible: false, required: false },
      innerSection: { visible: true, required: false },
      child1: { visible: true, required: true },
      child2: { visible: true, required: false },
      child3: { visible: true, required: true },
    };

    cascadeVisibility(schema, state);

    // innerSection is hidden because outerSection is hidden
    expect(state.innerSection.visible).toBe(false);
    expect(state.innerSection.required).toBe(false);
    // All grandchildren are hidden
    expect(state.child1.visible).toBe(false);
    expect(state.child1.required).toBe(false);
    expect(state.child2.visible).toBe(false);
    expect(state.child3.visible).toBe(false);
    expect(state.child3.required).toBe(false);
  });

  it("repeatingSection per-instance cascade: hiding the container hides all instance children", async () => {
    const { cascadeVisibility } = await getCascade();

    const schema = makeSchema({
      doorSection: { type: "repeatingSection", children: ["doorCondition", "repairUrgency"] },
      doorCondition: { type: "selectField" },
      repairUrgency: { type: "selectField" },
    });

    const state: Record<string, { visible: boolean; required: boolean }> = {
      doorSection: { visible: false, required: false },
      doorCondition: { visible: true, required: false },
      repairUrgency: { visible: true, required: true },
    };

    cascadeVisibility(schema, state);

    expect(state.doorCondition.visible).toBe(false);
    expect(state.doorCondition.required).toBe(false);
    expect(state.repairUrgency.visible).toBe(false);
    expect(state.repairUrgency.required).toBe(false);
  });

  it("sibling cascade does NOT propagate: hidden child does not affect siblings", async () => {
    const { cascadeVisibility } = await getCascade();

    const schema = makeSchema({
      section1: { type: "sectionGroup", children: ["field1", "field2"] },
      field1: { type: "textField" },
      field2: { type: "textField" },
    });

    // section1 is visible, field1 is hidden (by its own rules) — field2 must stay visible
    const state: Record<string, { visible: boolean; required: boolean }> = {
      section1: { visible: true, required: false },
      field1: { visible: false, required: false },
      field2: { visible: true, required: true },
    };

    cascadeVisibility(schema, state);

    // field2 must remain unaffected — hidden sibling doesn't cascade
    expect(state.field2.visible).toBe(true);
    expect(state.field2.required).toBe(true);
    // field1 stays hidden (its own state)
    expect(state.field1.visible).toBe(false);
  });
});

describe("makeShouldBeProcessed — smoke test (plan 15-00 hook + Wave-1 modules)", () => {
  it("entity with no rules returns true", async () => {
    const { makeShouldBeProcessed } = await getShouldBeProcessed();
    const hook = makeShouldBeProcessed();

    const result = hook({
      entity: {
        id: "field1",
        attributes: { visibilityRules: { rules: [], logic: "and" } },
      },
      entitiesValues: { field1: "some value" },
    });

    expect(result).toBe(true);
  });

  it("entity with a single fired hide rule returns false", async () => {
    const { makeShouldBeProcessed } = await getShouldBeProcessed();
    const hook = makeShouldBeProcessed();

    const result = hook({
      entity: {
        id: "fieldB",
        attributes: {
          visibilityRules: {
            rules: [
              {
                sourceEntityId: "fieldA",
                operator: "equals",
                value: "Yes",
                action: "hide",
              },
            ],
            logic: "and",
          },
        },
      },
      entitiesValues: { fieldA: "Yes", fieldB: "" },
    });

    expect(result).toBe(false);
  });

  it("entity with only require rules returns true (require does not affect visibility)", async () => {
    const { makeShouldBeProcessed } = await getShouldBeProcessed();
    const hook = makeShouldBeProcessed();

    const result = hook({
      entity: {
        id: "fieldC",
        attributes: {
          visibilityRules: {
            rules: [
              {
                sourceEntityId: "fieldA",
                operator: "equals",
                value: "Yes",
                action: "require",
              },
            ],
            logic: "and",
          },
        },
      },
      entitiesValues: { fieldA: "Yes", fieldC: "" },
    });

    expect(result).toBe(true);
  });
});
