/**
 * computeFormProgress — completion percentage for the assessment fill flow.
 *
 * The coltorapps interpreter store owns the entity values; this derives the
 * "% COMPLETE" figure the AssessmentFormHeader progress bar renders.
 *
 * "Complete" means "ready to submit", so progress is measured against the
 * REQUIRED fields only — the bar reaches 100% exactly when validation would
 * let the form submit. Optional fields never affect the percentage.
 *
 * A field counts as filled when it holds a meaningful value: a non-blank
 * string, a checked checkbox, a non-empty array, or any number (including 0).
 *
 * Phase 14 extensions:
 * - geolocationField: an object with numeric `lat` and `lng` keys is treated as filled.
 * - repeatingSection: when `attrs.minInstances > 0`, the section counts as a required
 *   entity. It is considered "filled" when ALL of the following are true:
 *     1. The value is `{ instances: [...] }` with `instances.length >= minInstances`.
 *     2. Every required child entity in EVERY instance holds a filled value.
 *   Children that have no `required: true` attribute are ignored in the per-instance check.
 */

import type { VisibilityState } from "./visibility/types";
import { isFileFieldType } from "./file-field-types";

/** Minimal structural shape — FormBuilderSchema satisfies this. */
type ProgressSchema = {
  entities: Record<
    string,
    {
      type?: string;
      attributes?: Record<string, unknown>;
      children?: string[];
    }
  >;
};

/**
 * Returns true when `value` represents a meaningful filled state.
 *
 * Phase 14 extension: geolocation objects `{lat: number, lng: number, ...}` are
 * treated as filled. Other plain objects (non-array, non-null) also return true,
 * preserving backwards compatibility for any future object-valued entity types.
 */
function isFilled(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "number") return !Number.isNaN(value);
  if (typeof value === "object") {
    const v = value as Record<string, unknown>;
    // geolocationField: recognise {lat, lng} object shape as filled (Phase 14 extension)
    if (typeof v.lat === "number" && typeof v.lng === "number") return true;
    // Other plain objects: fall through to true (backwards-compatible default)
    return true;
  }
  return true;
}

/**
 * Checks whether a repeatingSection entity is "filled" given its value and schema.
 *
 * "Filled" for a repeatingSection means:
 *   - value.instances.length >= minInstances (quantity gate)
 *   - Every required child entity is filled in every instance (quality gate)
 *
 * The `instances` array is `Array<Record<entityId, value>>`. Required children are those
 * whose `schema.entities[childId].attributes.required === true`.
 *
 * Per-instance child validation against non-shape constraints (e.g., rating bounds) is
 * deferred to the renderer and submitAssessmentAction (RESEARCH Open Question #1 / T-14-02-03).
 */
function isRepeatingSectionFilled(
  entityId: string,
  schema: ProgressSchema,
  values: Record<string, unknown>
): boolean {
  const entity = schema.entities[entityId];
  const minInstances = (entity.attributes?.minInstances as number) ?? 0;
  const rawValue = values[entityId];

  // No value or wrong shape → not filled
  if (
    rawValue === undefined ||
    rawValue === null ||
    typeof rawValue !== "object" ||
    Array.isArray(rawValue)
  ) {
    return false;
  }

  const repValue = rawValue as { instances?: unknown[] };
  if (!Array.isArray(repValue.instances)) return false;

  // Quantity gate
  if (repValue.instances.length < minInstances) return false;

  // Quality gate — check required children in each instance
  const children = entity.children ?? [];
  const requiredChildren = children.filter(
    (childId) =>
      schema.entities[childId]?.attributes?.required === true &&
      // BUG 3: photo/file-upload children are recommended, not required — never gate progress.
      !isFileFieldType(schema.entities[childId]?.type)
  );

  if (requiredChildren.length === 0) return true;

  for (const instance of repValue.instances as Array<Record<string, unknown>>) {
    for (const childId of requiredChildren) {
      if (!isFilled(instance[childId])) return false;
    }
  }

  return true;
}

/**
 * @returns integer 0-100 — the percentage of required fields that hold a
 *   filled value. Returns 100 when the schema has no required fields (a form
 *   with nothing required is submittable, i.e. already complete).
 *
 * Phase 14: repeatingSection entities where `minInstances > 0` are included
 * in the required set. Their fill logic is handled by `isRepeatingSectionFilled`.
 * computedField entities never carry a `required` attribute and therefore never
 * appear in the required set — they do not block progress (UI-SPEC §computedField-specific).
 *
 * Phase 15 extension: optional `visibility` parameter.
 * When provided:
 *   - If `visibility[id].visible === false`, the entity is EXCLUDED from both
 *     numerator AND denominator (D-07 hidden trumps required).
 *   - `visibility[id].required` (which folds static + dynamic require rules) is
 *     used instead of `entity.attributes?.required === true` for the required check.
 * When `visibility === undefined`, behaviour is byte-identical to Phase 14 (backward-compat).
 */
export function computeFormProgress(
  schema: ProgressSchema,
  values: Record<string, unknown>,
  visibility?: Record<string, VisibilityState>
): number {
  // Collect IDs of entities that are children of a repeatingSection.
  // These entities represent "template" fields — their values live inside instances[],
  // not at the top-level values map. They must NOT be counted as standalone required items.
  const repeatingSectionChildIds = new Set<string>();
  for (const entity of Object.values(schema.entities)) {
    if (entity.type === "repeatingSection" && Array.isArray(entity.children)) {
      for (const childId of entity.children) {
        repeatingSectionChildIds.add(childId);
      }
    }
  }

  // Collect required top-level entity IDs.
  // Two sources:
  //   (a) entities with attrs.required === true  (standard field types — excluding repeatingSection children)
  //   (b) repeatingSection entities with minInstances > 0  (Phase 14 extension)
  // Phase 15: when visibility is provided, use visibility[id].required (folds static + dynamic).
  const requiredIds = Object.entries(schema.entities).flatMap(([id, entity]) => {
    // Skip entities that are children of a repeatingSection
    if (repeatingSectionChildIds.has(id)) return [];

    // BUG 3: photo/file-upload fields are recommended, not required — never
    // count toward the completion denominator (so they can't keep the
    // "Submit assessment" button disabled via progress < 100).
    if (isFileFieldType(entity.type)) return [];

    // Phase 15: if visibility is provided and this entity is hidden, exclude entirely (D-07).
    if (visibility && visibility[id]?.visible === false) return [];

    if (entity.type === "repeatingSection") {
      const min = (entity.attributes?.minInstances as number) ?? 0;
      // When visibility is provided, repeatingSection is required if visibility says so
      // OR if minInstances > 0 (same as Phase 14 default).
      if (visibility) {
        return (visibility[id]?.required === true || min > 0) ? [id] : [];
      }
      return min > 0 ? [id] : [];
    }

    // Non-repeatingSection entity
    if (visibility) {
      // Use the visibility-computed required (folds static + fired require rules, D-07)
      return visibility[id]?.required === true ? [id] : [];
    }
    return entity.attributes?.required === true ? [id] : [];
  });

  const total = requiredIds.length;
  if (total === 0) return 100;

  const filled = requiredIds.filter((id) => {
    const entity = schema.entities[id];
    if (entity.type === "repeatingSection") {
      return isRepeatingSectionFilled(id, schema, values);
    }
    return isFilled(values[id]);
  }).length;

  return Math.round((filled / total) * 100);
}
