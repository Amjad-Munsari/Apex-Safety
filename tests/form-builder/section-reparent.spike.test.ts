/**
 * Spike test: Verify sectionGroup reparenting API (RESEARCH.md Assumption A1).
 *
 * FINDINGS (de-risks Plan 02 canvas implementation):
 *
 * RESEARCH.md Assumption A1 stated:
 *   "builderStore.addEntity({ type: 'textField' }, { parentId: sectionId }) places the field
 *    inside the section and NOT in root."
 *
 * ACTUAL API (verified by this spike):
 *   - addEntity() with a second arg { parentId } does NOT nest the entity — parentId is ignored
 *     and the entity still ends up in root.
 *   - The correct nesting call is: builderStore.setEntityParent(childId, parentId)
 *   - After setEntityParent, the child is removed from root and appears in parent.children[].
 *   - The sectionGroup entity MUST have childrenAllowed: true in its createEntity definition.
 *     Without this flag, setEntityParent throws "Child is not allowed."
 *   - Schema shape after nesting:
 *     { entities: { sectionId: { type, attributes, children: [fieldId] },
 *                   fieldId: { type, attributes, parentId: sectionId } },
 *       root: [sectionId] }
 *
 * Plan 02 canvas implementation must use:
 *   1. builderStore.addEntity({ type }) — adds to root
 *   2. builderStore.setEntityParent(childId, parentId) — moves child under parent
 *   3. builderStore.unsetEntityParent(childId) — moves child back to root
 *
 * NOTE: createBuilderStore is exported from @coltorapps/builder (headless, no React required).
 */
import { describe, it, expect } from "vitest";
import { createBuilderStore } from "@coltorapps/builder";

describe("sectionGroup reparenting spike (RESEARCH.md A1)", () => {
  it("setEntityParent moves child out of root and into sectionGroup.children", async () => {
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

    // Add a textField — it initially lands in root
    const { id: fieldId } = builderStore.addEntity({
      type: "textField",
      attributes: {
        label: "Test Field",
        required: false,
        placeholder: "",
        helpText: "",
        prefillSource: "",
      },
    });

    // Initially both are in root
    expect(builderStore.getSchema().root).toContain(sectionId);
    expect(builderStore.getSchema().root).toContain(fieldId);

    // Nest the textField inside the sectionGroup using setEntityParent
    builderStore.setEntityParent(fieldId, sectionId);

    const schema = builderStore.getSchema();

    // The sectionGroup should still be in root
    expect(schema.root).toContain(sectionId);

    // The textField should NOT be in root (moved to section.children)
    expect(schema.root).not.toContain(fieldId);

    // Both entities should be present in the entities map
    expect(schema.entities[sectionId]).toBeDefined();
    expect(schema.entities[fieldId]).toBeDefined();

    // sectionGroup should have children array containing the fieldId
    expect(schema.entities[sectionId]?.children).toContain(fieldId);

    // textField should have parentId pointing to sectionId
    expect(schema.entities[fieldId]?.parentId).toBe(sectionId);
  });

  it("unsetEntityParent moves child back to root", async () => {
    const { formBuilder } = await import("@/lib/form-builder/index");

    const builderStore = createBuilderStore(formBuilder);

    const { id: sectionId } = builderStore.addEntity({
      type: "sectionGroup",
      attributes: { title: "Test Section", description: "" },
    });
    const { id: fieldId } = builderStore.addEntity({
      type: "textField",
      attributes: { label: "Name", required: false, placeholder: "", helpText: "", prefillSource: "" },
    });

    builderStore.setEntityParent(fieldId, sectionId);
    expect(builderStore.getSchema().root).not.toContain(fieldId);

    builderStore.unsetEntityParent(fieldId);
    const schema = builderStore.getSchema();

    // After unsetEntityParent the field returns to root
    expect(schema.root).toContain(fieldId);
    expect(schema.entities[sectionId]?.children).not.toContain(fieldId);
  });

  it("a sectionGroup with no children has no children array and is in root", async () => {
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
