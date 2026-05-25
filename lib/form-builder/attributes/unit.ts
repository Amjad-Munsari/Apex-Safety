import { createAttribute } from "@coltorapps/builder";

export const unitAttribute = createAttribute({
  name: "unit",
  validate(value) {
    if (value === undefined || value === null) {
      return "";
    }
    return String(value);
  },
});
