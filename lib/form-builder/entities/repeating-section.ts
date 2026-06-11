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
  validate(value, context) {
    // Resolve the coerced instances array first, then enforce business bounds.
    // context may be absent in unit tests that only exercise shape coercion —
    // guard accordingly.
    const attrs = (context?.entity?.attributes ?? {}) as {
      minInstances?: number;
      maxInstances?: number;
      title?: string;
    };

    let instances: Array<Record<string, unknown>>;
    let coerced: { instances: Array<Record<string, unknown>> };

    if (value === undefined || value === null) {
      coerced = { instances: [] };
      instances = coerced.instances;
    } else {
      const v = value as Record<string, unknown>;
      // Pitfall 3 safe coercion: object without instances key → treat as empty
      if (!("instances" in v)) {
        coerced = { instances: [] };
        instances = coerced.instances;
      } else if (!Array.isArray(v.instances)) {
        // instances key present — verify it is an array
        throw new Error("Repeating section value must have an instances array.");
      } else {
        coerced = v as { instances: Array<Record<string, unknown>> };
        instances = coerced.instances;
      }
    }

    // D-03 bounds enforcement (audit #3). Previously min/max were never enforced
    // anywhere — the renderer hint was display-only and the server added nothing,
    // so an empty repeating section always passed. Enforcing here covers BOTH the
    // client (validateEntitiesValues) and the server submit path in one place, and
    // makes the "the section's own validator still enforces min/max counts"
    // comments in prune-schema-for-validation.ts / actions.ts finally true.
    const label = attrs.title || "This section";
    const min = typeof attrs.minInstances === "number" ? attrs.minInstances : 0;
    const max = typeof attrs.maxInstances === "number" ? attrs.maxInstances : undefined;

    if (min > 0 && instances.length < min) {
      throw new Error(
        `${label} requires at least ${min} ${min === 1 ? "entry" : "entries"}.`
      );
    }
    if (max !== undefined && instances.length > max) {
      throw new Error(
        `${label} allows at most ${max} ${max === 1 ? "entry" : "entries"}.`
      );
    }

    return coerced;
  },
  shouldBeProcessed: makeShouldBeProcessed(),
});
