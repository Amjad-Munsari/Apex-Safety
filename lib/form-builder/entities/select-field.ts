import { createEntity } from "@coltorapps/builder";
import { labelAttribute } from "../attributes/label";
import { requiredAttribute } from "../attributes/required";
import { optionsAttribute } from "../attributes/options";
import { allowMultipleAttribute } from "../attributes/allow-multiple";

export const selectFieldEntity = createEntity({
  name: "selectField",
  attributes: [
    labelAttribute,
    requiredAttribute,
    optionsAttribute,
    allowMultipleAttribute,
  ],
  validate(value, context) {
    const isRequired = context.entity.attributes.required ?? false;
    const label = context.entity.attributes.label ?? "This field";
    const allowMultiple = context.entity.attributes.allowMultiple ?? false;
    const options = context.entity.attributes.options ?? [];

    if (isRequired && (value === undefined || value === null || value === "")) {
      throw new Error(`${label} is required.`);
    }
    if (value !== undefined && value !== null && value !== "") {
      const validValues = options.map((o: { value: string; label: string }) => o.value);
      if (allowMultiple) {
        if (!Array.isArray(value)) {
          throw new Error(`${label} must be an array of selected values.`);
        }
        for (const v of value as string[]) {
          if (!validValues.includes(v)) {
            throw new Error(`"${v}" is not a valid option for ${label}.`);
          }
        }
      } else {
        if (!validValues.includes(value as string)) {
          throw new Error(`"${value}" is not a valid option for ${label}.`);
        }
      }
    }
    return value;
  },
});
