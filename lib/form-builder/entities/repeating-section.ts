/**
 * repeatingSectionEntity
 *
 * Container entity (childrenAllowed: true) for repeating groups of fields.
 * The canonical use case is "List all fire doors" — each door is one instance.
 *
 * Value shape (D-04):
 *   { instances: Array<Record<entityId, value>> }
 *
 * Where each instance is a Record mapping child entity IDs (from schema.entities[id].children)
 * to their filled values. The instances[] are independent value objects.
 *
 * validate() contract:
 *   - undefined / null  → return { instances: [] }  (safe default)
 *   - {} (no instances key) → return { instances: [] }  (Pitfall 3 safe coercion — documented)
 *   - { instances: [...] } → verify Array.isArray(instances); return unchanged if valid
 *   - { instances: <non-array> } → throw "Repeating section value must have an instances array."
 *
 * Per-instance child validation happens in the renderer BEFORE calling interpreterStore.setEntityValue(),
 * and ideally in an explicit server-side loop in submitAssessmentAction (tracked as T-14-02-03).
 * coltorapps validateEntitiesValues does NOT recurse into the instances[] array (RESEARCH Open Question #1).
 *
 * Security note (T-14-02-01): The schema is fetched server-side from the pinned template_versions.schema_json.
 * Child entity IDs not in schema.entities[id].children are ignored when building the AI prompt.
 * Security note (T-14-02-02): { instances: <non-array> } is rejected here and surfaced as validateEntitiesValues
 * result.success = false — submitAssessmentAction will reject such submissions.
 */
import { createEntity } from "@coltorapps/builder";
import { sectionTitleAttribute } from "../attributes/section-title";
import { sectionDescriptionAttribute } from "../attributes/section-description";
import { minInstancesAttribute } from "../attributes/min-instances";
import { maxInstancesAttribute } from "../attributes/max-instances";
import { visibilityRulesAttribute } from "../attributes/visibility-rules";
import { makeShouldBeProcessed } from "../visibility/should-be-processed";

export const repeatingSectionEntity = createEntity({
  name: "repeatingSection",
  // CRITICAL: childrenAllowed: true is required for setEntityParent() to work.
  // Without this flag, setEntityParent() throws "Child is not allowed."
  // Verified by Phase 13 spike (13-01 SUMMARY deviation #3).
  childrenAllowed: true,
  attributes: [
    sectionTitleAttribute,
    sectionDescriptionAttribute,
    minInstancesAttribute,
    maxInstancesAttribute,
    // NO attachPhotosAttribute — repeatingSection is a container (D-05: "every non-section entity")
    visibilityRulesAttribute,
  ],
  validate(value) {
    // Safe default: undefined/null → empty instances
    if (value === undefined || value === null) {
      return { instances: [] };
    }
    const v = value as Record<string, unknown>;

    // Pitfall 3 safe coercion: object without instances key → treat as empty
    if (!("instances" in v)) {
      return { instances: [] };
    }

    // instances key present — verify it is an array
    if (!Array.isArray(v.instances)) {
      throw new Error("Repeating section value must have an instances array.");
    }

    return v as { instances: Array<Record<string, unknown>> };
  },
  shouldBeProcessed: makeShouldBeProcessed(),
});
