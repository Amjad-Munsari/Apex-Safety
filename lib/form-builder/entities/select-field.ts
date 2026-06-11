import { createEntity } from "@coltorapps/builder";
import { labelAttribute } from "../attributes/label";
import { requiredAttribute } from "../attributes/required";
import { optionsAttribute } from "../attributes/options";
import { attachPhotosAttribute } from "../attributes/attach-photos";
import { visibilityRulesAttribute } from "../attributes/visibility-rules";
import { makeShouldBeProcessed } from "../visibility/should-be-processed";

export const selectFieldEntity = createEntity({
  name: "selectField",
  attributes: [
    labelAttribute,
    requiredAttribute,
    optionsAttribute,
    attachPhotosAttribute,
    visibilityRulesAttribute,
  ],
  // Single-select only — the `allowMultiple` mode was removed (audit #5).
  validate(value, context) {
    const isRequired = context.entity.attributes.required ?? false;
    const label = context.entity.attributes.label ?? "This field";
    const options = context.entity.attributes.options ?? [];

    // Treat an empty array the same as empty/undefined so a stray `[]` can't
    // satisfy a required select (audit #4).
    const isEmpty =
      value === undefined ||
      value === null ||
      value === "" ||
      (Array.isArray(value) && value.length === 0);

    if (isRequired && isEmpty) {
      throw new Error(`${label} is required.`);
    }
    if (!isEmpty) {
      const validValues = options.map((o: { value: string; label: string }) => o.value);
      if (!validValues.includes(value as string)) {
        throw new Error(`"${value}" is not a valid option for ${label}.`);
      }
    }
    return value;
  },
  shouldBeProcessed: makeShouldBeProcessed(),
});
