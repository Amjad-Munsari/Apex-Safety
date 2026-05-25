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
 */

/** Minimal structural shape — FormBuilderSchema satisfies this. */
type ProgressSchema = {
  entities: Record<string, { type?: string; attributes?: Record<string, unknown> }>;
};

function isFilled(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "number") return !Number.isNaN(value);
  return true;
}

/**
 * @returns integer 0-100 — the percentage of required fields that hold a
 *   filled value. Returns 100 when the schema has no required fields (a form
 *   with nothing required is submittable, i.e. already complete).
 */
export function computeFormProgress(
  schema: ProgressSchema,
  values: Record<string, unknown>
): number {
  const requiredIds = Object.entries(schema.entities)
    .filter(([, entity]) => entity.attributes?.required === true)
    .map(([id]) => id);

  const total = requiredIds.length;
  if (total === 0) return 100;

  const filled = requiredIds.filter((id) => isFilled(values[id])).length;
  return Math.round((filled / total) * 100);
}
