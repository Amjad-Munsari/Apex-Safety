/**
 * Clone a form schema with `children` cleared on every repeatingSection.
 *
 * Why: coltorapps' validateEntitiesValues walks entity.children recursively and
 * validates each descendant against the ROOT-level entitiesValues map. But the
 * template children of a repeatingSection (e.g. "Door condition", "Repair urgency")
 * never have root-level values — their values live nested inside
 *   values[repSectionId] = { instances: [{ [childId]: value }, ...] }
 * So a child with `required: true` always fails coltorapps' validator at the
 * root level, blocking submission even when every instance is correctly filled.
 *
 * The repeatingSection's own validator continues to enforce the
 * `{ instances: [...] }` shape and min/max instance counts. Per-instance
 * required enforcement is a renderer + server concern (see UI dynamicRequired
 * via evaluateVisibilityForInstance, plus any future per-instance server check).
 */
import type { FormBuilderSchema } from "./index"

export function pruneSchemaForValidation(schema: FormBuilderSchema): FormBuilderSchema {
  const next: FormBuilderSchema = {
    ...schema,
    entities: { ...schema.entities },
  }
  for (const [id, entity] of Object.entries(schema.entities)) {
    if (entity.type === "repeatingSection") {
      next.entities[id] = { ...entity, children: [] }
    }
  }
  return next
}
