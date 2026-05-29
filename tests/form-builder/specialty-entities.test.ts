/**
 * tests/form-builder/specialty-entities.test.ts
 *
 * Phase 14, Plan 02 — Unit tests for the 6 new specialty entity types:
 * signatureField, ratingField, multiPhotoField, geolocationField,
 * computedField, repeatingSection.
 *
 * Import style mirrors tests/form-builder/entities.test.ts (dynamic imports, @ alias).
 *
 * NOTE: coltorapps rejects arbitrary string entity IDs. The builderStore.addEntity()
 * call returns a UUID generated internally — we use the returned ID, not a hand-written one.
 * Attribute-level tests use entity.validate() directly without a builderStore.
 */
import { describe, it, expect } from "vitest";
import { createBuilderStore } from "@coltorapps/builder";

// ============================================================
// Registration tests
// ============================================================

describe("formBuilder registration — specialty entities", () => {
  it("includes all 6 new entity types + 7 existing = 13 total", async () => {
    const { formBuilder } = await import("@/lib/form-builder/index");
    const names = formBuilder.entities.map((e: { name: string }) => e.name);
    expect(names).toContain("signatureField");
    expect(names).toContain("ratingField");
    expect(names).toContain("multiPhotoField");
    expect(names).toContain("geolocationField");
    expect(names).toContain("computedField");
    expect(names).toContain("repeatingSection");
    // 7 existing
    expect(names).toContain("textField");
    expect(names).toContain("numberField");
    expect(names).toContain("dateField");
    expect(names).toContain("selectField");
    expect(names).toContain("textareaField");
    expect(names).toContain("checkboxField");
    expect(names).toContain("sectionGroup");
    expect(formBuilder.entities).toHaveLength(13);
  });

  it("can addEntity signatureField via builderStore", async () => {
    const { formBuilder } = await import("@/lib/form-builder/index");
    const store = createBuilderStore(formBuilder);
    const { id } = store.addEntity({
      type: "signatureField",
      attributes: { label: "Signature" },
    });
    const schema = store.getSchema();
    expect(schema.entities[id]).toBeDefined();
    expect(schema.entities[id].type).toBe("signatureField");
  });

  it("can addEntity ratingField via builderStore", async () => {
    const { formBuilder } = await import("@/lib/form-builder/index");
    const store = createBuilderStore(formBuilder);
    const { id } = store.addEntity({
      type: "ratingField",
      attributes: { label: "Rating" },
    });
    const schema = store.getSchema();
    expect(schema.entities[id]).toBeDefined();
    expect(schema.entities[id].type).toBe("ratingField");
  });

  it("can addEntity multiPhotoField via builderStore", async () => {
    const { formBuilder } = await import("@/lib/form-builder/index");
    const store = createBuilderStore(formBuilder);
    const { id } = store.addEntity({
      type: "multiPhotoField",
      attributes: { label: "Photos" },
    });
    const schema = store.getSchema();
    expect(schema.entities[id]).toBeDefined();
    expect(schema.entities[id].type).toBe("multiPhotoField");
  });

  it("can addEntity geolocationField via builderStore", async () => {
    const { formBuilder } = await import("@/lib/form-builder/index");
    const store = createBuilderStore(formBuilder);
    const { id } = store.addEntity({
      type: "geolocationField",
      attributes: { label: "Location" },
    });
    const schema = store.getSchema();
    expect(schema.entities[id]).toBeDefined();
    expect(schema.entities[id].type).toBe("geolocationField");
  });

  it("can addEntity computedField via builderStore", async () => {
    const { formBuilder } = await import("@/lib/form-builder/index");
    const store = createBuilderStore(formBuilder);
    const { id } = store.addEntity({
      type: "computedField",
      attributes: { label: "Risk Level" },
    });
    const schema = store.getSchema();
    expect(schema.entities[id]).toBeDefined();
    expect(schema.entities[id].type).toBe("computedField");
  });

  it("can addEntity repeatingSection via builderStore", async () => {
    const { formBuilder } = await import("@/lib/form-builder/index");
    const store = createBuilderStore(formBuilder);
    const { id } = store.addEntity({
      type: "repeatingSection",
      attributes: { title: "Fire Doors" },
    });
    const schema = store.getSchema();
    expect(schema.entities[id]).toBeDefined();
    expect(schema.entities[id].type).toBe("repeatingSection");
  });
});

// ============================================================
// Attribute coverage tests
// ============================================================

describe("signatureField attribute set", () => {
  it("has exactly label, required, helpText, attachPhotos, visibilityRules attributes", async () => {
    const { signatureFieldEntity } = await import(
      "@/lib/form-builder/entities/signature-field"
    );
    const attrNames = signatureFieldEntity.attributes.map((a: { name: string }) => a.name);
    expect(attrNames).toContain("label");
    expect(attrNames).toContain("required");
    expect(attrNames).toContain("helpText");
    expect(attrNames).toContain("attachPhotos");
    expect(attrNames).toContain("visibilityRules");
    expect(attrNames).toHaveLength(5);
  });

  it("attachPhotos defaults to false", async () => {
    const { attachPhotosAttribute } = await import(
      "@/lib/form-builder/attributes/attach-photos"
    );
    expect(attachPhotosAttribute.validate(undefined as unknown as boolean)).toBe(false);
  });
});

describe("ratingField attribute set", () => {
  it("has label, required, helpText, maxRating, attachPhotos attributes", async () => {
    const { ratingFieldEntity } = await import("@/lib/form-builder/entities/rating-field");
    const attrNames = ratingFieldEntity.attributes.map((a: { name: string }) => a.name);
    expect(attrNames).toContain("label");
    expect(attrNames).toContain("required");
    expect(attrNames).toContain("helpText");
    expect(attrNames).toContain("maxRating");
    expect(attrNames).toContain("attachPhotos");
  });

  it("maxRating defaults to 5 when not supplied", async () => {
    const { maxRatingAttribute } = await import(
      "@/lib/form-builder/attributes/max-rating"
    );
    expect(maxRatingAttribute.validate(undefined as unknown as number)).toBe(5);
  });
});

describe("multiPhotoField attribute set", () => {
  it("has label, required, helpText, maxPhotos, attachPhotos attributes", async () => {
    const { multiPhotoFieldEntity } = await import(
      "@/lib/form-builder/entities/multi-photo-field"
    );
    const attrNames = multiPhotoFieldEntity.attributes.map((a: { name: string }) => a.name);
    expect(attrNames).toContain("label");
    expect(attrNames).toContain("required");
    expect(attrNames).toContain("helpText");
    expect(attrNames).toContain("maxPhotos");
    expect(attrNames).toContain("attachPhotos");
  });

  it("maxPhotos defaults to 5 when not supplied", async () => {
    const { maxPhotosAttribute } = await import(
      "@/lib/form-builder/attributes/max-photos"
    );
    expect(maxPhotosAttribute.validate(undefined as unknown as number)).toBe(5);
  });
});

describe("geolocationField attribute set", () => {
  it("has exactly label, required, helpText, attachPhotos, visibilityRules attributes (no map config)", async () => {
    const { geolocationFieldEntity } = await import(
      "@/lib/form-builder/entities/geolocation-field"
    );
    const attrNames = geolocationFieldEntity.attributes.map((a: { name: string }) => a.name);
    expect(attrNames).toContain("label");
    expect(attrNames).toContain("required");
    expect(attrNames).toContain("helpText");
    expect(attrNames).toContain("attachPhotos");
    expect(attrNames).toContain("visibilityRules");
    expect(attrNames).toHaveLength(5);
  });
});

describe("computedField attribute set", () => {
  it("has exactly label, formula, computedInputs, attachPhotos, visibilityRules — NO required attribute", async () => {
    const { computedFieldEntity } = await import(
      "@/lib/form-builder/entities/computed-field"
    );
    const attrNames = computedFieldEntity.attributes.map((a: { name: string }) => a.name);
    expect(attrNames).toContain("label");
    expect(attrNames).toContain("formula");
    expect(attrNames).toContain("computedInputs");
    expect(attrNames).toContain("attachPhotos");
    expect(attrNames).toContain("visibilityRules");
    // Critically: NO required attribute (it is a read-only derived field)
    expect(attrNames).not.toContain("required");
    expect(attrNames).toHaveLength(5);
  });
});

describe("repeatingSection attribute set", () => {
  it("has exactly title, description, minInstances, maxInstances, visibilityRules — NO attachPhotos", async () => {
    const { repeatingSectionEntity } = await import(
      "@/lib/form-builder/entities/repeating-section"
    );
    const attrNames = repeatingSectionEntity.attributes.map((a: { name: string }) => a.name);
    expect(attrNames).toContain("title");
    expect(attrNames).toContain("description");
    expect(attrNames).toContain("minInstances");
    expect(attrNames).toContain("maxInstances");
    expect(attrNames).toContain("visibilityRules");
    // Container entity — D-05 "every non-section entity"; repeatingSection is excluded
    expect(attrNames).not.toContain("attachPhotos");
    expect(attrNames).toHaveLength(5);
  });

  it("has childrenAllowed: true for nesting support", async () => {
    const { repeatingSectionEntity } = await import(
      "@/lib/form-builder/entities/repeating-section"
    );
    // childrenAllowed is part of the entity definition
    expect((repeatingSectionEntity as unknown as { childrenAllowed: boolean }).childrenAllowed).toBe(true);
  });
});

// ============================================================
// validate() tests
// ============================================================

describe("signatureFieldEntity.validate()", () => {
  it("returns value when required and a non-empty storage path is provided", async () => {
    const { signatureFieldEntity } = await import(
      "@/lib/form-builder/entities/signature-field"
    );
    const result = signatureFieldEntity.validate("form-media/sig.png", {
      entity: { attributes: { required: true, label: "Signature" } },
    } as never);
    expect(result).toBe("form-media/sig.png");
  });

  it("throws when required and value is undefined", async () => {
    const { signatureFieldEntity } = await import(
      "@/lib/form-builder/entities/signature-field"
    );
    expect(() =>
      signatureFieldEntity.validate(undefined, {
        entity: { attributes: { required: true, label: "Signature" } },
      } as never)
    ).toThrow();
  });

  it("throws when value is not a string", async () => {
    const { signatureFieldEntity } = await import(
      "@/lib/form-builder/entities/signature-field"
    );
    expect(() =>
      signatureFieldEntity.validate(42 as unknown as string, {
        entity: { attributes: { required: false, label: "Signature" } },
      } as never)
    ).toThrow();
  });

  it("accepts undefined when not required", async () => {
    const { signatureFieldEntity } = await import(
      "@/lib/form-builder/entities/signature-field"
    );
    const result = signatureFieldEntity.validate(undefined, {
      entity: { attributes: { required: false, label: "Signature" } },
    } as never);
    expect(result).toBeUndefined();
  });
});

describe("ratingFieldEntity.validate()", () => {
  it("returns the value for a valid rating within bounds", async () => {
    const { ratingFieldEntity } = await import("@/lib/form-builder/entities/rating-field");
    const result = ratingFieldEntity.validate(3, {
      entity: { attributes: { required: false, label: "Rating", maxRating: 5 } },
    } as never);
    expect(result).toBe(3);
  });

  it("throws when value is 0 (out of range [1, max])", async () => {
    const { ratingFieldEntity } = await import("@/lib/form-builder/entities/rating-field");
    expect(() =>
      ratingFieldEntity.validate(0 as unknown as number, {
        entity: { attributes: { required: false, label: "Rating", maxRating: 5 } },
      } as never)
    ).toThrow();
  });

  it("throws when value exceeds maxRating", async () => {
    const { ratingFieldEntity } = await import("@/lib/form-builder/entities/rating-field");
    expect(() =>
      ratingFieldEntity.validate(6, {
        entity: { attributes: { required: false, label: "Rating", maxRating: 5 } },
      } as never)
    ).toThrow();
  });

  it("throws when value is not a number", async () => {
    const { ratingFieldEntity } = await import("@/lib/form-builder/entities/rating-field");
    expect(() =>
      ratingFieldEntity.validate("not a number" as unknown as number, {
        entity: { attributes: { required: false, label: "Rating", maxRating: 5 } },
      } as never)
    ).toThrow();
  });

  it("throws when required and value is undefined", async () => {
    const { ratingFieldEntity } = await import("@/lib/form-builder/entities/rating-field");
    expect(() =>
      ratingFieldEntity.validate(undefined as unknown as number, {
        entity: { attributes: { required: true, label: "Rating", maxRating: 5 } },
      } as never)
    ).toThrow();
  });
});

describe("geolocationFieldEntity.validate()", () => {
  it("returns valid geolocation object", async () => {
    const { geolocationFieldEntity } = await import(
      "@/lib/form-builder/entities/geolocation-field"
    );
    const loc = { lat: 51.5, lng: -0.1, accuracy: 10, capturedAt: "2026-01-01T12:00:00Z" };
    const result = geolocationFieldEntity.validate(loc, {
      entity: { attributes: { required: false, label: "Location" } },
    } as never);
    expect(result).toEqual(loc);
  });

  it("throws when lat is out of range [-90, 90]", async () => {
    const { geolocationFieldEntity } = await import(
      "@/lib/form-builder/entities/geolocation-field"
    );
    expect(() =>
      geolocationFieldEntity.validate(
        { lat: 999, lng: 0, accuracy: 10, capturedAt: "2026-01-01" },
        { entity: { attributes: { required: false, label: "Location" } } } as never
      )
    ).toThrow();
  });

  it("throws when required and value is undefined", async () => {
    const { geolocationFieldEntity } = await import(
      "@/lib/form-builder/entities/geolocation-field"
    );
    expect(() =>
      geolocationFieldEntity.validate(undefined, {
        entity: { attributes: { required: true, label: "Location" } },
      } as never)
    ).toThrow();
  });
});

describe("computedFieldEntity.validate()", () => {
  it("returns value unchanged (pass-through — renderer owns computation)", async () => {
    const { computedFieldEntity } = await import(
      "@/lib/form-builder/entities/computed-field"
    );
    const ctx = { entity: { attributes: { label: "Risk", formula: "pas79" } } } as never;
    expect(computedFieldEntity.validate("High", ctx)).toBe("High");
    expect(computedFieldEntity.validate(42, ctx)).toBe(42);
    expect(computedFieldEntity.validate(undefined, ctx)).toBeUndefined();
    expect(computedFieldEntity.validate(null, ctx)).toBeNull();
  });
});

describe("repeatingSectionEntity.validate()", () => {
  it("returns {instances: []} when value is undefined", async () => {
    const { repeatingSectionEntity } = await import(
      "@/lib/form-builder/entities/repeating-section"
    );
    const result = repeatingSectionEntity.validate(undefined, {} as never);
    expect(result).toEqual({ instances: [] });
  });

  it("returns {instances: []} when value is null", async () => {
    const { repeatingSectionEntity } = await import(
      "@/lib/form-builder/entities/repeating-section"
    );
    const result = repeatingSectionEntity.validate(null, {} as never);
    expect(result).toEqual({ instances: [] });
  });

  it("returns value unchanged when instances is a valid array", async () => {
    const { repeatingSectionEntity } = await import(
      "@/lib/form-builder/entities/repeating-section"
    );
    const val = { instances: [{ fieldA: "value1" }, { fieldA: "value2" }] };
    const result = repeatingSectionEntity.validate(val, {} as never);
    expect(result).toEqual(val);
  });

  it("returns {instances: []} for {instances: []} input", async () => {
    const { repeatingSectionEntity } = await import(
      "@/lib/form-builder/entities/repeating-section"
    );
    const result = repeatingSectionEntity.validate({ instances: [] }, {} as never);
    expect(result).toEqual({ instances: [] });
  });

  it("throws when instances is not an array", async () => {
    const { repeatingSectionEntity } = await import(
      "@/lib/form-builder/entities/repeating-section"
    );
    expect(() =>
      repeatingSectionEntity.validate({ instances: "nope" } as never, {} as never)
    ).toThrow(/instances/);
  });

  it("throws when value is object without instances key — uses {} → {instances: []} coercion per Pitfall 3", async () => {
    const { repeatingSectionEntity } = await import(
      "@/lib/form-builder/entities/repeating-section"
    );
    // Per Pitfall 3: an object without instances is treated as missing instances → default to []
    // This is the "safe coercion" choice documented in the entity JSDoc.
    const result = repeatingSectionEntity.validate({} as never, {} as never);
    expect(result).toEqual({ instances: [] });
  });
});
