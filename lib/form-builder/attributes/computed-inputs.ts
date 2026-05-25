import { createAttribute } from "@coltorapps/builder";

/** Maps formula input names to entity IDs in the same form. */
export type ComputedInputsValue = Record<string, string>;

export const computedInputsAttribute = createAttribute({
  name: "computedInputs",
  validate(value) {
    if (value === undefined || value === null) {
      return {} as ComputedInputsValue;
    }
    if (typeof value !== "object" || Array.isArray(value)) {
      throw new Error("Computed inputs must be an object mapping input names to entity IDs.");
    }
    // Each value must be a string (entity ID)
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (typeof val !== "string") {
        throw new Error(`Computed input "${key}" must be a string entity ID.`);
      }
    }
    return value as ComputedInputsValue;
  },
});
