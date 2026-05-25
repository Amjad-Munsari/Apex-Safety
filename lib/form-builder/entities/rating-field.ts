/**
 * ratingFieldEntity
 *
 * Value: integer in [1, maxRating] (defaults: maxRating = 5).
 * Validate() coerces to Number, then checks integer + in-range constraints.
 */
import { createEntity } from "@coltorapps/builder";
import { labelAttribute } from "../attributes/label";
import { requiredAttribute } from "../attributes/required";
import { helpTextAttribute } from "../attributes/help-text";
import { maxRatingAttribute } from "../attributes/max-rating";
import { attachPhotosAttribute } from "../attributes/attach-photos";

export const ratingFieldEntity = createEntity({
  name: "ratingField",
  attributes: [
    labelAttribute,
    requiredAttribute,
    helpTextAttribute,
    maxRatingAttribute,
    attachPhotosAttribute,
  ],
  validate(value, context) {
    const isRequired = context.entity.attributes.required ?? false;
    const label = context.entity.attributes.label ?? "Rating";
    const max = (context.entity.attributes.maxRating as number) ?? 5;

    if (isRequired && (value === undefined || value === null)) {
      throw new Error(`${label} is required.`);
    }
    if (value !== undefined && value !== null) {
      const n = Number(value);
      if (!Number.isInteger(n) || n < 1 || n > max) {
        throw new Error(`${label} must be a whole number between 1 and ${max}.`);
      }
      return n;
    }
    return value;
  },
});
