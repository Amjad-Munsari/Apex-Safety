import { createEntity } from "@coltorapps/builder";
import { labelAttribute } from "../attributes/label";
import { requiredAttribute } from "../attributes/required";
import { placeholderAttribute } from "../attributes/placeholder";
import { maxLengthAttribute } from "../attributes/max-length";
import { helpTextAttribute } from "../attributes/help-text";
import { prefillSourceAttribute } from "../attributes/prefill-source";
import { attachPhotosAttribute } from "../attributes/attach-photos";
import { visibilityRulesAttribute } from "../attributes/visibility-rules";
import { makeShouldBeProcessed } from "../visibility/should-be-processed";

export const textFieldEntity = createEntity({
  name: "textField",
  attributes: [
    labelAttribute,
    requiredAttribute,
    placeholderAttribute,
    maxLengthAttribute,
    helpTextAttribute,
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
    if (value !== undefined && value !== null && typeof value !== "string") {
      throw new Error(`${label} must be text.`);
    }
    return value;
  },
  shouldBeProcessed: makeShouldBeProcessed(),
});
