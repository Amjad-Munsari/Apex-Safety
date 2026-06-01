import { describe, it, expect } from "vitest";
import { validateSchema } from "@coltorapps/builder";

// Regression for the "Fire Risk Assessment (Type 3)" builder crash
// (template 00000000-0000-4000-a000-000000000018, migration 016).
//
// numberField and computedField were missing the shared `helpText` attribute that
// every other field entity carries. The FRA seed sets helpText on the PAS 79
// Likelihood/Consequence numberFields and the Risk-score computedField, so coltorapps
// validateSchema rejected the schema with UnknownEntityAttributeType — which made
// useBuilderStore() throw on hydrate and tripped the "Template editor unavailable"
// error boundary (app/admin/templates/[id]/error.tsx). The interpreter ignores
// unknown attributes, which is why fill kept working while the builder crashed.
const NUMBER = "22222222-2222-4222-8222-222222222222";
const COMPUTED = "33333333-3333-4333-8333-333333333333";

describe("numberField / computedField accept a helpText attribute (FRA seed regression)", () => {
  it("validates a numberField that carries helpText", async () => {
    const { formBuilder } = await import("@/lib/form-builder/index");
    const result = await validateSchema(
      {
        entities: {
          [NUMBER]: {
            type: "numberField",
            attributes: {
              label: "Likelihood (1–5)",
              required: true,
              min: 1,
              max: 5,
              unit: "",
              helpText: "1 = Very Low, 2 = Low, 3 = Medium, 4 = High, 5 = Very High",
            },
          },
        },
        root: [NUMBER],
      },
      formBuilder
    );
    expect(result.success, JSON.stringify((result as { reason?: unknown }).reason)).toBe(true);
  });

  it("validates a computedField that carries helpText", async () => {
    const { formBuilder } = await import("@/lib/form-builder/index");
    const result = await validateSchema(
      {
        entities: {
          [COMPUTED]: {
            type: "computedField",
            attributes: {
              label: "Risk score (PAS 79)",
              formula: "pas79",
              computedInputs: {},
              helpText: "Auto-calculated from Likelihood × Consequence above.",
            },
          },
        },
        root: [COMPUTED],
      },
      formBuilder
    );
    expect(result.success, JSON.stringify((result as { reason?: unknown }).reason)).toBe(true);
  });
});
