import { createAttribute } from "@coltorapps/builder";

export const allowMultipleAttribute = createAttribute({
  name: "allowMultiple",
  validate(value) {
    if (value === undefined || value === null) {
      return false;
    }
    return Boolean(value);
  },
});
