/**
 * Spike test: Verify that builderStore.addEntity({ type: 'textField' }, { parentId: sectionId })
 * nests the child inside the sectionGroup and does NOT add it to root.
 *
 * This de-risks RESEARCH.md Assumption A1 (sectionGroup child reparenting) before
 * Plan 02 builds the full canvas. The API shape discovered here is authoritative for Plan 02.
 *
 * NOTE: createBuilderStore is exported from @coltorapps/builder (headless, no React required).
 */
import { describe, it, expect } from "vitest";
import { createBuilderStore } from "@coltorapps/builder";

describe("sectionGroup reparenting spike (RESEARCH.md A1)", () => {
  it("a child added with parentId is absent from root while sectionGroup IS in root", async () => {
    const { formBuilder } = await import("@/lib/form-builder/index");

    const builderStore = createBuilderStore(formBuilder);

    // Add a sectionGroup to root
    const { id: sectionId } = builderStore.addEntity({
      type: "sectionGroup",
      attributes: {
        title: "Test Section",
        description: "",
      },
    });

    // Add a textField as a child of the sectionGroup
    const { id: fieldId } = builderStore.addEntity(
      {
        type: "textField",
        attributes: {
          label: "Test Field",
          required: false,
          placeholder: "",
          helpText: "",
          prefillSource: "",
        },
      },
      { parentId: sectionId }
    );

    const schema = builderStore.getSchema();

    // The sectionGroup should be in root
    expect(schema.root).toContain(sectionId);

    // The textField should NOT be in root (it is nested inside the sectionGroup)
    expect(schema.root).not.toContain(fieldId);

    // Both entities should be present in the entities map
    expect(schema.entities[sectionId]).toBeDefined();
    expect(schema.entities[fieldId]).toBeDefined();

    // The textField's entity type should be correct
    expect(schema.entities[fieldId]?.type).toBe("textField");
  });

  it("a sectionGroup with no children has an empty children list and is in root", async () => {
    const { formBuilder } = await import("@/lib/form-builder/index");

    const builderStore = createBuilderStore(formBuilder);

    const { id: sectionId } = builderStore.addEntity({
      type: "sectionGroup",
      attributes: {
        title: "Empty Section",
        description: "",
      },
    });

    const schema = builderStore.getSchema();

    expect(schema.root).toContain(sectionId);
    expect(Object.keys(schema.entities)).toHaveLength(1);
  });
});
