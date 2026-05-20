import { describe, it, expect } from "vitest";
import { hasStructuralChanges } from "./schema-diff";
import type { FormBuilderSchema } from "@/lib/form-builder";

// Minimal coltorapps-shaped schema for testing hasStructuralChanges
const ID_1 = "51324b32-adc3-4d17-a90e-66b5453935bd";
const ID_2 = "d5ae8682-156c-4511-b972-98c6c3b7c41b";
const ID_3 = "a1b2c3d4-e5f6-4789-8abc-def012345678";

const baseSchema: FormBuilderSchema = {
  entities: {
    [ID_1]: { type: "textField", attributes: { label: "Name", required: true } },
    [ID_2]: { type: "selectField", attributes: { label: "Site", required: false, options: [{ label: "A", value: "a" }], allowMultiple: false } },
  },
  root: [ID_1, ID_2],
} as unknown as FormBuilderSchema;

describe("hasStructuralChanges", () => {
  it("returns false for identical schemas", () => {
    expect(hasStructuralChanges(baseSchema, baseSchema)).toBe(false);
  });

  it("returns false for a deep clone with same content", () => {
    const clone = JSON.parse(JSON.stringify(baseSchema)) as FormBuilderSchema;
    expect(hasStructuralChanges(baseSchema, clone)).toBe(false);
  });

  it("returns true when a field is added", () => {
    const next = {
      entities: {
        ...baseSchema.entities,
        [ID_3]: { type: "textField", attributes: { label: "Extra", required: false } },
      },
      root: [ID_1, ID_2, ID_3],
    } as unknown as FormBuilderSchema;
    expect(hasStructuralChanges(baseSchema, next)).toBe(true);
  });

  it("returns true when a field is removed", () => {
    const next = {
      entities: { [ID_1]: (baseSchema.entities as Record<string, unknown>)[ID_1] },
      root: [ID_1],
    } as unknown as FormBuilderSchema;
    expect(hasStructuralChanges(baseSchema, next)).toBe(true);
  });

  it("returns true when fields are reordered", () => {
    const next = {
      ...baseSchema,
      root: [ID_2, ID_1],
    } as unknown as FormBuilderSchema;
    expect(hasStructuralChanges(baseSchema, next)).toBe(true);
  });

  it("returns true when a field type changes", () => {
    const next = {
      entities: {
        [ID_1]: { type: "textareaField", attributes: { label: "Name", required: true } },
        [ID_2]: (baseSchema.entities as Record<string, unknown>)[ID_2],
      },
      root: [ID_1, ID_2],
    } as unknown as FormBuilderSchema;
    expect(hasStructuralChanges(baseSchema, next)).toBe(true);
  });

  it("returns true when a label changes", () => {
    const next = {
      entities: {
        [ID_1]: { type: "textField", attributes: { label: "Full Name", required: true } },
        [ID_2]: (baseSchema.entities as Record<string, unknown>)[ID_2],
      },
      root: [ID_1, ID_2],
    } as unknown as FormBuilderSchema;
    expect(hasStructuralChanges(baseSchema, next)).toBe(true);
  });

  it("returns true when a required flag flips", () => {
    const next = {
      entities: {
        [ID_1]: { type: "textField", attributes: { label: "Name", required: false } },
        [ID_2]: (baseSchema.entities as Record<string, unknown>)[ID_2],
      },
      root: [ID_1, ID_2],
    } as unknown as FormBuilderSchema;
    expect(hasStructuralChanges(baseSchema, next)).toBe(true);
  });

  it("returns true when dropdown options change", () => {
    const next = {
      entities: {
        [ID_1]: (baseSchema.entities as Record<string, unknown>)[ID_1],
        [ID_2]: { type: "selectField", attributes: { label: "Site", required: false, options: [{ label: "B", value: "b" }], allowMultiple: false } },
      },
      root: [ID_1, ID_2],
    } as unknown as FormBuilderSchema;
    expect(hasStructuralChanges(baseSchema, next)).toBe(true);
  });

  it("returns false when only ignored presentation fields differ (placeholder, helpText)", () => {
    const next = {
      entities: {
        [ID_1]: { type: "textField", attributes: { label: "Name", required: true, placeholder: "Jane Doe", helpText: "Enter your full legal name" } },
        [ID_2]: (baseSchema.entities as Record<string, unknown>)[ID_2],
      },
      root: [ID_1, ID_2],
    } as unknown as FormBuilderSchema;
    expect(hasStructuralChanges(baseSchema, next)).toBe(false);
  });
});
