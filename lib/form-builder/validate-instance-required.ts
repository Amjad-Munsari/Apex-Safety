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
import type { FormBuilderSchema } from "./index"

export type InstanceRequiredFailure = {
  repSectionId: string
  repSectionLabel: string
  instanceIndex: number
  childId: string
  childLabel: string
}

function isEmpty(value: unknown): boolean {
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
