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
import { signatureFieldEntity } from "./entities/signature-field";
import { ratingFieldEntity } from "./entities/rating-field";
import { multiPhotoFieldEntity } from "./entities/multi-photo-field";
import { geolocationFieldEntity } from "./entities/geolocation-field";
import { computedFieldEntity } from "./entities/computed-field";
import { repeatingSectionEntity } from "./entities/repeating-section";

export const formBuilder = createBuilder({
  entities: [
    // 7 basic types (Phase 13)
    textFieldEntity,
    numberFieldEntity,
    dateFieldEntity,
    selectFieldEntity,
    textareaFieldEntity,
    checkboxFieldEntity,
    sectionGroupEntity,
    // 6 specialty types (Phase 14)
    signatureFieldEntity,
    ratingFieldEntity,
    multiPhotoFieldEntity,
    geolocationFieldEntity,
    computedFieldEntity,
    repeatingSectionEntity,
  ],
});

export type FormBuilderSchema = Schema<typeof formBuilder>;
