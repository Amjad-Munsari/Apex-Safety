import { createAttribute } from "@coltorapps/builder";

export const attachPhotosAttribute = createAttribute({
  name: "attachPhotos",
  validate(value) {
    if (value === undefined || value === null) {
      return false;
    }
    return Boolean(value);
  },
});
