// lib/form-builder/risk/pas79.ts
// Merlin Safety System
//
// The 5×5 bands below are the platform's accepted FRA practitioner convention.
// They are explicit application rules rather than a claim that BSI publishes
// these exact numerical boundaries.

export type RiskLevel =
  | "Trivial"
  | "Tolerable"
  | "Moderate"
  | "Substantial"
  | "Intolerable";

export interface RiskResult {
  score: number;
  level: RiskLevel;
  /** Exact Tailwind utility class string — consumed by computed-field-renderer.tsx. */
  colourClass: string;
}

/**
 * PAS 79 5×5 risk matrix.
 * Likelihood: 1 (Very Low) to 5 (Very High)
 * Consequence: 1 (Insignificant) to 5 (Catastrophic)
 * Score = likelihood × consequence (1–25)
 *
 * Colour coding convention used by FRA practitioners:
 *   GREEN  (Trivial 1–2, Tolerable 3–4)          score  1– 4
 *   AMBER  (Moderate 5–9, Substantial 10–12)      score  5–12
 *   RED    (Substantial 13–16, Intolerable 17–25) score 13–25
 *
 * NOTE: BSI does not publish the exact band boundaries in freely available form.
 * These bands are the most common practitioner convention.
 * See Assumptions Log A1 in 14-RESEARCH.md.
 */
export function computePAS79RiskLevel(
  likelihood: number | undefined,
  consequence: number | undefined
): RiskResult | null {
  // Guard undefined / null inputs (RESEARCH Pitfall 4 — initial render race).
  if (likelihood === undefined || likelihood === null) return null;
  if (consequence === undefined || consequence === null) return null;

  // Reject non-integers (e.g., 1.5).
  if (!Number.isInteger(likelihood) || !Number.isInteger(consequence)) return null;

  // Reject out-of-range inputs (valid range: 1–5 for each axis).
  if (likelihood < 1 || likelihood > 5) return null;
  if (consequence < 1 || consequence > 5) return null;

  const score = likelihood * consequence;

  let level: RiskLevel;
  let colourClass: string;

  if (score <= 4) {
    // GREEN band: Trivial (1–2) and Tolerable (3–4)
    level = score <= 2 ? "Trivial" : "Tolerable";
    colourClass = "bg-green-100 text-green-900 border border-green-300";
  } else if (score <= 12) {
    // AMBER band: Moderate (5–9) and Substantial (10–12)
    level = score <= 9 ? "Moderate" : "Substantial";
    colourClass = "bg-amber-100 text-amber-900 border border-amber-300";
  } else {
    // RED band: Substantial (13–16) and Intolerable (17–25)
    level = score <= 16 ? "Substantial" : "Intolerable";
    colourClass = "bg-red-100 text-red-900 border border-red-300";
  }

  return { score, level, colourClass };
}

/** The two raw inputs plus the derived result for a single PAS 79 computedField. */
export interface PAS79Summary {
  likelihood: number;
  consequence: number;
  result: RiskResult;
}

/**
 * Recompute the PAS 79 risk level from a submission's raw answers at read time.
 *
 * The on-screen renderer (components/form-interpreter/computed-field-renderer.tsx
 * ~128-133) DELIBERATELY does not persist the derived level — answers_json holds
 * the likelihood/consequence dependency inputs but never the risk rating. Any
 * downstream consumer that wants the rating (AI report prompt, review UI) must
 * recompute it. This helper is that recompute, colocated with the risk module.
 *
 * Extraction mirrors the renderer and augmentAnswersWithComputedValues exactly:
 *   - find computedField entities whose formula === "pas79"
 *   - read the likelihood/consequence dependency entity IDs from
 *     attributes.computedInputs (Record<string,string>)
 *   - coerce answers[<id>] to numbers and run computePAS79RiskLevel
 *
 * Returns null when the schema has no PAS 79 computedField, or when the
 * dependency answers are missing / non-numeric / out of range — so callers can
 * inject nothing rather than risk an "undefined" leaking into the prompt.
 *
 * Pure; does not mutate inputs and does not persist anything.
 */
export function extractPAS79Summary(
  schema: {
    entities: Record<
      string,
      { type?: string; attributes?: Record<string, unknown> }
    >;
  },
  answers: Record<string, unknown>
): PAS79Summary | null {
  for (const entity of Object.values(schema.entities)) {
    if (entity.type !== "computedField") continue;
    const attrs = (entity.attributes ?? {}) as Record<string, unknown>;
    if (attrs.formula !== "pas79") continue;

    const inputs = (attrs.computedInputs ?? {}) as Record<string, string>;
    const likelihoodId = inputs.likelihood;
    const consequenceId = inputs.consequence;

    const likelihoodRaw = likelihoodId ? answers[likelihoodId] : undefined;
    const consequenceRaw = consequenceId ? answers[consequenceId] : undefined;
    const likelihoodNum =
      likelihoodRaw !== undefined && likelihoodRaw !== null
        ? Number(likelihoodRaw)
        : undefined;
    const consequenceNum =
      consequenceRaw !== undefined && consequenceRaw !== null
        ? Number(consequenceRaw)
        : undefined;

    const result = computePAS79RiskLevel(
      likelihoodNum !== undefined && !isNaN(likelihoodNum) ? likelihoodNum : undefined,
      consequenceNum !== undefined && !isNaN(consequenceNum) ? consequenceNum : undefined
    );

    // First PAS 79 field with a valid result wins. A misconfigured / unfilled
    // field yields null and we keep scanning for a usable one.
    if (result && likelihoodNum !== undefined && consequenceNum !== undefined) {
      return { likelihood: likelihoodNum, consequence: consequenceNum, result };
    }
  }

  return null;
}
