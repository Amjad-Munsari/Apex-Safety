// lib/ai/prompt-builder.ts
// 888 Safety Solutions — Phase 7 AI Report Pipeline
//
// Pure, deterministic prompt assembler for the FRA report-draft pipeline.
// Consumed by app/admin/assessments/actions.ts (Plan 02 replaces the inline
// prompt literal at actions.ts:466-472 with buildReportPrompt(...)).
//
// Why pure: no template lookup, no env reads, no I/O. The exemplar is passed
// in by the caller (see lib/ai/exemplars/*.ts). This keeps the function
// trivially testable and lets the caller pick the right exemplar per
// template type (yellow-broom-fra vs site-risk).
//
// Prompt structure (locked, 07-CONTEXT §decisions D-02):
//   [system persona] + [no-hallucination rule] + [exemplar block] +
//   [expanded answers JSON]
//
// PERSONA and NO_HALLUCINATION are copied VERBATIM from 07-CONTEXT
// §specifics. Do NOT paraphrase, do NOT normalise punctuation (the em-dash
// in NO_HALLUCINATION is intentional — CONTEXT is the source of truth).

const PERSONA =
  "You are a UK Fire Risk Assessor drafting an official report under the Regulatory Reform (Fire Safety) Order 2005. You are assisting Matt Robinson, the competent person, who will review every output before delivery."

const NO_HALLUCINATION =
  "Every hazard in your output MUST trace to an explicit statement in the input answers. If the data is silent on a topic, omit it — do not infer."

export function buildReportPrompt(args: {
  exemplar: string
  exemplarLabel: string
  expandedAnswers: Record<string, unknown>
}): string {
  const { exemplar, exemplarLabel, expandedAnswers } = args
  const citation = `Few-shot reference: ${exemplarLabel}`
  const divider = "Now draft a report from these answers:"
  const answers = JSON.stringify(expandedAnswers, null, 2)

  return [PERSONA, NO_HALLUCINATION, citation, exemplar, divider, answers].join("\n\n")
}
