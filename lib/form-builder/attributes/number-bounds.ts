import { createAttribute } from "@coltorapps/builder";

export const minAttribute = createAttribute({
  name: "min",
  validate(value) {
    if (value === undefined || value === null) {
      return undefined;
    }
    const n = Number(value);
    if (typeof value === "string" && isNaN(n)) {
      throw new Error("Min must be a number.");
    }
    if (typeof value !== "number" && isNaN(n)) {
      throw new Error("Min must be a number.");
    }
    return n;
  },
});

export const maxAttribute = createAttribute({
  name: "max",
  validate(value) {
    if (value === undefined || value === null) {
      return undefined;
    }
    const n = Number(value);
    if (typeof value === "string" && isNaN(n)) {
      throw new Error("Max must be a number.");
    }
    if (typeof value !== "number" && isNaN(n)) {
      throw new Error("Max must be a number.");
    }
    return n;
  },
});
