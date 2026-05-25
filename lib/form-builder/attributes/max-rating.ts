import { createAttribute } from "@coltorapps/builder";

// maxRating integer attribute for ratingField.
// Controls the upper bound of the star/numeric rating scale.
// Range: [2, 10] per UI-SPEC §"ratingField-specific". Default 5.
// ALWAYS coerce undefined → 5 (Phase 13 RESEARCH Pitfall 4).
export const maxRatingAttribute = createAttribute({
  name: "maxRating",
  validate(value) {
    if (value === undefined || value === null) {
      return 5;
    }
    const n = Number(value);
    if (!Number.isInteger(n) || n < 2 || n > 10) {
      throw new Error("maxRating must be a whole number between 2 and 10.");
    }
    return n;
  },
});
