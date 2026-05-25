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
