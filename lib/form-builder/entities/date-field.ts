import { createEntity } from "@coltorapps/builder";
import { labelAttribute } from "../attributes/label";
import { requiredAttribute } from "../attributes/required";
import { minDateAttribute, maxDateAttribute } from "../attributes/date-bounds";
import { prefillSourceAttribute } from "../attributes/prefill-source";

export const dateFieldEntity = createEntity({
  name: "dateField",
  attributes: [
    labelAttribute,
    requiredAttribute,
    minDateAttribute,
    maxDateAttribute,
    prefillSourceAttribute,
  ],
  validate(value, context) {
    const isRequired = context.entity.attributes.required ?? false;
    const label = context.entity.attributes.label ?? "This field";
    if (isRequired && !value) {
      throw new Error(`${label} is required.`);
    }
    if (value !== undefined && value !== null && value !== "") {
      const date = new Date(value as string);
      if (isNaN(date.getTime())) {
        throw new Error(`${label} must be a valid date.`);
      }
    }
    return value;
  },
});
