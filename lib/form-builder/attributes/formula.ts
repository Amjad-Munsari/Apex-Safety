import { createAttribute } from "@coltorapps/builder";

const VALID_FORMULAS = ["", "pas79"] as const;
type Formula = (typeof VALID_FORMULAS)[number];

export const formulaAttribute = createAttribute({
  name: "formula",
  validate(value) {
    if (value === undefined || value === null) {
      return "" as Formula;
    }
    if (!VALID_FORMULAS.includes(value as Formula)) {
      throw new Error(
        `Invalid formula "${value}". Must be one of: ${VALID_FORMULAS.map((f) => `"${f}"`).join(", ")}.`
      );
    }
    return value as Formula;
  },
});
