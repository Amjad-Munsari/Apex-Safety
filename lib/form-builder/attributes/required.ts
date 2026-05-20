import { createAttribute } from "@coltorapps/builder";

export const requiredAttribute = createAttribute({
  name: "required",
  validate(value) {
    if (value === undefined || value === null) {
      return false;
    }
    return Boolean(value);
  },
});
