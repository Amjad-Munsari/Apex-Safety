import { describe, it, expect } from "vitest";

// These tests cover the attribute validators defined in lib/form-builder/attributes/.
// Entity-level test cases are added by Task 3 (validate function on createEntity).

describe("labelAttribute.validate", () => {
  it("rejects an empty string with a thrown Error", async () => {
    const { labelAttribute } = await import("@/lib/form-builder/attributes/label");
    expect(() => labelAttribute.validate("")).toThrow("Label is required.");
  });

  it("rejects a non-string value with a thrown Error", async () => {
    const { labelAttribute } = await import("@/lib/form-builder/attributes/label");
    expect(() => labelAttribute.validate(42 as unknown as string)).toThrow(
      "Label is required."
    );
  });

  it("accepts and trims a non-empty string", async () => {
    const { labelAttribute } = await import("@/lib/form-builder/attributes/label");
    expect(labelAttribute.validate("  Hello  ")).toBe("Hello");
  });
});

describe("requiredAttribute.validate", () => {
  it("coerces undefined to false without throwing", async () => {
    const { requiredAttribute } = await import("@/lib/form-builder/attributes/required");
    expect(requiredAttribute.validate(undefined as unknown as boolean)).toBe(false);
  });

  it("accepts true without throwing", async () => {
    const { requiredAttribute } = await import("@/lib/form-builder/attributes/required");
    expect(requiredAttribute.validate(true)).toBe(true);
  });

  it("accepts false without throwing", async () => {
    const { requiredAttribute } = await import("@/lib/form-builder/attributes/required");
    expect(requiredAttribute.validate(false)).toBe(false);
  });
});

describe("optionsAttribute.validate", () => {
  it("accepts an array of { value, label } objects", async () => {
    const { optionsAttribute } = await import("@/lib/form-builder/attributes/options");
    const opts = [{ value: "a", label: "A" }];
    expect(optionsAttribute.validate(opts)).toEqual(opts);
  });

  it("rejects a non-array value with a thrown Error", async () => {
    const { optionsAttribute } = await import("@/lib/form-builder/attributes/options");
    expect(() =>
      optionsAttribute.validate("not-an-array" as unknown as Array<{ value: string; label: string }>)
    ).toThrow();
  });

  it("accepts an empty array as the default", async () => {
    const { optionsAttribute } = await import("@/lib/form-builder/attributes/options");
    expect(optionsAttribute.validate([])).toEqual([]);
  });
});

describe("prefillSourceAttribute.validate", () => {
  it("accepts empty string ''", async () => {
    const { prefillSourceAttribute } = await import(
      "@/lib/form-builder/attributes/prefill-source"
    );
    expect(prefillSourceAttribute.validate("")).toBe("");
  });

  it("accepts 'currentUserName'", async () => {
    const { prefillSourceAttribute } = await import(
      "@/lib/form-builder/attributes/prefill-source"
    );
    expect(prefillSourceAttribute.validate("currentUserName")).toBe("currentUserName");
  });

  it("accepts 'currentDate'", async () => {
    const { prefillSourceAttribute } = await import(
      "@/lib/form-builder/attributes/prefill-source"
    );
    expect(prefillSourceAttribute.validate("currentDate")).toBe("currentDate");
  });

  it("accepts 'none'", async () => {
    const { prefillSourceAttribute } = await import(
      "@/lib/form-builder/attributes/prefill-source"
    );
    expect(prefillSourceAttribute.validate("none")).toBe("none");
  });

  it("rejects any other string with a thrown Error", async () => {
    const { prefillSourceAttribute } = await import(
      "@/lib/form-builder/attributes/prefill-source"
    );
    expect(() => prefillSourceAttribute.validate("username")).toThrow();
  });
});

describe("numberBounds attributes (minAttribute, maxAttribute)", () => {
  it("minAttribute accepts a number", async () => {
    const { minAttribute } = await import("@/lib/form-builder/attributes/number-bounds");
    expect(minAttribute.validate(0)).toBe(0);
  });

  it("minAttribute accepts undefined", async () => {
    const { minAttribute } = await import("@/lib/form-builder/attributes/number-bounds");
    expect(minAttribute.validate(undefined as unknown as number)).toBeUndefined();
  });

  it("minAttribute rejects a non-numeric string with a thrown Error", async () => {
    const { minAttribute } = await import("@/lib/form-builder/attributes/number-bounds");
    expect(() => minAttribute.validate("ten" as unknown as number)).toThrow();
  });

  it("maxAttribute accepts a number", async () => {
    const { maxAttribute } = await import("@/lib/form-builder/attributes/number-bounds");
    expect(maxAttribute.validate(100)).toBe(100);
  });

  it("maxAttribute accepts undefined", async () => {
    const { maxAttribute } = await import("@/lib/form-builder/attributes/number-bounds");
    expect(maxAttribute.validate(undefined as unknown as number)).toBeUndefined();
  });

  it("maxAttribute rejects a non-numeric string with a thrown Error", async () => {
    const { maxAttribute } = await import("@/lib/form-builder/attributes/number-bounds");
    expect(() => maxAttribute.validate("ten" as unknown as number)).toThrow();
  });
});
