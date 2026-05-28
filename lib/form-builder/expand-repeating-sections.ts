/**
 * Expand repeatingSection answers into labelled flat objects for the AI prompt.
 *
 * Current answers_json stores repeatingSection values as:
 *   { "[repId]": { instances: [ { "[childId1]": value, "[childId2]": value }, ... ] } }
 *
 * This function transforms those into arrays of labelled objects:
 *   { "[repId]": [ { instanceIndex: 1, "Location": "door 1", "Condition": "good" }, ... ] }
 *
 * So the AI prompt sees one labelled object per door / hazard / item instead of
 * an opaque nested "instances" array (RESEARCH Pattern 10).
 *
 * Threat T-14-03-06: iterates schema.entities[id].children (the PINNED,
 * server-fetched list) — keys not in that list are NEVER included in the
 * labelled output. User-supplied extra child keys are silently discarded.
 *
 * Pure function — no side effects, does not mutate the input.
 */
export function expandRepeatingSections(
  schema: { entities: Record<string, { type: string; children?: string[]; attributes?: Record<string, unknown> }> },
  answers: Record<string, unknown>
): Record<string, unknown> {
  const expanded: Record<string, unknown> = { ...answers }

  for (const [entityId, entity] of Object.entries(schema.entities)) {
    if (entity.type !== "repeatingSection") continue

    const repeatingValue = answers[entityId] as
      | { instances?: unknown[] }
      | undefined

    if (!repeatingValue?.instances) continue

    const childIds: string[] = (entity.children as string[]) ?? []

    expanded[entityId] = repeatingValue.instances.map((inst, idx) => {
      const instance = inst as Record<string, unknown>
      const labelled: Record<string, unknown> = { instanceIndex: idx + 1 }

      for (const childId of childIds) {
        const childEntity = schema.entities[childId]
        const childLabel =
          (childEntity?.attributes?.label as string | undefined) ?? childId
        labelled[childLabel] = instance[childId]
      }

      return labelled
    })
  }

  return expanded
}
