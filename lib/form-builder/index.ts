import { createBuilder } from "@coltorapps/builder";
import type { Schema } from "@coltorapps/builder";
import { textFieldEntity } from "./entities/text-field";
import { numberFieldEntity } from "./entities/number-field";
import { dateFieldEntity } from "./entities/date-field";
import { selectFieldEntity } from "./entities/select-field";
import { textareaFieldEntity } from "./entities/textarea-field";
import { checkboxFieldEntity } from "./entities/checkbox-field";
import { sectionGroupEntity } from "./entities/section-group";
// Phase 14 specialty entities — registered in UI-SPEC §"Palette Extension" order
import { multiPhotoFieldEntity } from "./entities/multi-photo-field";
import { geolocationFieldEntity } from "./entities/geolocation-field";
import { computedFieldEntity } from "./entities/computed-field";
import { repeatingSectionEntity } from "./entities/repeating-section";

const registeredEntities = [
  // 7 basic types (Phase 13)
  textFieldEntity,
  numberFieldEntity,
  dateFieldEntity,
  selectFieldEntity,
  textareaFieldEntity,
  checkboxFieldEntity,
  sectionGroupEntity,
  // specialty types (Phase 14) — signatureField + ratingField removed 2026-06-04
  multiPhotoFieldEntity,
  geolocationFieldEntity,
  computedFieldEntity,
  repeatingSectionEntity,
];

export const formBuilder = createBuilder({
  entities: registeredEntities,
});

/**
 * Entity type names currently registered. Used by sanitizeSchema to strip
 * entities of a type that's no longer registered (e.g. signatureField /
 * ratingField, removed 2026-06-04) so older schemas — including the seeded FRA —
 * still load instead of throwing "The provided entity type is unknown".
 */
export const KNOWN_ENTITY_TYPES: ReadonlySet<string> = new Set(
  registeredEntities.map((e) => e.name)
);

export type FormBuilderSchema = Schema<typeof formBuilder>;
