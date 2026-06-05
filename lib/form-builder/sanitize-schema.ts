import { KNOWN_ENTITY_TYPES, type FormBuilderSchema } from ".";

type RawEntity = {
  type: string;
  children?: string[];
  parentId?: string;
  [key: string]: unknown;
};

/**
 * Remove entities whose type is no longer registered (see KNOWN_ENTITY_TYPES),
 * cleaning them out of `root` and any parent's `children` so the schema still
 * loads. Without this, a schema saved with a since-removed type (e.g. the
 * seeded FRA's signatureField) throws "The provided entity type is unknown"
 * the moment a builder/interpreter store is created from it.
 *
 * Returns the original object unchanged when nothing needs removing (stable
 * identity, so it's safe to memoise on).
 */
export function sanitizeSchema(schema: FormBuilderSchema): FormBuilderSchema {
  const entities = schema.entities as Record<string, RawEntity>;
  const root = schema.root as string[];

  const removed = new Set<string>();
  for (const [id, entity] of Object.entries(entities)) {
    if (!KNOWN_ENTITY_TYPES.has(entity.type)) removed.add(id);
  }

  // Cascade: a sectionGroup whose children ALL get removed collapses into an
  // empty, purposeless container that still renders a stray heading + divider
  // (e.g. the seeded FRA's signature-only section once signatureField is
  // stripped). Drop such now-childless sections too. Loop until stable, since
  // emptying one section can empty its parent. Sections authored with zero
  // children are left untouched — only those emptied BY removal are dropped.
  let changed = true;
  while (changed) {
    changed = false;
    for (const [id, entity] of Object.entries(entities)) {
      if (removed.has(id) || entity.type !== "sectionGroup") continue;
      const kids = Array.isArray(entity.children) ? entity.children : [];
      if (kids.length === 0) continue; // intentionally empty — leave as authored
      if (kids.every((childId) => removed.has(childId))) {
        removed.add(id);
        changed = true;
      }
    }
  }

  if (removed.size === 0) return schema;

  const nextEntities: Record<string, RawEntity> = {};
  for (const [id, entity] of Object.entries(entities)) {
    if (removed.has(id)) continue;
    const clone: RawEntity = { ...entity };
    if (Array.isArray(clone.children)) {
      clone.children = clone.children.filter((childId) => !removed.has(childId));
    }
    nextEntities[id] = clone;
  }

  return {
    ...schema,
    root: root.filter((id) => !removed.has(id)),
    entities: nextEntities,
  } as unknown as FormBuilderSchema;
}
