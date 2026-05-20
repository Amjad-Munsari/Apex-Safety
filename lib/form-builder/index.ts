import { createBuilder } from "@coltorapps/builder";
import type { Schema } from "@coltorapps/builder";
import { textFieldEntity } from "./entities/text-field";
import { numberFieldEntity } from "./entities/number-field";
import { dateFieldEntity } from "./entities/date-field";
import { selectFieldEntity } from "./entities/select-field";
import { textareaFieldEntity } from "./entities/textarea-field";
import { checkboxFieldEntity } from "./entities/checkbox-field";
import { sectionGroupEntity } from "./entities/section-group";

export const formBuilder = createBuilder({
  entities: [
    textFieldEntity,
    numberFieldEntity,
    dateFieldEntity,
    selectFieldEntity,
    textareaFieldEntity,
    checkboxFieldEntity,
    sectionGroupEntity,
  ],
});

export type FormBuilderSchema = Schema<typeof formBuilder>;
