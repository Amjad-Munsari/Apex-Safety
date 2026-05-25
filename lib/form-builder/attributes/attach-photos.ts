import { createAttribute } from "@coltorapps/builder";

// D-05: attachPhotos boolean attribute, default false.
// Admin opts in via builder properties panel to show a photo attachment
// affordance below the field at fill time.
// ALWAYS coerce undefined → false (Phase 13 RESEARCH Pitfall 4).
export const attachPhotosAttribute = createAttribute({
  name: "attachPhotos",
  validate(value) {
    if (value === undefined || value === null) {
      return false;
    }
    return Boolean(value);
  },
});
