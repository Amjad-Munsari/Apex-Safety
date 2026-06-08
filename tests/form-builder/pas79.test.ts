import { describe, it, expect } from "vitest";

// Tests for the PAS 79 risk computation utility (lib/form-builder/risk/pas79.ts).
// RED-first TDD — written before the implementation exists.
// RESEARCH Assumption A1: band boundaries are practitioner convention.
// Matt must verify against BSI PAS 79-1:2020 before Phase 14 ships.

describe("computePAS79RiskLevel — null guards", () => {
  it("returns null for (undefined, undefined)", async () => {
    const { computePAS79RiskLevel } = await import("@/lib/form-builder/risk/pas79");
    expect(computePAS79RiskLevel(undefined, undefined)).toBeNull();
  });

  it("returns null for (1, undefined)", async () => {
    const { computePAS79RiskLevel } = await import("@/lib/form-builder/risk/pas79");
    expect(computePAS79RiskLevel(1, undefined)).toBeNull();
  });

  it("returns null for (0, 3) — likelihood out of [1,5]", async () => {
    const { computePAS79RiskLevel } = await import("@/lib/form-builder/risk/pas79");
    expect(computePAS79RiskLevel(0, 3)).toBeNull();
  });

  it("returns null for (6, 3) — likelihood out of [1,5]", async () => {
    const { computePAS79RiskLevel } = await import("@/lib/form-builder/risk/pas79");
    expect(computePAS79RiskLevel(6, 3)).toBeNull();
  });

  it("returns null for (1.5, 3) — non-integer rejected", async () => {
    const { computePAS79RiskLevel } = await import("@/lib/form-builder/risk/pas79");
    expect(computePAS79RiskLevel(1.5, 3)).toBeNull();
  });
});

describe("computePAS79RiskLevel — 25-cell matrix coverage", () => {
  // Verify score = L * C for all 25 cells and that results are non-null.
  it("covers all 25 (L,C) combinations with non-null results and correct score", async () => {
    const { computePAS79RiskLevel } = await import("@/lib/form-builder/risk/pas79");
    for (let l = 1; l <= 5; l++) {
      for (let c = 1; c <= 5; c++) {
        const result = computePAS79RiskLevel(l, c);
        expect(result).not.toBeNull();
        expect(result!.score).toBe(l * c);
      }
    }
  });
});

describe("computePAS79RiskLevel — banding: Trivial (score 1–2)", () => {
  it("(1,1) = score 1 → Trivial, green", async () => {
    const { computePAS79RiskLevel } = await import("@/lib/form-builder/risk/pas79");
    const r = computePAS79RiskLevel(1, 1)!;
    expect(r.level).toBe("Trivial");
    expect(r.colourClass).toBe("bg-green-100 text-green-900 border border-green-300");
  });

  it("(1,2) = score 2 → Trivial, green", async () => {
    const { computePAS79RiskLevel } = await import("@/lib/form-builder/risk/pas79");
    const r = computePAS79RiskLevel(1, 2)!;
    expect(r.level).toBe("Trivial");
    expect(r.colourClass).toBe("bg-green-100 text-green-900 border border-green-300");
  });
});

describe("computePAS79RiskLevel — banding: Tolerable (score 3–4)", () => {
  it("(1,3) = score 3 → Tolerable, green", async () => {
    const { computePAS79RiskLevel } = await import("@/lib/form-builder/risk/pas79");
    const r = computePAS79RiskLevel(1, 3)!;
    expect(r.level).toBe("Tolerable");
    expect(r.colourClass).toBe("bg-green-100 text-green-900 border border-green-300");
  });

  it("(2,2) = score 4 → Tolerable, green", async () => {
    const { computePAS79RiskLevel } = await import("@/lib/form-builder/risk/pas79");
    const r = computePAS79RiskLevel(2, 2)!;
    expect(r.level).toBe("Tolerable");
    expect(r.colourClass).toBe("bg-green-100 text-green-900 border border-green-300");
  });
});

describe("computePAS79RiskLevel — banding: Moderate (score 5–9)", () => {
  it("(1,5) = score 5 → Moderate, amber", async () => {
    const { computePAS79RiskLevel } = await import("@/lib/form-builder/risk/pas79");
    const r = computePAS79RiskLevel(1, 5)!;
    expect(r.level).toBe("Moderate");
    expect(r.colourClass).toBe("bg-amber-100 text-amber-900 border border-amber-300");
  });

  it("(3,3) = score 9 → Moderate, amber", async () => {
    const { computePAS79RiskLevel } = await import("@/lib/form-builder/risk/pas79");
    const r = computePAS79RiskLevel(3, 3)!;
    expect(r.level).toBe("Moderate");
    expect(r.colourClass).toBe("bg-amber-100 text-amber-900 border border-amber-300");
  });
});

describe("computePAS79RiskLevel — banding: Substantial amber (score 10–12)", () => {
  it("(2,5) = score 10 → Substantial, amber", async () => {
    const { computePAS79RiskLevel } = await import("@/lib/form-builder/risk/pas79");
    const r = computePAS79RiskLevel(2, 5)!;
    expect(r.level).toBe("Substantial");
    expect(r.colourClass).toBe("bg-amber-100 text-amber-900 border border-amber-300");
  });

  it("(3,4) = score 12 → Substantial, amber", async () => {
    const { computePAS79RiskLevel } = await import("@/lib/form-builder/risk/pas79");
    const r = computePAS79RiskLevel(3, 4)!;
    expect(r.level).toBe("Substantial");
    expect(r.colourClass).toBe("bg-amber-100 text-amber-900 border border-amber-300");
  });
});

describe("computePAS79RiskLevel — banding: Substantial red (score 13–16)", () => {
  it("(3,5) = score 15 → Substantial, red", async () => {
    const { computePAS79RiskLevel } = await import("@/lib/form-builder/risk/pas79");
    const r = computePAS79RiskLevel(3, 5)!;
    expect(r.level).toBe("Substantial");
    expect(r.colourClass).toBe("bg-red-100 text-red-900 border border-red-300");
  });

  it("(4,4) = score 16 → Substantial, red", async () => {
    const { computePAS79RiskLevel } = await import("@/lib/form-builder/risk/pas79");
    const r = computePAS79RiskLevel(4, 4)!;
    expect(r.level).toBe("Substantial");
    expect(r.colourClass).toBe("bg-red-100 text-red-900 border border-red-300");
  });
});

describe("computePAS79RiskLevel — banding: Intolerable (score 17–25)", () => {
  it("(4,5) = score 20 → Intolerable, red", async () => {
    const { computePAS79RiskLevel } = await import("@/lib/form-builder/risk/pas79");
    const r = computePAS79RiskLevel(4, 5)!;
    expect(r.level).toBe("Intolerable");
    expect(r.colourClass).toBe("bg-red-100 text-red-900 border border-red-300");
  });

  it("(5,5) = score 25 → Intolerable, red", async () => {
    const { computePAS79RiskLevel } = await import("@/lib/form-builder/risk/pas79");
    const r = computePAS79RiskLevel(5, 5)!;
    expect(r.level).toBe("Intolerable");
    expect(r.colourClass).toBe("bg-red-100 text-red-900 border border-red-300");
  });
});

// ── extractPAS79Summary — recompute from schema + raw answers ─────────────────
// Mirrors the renderer's extraction (attributes.computedInputs → entity IDs →
// answers lookup). Used by the AI report prompt path, which never sees the
// persisted level because the renderer deliberately does not store it.

// A minimal schema with one PAS 79 computedField whose inputs point at two
// number entities by id. Matches the shape buildReportPrompt's caller passes
// (version.schema_json).
function pas79Schema(likelihoodId: string, consequenceId: string) {
  return {
    entities: {
      [likelihoodId]: { type: "numberField", attributes: { label: "Likelihood" } },
      [consequenceId]: { type: "numberField", attributes: { label: "Consequence" } },
      cf1: {
        type: "computedField",
        attributes: {
          label: "PAS 79 Risk",
          formula: "pas79",
          computedInputs: { likelihood: likelihoodId, consequence: consequenceId },
        },
      },
    },
  };
}

describe("extractPAS79Summary — happy path", () => {
  it("recomputes level + echoes likelihood/consequence from raw answers", async () => {
    const { extractPAS79Summary } = await import("@/lib/form-builder/risk/pas79");
    const schema = pas79Schema("L", "C");
    const summary = extractPAS79Summary(schema, { L: 4, C: 5 })!;
    expect(summary.likelihood).toBe(4);
    expect(summary.consequence).toBe(5);
    expect(summary.result.score).toBe(20);
    expect(summary.result.level).toBe("Intolerable");
  });

  it("coerces numeric-string answers (number entities can store strings)", async () => {
    const { extractPAS79Summary } = await import("@/lib/form-builder/risk/pas79");
    const schema = pas79Schema("L", "C");
    const summary = extractPAS79Summary(schema, { L: "3", C: "3" })!;
    expect(summary.likelihood).toBe(3);
    expect(summary.consequence).toBe(3);
    expect(summary.result.level).toBe("Moderate");
  });
});

describe("extractPAS79Summary — null cases (inject nothing)", () => {
  it("returns null when the schema has no PAS 79 computedField", async () => {
    const { extractPAS79Summary } = await import("@/lib/form-builder/risk/pas79");
    const schema = {
      entities: { q1: { type: "textField", attributes: { label: "Notes" } } },
    };
    expect(extractPAS79Summary(schema, { q1: "anything" })).toBeNull();
  });

  it("returns null when likelihood/consequence answers are unfilled", async () => {
    const { extractPAS79Summary } = await import("@/lib/form-builder/risk/pas79");
    const schema = pas79Schema("L", "C");
    expect(extractPAS79Summary(schema, {})).toBeNull();
  });

  it("returns null when an input is out of the [1,5] range", async () => {
    const { extractPAS79Summary } = await import("@/lib/form-builder/risk/pas79");
    const schema = pas79Schema("L", "C");
    expect(extractPAS79Summary(schema, { L: 0, C: 3 })).toBeNull();
  });

  it("returns null when an input is non-numeric", async () => {
    const { extractPAS79Summary } = await import("@/lib/form-builder/risk/pas79");
    const schema = pas79Schema("L", "C");
    expect(extractPAS79Summary(schema, { L: "n/a", C: 3 })).toBeNull();
  });
});
