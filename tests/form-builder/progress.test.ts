/**
 * tests/form-builder/progress.test.ts
 *
 * Tests for computeFormProgress — the completion-percentage helper for the
 * assessment fill flow's progress bar.
 *
 * Regression context: Plan 13-03's interpreter cutover (commit e047a9e) left
 * AssessmentFormHeader wired to a hardcoded progress={0}. computeFormProgress
 * derives the real percentage from the interpreter store's entity values.
 *
 * "Complete" means "ready to submit" — so progress is measured against the
 * REQUIRED fields only. Optional fields never affect the percentage; a form
 * reaches 100% exactly when validation would let it submit.
 *
 * Phase 14 extension:
 * - repeatingSection with minInstances > 0 counts as required
 * - geolocationField {lat,lng,...} object is recognised as "filled"
 * - computedField (no requiredAttribute) never blocks progress
 */
import { describe, it, expect } from "vitest";
import { computeFormProgress } from "@/lib/form-builder/progress";

// Real UUIDs (coltorapps requires v1-5 + variant [89ab]) — mirrors validate-values.test.ts
const REQ_TEXT_ID = "51324b32-adc3-4d17-a90e-66b5453935bd";
const REQ_SELECT_ID = "f1e2d3c4-b5a6-4987-8765-432109876543";
const REQ_CHECKBOX_ID = "fedcba98-7654-4321-abcd-ef0123456789";
const OPT_NUMBER_ID = "d5ae8682-156c-4511-b972-98c6c3b7c41b";
const OPT_DATE_ID = "a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5";
const OPT_TEXTAREA_ID = "abcdef01-2345-4678-9abc-def012345678";
const SECTION_ID = "12345678-90ab-4cde-8f01-234567890abc";

// Phase 14 UUIDs
const REP_SECTION_ID = "a7b8c9d0-e1f2-4345-a678-90abcdef0123";
const CHILD_REQ_ID = "b8c9d0e1-f2a3-4456-b789-01bcdef01234";
const CHILD_OPT_ID = "c9d0e1f2-a3b4-4567-c890-12cdef012345";
const GEO_REQ_ID = "d0e1f2a3-b4c5-4678-d901-23def0123456";
const GEO_OPT_ID = "e1f2a3b4-c5d6-4789-e012-34ef01234567";
const COMPUTED_ID = "f2a3b4c5-d6e7-4890-f123-45f012345678";

// 3 required + 3 optional value-bearing fields + 1 sectionGroup
const schema = {
  entities: {
    [REQ_TEXT_ID]: { type: "textField", attributes: { label: "Name", required: true } },
    [REQ_SELECT_ID]: { type: "selectField", attributes: { label: "Risk", required: true } },
    [REQ_CHECKBOX_ID]: { type: "checkboxField", attributes: { label: "Confirmed", required: true } },
    [OPT_NUMBER_ID]: { type: "numberField", attributes: { label: "Age", required: false } },
    [OPT_DATE_ID]: { type: "dateField", attributes: { label: "Date", required: false } },
    [OPT_TEXTAREA_ID]: { type: "textareaField", attributes: { label: "Notes", required: false } },
    [SECTION_ID]: { type: "sectionGroup", attributes: { title: "Header" } },
  },
  root: [REQ_TEXT_ID, REQ_SELECT_ID, REQ_CHECKBOX_ID, OPT_NUMBER_ID, OPT_DATE_ID, OPT_TEXTAREA_ID, SECTION_ID],
};

describe("computeFormProgress", () => {
  it("returns 0 when no required fields are filled", () => {
    expect(computeFormProgress(schema, {})).toBe(0);
  });

  it("returns 100 when all required fields are filled, even with optional fields blank", () => {
    const values = {
      [REQ_TEXT_ID]: "Jane",
      [REQ_SELECT_ID]: "low",
      [REQ_CHECKBOX_ID]: true,
      // optional number / date / textarea left blank
    };
    expect(computeFormProgress(schema, values)).toBe(100);
  });

  it("ignores optional fields — filling only optional fields leaves progress at 0", () => {
    const values = {
      [OPT_NUMBER_ID]: 42,
      [OPT_DATE_ID]: "2026-05-21",
      [OPT_TEXTAREA_ID]: "some notes",
    };
    expect(computeFormProgress(schema, values)).toBe(0);
  });

  it("counts required fields proportionally (2 of 3 → 67)", () => {
    const values = {
      [REQ_TEXT_ID]: "Jane",
      [REQ_SELECT_ID]: "low",
    };
    expect(computeFormProgress(schema, values)).toBe(67);
  });

  it("returns 100 when the schema has no required fields", () => {
    const allOptional = {
      entities: {
        [OPT_NUMBER_ID]: { type: "numberField", attributes: { label: "Age", required: false } },
        [SECTION_ID]: { type: "sectionGroup", attributes: { title: "Header" } },
      },
      root: [OPT_NUMBER_ID, SECTION_ID],
    };
    expect(computeFormProgress(allOptional, {})).toBe(100);
  });

  it("treats empty string, empty array, false and null as not filled", () => {
    const values = {
      [REQ_TEXT_ID]: "   ",
      [REQ_SELECT_ID]: [],
      [REQ_CHECKBOX_ID]: false,
    };
    expect(computeFormProgress(schema, values)).toBe(0);
  });

  it("treats the number 0 as a filled value", () => {
    const numberRequired = {
      entities: {
        [OPT_NUMBER_ID]: { type: "numberField", attributes: { label: "Count", required: true } },
      },
      root: [OPT_NUMBER_ID],
    };
    expect(computeFormProgress(numberRequired, { [OPT_NUMBER_ID]: 0 })).toBe(100);
  });
});

// ============================================================
// Phase 14 extension tests — repeatingSection progress
// ============================================================

describe("computeFormProgress — repeatingSection", () => {
  it("repeatingSection with minInstances = 0 is not required — returns 100", () => {
    const s = {
      entities: {
        [REP_SECTION_ID]: {
          type: "repeatingSection",
          attributes: { title: "Items", minInstances: 0 },
          children: [],
        },
      },
      root: [REP_SECTION_ID],
    };
    expect(computeFormProgress(s, {})).toBe(100);
  });

  it("repeatingSection with minInstances = 2, value undefined → 0 (required but not filled)", () => {
    const s = {
      entities: {
        [REP_SECTION_ID]: {
          type: "repeatingSection",
          attributes: { title: "Items", minInstances: 2 },
          children: [],
        },
      },
      root: [REP_SECTION_ID],
    };
    expect(computeFormProgress(s, {})).toBe(0);
  });

  it("repeatingSection minInstances = 2, value {instances: [{}]} (length 1 < min) → 0", () => {
    const s = {
      entities: {
        [REP_SECTION_ID]: {
          type: "repeatingSection",
          attributes: { title: "Items", minInstances: 2 },
          children: [],
        },
      },
      root: [REP_SECTION_ID],
    };
    expect(computeFormProgress(s, { [REP_SECTION_ID]: { instances: [{}] } })).toBe(0);
  });

  it("repeatingSection minInstances = 2, value has 2 instances, no required children → 100", () => {
    const s = {
      entities: {
        [REP_SECTION_ID]: {
          type: "repeatingSection",
          attributes: { title: "Items", minInstances: 2 },
          children: [CHILD_OPT_ID],
        },
        [CHILD_OPT_ID]: { type: "textField", attributes: { label: "Note", required: false } },
      },
      root: [REP_SECTION_ID],
    };
    expect(computeFormProgress(s, {
      [REP_SECTION_ID]: { instances: [{}, {}] },
    })).toBe(100);
  });

  it("repeatingSection minInstances = 2, second instance missing required child → 0", () => {
    const s = {
      entities: {
        [REP_SECTION_ID]: {
          type: "repeatingSection",
          attributes: { title: "Items", minInstances: 2 },
          children: [CHILD_REQ_ID],
        },
        [CHILD_REQ_ID]: { type: "textField", attributes: { label: "Name", required: true } },
      },
      root: [REP_SECTION_ID],
    };
    expect(computeFormProgress(s, {
      [REP_SECTION_ID]: {
        instances: [
          { [CHILD_REQ_ID]: "filled" },
          { [CHILD_REQ_ID]: "" }, // empty — not filled
        ],
      },
    })).toBe(0);
  });

  it("repeatingSection minInstances = 2, both instances fill required child → 100", () => {
    const s = {
      entities: {
        [REP_SECTION_ID]: {
          type: "repeatingSection",
          attributes: { title: "Items", minInstances: 2 },
          children: [CHILD_REQ_ID],
        },
        [CHILD_REQ_ID]: { type: "textField", attributes: { label: "Name", required: true } },
      },
      root: [REP_SECTION_ID],
    };
    expect(computeFormProgress(s, {
      [REP_SECTION_ID]: {
        instances: [
          { [CHILD_REQ_ID]: "Alice" },
          { [CHILD_REQ_ID]: "Bob" },
        ],
      },
    })).toBe(100);
  });
});

// ============================================================
// Phase 14 extension tests — geolocationField isFilled
// ============================================================

describe("computeFormProgress — geolocationField isFilled", () => {
  it("geolocationField required, value undefined → 0", () => {
    const s = {
      entities: {
        [GEO_REQ_ID]: {
          type: "geolocationField",
          attributes: { label: "Location", required: true },
        },
      },
      root: [GEO_REQ_ID],
    };
    expect(computeFormProgress(s, {})).toBe(0);
  });

  it("geolocationField required, valid {lat,lng,...} value → 100 (isFilled recognises lat+lng object)", () => {
    const s = {
      entities: {
        [GEO_REQ_ID]: {
          type: "geolocationField",
          attributes: { label: "Location", required: true },
        },
      },
      root: [GEO_REQ_ID],
    };
    expect(computeFormProgress(s, {
      [GEO_REQ_ID]: { lat: 51.5, lng: -0.1, accuracy: 10, capturedAt: "2026-01-01T12:00:00Z" },
    })).toBe(100);
  });
});

// ============================================================
// Phase 14 extension tests — computedField does NOT affect progress
// ============================================================

describe("computeFormProgress — computedField does not affect progress", () => {
  /**
   * Contract per UI-SPEC §computedField-specific:
   * computedField has NO requiredAttribute, so attrs.required is always undefined ≠ true.
   * The required-filter in computeFormProgress will never include computedField entities.
   * A form with only a computedField returns 100 (no required fields → immediately complete).
   */
  it("computedField in schema does not affect percentage (no requiredAttribute)", () => {
    const s = {
      entities: {
        [REQ_TEXT_ID]: { type: "textField", attributes: { label: "Name", required: true } },
        [COMPUTED_ID]: {
          type: "computedField",
          // No requiredAttribute — attrs.required is undefined
          attributes: { label: "Risk Level", formula: "pas79" },
        },
      },
      root: [REQ_TEXT_ID, COMPUTED_ID],
    };
    // With text field empty: 0% (only the required textField counts)
    expect(computeFormProgress(s, {})).toBe(0);
    // With text field filled: 100% (computedField never blocks)
    expect(computeFormProgress(s, { [REQ_TEXT_ID]: "Alice" })).toBe(100);
  });
});

// ============================================================
// Phase 14 extension tests — mixed schema
// ============================================================

describe("computeFormProgress — mixed schema with repeatingSection", () => {
  it("1 required text + repeatingSection(minInstances=1, 1 instance) + optional select → 100%", () => {
    const s = {
      entities: {
        [REQ_TEXT_ID]: { type: "textField", attributes: { label: "Name", required: true } },
        [REP_SECTION_ID]: {
          type: "repeatingSection",
          attributes: { title: "Doors", minInstances: 1 },
          children: [],
        },
        [OPT_NUMBER_ID]: { type: "numberField", attributes: { label: "Count", required: false } },
      },
      root: [REQ_TEXT_ID, REP_SECTION_ID, OPT_NUMBER_ID],
    };
    expect(computeFormProgress(s, {
      [REQ_TEXT_ID]: "Jane",
      [REP_SECTION_ID]: { instances: [{}] },
    })).toBe(100);
  });

  it("same mixed schema — 0 instances in repeatingSection → 50%", () => {
    const s = {
      entities: {
        [REQ_TEXT_ID]: { type: "textField", attributes: { label: "Name", required: true } },
        [REP_SECTION_ID]: {
          type: "repeatingSection",
          attributes: { title: "Doors", minInstances: 1 },
          children: [],
        },
        [OPT_NUMBER_ID]: { type: "numberField", attributes: { label: "Count", required: false } },
      },
      root: [REQ_TEXT_ID, REP_SECTION_ID, OPT_NUMBER_ID],
    };
    expect(computeFormProgress(s, {
      [REQ_TEXT_ID]: "Jane",
      [REP_SECTION_ID]: { instances: [] }, // below minInstances
    })).toBe(50);
  });
});
