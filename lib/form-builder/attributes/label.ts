import { createAttribute } from "@coltorapps/builder";

export const labelAttribute = createAttribute({
  name: "label",
  validate(value) {
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new Error("Label is required.");
    }
    return value.trim();
  },
});
