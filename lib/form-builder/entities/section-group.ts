import { createEntity } from "@coltorapps/builder";
import { sectionTitleAttribute } from "../attributes/section-title";
import { sectionDescriptionAttribute } from "../attributes/section-description";
import { visibilityRulesAttribute } from "../attributes/visibility-rules";
import { makeShouldBeProcessed } from "../visibility/should-be-processed";

export const sectionGroupEntity = createEntity({
  name: "sectionGroup",
  attributes: [
    sectionTitleAttribute,
    sectionDescriptionAttribute,
    visibilityRulesAttribute,
  ],
  // childrenAllowed: true marks this as a container entity.
  // Without this flag, setEntityParent() will throw "Child is not allowed."
  childrenAllowed: true,
  validate(value) {
    // Container entity — children validate themselves.
    return value;
  },
  shouldBeProcessed: makeShouldBeProcessed(),
});
