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
});
