import { createAttribute } from "@coltorapps/builder";

export const maxRatingAttribute = createAttribute({
  name: "maxRating",
  validate(value) {
    if (value === undefined || value === null) {
      return 5; // Default max rating
    }
    const n = Number(value);
    if (!Number.isInteger(n) || n < 1) {
      throw new Error("Max rating must be a positive integer.");
    }
    return n;
  },
});
