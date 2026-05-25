import { createAttribute } from "@coltorapps/builder";

// D-03: minInstances integer attribute for repeatingSection.
// Controls the minimum number of instances required before the form submits.
// Default 0 = no minimum enforcement.
// ALWAYS coerce undefined → 0 (Phase 13 RESEARCH Pitfall 4).
export const minInstancesAttribute = createAttribute({
  name: "minInstances",
  validate(value) {
    if (value === undefined || value === null) {
      return 0;
    }
    const n = Number(value);
    if (!Number.isInteger(n) || n < 0) {
      throw new Error("minInstances must be a non-negative integer.");
    }
    return n;
  },
});
