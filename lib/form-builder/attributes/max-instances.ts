import { createAttribute } from "@coltorapps/builder";

export const maxInstancesAttribute = createAttribute({
  name: "maxInstances",
  validate(value) {
    if (value === undefined || value === null) {
      return undefined; // Default: no maximum (unlimited)
    }
    const n = Number(value);
    if (!Number.isInteger(n) || n < 1) {
      throw new Error("Max instances must be a positive integer.");
    }
    return n;
  },
});
