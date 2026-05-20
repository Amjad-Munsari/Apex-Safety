import { createAttribute } from "@coltorapps/builder";

export const maxLengthAttribute = createAttribute({
  name: "maxLength",
  validate(value) {
    if (value === undefined || value === null) {
      return undefined;
    }
    const n = Number(value);
    if (isNaN(n) || n <= 0) {
      throw new Error("Max length must be a positive number.");
    }
    return n;
  },
});
