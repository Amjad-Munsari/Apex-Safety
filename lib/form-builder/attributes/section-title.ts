import { createAttribute } from "@coltorapps/builder";

export const sectionTitleAttribute = createAttribute({
  name: "title",
  validate(value) {
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new Error("Section title is required.");
    }
    return value.trim();
  },
});
