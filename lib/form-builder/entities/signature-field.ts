/**
 * signatureFieldEntity
 *
 * Value: string (storage path returned by uploadMediaAction after canvas.toDataURL("image/png"))
 * Storage path contract: form-media/{client_id}/signatures/{submission_id}/{field_id}.png (D-16)
 *
 * Security note (T-14-02-05): validate() enforces that any supplied value is a non-null string.
 * The storage path is generated server-side by uploadMediaAction; clients submit the path string
 * after a successful upload. Non-string values are rejected here.
 */
import { createEntity } from "@coltorapps/builder";
import { labelAttribute } from "../attributes/label";
import { requiredAttribute } from "../attributes/required";
import { helpTextAttribute } from "../attributes/help-text";
import { attachPhotosAttribute } from "../attributes/attach-photos";
import { visibilityRulesAttribute } from "../attributes/visibility-rules";
import { makeShouldBeProcessed } from "../visibility/should-be-processed";

export const signatureFieldEntity = createEntity({
  name: "signatureField",
  attributes: [
    labelAttribute,
    requiredAttribute,
    helpTextAttribute,
    attachPhotosAttribute,
    visibilityRulesAttribute,
  ],
  validate(value, context) {
    const isRequired = context.entity.attributes.required ?? false;
    const label = context.entity.attributes.label ?? "Signature";

    if (isRequired && (!value || (typeof value === "string" && value.trim().length === 0))) {
      throw new Error(`${label} is required.`);
    }
    if (value !== undefined && value !== null && typeof value !== "string") {
      throw new Error(`${label} must be a storage path string.`);
    }
    return value;
  },
  shouldBeProcessed: makeShouldBeProcessed(),
});
