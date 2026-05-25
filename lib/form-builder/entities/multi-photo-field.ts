/**
 * multiPhotoFieldEntity
 *
 * Value: string[] — array of storage paths (form-media/{client_id}/photos/{submission_id}/{field_id}/{uuid}.{ext}).
 * Storage path contract per D-17. HEIC → JPEG conversion + 1.2-1.5MB compression handled in the renderer.
 *
 * validate() enforces:
 *   - required gate: if required and value is empty array or undefined, throw
 *   - type check: value must be an array
 *   - length check: value.length <= attrs.maxPhotos
 *   - element check: every element must be a non-empty string (storage path)
 */
import { createEntity } from "@coltorapps/builder";
import { labelAttribute } from "../attributes/label";
import { requiredAttribute } from "../attributes/required";
import { helpTextAttribute } from "../attributes/help-text";
import { maxPhotosAttribute } from "../attributes/max-photos";
import { attachPhotosAttribute } from "../attributes/attach-photos";
import { visibilityRulesAttribute } from "../attributes/visibility-rules";
import { makeShouldBeProcessed } from "../visibility/should-be-processed";

export const multiPhotoFieldEntity = createEntity({
  name: "multiPhotoField",
  attributes: [
    labelAttribute,
    requiredAttribute,
    helpTextAttribute,
    maxPhotosAttribute,
    attachPhotosAttribute,
    visibilityRulesAttribute,
  ],
  validate(value, context) {
    const isRequired = context.entity.attributes.required ?? false;
    const label = context.entity.attributes.label ?? "Photos";
    const maxPhotos = (context.entity.attributes.maxPhotos as number) ?? 5;

    if (isRequired && (!Array.isArray(value) || (value as unknown[]).length === 0)) {
      throw new Error(`${label} is required.`);
    }
    if (value !== undefined && value !== null) {
      if (!Array.isArray(value)) {
        throw new Error(`${label} must be an array of photo paths.`);
      }
      const arr = value as string[];
      if (arr.length > maxPhotos) {
        throw new Error(`${label} allows at most ${maxPhotos} photos.`);
      }
      for (const element of arr) {
        if (typeof element !== "string" || element.trim().length === 0) {
          throw new Error(`${label}: each photo must be a non-empty storage path string.`);
        }
      }
    }
    return value;
  },
  shouldBeProcessed: makeShouldBeProcessed(),
});
