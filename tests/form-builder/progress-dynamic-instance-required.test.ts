/**
 * lib/form-builder/progress-dynamic-instance-required.test.ts
 *
 * BUG B — isRepeatingSectionFilled quality gate must fold STATIC + DYNAMIC
 * required for repeatingSection CHILDREN, the same way validateInstanceRequired
 * does (per-instance evaluateVisibilityForInstance, state.required && state.visible).
 *
 * Before the fix the gate keyed solely on `attributes.required === true`, so a
 * child required ONLY by a fired `action: "require"` rule was ignored — progress
 * reported 100% while validateInstanceRequired still blocked submit. These tests
 * prove progress now reaches 100% exactly when validateInstanceRequired passes.
 */

import { describe, it, expect } from "vitest";
import { computeFormProgress } from "@/lib/form-builder/progress";
import { validateInstanceRequired } from "@/lib/form-builder/validate-instance-required";

const REP_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TRIGGER_CHILD = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const DYN_CHILD = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

/**
 * A repeatingSection (minInstances 1) with two children:
 *  - TRIGGER_CHILD: plain text, optional
 *  - DYN_CHILD: required ONLY when TRIGGER_CHILD === "yes" (no static required)
 */
function makeSchema() {
  return {
    entities: {
      [REP_ID]: {
        type: "repeatingSection",
        attributes: { title: "Doors", minInstances: 1 },
        children: [TRIGGER_CHILD, DYN_CHILD],
      },
      [TRIGGER_CHILD]: {
        type: "textField",
        attributes: { label: "Trigger" },
      },
      [DYN_CHILD]: {
        type: "textField",
        attributes: {
          label: "Dynamically required child",
          visibilityRules: {
            logic: "and",
            rules: [
              {
                sourceEntityId: TRIGGER_CHILD,
                operator: "equals",
                value: "yes",
                action: "require",
              },
            ],
          },
        },
      },
    },
  };
}

describe("computeFormProgress — dynamic per-instance required (BUG B)", () => {
  it("is BELOW 100% when a dynamic-required child is empty (matches validateInstanceRequired blocking)", () => {
    const schema = makeSchema();
    // Rule fires (trigger=yes) but DYN_CHILD empty → submit blocked
    const values = {
      [REP_ID]: { instances: [{ [TRIGGER_CHILD]: "yes" }] },
    };

    // validateInstanceRequired must block
    const failures = validateInstanceRequired(
      schema as unknown as Parameters<typeof validateInstanceRequired>[0],
      values
    );
    expect(failures.length).toBeGreaterThan(0);

    // progress must therefore NOT be 100 (was 100 before the fix)
    expect(computeFormProgress(schema, values)).toBeLessThan(100);
  });

  it("reaches 100% once the dynamic-required child is filled (matches validateInstanceRequired passing)", () => {
    const schema = makeSchema();
    const values = {
      [REP_ID]: { instances: [{ [TRIGGER_CHILD]: "yes", [DYN_CHILD]: "answered" }] },
    };

    expect(
      validateInstanceRequired(
        schema as unknown as Parameters<typeof validateInstanceRequired>[0],
        values
      )
    ).toHaveLength(0);
    expect(computeFormProgress(schema, values)).toBe(100);
  });

  it("is 100% when the require rule has NOT fired (child stays optional)", () => {
    const schema = makeSchema();
    // trigger != yes → DYN_CHILD optional and empty is fine
    const values = {
      [REP_ID]: { instances: [{ [TRIGGER_CHILD]: "no" }] },
    };

    expect(
      validateInstanceRequired(
        schema as unknown as Parameters<typeof validateInstanceRequired>[0],
        values
      )
    ).toHaveLength(0);
    expect(computeFormProgress(schema, values)).toBe(100);
  });
});
