import { createAttribute } from "@coltorapps/builder";

// maxPhotos integer attribute for multiPhotoField.
// Controls the maximum number of photos the user can attach.
// Range: [1, 20] per UI-SPEC §"multiPhotoField-specific". Default 5.
// ALWAYS coerce undefined → 5 (Phase 13 RESEARCH Pitfall 4).
export const maxPhotosAttribute = createAttribute({
  name: "maxPhotos",
  validate(value) {
    if (value === undefined || value === null) {
      return 5;
    }
    const n = Number(value);
    if (!Number.isInteger(n) || n < 1 || n > 20) {
      throw new Error("maxPhotos must be a whole number between 1 and 20.");
    }
    return n;
  },
});
