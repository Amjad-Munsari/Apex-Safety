/**
 * Default attributes for a newly-added builder entity.
 *
 * Both `label` (fields) and `title` (sections) are REQUIRED attributes that
 * throw on empty at save time (see attributes/label.ts, attributes/section-title.ts).
 * A freshly-dropped entity created with `{}` would carry an empty value and make
 * the whole template fail validation with a cryptic InvalidEntitiesAttributes.
 * Seeding a sensible placeholder keeps every new entity immediately valid; the
 * user just renames it.
 *
 * Used by every addEntity call site (palette add + duplicate) so the behaviour
 * is consistent across the admin and customer builder surfaces.
 */

// Friendly starting labels, mirroring the field-palette names.
const FIELD_LABELS: Record<string, string> = {
  textField: "Short Text",
  numberField: "Number",
  dateField: "Date",
  selectField: "Select",
  textareaField: "Long Text",
  checkboxField: "Checkbox",
  multiPhotoField: "Photos",
  geolocationField: "Location",
  computedField: "Computed",
};

export function defaultEntityAttributes(type: string): Record<string, unknown> {
  if (type === "sectionGroup") return { title: "Untitled Section" };
  if (type === "repeatingSection") return { title: "Untitled Repeating Section" };
  return { label: FIELD_LABELS[type] ?? "Untitled Field" };
}
