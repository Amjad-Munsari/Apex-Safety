import { describe, it, expect } from "vitest";

// Plan 15-03 Task 1: scope walker tests
// Uses dynamic await import() to keep production module out of static import graph (vitest isolation).

// Minimal schema shape for scope tests
// Contains: root fields, sectionGroup with children, repeatingSection with children
const buildTestSchema = () => ({
  entities: {
    rootField: {
      type: "textField",
      attributes: {},
    },
    anotherRootField: {
      type: "textField",
      attributes: {},
    },
    mySection: {
      type: "sectionGroup",
      attributes: {},
      children: ["sectionChild"],
    },
    sectionChild: {
      type: "textField",
      attributes: {},
    },
    myRepSection: {
      type: "repeatingSection",
      attributes: {},
      children: ["repChild1", "repChild2"],
    },
    repChild1: {
      type: "textField",
      attributes: {},
    },
    repChild2: {
      type: "selectField",
      attributes: {},
    },
    anotherRepSection: {
      type: "repeatingSection",
      attributes: {},
      children: ["repChild3"],
    },
    repChild3: {
      type: "textField",
      attributes: {},
    },
  },
});

describe("resolveScope — entity scope resolution", () => {
  it("resolveScope returns 'root' for a root-level entity (not inside any container)", async () => {
    const { resolveScope } = await import(
      "@/lib/form-builder/visibility/scope"
    );
    const schema = buildTestSchema();
    expect(resolveScope(schema, "rootField")).toBe("root");
    expect(resolveScope(schema, "anotherRootField")).toBe("root");
  });

  it("resolveScope returns the sectionGroup's id for a child of sectionGroup", async () => {
    const { resolveScope } = await import(
      "@/lib/form-builder/visibility/scope"
    );
    const schema = buildTestSchema();
    // sectionChild is inside mySection (sectionGroup)
    expect(resolveScope(schema, "sectionChild")).toBe("mySection");
  });

  it("resolveScope returns the repeatingSection id for a child of repeatingSection", async () => {
    const { resolveScope } = await import(
      "@/lib/form-builder/visibility/scope"
    );
    const schema = buildTestSchema();
    expect(resolveScope(schema, "repChild1")).toBe("myRepSection");
    expect(resolveScope(schema, "repChild2")).toBe("myRepSection");
    expect(resolveScope(schema, "repChild3")).toBe("anotherRepSection");
  });

  it("resolveScope returns 'root' for container entities themselves (they are not children of other containers)", async () => {
    const { resolveScope } = await import(
      "@/lib/form-builder/visibility/scope"
    );
    const schema = buildTestSchema();
    expect(resolveScope(schema, "mySection")).toBe("root");
    expect(resolveScope(schema, "myRepSection")).toBe("root");
  });

  it("resolveScope returns 'root' for an unknown entity id (not a child of any container)", async () => {
    const { resolveScope } = await import(
      "@/lib/form-builder/visibility/scope"
    );
    const schema = buildTestSchema();
    expect(resolveScope(schema, "nonExistentEntity")).toBe("root");
  });
});

describe("isAncestorScope — cross-scope validation (D-03)", () => {
  it("returns true when consumer and source are both root-level", async () => {
    const { isAncestorScope } = await import(
      "@/lib/form-builder/visibility/scope"
    );
    const schema = buildTestSchema();
    // root → root: allowed
    expect(isAncestorScope(schema, "rootField", "anotherRootField")).toBe(true);
  });

  it("returns true when source is root and consumer is inside a repeatingSection (ancestor-scope case)", async () => {
    const { isAncestorScope } = await import(
      "@/lib/form-builder/visibility/scope"
    );
    const schema = buildTestSchema();
    // repChild1 (inside myRepSection) references rootField (root scope) — ancestor-scope, ALLOWED
    expect(isAncestorScope(schema, "repChild1", "rootField")).toBe(true);
  });

  it("returns true when consumer and source are both inside the SAME repeatingSection", async () => {
    const { isAncestorScope } = await import(
      "@/lib/form-builder/visibility/scope"
    );
    const schema = buildTestSchema();
    // repChild1 and repChild2 are siblings inside myRepSection — same scope, ALLOWED
    expect(isAncestorScope(schema, "repChild1", "repChild2")).toBe(true);
  });

  it("returns false for cross-instance: consumer and source are children of DIFFERENT repeatingSections (D-03 cross-instance)", async () => {
    const { isAncestorScope } = await import(
      "@/lib/form-builder/visibility/scope"
    );
    const schema = buildTestSchema();
    // repChild1 (myRepSection) references repChild3 (anotherRepSection) — cross-instance, REJECTED
    expect(isAncestorScope(schema, "repChild1", "repChild3")).toBe(false);
  });

  it("returns false when consumer is root and source is inside a repeatingSection (root→inside-repeating REJECTED per D-03)", async () => {
    const { isAncestorScope } = await import(
      "@/lib/form-builder/visibility/scope"
    );
    const schema = buildTestSchema();
    // rootField references repChild1 (inside myRepSection) — N-instances ambiguous, REJECTED
    expect(isAncestorScope(schema, "rootField", "repChild1")).toBe(false);
  });
});
