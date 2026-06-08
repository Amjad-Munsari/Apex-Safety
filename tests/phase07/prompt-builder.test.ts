// Phase 07 — buildReportPrompt unit tests.
//
// Focus: the computed PAS 79 risk line (fix(ai): inject computed PAS 79 risk
// level into report prompt). The phase07/ai-report-pipeline.test.ts suite mocks
// buildReportPrompt wholesale, so the prompt-string contract is pinned here.

import { describe, it, expect } from "vitest"
import { buildReportPrompt } from "@/lib/ai/prompt-builder"

const baseArgs = {
  exemplar: "EXEMPLAR_BLOCK",
  exemplarLabel: "TEST EXEMPLAR",
  expandedAnswers: { q1: "yes" },
}

describe("buildReportPrompt — PAS 79 injection", () => {
  it("injects a clear PAS 79 statement when a rating is supplied", () => {
    const prompt = buildReportPrompt({
      ...baseArgs,
      pas79: { likelihood: 4, consequence: 5, level: "Intolerable" },
    })
    expect(prompt).toContain(
      "Computed PAS 79 risk rating: Intolerable (likelihood 4, consequence 5)"
    )
  })

  it("places the PAS 79 line OUTSIDE the <user_provided_answers> sentinels", () => {
    const prompt = buildReportPrompt({
      ...baseArgs,
      pas79: { likelihood: 2, consequence: 3, level: "Moderate" },
    })
    const pasIdx = prompt.indexOf("Computed PAS 79 risk rating")
    // Locate the actual data block (newline-prefixed opening tag) — NOT the
    // earlier mention of the tag name inside the INJECTION_GUARD sentence.
    const wrapperIdx = prompt.indexOf("\n<user_provided_answers>\n")
    expect(pasIdx).toBeGreaterThan(-1)
    expect(wrapperIdx).toBeGreaterThan(-1)
    // Derived statement comes before the untrusted-data block, never inside it.
    expect(pasIdx).toBeLessThan(wrapperIdx)
    // And it is not swallowed inside the sentinels.
    // Newline-anchored like the open tag — the INJECTION_GUARD sentence also
    // mentions the literal close tag, which must not be matched here.
    const closeIdx = prompt.indexOf("\n</user_provided_answers>")
    expect(pasIdx).toBeLessThan(wrapperIdx)
    expect(pasIdx).not.toBeGreaterThan(closeIdx)
  })

  it("injects nothing when pas79 is null", () => {
    const prompt = buildReportPrompt({ ...baseArgs, pas79: null })
    expect(prompt).not.toContain("Computed PAS 79")
    expect(prompt).not.toContain("undefined")
  })

  it("injects nothing when pas79 is omitted entirely", () => {
    const prompt = buildReportPrompt(baseArgs)
    expect(prompt).not.toContain("Computed PAS 79")
    expect(prompt).not.toContain("undefined")
    // No blank double-blank artefact from a dropped slot.
    expect(prompt).not.toContain("\n\n\n")
  })
})
