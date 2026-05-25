/**
 * lib/form-builder/visibility/scope.ts
 *
 * Schema tree-walking utilities for scope resolution (D-03).
 *
 * Scope rules (D-03):
 *   - A field can reference fields in the SAME scope (e.g., sibling in same repeatingSection).
 *   - A field can reference fields in an ANCESTOR scope (e.g., inside-repeatingSection → root).
 *   - Cross-instance references are REJECTED (different repeatingSection instances/containers).
 *   - Root fields cannot reference inside-repeatingSection fields (N instances → ambiguous source).
 *   - sectionGroup children share their parent's scope for the purposes of rule cross-reference
 *     (sectionGroups are layout containers; they don't introduce an isolation boundary like
 *     repeatingSection does). A child of sectionGroup is considered at "sectionGroup scope"
 *     for structural resolution, but sectionGroup itself is always rooted (root-level scope).
 *
 * PURE FUNCTION — no I/O, no React, no schema mutations.
 */

type SchemaEntity = {
  type: string;
  attributes?: Record<string, unknown>;
  children?: string[];
};

type Schema = {
  entities: Record<string, SchemaEntity>;
};

/**
 * Build a parent-map from the schema: for each entity that is a child of a container,
 * record child → parent relationship.
 *
 * Only direct parent (not grandparent) is recorded since the schema is one level deep
 * for containers (sectionGroup and repeatingSection hold direct children).
 */
function buildParentMap(schema: Schema): Map<string, string> {
  const parentMap = new Map<string, string>();
  for (const [containerId, entity] of Object.entries(schema.entities)) {
    if (Array.isArray(entity.children)) {
      for (const childId of entity.children) {
        parentMap.set(childId, containerId);
      }
    }
  }
  return parentMap;
}

/**
 * Resolve the scope of an entity.
 *
 * Returns:
 *   - "root"               — entity is not a child of any container
 *   - repeatingSection.id — entity is a direct child of a repeatingSection
 *   - sectionGroup.id     — entity is a direct child of a sectionGroup
 *
 * If an entity is not found in the schema, returns "root" (safe default — orphan).
 */
export function resolveScope(schema: Schema, entityId: string): string {
  const parentMap = buildParentMap(schema);
  const parentId = parentMap.get(entityId);

  if (!parentId) {
    // No parent — entity is at root level
    return "root";
  }

  // The entity has a parent — return the parent's ID
  // (both sectionGroup and repeatingSection IDs are returned as scope identifiers)
  return parentId;
}

/**
 * Determine whether a source entity's scope is an ancestor (or equal) to the consumer's scope.
 *
 * D-03 rules:
 *   - PASS: consumer and source share the same direct parent (same scope)
 *   - PASS: consumer is inside a repeatingSection and source is at root (ancestor-scope)
 *   - PASS: both are at root
 *   - FAIL: consumer is root but source is inside a repeatingSection (ambiguous — N instances)
 *   - FAIL: consumer and source are children of DIFFERENT repeating sections (cross-instance)
 *
 * Note on sectionGroup: treated like root from a D-03 perspective for now — a sectionGroup
 * child can reference any other sectionGroup child or root field. sectionGroups are layout-only
 * and do not introduce instance isolation.
 */
export function isAncestorScope(
  schema: Schema,
  consumerId: string,
  sourceId: string
): boolean {
  const parentMap = buildParentMap(schema);

  const consumerParentId = parentMap.get(consumerId);
  const sourceParentId = parentMap.get(sourceId);

  // Both at root
  if (!consumerParentId && !sourceParentId) return true;

  // Consumer is inside a container; source is at root → ancestor-scope (PASS)
  if (consumerParentId && !sourceParentId) {
    const consumerParent = schema.entities[consumerParentId];
    if (consumerParent?.type === "repeatingSection") {
      // repSection child → root: ancestor-scope, ALLOWED
      return true;
    }
    if (consumerParent?.type === "sectionGroup") {
      // sectionGroup child → root: ALLOWED (sectionGroup is layout-only)
      return true;
    }
    // Unknown parent type: treat as allowed (forward-compat)
    return true;
  }

  // Consumer is at root; source is inside a container
  if (!consumerParentId && sourceParentId) {
    const sourceParent = schema.entities[sourceParentId];
    if (sourceParent?.type === "repeatingSection") {
      // Root → inside-repeatingSection: REJECTED per D-03 (N instances → ambiguous)
      return false;
    }
    // Root → inside-sectionGroup: ALLOWED (sectionGroup is layout-only)
    return true;
  }

  // Both inside containers — check if they share the same parent
  if (consumerParentId && sourceParentId) {
    if (consumerParentId === sourceParentId) {
      // Same parent scope (siblings) — ALLOWED
      return true;
    }

    // Different parent containers
    const consumerParent = schema.entities[consumerParentId];
    const sourceParent = schema.entities[sourceParentId];

    // If both are children of different repeatingSections → cross-instance REJECTED
    if (
      consumerParent?.type === "repeatingSection" &&
      sourceParent?.type === "repeatingSection"
    ) {
      return false;
    }

    // If consumer is in a sectionGroup and source is in another container:
    // Allow if source parent is not a repeatingSection
    if (
      consumerParent?.type === "sectionGroup" &&
      sourceParent?.type !== "repeatingSection"
    ) {
      return true;
    }

    // Consumer is in repeatingSection, source is in sectionGroup → allowed (sectionGroup is root-adjacent)
    if (
      consumerParent?.type === "repeatingSection" &&
      sourceParent?.type === "sectionGroup"
    ) {
      return true;
    }

    // Any other mixed-parent case: conservative reject
    return false;
  }

  return false;
}
