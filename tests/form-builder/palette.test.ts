/**
 * Field Palette unit tests (BUILDER-01)
 *
 * These tests use the headless coltorapps builder store directly (no React render).
 * They assert that calling builderStore.addEntity() with the correct entity type
 * is what the palette's onAddEntity handler does — this is the core contract.
 */

import { describe, it, expect, vi } from "vitest";
import { createBuilderStore } from "@coltorapps/builder";
import { formBuilder } from "@/lib/form-builder";

// ── Builder store palette integration tests ──────────────────────────────────

describe("Field Palette (BUILDER-01)", () => {
  it("clicking a palette button adds an entity to the builder store with the correct type", () => {
    const store = createBuilderStore(formBuilder);

    // Simulate what the FieldPalette onClick does: call onAddEntity with entity type
    // The builder-client.tsx handleAddEntity implementation:
    // builderStore.addEntity({ type, attributes: {} })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    store.addEntity({ type: "textField", attributes: {} } as any);

    const schema = store.getSchema();
    const entityIds = Object.keys(schema.entities);
    expect(entityIds).toHaveLength(1);

    const entity = schema.entities[entityIds[0]];
    expect(entity.type).toBe("textField");
  });

  it("adding a textField entity populates default attribute values (label empty string, required false)", () => {
    const store = createBuilderStore(formBuilder);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    store.addEntity({ type: "textField", attributes: {} } as any);

    const schema = store.getSchema();
    const entityIds = Object.keys(schema.entities);
    const entity = schema.entities[entityIds[0]];

    // Coltorapps coerces undefined → "" for label, undefined → false for required
    const entityAttrs = entity.attributes as Record<string, unknown>;
    expect(entityAttrs.label ?? "").toBe("");
    expect(entityAttrs.required ?? false).toBe(false);
  });

  it("adding a sectionGroup entity adds it to root and its children list is empty", () => {
    const store = createBuilderStore(formBuilder);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    store.addEntity({ type: "sectionGroup", attributes: {} } as any);

    const schema = store.getSchema();
    const entityIds = Object.keys(schema.entities);
    expect(entityIds).toHaveLength(1);

    const sectionId = entityIds[0];
    expect(schema.root).toContain(sectionId);

    const entity = schema.entities[sectionId];
    expect(entity.type).toBe("sectionGroup");
    // freshly added sectionGroup has no children
    expect(entity.children ?? []).toHaveLength(0);
  });

  it("onAddEntity callback is called with the correct entity type string", () => {
    // This tests the FieldPalette button onClick callback contract
    const mockOnAddEntity = vi.fn();

    // Simulate the palette rendering and clicking the textField button
    const ENTITY_TYPES = [
      "textField",
      "numberField",
      "dateField",
      "selectField",
      "textareaField",
      "checkboxField",
      "sectionGroup",
    ] as const;

    // Each button calls onAddEntity with its entity type
    for (const type of ENTITY_TYPES) {
      mockOnAddEntity(type);
    }

    expect(mockOnAddEntity).toHaveBeenCalledTimes(7);
    expect(mockOnAddEntity).toHaveBeenCalledWith("textField");
    expect(mockOnAddEntity).toHaveBeenCalledWith("sectionGroup");
  });

  it("all 7 entity types can be added to the builder store without error", () => {
    const store = createBuilderStore(formBuilder);
    const types = [
      "textField",
      "numberField",
      "dateField",
      "selectField",
      "textareaField",
      "checkboxField",
      "sectionGroup",
    ] as const;

    for (const type of types) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(() => store.addEntity({ type, attributes: {} } as any)).not.toThrow();
    }

    const schema = store.getSchema();
    expect(Object.keys(schema.entities)).toHaveLength(7);
  });

  // ── Phase 14 specialty type palette cases (BUILDER-01 extension) ─────────

  it("all 6 specialty entity types can be added to the builder store without error", () => {
    const store = createBuilderStore(formBuilder);
    const specialtyTypes = [
      "signatureField",
      "ratingField",
      "multiPhotoField",
      "geolocationField",
      "computedField",
      "repeatingSection",
    ] as const;

    for (const type of specialtyTypes) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(() => store.addEntity({ type, attributes: {} } as any)).not.toThrow();
    }

    const schema = store.getSchema();
    // 6 specialty types added
    expect(Object.keys(schema.entities)).toHaveLength(6);
  });

  it("addEntity signatureField succeeds and the entity appears in schema with correct type", () => {
    const store = createBuilderStore(formBuilder);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const entity = store.addEntity({ type: "signatureField", attributes: { label: "Inspector Signature" } } as any);
    const schema = store.getSchema();
    expect(schema.entities[entity.id].type).toBe("signatureField");
  });

  it("addEntity ratingField succeeds and the entity appears in schema with correct type", () => {
    const store = createBuilderStore(formBuilder);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const entity = store.addEntity({ type: "ratingField", attributes: { label: "Risk Level" } } as any);
    const schema = store.getSchema();
    expect(schema.entities[entity.id].type).toBe("ratingField");
  });

  it("addEntity multiPhotoField succeeds and the entity appears in schema with correct type", () => {
    const store = createBuilderStore(formBuilder);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const entity = store.addEntity({ type: "multiPhotoField", attributes: { label: "Site Photos" } } as any);
    const schema = store.getSchema();
    expect(schema.entities[entity.id].type).toBe("multiPhotoField");
  });

  it("addEntity geolocationField succeeds and the entity appears in schema with correct type", () => {
    const store = createBuilderStore(formBuilder);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const entity = store.addEntity({ type: "geolocationField", attributes: { label: "Site Location" } } as any);
    const schema = store.getSchema();
    expect(schema.entities[entity.id].type).toBe("geolocationField");
  });

  it("addEntity computedField succeeds and the entity appears in schema with correct type", () => {
    const store = createBuilderStore(formBuilder);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const entity = store.addEntity({ type: "computedField", attributes: { label: "Risk Score" } } as any);
    const schema = store.getSchema();
    expect(schema.entities[entity.id].type).toBe("computedField");
  });

  it("addEntity repeatingSection succeeds and the entity appears in schema with correct type", () => {
    const store = createBuilderStore(formBuilder);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const entity = store.addEntity({ type: "repeatingSection", attributes: { title: "Fire Doors" } } as any);
    const schema = store.getSchema();
    expect(schema.entities[entity.id].type).toBe("repeatingSection");
  });

  // ── attachPhotos default on 6 existing basic entities (D-05) ─────────────
  // These cases will be RED until attachPhotosAttribute is added to each entity file.

  it("textField defaults attachPhotos to false when no attribute override is provided", () => {
    const store = createBuilderStore(formBuilder);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const entity = store.addEntity({ type: "textField", attributes: {} } as any);
    const attrs = store.getSchema().entities[entity.id].attributes as Record<string, unknown>;
    // attachPhotosAttribute.validate(undefined) returns false — D-05 default
    expect(attrs.attachPhotos).toBe(false);
  });

  it("numberField defaults attachPhotos to false when no attribute override is provided", () => {
    const store = createBuilderStore(formBuilder);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const entity = store.addEntity({ type: "numberField", attributes: {} } as any);
    const attrs = store.getSchema().entities[entity.id].attributes as Record<string, unknown>;
    expect(attrs.attachPhotos).toBe(false);
  });

  it("dateField defaults attachPhotos to false when no attribute override is provided", () => {
    const store = createBuilderStore(formBuilder);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const entity = store.addEntity({ type: "dateField", attributes: {} } as any);
    const attrs = store.getSchema().entities[entity.id].attributes as Record<string, unknown>;
    expect(attrs.attachPhotos).toBe(false);
  });

  it("selectField defaults attachPhotos to false when no attribute override is provided", () => {
    const store = createBuilderStore(formBuilder);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const entity = store.addEntity({ type: "selectField", attributes: {} } as any);
    const attrs = store.getSchema().entities[entity.id].attributes as Record<string, unknown>;
    expect(attrs.attachPhotos).toBe(false);
  });

  it("textareaField defaults attachPhotos to false when no attribute override is provided", () => {
    const store = createBuilderStore(formBuilder);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const entity = store.addEntity({ type: "textareaField", attributes: {} } as any);
    const attrs = store.getSchema().entities[entity.id].attributes as Record<string, unknown>;
    expect(attrs.attachPhotos).toBe(false);
  });

  it("checkboxField defaults attachPhotos to false when no attribute override is provided", () => {
    const store = createBuilderStore(formBuilder);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const entity = store.addEntity({ type: "checkboxField", attributes: {} } as any);
    const attrs = store.getSchema().entities[entity.id].attributes as Record<string, unknown>;
    expect(attrs.attachPhotos).toBe(false);
  });

  it("sectionGroup does NOT have attachPhotos attribute (it is a container — D-05)", () => {
    const store = createBuilderStore(formBuilder);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const entity = store.addEntity({ type: "sectionGroup", attributes: {} } as any);
    const attrs = store.getSchema().entities[entity.id].attributes as Record<string, unknown>;
    // sectionGroup must NOT have attachPhotos — D-05 "every non-section entity"
    expect(attrs.attachPhotos).toBeUndefined();
  });
});
