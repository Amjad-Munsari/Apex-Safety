/**
 * tests/form-builder/audit-fixes.test.ts
 *
 * Coverage for the 2026-06-11 form-builder audit fixes that aren't already
 * covered by entities.test.ts / repeating-section.test.ts:
 *   #4  required select rejects an empty array
 *   #5  allowMultiple removed; selectField is single-select only
 *   #7  maxLength enforced in text + textarea validate()
 *   #8  minDate/maxDate enforced in date validate()
 *   #9  unit removed from numberField
 *   #1/#5/#9  sanitizeSchema strips dead attribute keys + reports removed entities
 *   #10 findRepeatingNestingViolations flags specialty types nested in a section
 */
import { describe, it, expect } from "vitest";

const ctx = (attributes: Record<string, unknown>) => ({ entity: { attributes } } as never);

describe("#7 maxLength — enforced in text/textarea validate()", () => {
  it("textField throws when value exceeds maxLength", async () => {
    const { textFieldEntity } = await import("@/lib/form-builder/entities/text-field");
    expect(() => textFieldEntity.validate("abcdef", ctx({ maxLength: 3, label: "Notes" }))).toThrow(
      /3 characters/
    );
    expect(textFieldEntity.validate("ab", ctx({ maxLength: 3 }))).toBe("ab");
  });
  it("textareaField throws when value exceeds maxLength", async () => {
    const { textareaFieldEntity } = await import("@/lib/form-builder/entities/textarea-field");
    expect(() => textareaFieldEntity.validate("abcdef", ctx({ maxLength: 3 }))).toThrow();
    expect(textareaFieldEntity.validate("abc", ctx({ maxLength: 3 }))).toBe("abc");
  });
  it("no cap when maxLength is unset", async () => {
    const { textFieldEntity } = await import("@/lib/form-builder/entities/text-field");
    expect(textFieldEntity.validate("a".repeat(9999), ctx({}))).toHaveLength(9999);
  });
});

describe("#8 date bounds — enforced in date validate()", () => {
  it("throws below minDate and above maxDate, passes within range", async () => {
    const { dateFieldEntity } = await import("@/lib/form-builder/entities/date-field");
    const bounds = ctx({ minDate: "2026-01-01", maxDate: "2026-12-31", label: "Inspection" });
    expect(() => dateFieldEntity.validate("2025-12-31", bounds)).toThrow(/on or after/);
    expect(() => dateFieldEntity.validate("2027-01-01", bounds)).toThrow(/on or before/);
    expect(dateFieldEntity.validate("2026-06-11", bounds)).toBe("2026-06-11");
  });
});

describe("#4/#5 select — single-select, empty array is empty", () => {
  it("required select rejects an empty array", async () => {
    const { selectFieldEntity } = await import("@/lib/form-builder/entities/select-field");
    expect(() =>
      selectFieldEntity.validate([], ctx({ required: true, options: [{ label: "A", value: "a" }] }))
    ).toThrow(/required/);
  });
  it("accepts a valid single value", async () => {
    const { selectFieldEntity } = await import("@/lib/form-builder/entities/select-field");
    expect(
      selectFieldEntity.validate("a", ctx({ required: true, options: [{ label: "A", value: "a" }] }))
    ).toBe("a");
  });
});

describe("#9 numberField — unit attribute removed", () => {
  it("does not declare a unit attribute", async () => {
    const { numberFieldEntity } = await import("@/lib/form-builder/entities/number-field");
    const names = numberFieldEntity.attributes.map((a: { name: string }) => a.name);
    expect(names).not.toContain("unit");
    expect(names).toContain("min");
    expect(names).toContain("max");
  });
});

describe("#5 selectField — allowMultiple attribute removed", () => {
  it("does not declare an allowMultiple attribute", async () => {
    const { selectFieldEntity } = await import("@/lib/form-builder/entities/select-field");
    const names = selectFieldEntity.attributes.map((a: { name: string }) => a.name);
    expect(names).not.toContain("allowMultiple");
    expect(names).toContain("options");
  });
});

describe("#1/#5/#9 sanitizeSchema — dead attr strip + removal report", () => {
  it("strips allowMultiple/unit and validates against coltorapps", async () => {
    const { sanitizeSchema } = await import("@/lib/form-builder/sanitize-schema");
    const { validateSchema, createBuilderStore } = await import("@coltorapps/builder");
    const { formBuilder } = await import("@/lib/form-builder/index");
    const store = createBuilderStore(formBuilder);
    const sel = store.addEntity({
      type: "selectField",
      attributes: { label: "S", required: false, options: [{ label: "A", value: "a" }] },
    } as never);
    const num = store.addEntity({ type: "numberField", attributes: { label: "N", required: false } } as never);
    const schema = JSON.parse(JSON.stringify(store.getSchema()));
    schema.entities[sel.id].attributes.allowMultiple = false;
    schema.entities[num.id].attributes.unit = "mm";

    const cleaned = sanitizeSchema(schema);
    expect(cleaned.entities[sel.id].attributes).not.toHaveProperty("allowMultiple");
    expect(cleaned.entities[num.id].attributes).not.toHaveProperty("unit");
    const result = await validateSchema(cleaned, formBuilder);
    expect(result.success).toBe(true);
  });

  it("reports entities dropped for unregistered type", async () => {
    const { sanitizeSchemaWithReport } = await import("@/lib/form-builder/sanitize-schema");
    const id = "00000000-0000-4000-8000-000000000001";
    const schema = {
      root: [id],
      entities: { [id]: { type: "signatureField", attributes: { label: "Sign" } } },
    } as never;
    const report = sanitizeSchemaWithReport(schema);
    expect(report.removedEntities).toEqual([{ id, type: "signatureField" }]);
    expect(report.schema.root).not.toContain(id);
  });
});

describe("#10 findRepeatingNestingViolations", () => {
  it("flags a computedField nested in a repeatingSection but not a textField", async () => {
    const { findRepeatingNestingViolations } = await import(
      "@/lib/form-builder/repeating-section-constraints"
    );
    const schema = {
      root: ["rep"],
      entities: {
        rep: { type: "repeatingSection", children: ["txt", "calc"] },
        txt: { type: "textField", parentId: "rep" },
        calc: { type: "computedField", parentId: "rep" },
      },
    };
    const violations = findRepeatingNestingViolations(schema as never);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({ childId: "calc", childType: "computedField", sectionId: "rep" });
  });
});
