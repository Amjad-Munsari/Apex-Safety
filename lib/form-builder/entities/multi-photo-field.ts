/**
 * multiPhotoFieldEntity
 *
 * Value: string[] — array of storage paths (form-media/{client_id}/photos/{submission_id}/{field_id}/{uuid}.{ext}).
 * Storage path contract per D-17. HEIC → JPEG conversion + 1.2-1.5MB compression handled in the renderer.
 *
 * validate() enforces:
 *   - type check: value must be an array
 *   - length check: value.length <= attrs.maxPhotos
 *   - element check: every element must be a non-empty string (storage path)
 *
 * NOTE (BUG 3, 2026-06-07): the `required` attribute is intentionally NOT
 * enforced here. Photo/file-upload fields are treated as *recommended* — an
 * empty required photo field must never block submission (it only surfaces a
 * non-blocking "recommended but not required" hint in the renderer). The
 * `required` attribute is preserved on the schema (so the form builder + hint
 * still read it) but is downgraded to recommended at every required-gate call
 * site via lib/form-builder/file-field-types.ts. All other validation
 * (type/length/element) stays intact.
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
    const label = context.entity.attributes.label ?? "Photos";
    const maxPhotos = (context.entity.attributes.maxPhotos as number) ?? 5;

    // BUG 3: no required gate here — photo fields are recommended, not required.
    // An empty value (undefined / null / []) is always valid for submission.
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
