import { createAttribute } from "@coltorapps/builder";

export const sectionDescriptionAttribute = createAttribute({
  name: "description",
  validate(value) {
    if (value === undefined || value === null) {
      return "";
    }
    return String(value);
  },
});
