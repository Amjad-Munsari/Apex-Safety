import { createAttribute } from "@coltorapps/builder";

const VALID_PREFILL_SOURCES = ["", "currentUserName", "currentDate", "none"] as const;
type PrefillSource = (typeof VALID_PREFILL_SOURCES)[number];

export const prefillSourceAttribute = createAttribute({
  name: "prefillSource",
  validate(value) {
    if (value === undefined || value === null) {
      return "" as PrefillSource;
    }
    if (!VALID_PREFILL_SOURCES.includes(value as PrefillSource)) {
      throw new Error(
        `Invalid prefill source "${value}". Must be one of: ${VALID_PREFILL_SOURCES.map((s) => `"${s}"`).join(", ")}.`
      );
    }
    return value as PrefillSource;
  },
});
