import { describe, it, expect } from "vitest";

// Tests for the 7 new Phase 14 shared attribute files.
// Written RED-first (TDD) before the attribute implementations exist.
// Phase 13 carry-forward rule: every validate() must coerce undefined → default
// without throwing (RESEARCH Pitfall 4).

describe("attachPhotosAttribute.validate", () => {
  it("coerces undefined to false without throwing", async () => {
    const { attachPhotosAttribute } = await import(
      "@/lib/form-builder/attributes/attach-photos"
    );
    expect(attachPhotosAttribute.validate(undefined as unknown as boolean)).toBe(false);
  });

  it("coerces null to false without throwing", async () => {
    const { attachPhotosAttribute } = await import(
      "@/lib/form-builder/attributes/attach-photos"
    );
    expect(attachPhotosAttribute.validate(null as unknown as boolean)).toBe(false);
  });

  it("accepts true and returns true", async () => {
    const { attachPhotosAttribute } = await import(
      "@/lib/form-builder/attributes/attach-photos"
    );
    expect(attachPhotosAttribute.validate(true)).toBe(true);
  });

  it("coerces truthy string 'yes' to true via Boolean coercion", async () => {
    const { attachPhotosAttribute } = await import(
      "@/lib/form-builder/attributes/attach-photos"
    );
    expect(attachPhotosAttribute.validate("yes" as unknown as boolean)).toBe(true);
  });
});

describe("formulaAttribute.validate", () => {
  it("coerces undefined to 'pas79' (default) without throwing", async () => {
    const { formulaAttribute } = await import("@/lib/form-builder/attributes/formula");
    expect(formulaAttribute.validate(undefined as unknown as string)).toBe("pas79");
  });

  it("accepts 'pas79' and returns 'pas79'", async () => {
    const { formulaAttribute } = await import("@/lib/form-builder/attributes/formula");
    expect(formulaAttribute.validate("pas79")).toBe("pas79");
  });

  it("rejects an invalid formula string with a thrown Error", async () => {
    const { formulaAttribute } = await import("@/lib/form-builder/attributes/formula");
    expect(() => formulaAttribute.validate("dsear" as unknown as string)).toThrow();
  });
});

describe("computedInputsAttribute.validate", () => {
  it("coerces undefined to { likelihood: '', consequence: '' } without throwing", async () => {
    const { computedInputsAttribute } = await import(
      "@/lib/form-builder/attributes/computed-inputs"
    );
    expect(
      computedInputsAttribute.validate(undefined as unknown as { likelihood: string; consequence: string })
    ).toEqual({ likelihood: "", consequence: "" });
  });

  it("coerces partial object { likelihood: 'abc' } to { likelihood: 'abc', consequence: '' }", async () => {
    const { computedInputsAttribute } = await import(
      "@/lib/form-builder/attributes/computed-inputs"
    );
    expect(
      computedInputsAttribute.validate({ likelihood: "abc" } as unknown as { likelihood: string; consequence: string })
    ).toEqual({ likelihood: "abc", consequence: "" });
  });

  it("rejects a non-object (string) with a thrown Error", async () => {
    const { computedInputsAttribute } = await import(
      "@/lib/form-builder/attributes/computed-inputs"
    );
    expect(() =>
      computedInputsAttribute.validate("nope" as unknown as { likelihood: string; consequence: string })
    ).toThrow();
  });
});

describe("minInstancesAttribute.validate", () => {
  it("coerces undefined to 0 without throwing", async () => {
    const { minInstancesAttribute } = await import(
      "@/lib/form-builder/attributes/min-instances"
    );
    expect(minInstancesAttribute.validate(undefined as unknown as number)).toBe(0);
  });

  it("accepts a valid non-negative integer (3)", async () => {
    const { minInstancesAttribute } = await import(
      "@/lib/form-builder/attributes/min-instances"
    );
    expect(minInstancesAttribute.validate(3)).toBe(3);
  });

  it("rejects a negative integer (-1) with a thrown Error", async () => {
    const { minInstancesAttribute } = await import(
      "@/lib/form-builder/attributes/min-instances"
    );
    expect(() => minInstancesAttribute.validate(-1)).toThrow();
  });

  it("rejects a fractional number (1.5) with a thrown Error", async () => {
    const { minInstancesAttribute } = await import(
      "@/lib/form-builder/attributes/min-instances"
    );
    expect(() => minInstancesAttribute.validate(1.5)).toThrow();
  });
});

describe("maxInstancesAttribute.validate", () => {
  it("coerces undefined to undefined (unlimited) without throwing", async () => {
    const { maxInstancesAttribute } = await import(
      "@/lib/form-builder/attributes/max-instances"
    );
    expect(maxInstancesAttribute.validate(undefined as unknown as number)).toBeUndefined();
  });

  it("accepts a valid positive integer (5)", async () => {
    const { maxInstancesAttribute } = await import(
      "@/lib/form-builder/attributes/max-instances"
    );
    expect(maxInstancesAttribute.validate(5)).toBe(5);
  });

  it("rejects 0 (must be positive when set) with a thrown Error", async () => {
    const { maxInstancesAttribute } = await import(
      "@/lib/form-builder/attributes/max-instances"
    );
    expect(() => maxInstancesAttribute.validate(0)).toThrow();
  });
});

// maxRatingAttribute (ratingField) is intentionally unsupported (product
// decision 2026-06) — block removed.

describe("maxPhotosAttribute.validate", () => {
  it("coerces undefined to 5 (default) without throwing", async () => {
    const { maxPhotosAttribute } = await import(
      "@/lib/form-builder/attributes/max-photos"
    );
    expect(maxPhotosAttribute.validate(undefined as unknown as number)).toBe(5);
  });

  it("accepts a valid in-range integer (10)", async () => {
    const { maxPhotosAttribute } = await import(
      "@/lib/form-builder/attributes/max-photos"
    );
    expect(maxPhotosAttribute.validate(10)).toBe(10);
  });

  it("rejects 0 (below min of 1) with a thrown Error", async () => {
    const { maxPhotosAttribute } = await import(
      "@/lib/form-builder/attributes/max-photos"
    );
    expect(() => maxPhotosAttribute.validate(0)).toThrow();
  });

  it("rejects 21 (above max of 20) with a thrown Error", async () => {
    const { maxPhotosAttribute } = await import(
      "@/lib/form-builder/attributes/max-photos"
    );
    expect(() => maxPhotosAttribute.validate(21)).toThrow();
  });
});
