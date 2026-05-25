import { createAttribute } from "@coltorapps/builder";

// D-03: maxInstances integer attribute for repeatingSection.
// Controls the maximum number of instances allowed. Undefined = unlimited.
// Must be a positive integer when set (0 is meaningless for a max).
// ALWAYS coerce undefined → undefined (Phase 13 RESEARCH Pitfall 4).
export const maxInstancesAttribute = createAttribute({
  name: "maxInstances",
  validate(value) {
    if (value === undefined || value === null) {
      return undefined;
    }
    const n = Number(value);
    if (!Number.isInteger(n) || n < 1) {
      throw new Error("maxInstances must be a positive integer when set.");
    }
    return n;
  },
});
