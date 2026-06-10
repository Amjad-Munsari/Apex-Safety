/**
 * lib/form-builder/validate-root-required.test.ts
 *
 * BUG A — root-level DYNAMIC required enforcement (validateRootRequired).
 *
 * The submit pipeline enforces STATIC required (coltorapps validateEntitiesValues)
 * and per-INSTANCE required (validateInstanceRequired), but a TOP-LEVEL field made
 * required ONLY by a fired `action: "require"` rule slipped through both and could
 * be submitted empty. validateRootRequired closes that gap, run against the same
 * visibility map the submit paths already compute via evaluateVisibility.
 *
 * Proven here:
 *   1. root field required ONLY via a fired require rule + empty value → reported
 *   2. same field filled → NOT reported
 *   3. hidden (visible:false) required field → NOT reported (hide-wins, D-07)
 *   4. a STATIC-required field is not double-counted by this helper
 *      (it is reached for dynamic ones; a filled static field is ignored, and a
 *       static-required entity does not get re-reported when filled)
 *   5. file/photo field types are exempt even when required (BUG 3)
 *   6. repeatingSection entities + their children are skipped (covered elsewhere)
 */

import { describe, it, expect } from "vitest";
import {
  validateRootRequired,
  isEmpty,
} from "@/lib/form-builder/validate-instance-required";
import { evaluateVisibility } from "@/lib/form-builder/visibility/evaluate-visibility";

// Stable UUID-ish ids
const TRIGGER_ID = "11111111-1111-4111-8111-111111111111";
const DYN_ID = "22222222-2222-4222-8222-222222222222";
const STATIC_ID = "33333333-3333-4333-8333-333333333333";
const PHOTO_ID = "44444444-4444-4444-8444-444444444444";
const REP_ID = "55555555-5555-4555-8555-555555555555";
const REP_CHILD_ID = "66666666-6666-4666-8666-666666666666";

/**
 * Schema where DYN_ID becomes required ONLY when TRIGGER_ID === "yes".
 * DYN_ID has no static `required` attribute.
 */
function makeSchema() {
  return {
    entities: {
      [TRIGGER_ID]: {
        type: "textField",
        attributes: { label: "Trigger" },
      },
      [DYN_ID]: {
        type: "textField",
        attributes: {
          label: "Dynamically required",
          // Static: NOT required. Required only via the rule below.
          visibilityRules: {
            logic: "and",
            rules: [
              {
                sourceEntityId: TRIGGER_ID,
                operator: "equals",
                value: "yes",
                action: "require",
              },
            ],
          },
        },
      },
    },
  } as unknown as Parameters<typeof validateRootRequired>[0];
}

describe("isEmpty (shared semantics)", () => {
  it("treats undefined/null/blank-string/empty-array as empty", () => {
    expect(isEmpty(undefined)).toBe(true);
    expect(isEmpty(null)).toBe(true);
    expect(isEmpty("")).toBe(true);
    expect(isEmpty("   ")).toBe(true);
    expect(isEmpty([])).toBe(true);
  });
  it("treats filled values (incl. 0 and false) as non-empty", () => {
    expect(isEmpty("x")).toBe(false);
    expect(isEmpty(0)).toBe(false);
    expect(isEmpty(false)).toBe(false);
    expect(isEmpty(["a"])).toBe(false);
  });
});

describe("validateRootRequired — BUG A", () => {
  it("reports a root field required only via a FIRED require rule + empty value", () => {
    const schema = makeSchema();
    const values = { [TRIGGER_ID]: "yes" }; // DYN_ID empty
    const visibility = evaluateVisibility(schema, values);

    // sanity: the rule fired
    expect(visibility[DYN_ID].required).toBe(true);

    const failures = validateRootRequired(schema, values, visibility);
    expect(failures).toHaveLength(1);
    expect(failures[0]).toEqual({
      entityId: DYN_ID,
      label: "Dynamically required",
    });
  });

  it("does NOT report when the same field is filled", () => {
    const schema = makeSchema();
    const values = { [TRIGGER_ID]: "yes", [DYN_ID]: "answered" };
    const visibility = evaluateVisibility(schema, values);

    expect(validateRootRequired(schema, values, visibility)).toHaveLength(0);
  });

  it("does NOT report when the require rule has NOT fired (field stays optional)", () => {
    const schema = makeSchema();
    const values = { [TRIGGER_ID]: "no" }; // rule sourced on "yes" — does not fire
    const visibility = evaluateVisibility(schema, values);

    expect(visibility[DYN_ID].required).toBe(false);
    expect(validateRootRequired(schema, values, visibility)).toHaveLength(0);
  });

  it("does NOT report a hidden required field (hide-wins / D-07)", () => {
    // DYN_ID is hidden by a fired `hide` rule AND required by a fired `require` rule.
    // evaluateVisibility forces required=false when visible=false, so it must not report;
    // we also defensively guard on state.visible === false in the helper.
    const schema = {
      entities: {
        [TRIGGER_ID]: { type: "textField", attributes: { label: "Trigger" } },
        [DYN_ID]: {
          type: "textField",
          attributes: {
            label: "Hidden but required",
            visibilityRules: {
              logic: "and",
              rules: [
                {
                  sourceEntityId: TRIGGER_ID,
                  operator: "equals",
                  value: "yes",
                  action: "require",
                },
                {
                  sourceEntityId: TRIGGER_ID,
                  operator: "equals",
                  value: "yes",
                  action: "hide",
                },
              ],
            },
          },
        },
      },
    } as unknown as Parameters<typeof validateRootRequired>[0];

    const values = { [TRIGGER_ID]: "yes" }; // DYN_ID empty + hidden
    const visibility = evaluateVisibility(schema, values);

    expect(visibility[DYN_ID].visible).toBe(false);
    expect(visibility[DYN_ID].required).toBe(false); // hide-wins
    expect(validateRootRequired(schema, values, visibility)).toHaveLength(0);
  });

  it("does NOT double-count a STATIC-required field (already caught by validateEntitiesValues)", () => {
    // A statically-required field reaches validateRootRequired only AFTER passing
    // validateEntitiesValues — i.e. it is necessarily filled. A filled static field
    // must not be reported.
    const schema = {
      entities: {
        [STATIC_ID]: {
          type: "textField",
          attributes: { label: "Static required", required: true },
        },
      },
    } as unknown as Parameters<typeof validateRootRequired>[0];

    const values = { [STATIC_ID]: "filled" };
    const visibility = evaluateVisibility(schema, values);

    expect(visibility[STATIC_ID].required).toBe(true);
    expect(validateRootRequired(schema, values, visibility)).toHaveLength(0);
  });

  it("exempts file/photo field types even when required (BUG 3)", () => {
    const schema = {
      entities: {
        [PHOTO_ID]: {
          type: "multiPhotoField",
          attributes: { label: "Photos", required: true },
        },
      },
    } as unknown as Parameters<typeof validateRootRequired>[0];

    const values = {}; // empty
    const visibility = evaluateVisibility(schema, values);

    // required by static attr, but file type is exempt → not reported
    expect(validateRootRequired(schema, values, visibility)).toHaveLength(0);
  });

  it("skips repeatingSection entities and their children", () => {
    const schema = {
      entities: {
        [REP_ID]: {
          type: "repeatingSection",
          attributes: { title: "Doors", minInstances: 1 },
          children: [REP_CHILD_ID],
        },
        [REP_CHILD_ID]: {
          type: "textField",
          attributes: { label: "Door ref", required: true },
        },
      },
    } as unknown as Parameters<typeof validateRootRequired>[0];

    const values = { [REP_ID]: { instances: [{}] } };
    const visibility = evaluateVisibility(schema, values);

    // The rep section + its child are covered by validateInstanceRequired, not here.
    expect(validateRootRequired(schema, values, visibility)).toHaveLength(0);
  });
});
