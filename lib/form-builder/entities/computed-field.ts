/**
 * computedFieldEntity
 *
 * Value: derived (renderer-owned, server passthrough) — D-10.
 * The renderer computes the value from dependency fields (e.g., PAS 79 formula) and
 * calls setValue() with the result. The server stores it as part of answers_json for
 * AI prompt context. Even if a client tampers with the value, it is treated as advisory
 * text only — Matt reviews every draft before finalising (T-14-02-04).
 *
 * Crucially: NO requiredAttribute — this field is read-only and always implicitly filled
 * once its inputs are available. Adding required would cause computeFormProgress to treat
 * it as a blocker, which is incorrect per UI-SPEC §computedField-specific.
 *
 * Attributes:
 *   - label: display name
 *   - formula: string enum ("pas79" | ...) for forward-compatibility (D-08)
 *   - computedInputs: Record<string, string> mapping input names to entity IDs in the same form (D-09)
 *   - attachPhotos: boolean (D-05 — non-section entity)
 *   - visibilityRules: conditional visibility rules (D-05 Phase 15)
 *     NOTE: UI filters `require` from the action dropdown when the host entity is computedField
 *     (no requiredAttribute here — D-02 special case). Engine attaches normally for uniformity.
 */
import { createEntity } from "@coltorapps/builder";
import { labelAttribute } from "../attributes/label";
import { formulaAttribute } from "../attributes/formula";
import { computedInputsAttribute } from "../attributes/computed-inputs";
import { attachPhotosAttribute } from "../attributes/attach-photos";
import { visibilityRulesAttribute } from "../attributes/visibility-rules";
import { makeShouldBeProcessed } from "../visibility/should-be-processed";

export const computedFieldEntity = createEntity({
  name: "computedField",
  attributes: [
    labelAttribute,
    formulaAttribute,
    computedInputsAttribute,
    attachPhotosAttribute,
    visibilityRulesAttribute,
  ],
  validate(value) {
    // Computed: value is derived in renderer, never user-supplied.
    // Server may store the latest computed result for prompt context, or strip it.
    return value;
  },
  shouldBeProcessed: makeShouldBeProcessed(),
});
