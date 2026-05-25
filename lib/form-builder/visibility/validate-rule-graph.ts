/**
 * lib/form-builder/visibility/validate-rule-graph.ts
 *
 * Save-time DAG cycle detector and D-03 scope validator.
 *
 * Contract:
 *   validateRuleGraph(schema) → { ok, cycles, scopeErrors }
 *
 * - Runs 3-colour DFS over the UNION of direct + computedInputs edges (D-02, Pitfall 8).
 * - Detects computed-mediated cycles (e.g., A → computedField → A).
 * - Checks scope rules (D-03): cross-instance and root-references-inside-repeating rejected.
 * - Orphan sources (sourceEntityId not in schema.entities) emit advisory entries, NOT blockers.
 *
 * PURE FUNCTION — no I/O, no React. Called server-side before schema INSERT.
 * Never throws on malformed schema — bad shapes yield structured errors.
 */

import { buildDependencyMap } from "./dependency-map";
import { isAncestorScope } from "./scope";

// ── Schema types ──────────────────────────────────────────────────────────────

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
    label?: string;
    [key: string]: unknown;
  };
  children?: string[];
};

type Schema = {
  entities: Record<string, SchemaEntity>;
};

// ── Error payloads ────────────────────────────────────────────────────────────

export interface CycleError {
  /** Entity IDs forming the cycle, first repeated at end to close the loop */
  path: string[];
  /** Human-readable labels for the same positions — for UI banner */
  labels: string[];
  /** The edges that form the cycle — tagged direct vs computed for Pitfall 8 diagnosis */
  edges: Array<{ from: string; to: string; via: "direct" | "computed" }>;
}

export interface ScopeError {
  consumerId: string;
  sourceId: string;
  reason:
    | "cross-instance"
    | "root-references-inside-repeating"
    | "orphan-source";
  /** "advisory" = not save-blocking; absent/undefined = save-blocking */
  severity?: "advisory";
  consumerLabel?: string;
  sourceLabel?: string;
}

// ── 3-colour DFS constants ────────────────────────────────────────────────────

const WHITE = 0;
const GRAY = 1;
const BLACK = 2;

// ── Helper ────────────────────────────────────────────────────────────────────

function labelOf(schema: Schema, id: string): string {
  const entity = schema.entities[id];
  if (!entity) return id;
  const label = entity.attributes?.label;
  return typeof label === "string" && label.length > 0 ? label : id;
}

/**
 * Build pairwise edges from a cycle path using the dependency map to determine
 * whether each hop is via "direct" or "computed".
 * For each consecutive pair (path[i], path[i+1]), check:
 *   - if direct.get(path[i]) contains path[i+1] → "direct"
 *   - if computedInputs.get(path[i+1]) contains path[i] → "computed"
 *   - otherwise fall back to "direct"
 */
function pairwiseEdges(
  path: string[],
  map: ReturnType<typeof buildDependencyMap>
): Array<{ from: string; to: string; via: "direct" | "computed" }> {
  const edges: Array<{ from: string; to: string; via: "direct" | "computed" }> = [];
  for (let i = 0; i < path.length - 1; i++) {
    const from = path[i];
    const to = path[i + 1];

    // Check if this is a computed edge: `from` is an input to `to` (computedField)
    const toInputs = map.computedInputs.get(to);
    const isComputed = toInputs?.has(from) ?? false;

    edges.push({ from, to, via: isComputed ? "computed" : "direct" });
  }
  return edges;
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Validate the rule graph of a schema.
 *
 * Returns:
 *   ok          — false if any blocking cycle or non-advisory scope error exists
 *   cycles      — CycleError[] from the 3-colour DFS
 *   scopeErrors — ScopeError[] including advisory orphan entries
 */
export function validateRuleGraph(schema: Schema): {
  ok: boolean;
  cycles: CycleError[];
  scopeErrors: ScopeError[];
} {
  if (!schema || !schema.entities || typeof schema.entities !== "object") {
    return { ok: true, cycles: [], scopeErrors: [] };
  }

  const map = buildDependencyMap(schema);
  const colour = new Map<string, number>();
  const cycles: CycleError[] = [];
  const stack: string[] = [];

  function dfs(node: string): void {
    colour.set(node, GRAY);
    stack.push(node);

    // Follow direct edges: node is a SOURCE → visit each consumer
    for (const dependent of map.direct.get(node) ?? []) {
      visitEdge(node, dependent, "direct");
    }

    // Follow computed edges: if node is an INPUT to a computedField,
    // visit that computedField as downstream (Pitfall 8 — both edge classes)
    for (const [computedId, inputs] of map.computedInputs.entries()) {
      if (inputs.has(node)) {
        visitEdge(node, computedId, "computed");
      }
    }

    stack.pop();
    colour.set(node, BLACK);
  }

  function visitEdge(from: string, to: string, _via: "direct" | "computed"): void {
    const c = colour.get(to) ?? WHITE;
    if (c === GRAY) {
      // Back edge — extract the cycle path from the stack
      const idx = stack.indexOf(to);
      if (idx !== -1) {
        const cyclePath = stack.slice(idx).concat(to);
        cycles.push({
          path: cyclePath,
          labels: cyclePath.map((id) => labelOf(schema, id)),
          edges: pairwiseEdges(cyclePath, map),
        });
      }
      return;
    }
    if (c === WHITE) {
      dfs(to);
    }
  }

  // Visit all nodes — multiple disconnected components
  for (const id of Object.keys(schema.entities)) {
    if ((colour.get(id) ?? WHITE) === WHITE) {
      dfs(id);
    }
  }

  // ── Scope validation (D-03) ──────────────────────────────────────────────
  const scopeErrors: ScopeError[] = [];

  // Check all entities' visibilityRules for scope violations + orphan refs
  for (const [entityId, entity] of Object.entries(schema.entities)) {
    const rules = entity.attributes?.visibilityRules?.rules ?? [];
    for (const rule of rules) {
      const { sourceEntityId } = rule as { sourceEntityId: string };
      if (!sourceEntityId || typeof sourceEntityId !== "string") continue;

      // Orphan source: sourceEntityId not in schema.entities (advisory, Pitfall 3 / A6)
      if (!(sourceEntityId in schema.entities)) {
        scopeErrors.push({
          consumerId: entityId,
          sourceId: sourceEntityId,
          reason: "orphan-source",
          severity: "advisory",
          consumerLabel: labelOf(schema, entityId),
          sourceLabel: sourceEntityId, // not in schema — use raw ID
        });
        continue;
      }

      // Scope check: is the source in an ancestor or same scope as the consumer?
      if (!isAncestorScope(schema, entityId, sourceEntityId)) {
        // Determine the specific reason
        // Need to figure out if it's cross-instance or root→inside-repeating
        // We can check by examining the entity types
        const consumerIsInsideRepSection = isEntityInsideRepeatingSection(schema, entityId);
        const sourceIsInsideRepSection = isEntityInsideRepeatingSection(schema, sourceEntityId);

        let reason: "cross-instance" | "root-references-inside-repeating";
        if (!consumerIsInsideRepSection && sourceIsInsideRepSection) {
          reason = "root-references-inside-repeating";
        } else {
          // Both in different repeating sections (or other cross-scope case)
          reason = "cross-instance";
        }

        scopeErrors.push({
          consumerId: entityId,
          sourceId: sourceEntityId,
          reason,
          consumerLabel: labelOf(schema, entityId),
          sourceLabel: labelOf(schema, sourceEntityId),
        });
      }
    }
  }

  // ok = false if there are any cycles OR any non-advisory scope errors
  const blockingErrors = scopeErrors.filter((e) => e.severity !== "advisory");
  const ok = cycles.length === 0 && blockingErrors.length === 0;

  return { ok, cycles, scopeErrors };
}

// ── Scope helpers ─────────────────────────────────────────────────────────────

/**
 * Returns true if the given entity is a direct child of any repeatingSection.
 */
function isEntityInsideRepeatingSection(schema: Schema, entityId: string): boolean {
  for (const entity of Object.values(schema.entities)) {
    if (
      entity.type === "repeatingSection" &&
      Array.isArray(entity.children) &&
      entity.children.includes(entityId)
    ) {
      return true;
    }
  }
  return false;
}
