import { createEntity } from "@coltorapps/builder";
import { labelAttribute } from "../attributes/label";
import { requiredAttribute } from "../attributes/required";
import { minAttribute, maxAttribute } from "../attributes/number-bounds";
import { unitAttribute } from "../attributes/unit";
import { attachPhotosAttribute } from "../attributes/attach-photos";
import { visibilityRulesAttribute } from "../attributes/visibility-rules";
import { makeShouldBeProcessed } from "../visibility/should-be-processed";

export const numberFieldEntity = createEntity({
  name: "numberField",
  attributes: [
    labelAttribute,
    requiredAttribute,
    minAttribute,
    maxAttribute,
    unitAttribute,
    attachPhotosAttribute,
    visibilityRulesAttribute,
  ],
  validate(value, context) {
    const isRequired = context.entity.attributes.required ?? false;
    const label = context.entity.attributes.label ?? "This field";
    if (isRequired && (value === undefined || value === null || value === "")) {
      throw new Error(`${label} is required.`);
    }
    if (value !== undefined && value !== null && value !== "") {
      const n = Number(value);
      if (isNaN(n)) {
        throw new Error(`${label} must be a number.`);
      }
      const min = context.entity.attributes.min;
      const max = context.entity.attributes.max;
      if (min !== undefined && n < min) {
        throw new Error(`${label} must be at least ${min}.`);
      }
      if (max !== undefined && n > max) {
        throw new Error(`${label} must be at most ${max}.`);
      }
    }
    return value;
  },
  shouldBeProcessed: makeShouldBeProcessed(),
});
