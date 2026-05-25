import { createEntity } from "@coltorapps/builder";
import { labelAttribute } from "../attributes/label";
import { requiredAttribute } from "../attributes/required";
import { defaultCheckedAttribute } from "../attributes/default-checked";
import { attachPhotosAttribute } from "../attributes/attach-photos";

export const checkboxFieldEntity = createEntity({
  name: "checkboxField",
  attributes: [
    labelAttribute,
    requiredAttribute,
    defaultCheckedAttribute,
    attachPhotosAttribute,
  ],
  validate(value, context) {
    const isRequired = context.entity.attributes.required ?? false;
    const label = context.entity.attributes.label ?? "This field";
    if (isRequired && !value) {
      throw new Error(`${label} must be checked.`);
    }
    if (value !== undefined && value !== null && typeof value !== "boolean") {
      throw new Error(`${label} must be a boolean.`);
    }
    return value;
  },
});
