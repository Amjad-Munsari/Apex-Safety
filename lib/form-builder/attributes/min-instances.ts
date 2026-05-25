import { createAttribute } from "@coltorapps/builder";

export const minInstancesAttribute = createAttribute({
  name: "minInstances",
  validate(value) {
    if (value === undefined || value === null) {
      return 0; // Default: no minimum — repeatingSection is optional
    }
    const n = Number(value);
    if (!Number.isInteger(n) || n < 0) {
      throw new Error("Min instances must be a non-negative integer.");
    }
    return n;
  },
});
