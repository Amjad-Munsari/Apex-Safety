// lib/form-builder/risk/pas79.ts
// 888 Safety & Training Platform
//
// TODO: PAS 79 band boundaries are practitioner convention (RESEARCH Assumption A1) —
// Matt must verify against BSI PAS 79-1:2020 before Phase 14 ships.
// The 5×5 matrix below reflects the most common FRA practitioner interpretation.

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
