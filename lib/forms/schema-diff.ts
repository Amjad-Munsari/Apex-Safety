import type { FormBuilderSchema } from "@/lib/form-builder";

/**
 * Returns true if `next` differs structurally from `original`.
 *
 * For coltorapps schemas ({ entities, root }), structural change means:
 * - Different number of entities in root (field added or removed)
 * - Different root order (field reordered)
 * - Any entity's type changed
 * - Any entity's label attribute changed
 * - Any entity's required attribute changed
 * - selectField options changed
 *
 * Used by the `forkOnFill` server action (Phase 16) to decide whether a
 * customer's edits to a master template warrant creating a forked record.
 *
 * Presentation-only edits (placeholder, helpText) do NOT trigger a fork.
 *
 * Contract preserved per AGENTS.md "Form template ownership" decision (2026-04-17).
 */
export function hasStructuralChanges(
  original: FormBuilderSchema,
  next: FormBuilderSchema
): boolean {
  const origRoot = original.root ?? [];
  const nextRoot = next.root ?? [];

  if (origRoot.length !== nextRoot.length) return true;

  for (let i = 0; i < origRoot.length; i++) {
    const origId = origRoot[i] as string;
    const nextId = nextRoot[i] as string;

    // Different entity ID at same position = reorder or replacement
    if (origId !== nextId) return true;

    const origEntity = (original.entities as Record<string, { type: string; attributes: Record<string, unknown> }>)[origId];
    const nextEntity = (next.entities as Record<string, { type: string; attributes: Record<string, unknown> }>)[nextId];

    if (!origEntity || !nextEntity) return true;

    // Type change
    if (origEntity.type !== nextEntity.type) return true;

    // Label change
    if (origEntity.attributes.label !== nextEntity.attributes.label) return true;

    // Required flag change
    const origRequired = Boolean(origEntity.attributes.required ?? false);
    const nextRequired = Boolean(nextEntity.attributes.required ?? false);
    if (origRequired !== nextRequired) return true;

    // Options change (for selectField)
    if (origEntity.type === "selectField") {
      if (!optionsEqual(
        origEntity.attributes.options as FieldOption[] | undefined,
        nextEntity.attributes.options as FieldOption[] | undefined
      )) return true;
    }
  }

  return false;
}

interface FieldOption {
  label: string;
  value: string;
}

function optionsEqual(
  a: FieldOption[] | undefined,
  b: FieldOption[] | undefined
): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].label !== b[i].label || a[i].value !== b[i].value) return false;
  }
  return true;
}
