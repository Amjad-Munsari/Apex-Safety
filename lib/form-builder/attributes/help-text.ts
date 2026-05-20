import { createAttribute } from "@coltorapps/builder";

export const helpTextAttribute = createAttribute({
  name: "helpText",
  validate(value) {
    if (value === undefined || value === null) {
      return "";
    }
    return String(value);
  },
});
