import { createEntity } from "@coltorapps/builder";
import { labelAttribute } from "../attributes/label";
import { requiredAttribute } from "../attributes/required";
import { minDateAttribute, maxDateAttribute } from "../attributes/date-bounds";
import { prefillSourceAttribute } from "../attributes/prefill-source";
import { attachPhotosAttribute } from "../attributes/attach-photos";
import { visibilityRulesAttribute } from "../attributes/visibility-rules";
import { makeShouldBeProcessed } from "../visibility/should-be-processed";

export const dateFieldEntity = createEntity({
  name: "dateField",
  attributes: [
    labelAttribute,
    requiredAttribute,
    minDateAttribute,
    maxDateAttribute,
    prefillSourceAttribute,
    attachPhotosAttribute,
    visibilityRulesAttribute,
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
      // Bounds are stored and compared as YYYY-MM-DD strings, which sort
      // lexicographically the same as chronologically — no timezone drift
      // (audit #8).
      const minDate = context.entity.attributes.minDate;
      const maxDate = context.entity.attributes.maxDate;
      const iso = String(value);
      if (typeof minDate === "string" && minDate && iso < minDate) {
        throw new Error(`${label} must be on or after ${minDate}.`);
      }
      if (typeof maxDate === "string" && maxDate && iso > maxDate) {
        throw new Error(`${label} must be on or before ${maxDate}.`);
      }
    }
    return value;
  },
  shouldBeProcessed: makeShouldBeProcessed(),
});
