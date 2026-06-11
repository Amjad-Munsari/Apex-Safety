import { KNOWN_ENTITY_TYPES, type FormBuilderSchema } from ".";

type RawEntity = {
  type: string;
  children?: string[];
  parentId?: string;
  [key: string]: unknown;
};

/**
 * Attribute keys removed from entity definitions but still present in older
 * saved schema_json. coltorapps' validateSchema rejects unknown attributes
 * (UnknownEntityAttributeType), so re-saving/re-publishing a template authored
 * before the removal would throw unless these stale keys are stripped on load.
 *  - `allowMultiple` (selectField) removed with the half-built multi-select mode
 *  - `unit` (numberField) removed as unused
 * See audit findings #5 and #9.
 */
const DEAD_ATTRIBUTE_KEYS = ["allowMultiple", "unit"] as const;

/** A field dropped by sanitizeSchema because its type is no longer registered. */
export interface RemovedEntity {
  id: string;
  type: string;
}

export interface SanitizeReport {
  schema: FormBuilderSchema;
  /** Entities dropped because their TYPE is unregistered (real data loss, e.g.
   *  signatureField/ratingField). Cascade-emptied sections are NOT listed —
   *  they held no user answers. */
  removedEntities: RemovedEntity[];
}

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
  return sanitizeSchemaWithReport(schema).schema;
}

/**
 * Same sanitisation as {@link sanitizeSchema}, but also returns which entities
 * were dropped because their type is unregistered — so callers (e.g. the builder)
 * can WARN the user that fields were silently removed (audit #1) rather than
 * having that data loss pass unnoticed.
 */
export function sanitizeSchemaWithReport(schema: FormBuilderSchema): SanitizeReport {
  const entities = schema.entities as Record<string, RawEntity>;
  const root = schema.root as string[];

  const removed = new Set<string>();
  const removedEntities: RemovedEntity[] = [];
  for (const [id, entity] of Object.entries(entities)) {
    if (!KNOWN_ENTITY_TYPES.has(entity.type)) {
      removed.add(id);
      removedEntities.push({ id, type: entity.type });
    }
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

  // Detect stale attribute keys on any surviving entity so we can clean them out
  // even when no entity needed removing.
  const hasDeadAttrs = Object.values(entities).some((entity) => {
    const attrs = entity.attributes as Record<string, unknown> | undefined;
    return attrs != null && DEAD_ATTRIBUTE_KEYS.some((k) => k in attrs);
  });

  if (removed.size === 0 && !hasDeadAttrs) return { schema, removedEntities };

  // Make the data loss observable in server logs / browser console — previously
  // entities were stripped completely silently (audit #1).
  if (removedEntities.length > 0) {
    const summary = removedEntities.map((e) => `${e.type}(${e.id})`).join(", ");
    console.warn(
      `[sanitizeSchema] dropped ${removedEntities.length} field(s) of unregistered type — answers for these are lost: ${summary}`
    );
  }

  const nextEntities: Record<string, RawEntity> = {};
  for (const [id, entity] of Object.entries(entities)) {
    if (removed.has(id)) continue;
    const clone: RawEntity = { ...entity };
    if (Array.isArray(clone.children)) {
      clone.children = clone.children.filter((childId) => !removed.has(childId));
    }
    const attrs = clone.attributes as Record<string, unknown> | undefined;
    if (attrs != null && DEAD_ATTRIBUTE_KEYS.some((k) => k in attrs)) {
      const nextAttrs = { ...attrs };
      for (const k of DEAD_ATTRIBUTE_KEYS) delete nextAttrs[k];
      clone.attributes = nextAttrs;
    }
    nextEntities[id] = clone;
  }

  return {
    schema: {
      ...schema,
      root: root.filter((id) => !removed.has(id)),
      entities: nextEntities,
    } as unknown as FormBuilderSchema,
    removedEntities,
  };
}
