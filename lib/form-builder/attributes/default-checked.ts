import { createAttribute } from "@coltorapps/builder";

export const defaultCheckedAttribute = createAttribute({
  name: "defaultChecked",
  validate(value) {
    if (value === undefined || value === null) {
      return false;
    }
    return Boolean(value);
  },
});
