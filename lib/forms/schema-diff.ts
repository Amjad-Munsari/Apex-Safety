import type { FormSchema, FormField } from "@/lib/types/form-builder";

/**
 * Returns true if `next` differs structurally from `original`. Compares field
 * identity (id + order), type, label, required flag, and options list. Used
 * by the `forkOnFill` server action to decide whether a customer's edits to
 * a master template warrant creating a forked template record.
 *
 * NOT compared: helpText, placeholder, maxPhotos, maxRating — these are
 * presentation-only and editing them shouldn't trigger a fork. Adjust if
 * the Finley contract changes.
 */
export function hasStructuralChanges(original: FormSchema, next: FormSchema): boolean {
  if (original.fields.length !== next.fields.length) return true;
  for (let i = 0; i < original.fields.length; i++) {
    if (fieldDiffers(original.fields[i], next.fields[i])) return true;
  }
  return false;
}

function fieldDiffers(a: FormField, b: FormField): boolean {
  if (a.id !== b.id) return true;
  if (a.type !== b.type) return true;
  if (a.label !== b.label) return true;
  if (Boolean(a.required) !== Boolean(b.required)) return true;
  if (!optionsEqual(a.options, b.options)) return true;
  return false;
}

function optionsEqual(
  a: FormField["options"] | undefined,
  b: FormField["options"] | undefined
): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].label !== b[i].label || a[i].value !== b[i].value) return false;
  }
  return true;
}
