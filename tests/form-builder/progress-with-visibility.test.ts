/**
 * tests/form-builder/progress-with-visibility.test.ts
 *
 * Phase 15 Plan 15-04 — Task 2: computeFormProgress visibility-aware extension.
 *
 * Three test cases per Wave-0 spec:
 *   1. visibility=undefined → byte-identical to pre-Phase-15 behaviour (backward-compat)
 *   2. hidden entity excluded from denominator (visibility[id].visible === false)
 *   3. dynamic-required (rule-fired) with visible === true IS counted in denominator
 *
 * These tests are RED before the 3-arg overload is added to progress.ts.
 */

import { describe, it, expect } from "vitest";
import { computeFormProgress } from "@/lib/form-builder/progress";
import type { VisibilityState } from "@/lib/form-builder/visibility/types";

// ── Test data ─────────────────────────────────────────────────────────────────

const REQ_FIELD_ID = "a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5";
const OPT_FIELD_ID = "b2c3d4e5-f6a7-4b8c-9d0e-f1a2b3c4d5e6";
const DYN_FIELD_ID = "c3d4e5f6-a7b8-4c9d-0e1f-a2b3c4d5e6f7";

/** A schema with one static-required + one optional + one optional (for dynamic-required test) */
const baseSchema = {
  entities: {
    [REQ_FIELD_ID]: {
      type: "textField",
      attributes: { label: "Required name", required: true },
    },
    [OPT_FIELD_ID]: {
      type: "textField",
      attributes: { label: "Optional field", required: false },
    },
    [DYN_FIELD_ID]: {
      type: "textField",
      // Static: NOT required. Will be required dynamically via visibility.
      attributes: { label: "Dynamic field", required: false },
    },
  },
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("computeFormProgress — visibility-aware extension", () => {
  it("visibility=undefined matches pre-Phase-15 behaviour (backward-compat)", () => {
    // Without visibility — same as current behavior
    const noVisValues = { [REQ_FIELD_ID]: "Jane" };
    const withoutVisibility = computeFormProgress(baseSchema, noVisValues);

    // With visibility=undefined — must be byte-identical
    const withUndefinedVisibility = computeFormProgress(baseSchema, noVisValues, undefined);

    expect(withUndefinedVisibility).toBe(withoutVisibility);
    expect(withUndefinedVisibility).toBe(100); // 1/1 required fields filled

    // Also check empty values
    expect(computeFormProgress(baseSchema, {}, undefined)).toBe(
      computeFormProgress(baseSchema, {})
    );
    expect(computeFormProgress(baseSchema, {})).toBe(0);
  });

  it("hidden entity is excluded from denominator when visibility is provided (D-07)", () => {
    // REQ_FIELD_ID is static required but visibility marks it as hidden
    // → it should NOT count toward the denominator at all
    const visibility: Record<string, VisibilityState> = {
      [REQ_FIELD_ID]: { visible: false, required: false }, // D-07: hidden trumps required
      [OPT_FIELD_ID]: { visible: true, required: false },
      [DYN_FIELD_ID]: { visible: true, required: false },
    };

    // No fields filled, but the only required field is hidden → denominator is 0 → 100%
    const result = computeFormProgress(baseSchema, {}, visibility);
    expect(result).toBe(100); // no required visible fields → all "complete"

    // Verify: without visibility, the same scenario gives 0% (REQ_FIELD_ID is required but not filled)
    expect(computeFormProgress(baseSchema, {})).toBe(0);
  });

  it("dynamic-required (require rule fired) field is counted in denominator when visible (D-07 inverse)", () => {
    // DYN_FIELD_ID is statically NOT required, but visibility marks it required
    // (a `require` action fired) AND visible = true → it SHOULD count in denominator
    const visibility: Record<string, VisibilityState> = {
      [REQ_FIELD_ID]: { visible: true, required: true },   // static required, still visible
      [OPT_FIELD_ID]: { visible: true, required: false },  // optional, stays optional
      [DYN_FIELD_ID]: { visible: true, required: true },   // dynamically required via rule
    };

    // Neither REQ_FIELD_ID nor DYN_FIELD_ID filled → denominator = 2, filled = 0 → 0%
    const resultEmpty = computeFormProgress(baseSchema, {}, visibility);
    expect(resultEmpty).toBe(0);

    // REQ_FIELD_ID filled, DYN_FIELD_ID still empty → 1/2 → 50%
    const resultPartial = computeFormProgress(baseSchema, { [REQ_FIELD_ID]: "Jane" }, visibility);
    expect(resultPartial).toBe(50);

    // Both required fields filled → 2/2 → 100%
    const resultFull = computeFormProgress(
      baseSchema,
      { [REQ_FIELD_ID]: "Jane", [DYN_FIELD_ID]: "required reason" },
      visibility
    );
    expect(resultFull).toBe(100);
  });
});
