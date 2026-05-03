import { describe, it, expect } from "vitest";
import { hasStructuralChanges } from "./schema-diff";
import type { FormSchema } from "@/lib/types/form-builder";

const baseSchema: FormSchema = {
  fields: [
    { id: "f1", key: "name", type: "text", label: "Name", required: true },
    { id: "f2", key: "site", type: "dropdown", label: "Site", required: false,
      options: [{ label: "A", value: "a" }] },
  ],
};

describe("hasStructuralChanges", () => {
  it("returns false for identical schemas", () => {
    expect(hasStructuralChanges(baseSchema, baseSchema)).toBe(false);
  });

  it("returns false for a deep clone with same content", () => {
    const clone = JSON.parse(JSON.stringify(baseSchema));
    expect(hasStructuralChanges(baseSchema, clone)).toBe(false);
  });

  it("returns true when a field is added", () => {
    const next: FormSchema = {
      fields: [...baseSchema.fields,
        { id: "f3", key: "extra", type: "text", label: "Extra", required: false }],
    };
    expect(hasStructuralChanges(baseSchema, next)).toBe(true);
  });

  it("returns true when a field is removed", () => {
    const next: FormSchema = { fields: [baseSchema.fields[0]] };
    expect(hasStructuralChanges(baseSchema, next)).toBe(true);
  });

  it("returns true when fields are reordered", () => {
    const next: FormSchema = {
      fields: [baseSchema.fields[1], baseSchema.fields[0]],
    };
    expect(hasStructuralChanges(baseSchema, next)).toBe(true);
  });

  it("returns true when a field type changes", () => {
    const next: FormSchema = {
      fields: [
        { ...baseSchema.fields[0], type: "textarea" },
        baseSchema.fields[1],
      ],
    };
    expect(hasStructuralChanges(baseSchema, next)).toBe(true);
  });

  it("returns true when a label changes", () => {
    const next: FormSchema = {
      fields: [
        { ...baseSchema.fields[0], label: "Full Name" },
        baseSchema.fields[1],
      ],
    };
    expect(hasStructuralChanges(baseSchema, next)).toBe(true);
  });

  it("returns true when a required flag flips", () => {
    const next: FormSchema = {
      fields: [
        { ...baseSchema.fields[0], required: false },
        baseSchema.fields[1],
      ],
    };
    expect(hasStructuralChanges(baseSchema, next)).toBe(true);
  });

  it("returns true when dropdown options change", () => {
    const next: FormSchema = {
      fields: [
        baseSchema.fields[0],
        { ...baseSchema.fields[1], options: [{ label: "B", value: "b" }] },
      ],
    };
    expect(hasStructuralChanges(baseSchema, next)).toBe(true);
  });

  it("returns true when a field key changes (answer column rename)", () => {
    const next: FormSchema = {
      fields: [
        { ...baseSchema.fields[0], key: "full_name" },
        baseSchema.fields[1],
      ],
    };
    expect(hasStructuralChanges(baseSchema, next)).toBe(true);
  });

  it("returns false when only ignored presentation fields differ", () => {
    const next: FormSchema = {
      fields: [
        { ...baseSchema.fields[0], helpText: "Enter your full legal name", placeholder: "Jane Doe" },
        { ...baseSchema.fields[1], maxPhotos: 10, maxRating: 7 },
      ],
    };
    expect(hasStructuralChanges(baseSchema, next)).toBe(false);
  });
});
