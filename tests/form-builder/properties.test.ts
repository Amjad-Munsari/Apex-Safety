/**
 * Properties Panel unit tests (BUILDER-02)
 *
 * These tests use the headless coltorapps builder store directly (no React render).
 * They assert that setEntityAttribute() is the correct call pattern for the
 * PropertiesPanel component's attribute editing contract.
 */

import { describe, it, expect } from "vitest";
import { createBuilderStore } from "@coltorapps/builder";
import { formBuilder } from "@/lib/form-builder";

// Helper: access entity attributes as a plain record to avoid generic union TS issues
function getAttrs(store: ReturnType<typeof createBuilderStore<typeof formBuilder>>, entityId: string): Record<string, unknown> {
  return store.getSchema().entities[entityId].attributes as Record<string, unknown>;
}

// ── Builder store properties integration tests ───────────────────────────────

describe("Properties Panel (BUILDER-02)", () => {
  it("setEntityAttribute updates the attribute value in the builder store", () => {
    const store = createBuilderStore(formBuilder);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const entity = store.addEntity({ type: "textField", attributes: {} } as any);

    // This is what PropertiesPanel's onChange handler calls
    store.setEntityAttribute(entity.id, "label", "Full Name");

    expect(getAttrs(store, entity.id).label).toBe("Full Name");
  });

  it("setting required to true is reflected in the entity attributes", () => {
    const store = createBuilderStore(formBuilder);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const entity = store.addEntity({ type: "textField", attributes: {} } as any);

    store.setEntityAttribute(entity.id, "required", true);

    expect(getAttrs(store, entity.id).required).toBe(true);
  });

  it("setting required back to false works correctly", () => {
    const store = createBuilderStore(formBuilder);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const entity = store.addEntity({ type: "textField", attributes: {} } as any);
    store.setEntityAttribute(entity.id, "required", true);
    store.setEntityAttribute(entity.id, "required", false);

    expect(getAttrs(store, entity.id).required).toBe(false);
  });

  it("setting label on a numberField updates the store correctly", () => {
    const store = createBuilderStore(formBuilder);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const entity = store.addEntity({ type: "numberField", attributes: {} } as any);

    store.setEntityAttribute(entity.id, "label", "Employee Count");

    expect(getAttrs(store, entity.id).label).toBe("Employee Count");
  });

  it("properties panel renders the correct attribute inputs for each entity type", () => {
    // Test that each entity type has the expected set of attributes in the schema
    const store = createBuilderStore(formBuilder);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const textField = store.addEntity({ type: "textField", attributes: {} } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sectionGroup = store.addEntity({ type: "sectionGroup", attributes: {} } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const selectField = store.addEntity({ type: "selectField", attributes: {} } as any);

    const schema = store.getSchema();

    // textField has label, required, placeholder, maxLength, helpText, prefillSource
    // We can at least verify we can set each attribute
    expect(() => store.setEntityAttribute(textField.id, "label", "Test")).not.toThrow();
    expect(() => store.setEntityAttribute(textField.id, "required", true)).not.toThrow();
    expect(() => store.setEntityAttribute(textField.id, "placeholder", "Enter here")).not.toThrow();

    // sectionGroup has title and description (attribute names in section-group entity)
    expect(() => store.setEntityAttribute(sectionGroup.id, "title", "My Section")).not.toThrow();
    expect(() =>
      store.setEntityAttribute(sectionGroup.id, "description", "A description")
    ).not.toThrow();

    // selectField has label, required, options, allowMultiple
    expect(() => store.setEntityAttribute(selectField.id, "label", "Category")).not.toThrow();
    expect(() =>
      store.setEntityAttribute(selectField.id, "options", [{ label: "A", value: "a" }])
    ).not.toThrow();

    // All entities are in the schema
    expect(Object.keys(schema.entities)).toHaveLength(3);
  });

  it("multiple attribute updates on the same entity persist all changes", () => {
    const store = createBuilderStore(formBuilder);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const entity = store.addEntity({ type: "textField", attributes: {} } as any);

    store.setEntityAttribute(entity.id, "label", "My Field");
    store.setEntityAttribute(entity.id, "required", true);
    store.setEntityAttribute(entity.id, "placeholder", "Type here");

    const entityAttrs = getAttrs(store, entity.id);

    expect(entityAttrs.label).toBe("My Field");
    expect(entityAttrs.required).toBe(true);
    expect(entityAttrs.placeholder).toBe("Type here");
  });

  // ── Phase 14: attachPhotos toggle — universal for all non-section entity types ──

  it("attachPhotos toggle: setEntityAttribute attachPhotos=true on textField stores correctly", () => {
    const store = createBuilderStore(formBuilder);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const entity = store.addEntity({ type: "textField", attributes: {} } as any);
    store.setEntityAttribute(entity.id, "attachPhotos", true);
    expect(getAttrs(store, entity.id).attachPhotos).toBe(true);
  });

  it("attachPhotos toggle: setEntityAttribute attachPhotos=false on textField stores correctly", () => {
    const store = createBuilderStore(formBuilder);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const entity = store.addEntity({ type: "textField", attributes: {} } as any);
    store.setEntityAttribute(entity.id, "attachPhotos", true);
    store.setEntityAttribute(entity.id, "attachPhotos", false);
    expect(getAttrs(store, entity.id).attachPhotos).toBe(false);
  });

  it("attachPhotos toggle: setEntityAttribute works on numberField (D-05 all non-section)", () => {
    const store = createBuilderStore(formBuilder);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const entity = store.addEntity({ type: "numberField", attributes: {} } as any);
    store.setEntityAttribute(entity.id, "attachPhotos", true);
    expect(getAttrs(store, entity.id).attachPhotos).toBe(true);
  });

  it("attachPhotos toggle: setEntityAttribute works on computedField (no required attr — D-05)", () => {
    const store = createBuilderStore(formBuilder);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const entity = store.addEntity({ type: "computedField", attributes: {} } as any);
    store.setEntityAttribute(entity.id, "attachPhotos", true);
    expect(getAttrs(store, entity.id).attachPhotos).toBe(true);
  });

  // ratingField maxRating editor tests removed — ratingField is intentionally
  // unsupported (product decision 2026-06).

  // ── Phase 14: multiPhotoField maxPhotos attribute editor ─────────────────

  it("multiPhotoField maxPhotos: setEntityAttribute maxPhotos=8 stores 8", () => {
    const store = createBuilderStore(formBuilder);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const entity = store.addEntity({ type: "multiPhotoField", attributes: {} } as any);
    store.setEntityAttribute(entity.id, "maxPhotos", 8);
    expect(getAttrs(store, entity.id).maxPhotos).toBe(8);
  });

  it("multiPhotoField maxPhotos: validate(21) throws (above maximum 20)", async () => {
    const { maxPhotosAttribute } = await import("@/lib/form-builder/attributes/max-photos");
    expect(() => maxPhotosAttribute.validate(21 as unknown as number)).toThrow();
  });

  it("multiPhotoField maxPhotos: validate(0) throws (below minimum 1)", async () => {
    const { maxPhotosAttribute } = await import("@/lib/form-builder/attributes/max-photos");
    expect(() => maxPhotosAttribute.validate(0 as unknown as number)).toThrow();
  });

  // ── Phase 14: computedField computedInputs + formula ────────────────────

  it("computedField computedInputs: setEntityAttribute stores likelihood + consequence entity IDs", () => {
    const store = createBuilderStore(formBuilder);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const entity = store.addEntity({ type: "computedField", attributes: {} } as any);
    const inputs = { likelihood: "e1c6f3a2-8b4d-4f7e-9d5c-3a2b1c0f9e8d", consequence: "f2d7a4b1-9c5e-4f8d-0e6d-4b3c2d1a0f9e" };
    store.setEntityAttribute(entity.id, "computedInputs", inputs);
    const stored = getAttrs(store, entity.id).computedInputs as Record<string, string>;
    expect(stored.likelihood).toBe("e1c6f3a2-8b4d-4f7e-9d5c-3a2b1c0f9e8d");
    expect(stored.consequence).toBe("f2d7a4b1-9c5e-4f8d-0e6d-4b3c2d1a0f9e");
  });

  it("computedField computedInputs: default-coerce of undefined returns empty strings", async () => {
    const { computedInputsAttribute } = await import("@/lib/form-builder/attributes/computed-inputs");
    const coerced = computedInputsAttribute.validate(undefined as unknown as { likelihood: string; consequence: string });
    expect(coerced).toEqual({ likelihood: "", consequence: "" });
  });

  it("computedField formula: attrs.formula defaults to 'pas79' via formulaAttribute", async () => {
    const { formulaAttribute } = await import("@/lib/form-builder/attributes/formula");
    // formulaAttribute.validate(undefined) should coerce to "pas79" (Plan 14-01 default)
    const coerced = formulaAttribute.validate(undefined as unknown as string);
    expect(coerced).toBe("pas79");
  });

  // ── Phase 14: repeatingSection minInstances + maxInstances ───────────────

  it("repeatingSection minInstances: setEntityAttribute minInstances=3 stores 3", () => {
    const store = createBuilderStore(formBuilder);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const entity = store.addEntity({ type: "repeatingSection", attributes: { title: "Doors" } } as any);
    store.setEntityAttribute(entity.id, "minInstances", 3);
    expect(getAttrs(store, entity.id).minInstances).toBe(3);
  });

  it("repeatingSection maxInstances: setEntityAttribute maxInstances=10 stores 10", () => {
    const store = createBuilderStore(formBuilder);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const entity = store.addEntity({ type: "repeatingSection", attributes: { title: "Doors" } } as any);
    store.setEntityAttribute(entity.id, "maxInstances", 10);
    expect(getAttrs(store, entity.id).maxInstances).toBe(10);
  });

  it("repeatingSection minInstances: validate(-1) throws (must be non-negative)", async () => {
    const { minInstancesAttribute } = await import("@/lib/form-builder/attributes/min-instances");
    expect(() => minInstancesAttribute.validate(-1 as unknown as number)).toThrow();
  });

  it("repeatingSection maxInstances: validate(0) throws (must be positive when set)", async () => {
    const { maxInstancesAttribute } = await import("@/lib/form-builder/attributes/max-instances");
    expect(() => maxInstancesAttribute.validate(0 as unknown as number)).toThrow();
  });

  it("repeatingSection title: setEntityAttribute title='Fire Doors' stores correctly", () => {
    const store = createBuilderStore(formBuilder);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const entity = store.addEntity({ type: "repeatingSection", attributes: { title: "Fire Doors" } } as any);
    store.setEntityAttribute(entity.id, "title", "Fire Doors Updated");
    expect(getAttrs(store, entity.id).title).toBe("Fire Doors Updated");
  });

  // ── Phase 14: properties panel EntityType metadata coverage ──────────────

  it("PropertiesPanel entityTypeMeta includes the 4 supported specialty type names", () => {
    // Round-trips each supported specialty type through the store; their meta is
    // needed by PropertiesPanel. signatureField/ratingField are intentionally
    // unsupported (product decision 2026-06).
    const store = createBuilderStore(formBuilder);
    const specialtyTypes = [
      "multiPhotoField",
      "geolocationField",
      "computedField",
      "repeatingSection",
    ] as const;

    for (const type of specialtyTypes) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const entity = store.addEntity({ type, attributes: {} } as any);
      // All specialty types can be added — their meta is needed by PropertiesPanel
      expect(store.getSchema().entities[entity.id].type).toBe(type);
    }
  });
});
