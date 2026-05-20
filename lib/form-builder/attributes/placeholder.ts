import { createAttribute } from "@coltorapps/builder";

export const placeholderAttribute = createAttribute({
  name: "placeholder",
  validate(value) {
    if (value === undefined || value === null) {
      return "";
    }
    return String(value);
  },
});
