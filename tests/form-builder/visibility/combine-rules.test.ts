// Phase 15 Plan 15-02 Task 1 — real assertions for combineShowHide
import { describe, it, expect } from "vitest";

// Dynamic import convention (tests/form-builder/attributes.test.ts pattern)
const getModule = async () =>
  await import("@/lib/form-builder/visibility/combine-rules");

describe("combineShowHide — AND/OR truth table", () => {
  it("AND logic: all show rules fire → entity is visible", async () => {
    const { combineShowHide } = await getModule();
    expect(
      combineShowHide(
        [
          { fired: true, action: "show" },
          { fired: true, action: "show" },
        ],
        "and"
      )
    ).toBe(true);
  });

  it("AND logic: one show rule does not fire → entity is not shown", async () => {
    const { combineShowHide } = await getModule();
    expect(
      combineShowHide(
        [
          { fired: true, action: "show" },
          { fired: false, action: "show" },
        ],
        "and"
      )
    ).toBe(false);
  });

  it("OR logic: at least one show rule fires → entity is visible", async () => {
    const { combineShowHide } = await getModule();
    expect(
      combineShowHide(
        [
          { fired: false, action: "show" },
          { fired: true, action: "show" },
        ],
        "or"
      )
    ).toBe(true);
  });

  it("OR logic: no show rules fire → entity is not visible", async () => {
    const { combineShowHide } = await getModule();
    expect(
      combineShowHide(
        [
          { fired: false, action: "show" },
          { fired: false, action: "show" },
        ],
        "or"
      )
    ).toBe(false);
  });
});

describe("combineShowHide — hide-wins-over-show (D-07)", () => {
  it("when both show and hide rules fire for the same entity, hide wins", async () => {
    const { combineShowHide } = await getModule();
    // The acceptance criteria case from the plan
    expect(
      combineShowHide(
        [
          { fired: true, action: "hide" },
          { fired: true, action: "show" },
        ],
        "or"
      )
    ).toBe(false);
    // Also for AND logic
    expect(
      combineShowHide(
        [
          { fired: true, action: "hide" },
          { fired: true, action: "show" },
        ],
        "and"
      )
    ).toBe(false);
  });

  it("when only a hide rule fires (no show rules), entity is hidden", async () => {
    const { combineShowHide } = await getModule();
    expect(combineShowHide([{ fired: true, action: "hide" }], "and")).toBe(false);
  });

  it("when a hide rule does NOT fire, entity falls through to show-rule logic", async () => {
    const { combineShowHide } = await getModule();
    expect(
      combineShowHide(
        [
          { fired: false, action: "hide" },
          { fired: true, action: "show" },
        ],
        "or"
      )
    ).toBe(true);
  });

  it("no rules present → entity is visible (empty rule list)", async () => {
    const { combineShowHide } = await getModule();
    expect(combineShowHide([], "and")).toBe(true);
    expect(combineShowHide([], "or")).toBe(true);
  });

  it("only require-action rules (empty show/hide list) → entity is visible (D-07)", async () => {
    const { combineShowHide } = await getModule();
    // D-07: a rule list of all `require` actions does not affect visibility
    // (evaluateVisibility filters to show/hide before calling combineShowHide)
    // Empty input confirms no-show-no-hide → visible
    expect(combineShowHide([], "and")).toBe(true);
  });
});
