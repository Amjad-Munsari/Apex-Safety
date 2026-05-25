import { createAttribute } from "@coltorapps/builder";

export const maxPhotosAttribute = createAttribute({
  name: "maxPhotos",
  validate(value) {
    if (value === undefined || value === null) {
      return 5; // Default max photos
    }
    const n = Number(value);
    if (!Number.isInteger(n) || n < 1) {
      throw new Error("Max photos must be a positive integer.");
    }
    return n;
  },
});
