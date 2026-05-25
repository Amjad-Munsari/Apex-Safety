/**
 * lib/form-builder/visibility/dependency-map.ts
 *
 * Builds the dependency graph from a schema for cycle detection (validateRuleGraph)
 * and runtime reactive updates (D-09 performance contract).
 *
 * Two edge classes (D-02):
 *   - direct:        source entity → Set of dependent entities (from visibilityRules)
 *                    "X → Y" means "a change to X requires re-eval of Y"
 *   - computedInputs: computedField entity → Set of input entity IDs
 *                    Used by the 3-colour DFS to detect computed-mediated cycles (Pitfall 8)
 *
 * PURE FUNCTION — no I/O, no React, no schema mutations.
 * Safe to call at save time (server) or in tests with hand-built schemas.
 */

type VisibilityRuleEntry = {
  sourceEntityId: string;
  operator: string;
  value: unknown;
  action: "show" | "hide" | "require";
};

type VisibilityRules = {
  rules: VisibilityRuleEntry[];
  logic: "and" | "or";
};

type SchemaEntity = {
  type: string;
  attributes: {
    visibilityRules?: VisibilityRules;
    computedInputs?: Record<string, string>;
    [key: string]: unknown;
  };
  children?: string[];
};

type Schema = {
  entities: Record<string, SchemaEntity>;
};

export interface DependencyMap {
  /** source entity ID → Set of entity IDs that directly reference it in a visibility rule */
  direct: Map<string, Set<string>>;
  /** computedField entity ID → Set of input entity IDs that feed it */
  computedInputs: Map<string, Set<string>>;
}

/**
 * Build the two-class dependency map from a schema.
 *
 * Direct edges: for each entity, for each rule, record sourceEntityId → thisEntityId.
 * Computed edges: for each computedField, record computedFieldId → Set<inputEntityId>.
 *
 * NOTE on direction:
 *   direct: Map<sourceId, Set<consumerId>>
 *           "when source changes, re-eval all consumers" — i.e., source → consumer
 *   computedInputs: Map<computedFieldId, Set<inputEntityId>>
 *           "these inputs feed this computedField" — used by the DFS to also traverse
 *           input → computedField direction (both edge classes are traversed by the DFS)
 */
export function buildDependencyMap(schema: Schema): DependencyMap {
  const direct = new Map<string, Set<string>>();
  const computedInputs = new Map<string, Set<string>>();

  for (const [entityId, entity] of Object.entries(schema.entities)) {
    // Direct rule dependencies: source → this entity (consumer)
    const rules = entity.attributes?.visibilityRules?.rules ?? [];
    for (const rule of rules) {
      if (rule.sourceEntityId && typeof rule.sourceEntityId === "string") {
        if (!direct.has(rule.sourceEntityId)) {
          direct.set(rule.sourceEntityId, new Set());
        }
        direct.get(rule.sourceEntityId)!.add(entityId);
      }
    }

    // Computed-field input dependencies (for D-02 transitive cycle detection — Pitfall 8)
    if (entity.type === "computedField") {
      const inputs = entity.attributes?.computedInputs ?? {};
      // Only include non-empty string values (bound inputs; empty string = unbound)
      const inputIds = new Set(
        Object.values(inputs).filter(
          (v): v is string => typeof v === "string" && v.length > 0
        )
      );
      if (inputIds.size > 0) {
        computedInputs.set(entityId, inputIds);
      }
    }
  }

  return { direct, computedInputs };
}
