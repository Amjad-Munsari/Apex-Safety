/**
 * Repeating-section nesting constraints (audit #10).
 *
 * Fill mode only supports basic field types inside a repeatingSection — specialty
 * types render a "not supported" message instead of an input. Before this module
 * the builder's drag-drop and the save/publish validators applied NO restriction,
 * so an admin could nest a Photos / Location / Computed / nested-Repeating field
 * into a repeating section and produce a schema that silently breaks at fill time.
 *
 * This is the single source of truth: the fill renderer, the builder canvas guard,
 * and the server-side publish validator all import `DISALLOWED_IN_REPEATING_SECTION`.
 */

/** Entity types that must NOT be nested inside a repeatingSection. */
export const DISALLOWED_IN_REPEATING_SECTION: ReadonlySet<string> = new Set([
  "multiPhotoField",
  "geolocationField",
  "computedField",
  "repeatingSection",
  "sectionGroup",
]);

type SchemaLike = {
  entities: Record<string, { type: string; children?: string[]; parentId?: string }>;
};

export interface RepeatingNestingViolation {
  childId: string;
  childType: string;
  sectionId: string;
}

/**
 * Scan a schema for disallowed entities nested (directly) inside any
 * repeatingSection. Returns one violation per offending child.
 */
export function findRepeatingNestingViolations(
  schema: SchemaLike
): RepeatingNestingViolation[] {
  const violations: RepeatingNestingViolation[] = [];
  const entities = schema.entities ?? {};
  for (const [sectionId, entity] of Object.entries(entities)) {
    if (entity.type !== "repeatingSection") continue;
    for (const childId of entity.children ?? []) {
      const child = entities[childId];
      if (child && DISALLOWED_IN_REPEATING_SECTION.has(child.type)) {
        violations.push({ childId, childType: child.type, sectionId });
      }
    }
  }
  return violations;
}
