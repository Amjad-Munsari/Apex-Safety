import { createAttribute } from "@coltorapps/builder";

export interface SelectOption {
  value: string;
  label: string;
}

export const optionsAttribute = createAttribute({
  name: "options",
  validate(value) {
    if (value === undefined || value === null) {
      return [] as SelectOption[];
    }
    if (!Array.isArray(value)) {
      throw new Error("Options must be an array.");
    }
    return value as SelectOption[];
  },
});
