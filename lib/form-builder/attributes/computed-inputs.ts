import { createAttribute } from "@coltorapps/builder";

// D-09: computedInputs object attribute for computedField.
// Admin maps which entity IDs feed the formula inputs via builder properties.
// Shape: { likelihood: entityId | "", consequence: entityId | "" }
// Unknown keys pass through unchanged (forward-compat for future formulas).
// ALWAYS coerce undefined → default empty shape (Phase 13 RESEARCH Pitfall 4).
export interface ComputedInputs {
  likelihood: string;
  consequence: string;
  [key: string]: string; // forward-compat: future formula inputs
}

export const computedInputsAttribute = createAttribute({
  name: "computedInputs",
  validate(value) {
    if (value === undefined || value === null) {
      return { likelihood: "", consequence: "" } as ComputedInputs;
    }
    if (typeof value !== "object" || Array.isArray(value)) {
      throw new Error(
        'computedInputs must be an object with "likelihood" and "consequence" keys.'
      );
    }
    const raw = value as Record<string, unknown>;
    return {
      ...raw,
      likelihood: typeof raw.likelihood === "string" ? raw.likelihood : "",
      consequence: typeof raw.consequence === "string" ? raw.consequence : "",
    } as ComputedInputs;
  },
});
