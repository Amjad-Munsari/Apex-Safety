import { createAttribute } from "@coltorapps/builder";

export const minDateAttribute = createAttribute({
  name: "minDate",
  validate(value) {
    if (value === undefined || value === null) {
      return undefined;
    }
    return String(value);
  },
});

export const maxDateAttribute = createAttribute({
  name: "maxDate",
  validate(value) {
    if (value === undefined || value === null) {
      return undefined;
    }
    return String(value);
  },
});
