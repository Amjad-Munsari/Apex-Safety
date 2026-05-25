import { createAttribute } from "@coltorapps/builder";

// D-08: formula string enum attribute for computedField.
// Currently only "pas79" is supported; the enum is intentionally extensible
// for future formulas (DSEAR, COSHH, etc.) without a breaking schema migration.
// ALWAYS coerce undefined → "pas79" (Phase 13 RESEARCH Pitfall 4).
const VALID_FORMULAS = ["pas79"] as const;
type Formula = (typeof VALID_FORMULAS)[number];

export const formulaAttribute = createAttribute({
  name: "formula",
  validate(value) {
    if (value === undefined || value === null) {
      return "pas79" as Formula;
    }
    if (!VALID_FORMULAS.includes(value as Formula)) {
      throw new Error(
        `Invalid formula "${value}". Must be one of: ${VALID_FORMULAS.map((f) => `"${f}"`).join(", ")}.`
      );
    }
    return value as Formula;
  },
});
