/**
 * Per-instance required validation for repeatingSection children.
 *
 * coltorapps' validateEntitiesValues doesn't recurse into instances[] (and we
 * prune children off repeatingSections before handing the schema over so it
 * stops at the section — see prune-schema-for-validation.ts). That leaves
 * per-instance required enforcement to us: a child with static `required: true`
 * or a dynamic `action: "require"` rule firing inside a specific instance must
 * have a non-empty value in that instance.
 *
 * Returns the list of missing entries; an empty array means valid.
 *
 * Used by both the client submit guard (interpreter-renderer.tsx) and the
 * server action (app/admin/assessments/actions.ts) so behaviour is identical.
 */
import { evaluateVisibilityForInstance } from "./visibility/evaluate-visibility"
import { isFileFieldType } from "./file-field-types"
import type { VisibilityState } from "./visibility/types"
import type { FormBuilderSchema } from "./index"

export type InstanceRequiredFailure = {
  repSectionId: string
  repSectionLabel: string
  instanceIndex: number
  childId: string
  childLabel: string
}

/**
 * A root-level (non-repeating) field that is required by visibility but holds no
 * value. `entityId` + `label` are enough for the submit guard to surface a clear
 * "Missing required field …" error before the DB write (BUG A).
 */
export type RootRequiredFailure = {
  entityId: string
  label: string
}

/**
 * Shared emptiness semantics for both the per-instance child check
 * (validateInstanceRequired) and the root-level check (validateRootRequired).
 *
 * Exported so the two validators — and any future required-gate — agree on what
 * "empty" means: undefined/null, a blank/whitespace-only string, or an empty
 * array. Anything else (numbers incl. 0, booleans, non-empty objects/arrays) is
 * considered filled.
 */
export function isEmpty(value: unknown): boolean {
  if (value === undefined || value === null) return true
  if (typeof value === "string") return value.trim() === ""
  if (Array.isArray(value)) return value.length === 0
  return false
}

export function validateInstanceRequired(
  schema: FormBuilderSchema,
  values: Record<string, unknown>
): InstanceRequiredFailure[] {
  const failures: InstanceRequiredFailure[] = []

  for (const [repSectionId, entity] of Object.entries(schema.entities)) {
    if (entity.type !== "repeatingSection") continue

    const childIds: string[] = (entity as { children?: string[] }).children ?? []
    if (childIds.length === 0) continue

    const repValue = values[repSectionId] as { instances?: Array<Record<string, unknown>> } | undefined
    const instances = repValue?.instances ?? []

    const repLabel =
      ((entity.attributes as Record<string, unknown>)?.title as string | undefined) ?? repSectionId

    for (let idx = 0; idx < instances.length; idx++) {
      const instanceVis = evaluateVisibilityForInstance(schema, values, repSectionId, idx)
      const instance = instances[idx]

      for (const childId of childIds) {
        const state = instanceVis[childId]
        if (!state || state.visible === false) continue
        if (!state.required) continue
        // BUG 3: photo/file-upload children are recommended, not required —
        // never block per-instance submission even when marked required.
        if (isFileFieldType(schema.entities[childId]?.type)) continue
        if (!isEmpty(instance?.[childId])) continue

        const childEntity = schema.entities[childId]
        const childLabel =
          ((childEntity?.attributes as Record<string, unknown>)?.label as string | undefined) ?? childId

        failures.push({
          repSectionId,
          repSectionLabel: repLabel,
          instanceIndex: idx,
          childId,
          childLabel,
        })
      }
    }
  }

  return failures
}

/**
 * Root-level DYNAMIC required enforcement (BUG A — data integrity).
 *
 * The submit pipeline already enforces:
 *   - STATIC `required: true` on root fields → coltorapps validateEntitiesValues
 *   - per-INSTANCE required on repeatingSection children → validateInstanceRequired
 *
 * The gap: a TOP-LEVEL (non-repeating) field that is required ONLY by a fired
 * `action: "require"` rule is invisible to both. validateEntitiesValues sees it
 * as optional (static required is false); validateInstanceRequired only walks
 * repeatingSection children. Such a field could be submitted EMPTY.
 *
 * This closes that gap. For each top-level entity we flag it when:
 *   - visibility[id].visible !== false  (a hidden field is never required — D-07
 *     hide-wins; the value is scrubbed anyway), AND
 *   - visibility[id].required === true  (folds static + fired require rules), AND
 *   - the value isEmpty.
 *
 * Skipped (covered elsewhere or exempt):
 *   - repeatingSection ENTITIES themselves (their instance children are handled
 *     by validateInstanceRequired; the section min/max shape by coltorapps).
 *   - repeatingSection CHILDREN (their values live nested in instances[], never
 *     at the root values map — see validateInstanceRequired).
 *   - file/photo field types (isFileFieldType) — required is downgraded to
 *     "recommended" and must never block submission (BUG 3).
 *
 * No double-reporting: a STATIC-required empty field has already failed
 * validateEntitiesValues earlier in the pipeline, so this check is only ever
 * reached for fields whose required-ness comes from a dynamic rule. We still
 * gate on `isEmpty` so a static-required field that somehow reaches here while
 * filled is correctly ignored.
 *
 * @param schema     - sanitized FormBuilderSchema (same object the pipeline uses).
 * @param values     - validated answers (result.data), root-level keyed by entity ID.
 * @param visibility - the per-entity visibility map already computed in each
 *   submit path via `evaluateVisibility(schemaJson, result.data)`.
 * @returns the list of {entityId, label} missing entries; empty array means valid.
 */
export function validateRootRequired(
  schema: FormBuilderSchema,
  values: Record<string, unknown>,
  visibility: Record<string, VisibilityState>
): RootRequiredFailure[] {
  const failures: RootRequiredFailure[] = []

  // Collect every entity that is a child of some repeatingSection — those values
  // live inside instances[], not at the root, so they must never be checked here.
  const repSectionChildIds = new Set<string>()
  for (const entity of Object.values(schema.entities)) {
    if (entity.type !== "repeatingSection") continue
    for (const childId of (entity as { children?: string[] }).children ?? []) {
      repSectionChildIds.add(childId)
    }
  }

  for (const [id, entity] of Object.entries(schema.entities)) {
    // Skip repeatingSection entities (instance children covered by validateInstanceRequired).
    if (entity.type === "repeatingSection") continue
    // Skip repeatingSection children (nested, not root-level).
    if (repSectionChildIds.has(id)) continue
    // Skip file/photo fields — required is "recommended", never blocking (BUG 3).
    if (isFileFieldType(entity.type)) continue

    const state = visibility[id]
    if (!state) continue
    if (state.visible === false) continue // hide-wins: hidden field is never required
    if (state.required !== true) continue
    if (!isEmpty(values[id])) continue

    const label =
      ((entity.attributes as Record<string, unknown>)?.label as string | undefined) ?? id

    failures.push({ entityId: id, label })
  }

  return failures
}
