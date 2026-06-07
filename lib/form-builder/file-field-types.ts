/**
 * file-field-types — single source of truth for "file / photo upload" entity types.
 *
 * Product decision (BUG 3, 2026-06-07): photo / file-upload fields are EXEMPT
 * from blocking submission. A required photo field is treated as *recommended*,
 * not required — it must never gate the "Submit assessment" button, the
 * completion-progress denominator, or the submit-time validators (client or
 * server). All other required-field validation stays intact.
 *
 * Form templates are dynamic and customer-ownable (see AGENTS.md — form builder),
 * so the exemption is keyed on the field TYPE, not on any one template's field id.
 * Add any future file-upload entity type here (e.g. a single-file/document field)
 * and every required-gate call site picks it up automatically.
 */

/** Entity types whose `required` attribute is downgraded to "recommended". */
export const FILE_FIELD_TYPES = new Set<string>(["multiPhotoField"]);

/** True when `type` is a file/photo-upload field exempt from required-gating. */
export function isFileFieldType(type: string | undefined | null): boolean {
  return type != null && FILE_FIELD_TYPES.has(type);
}
