---
phase: 07-ai-report-pipeline
plan: 01
subsystem: ai

tags: [ai-sdk, prompt-engineering, few-shot, zod-schema, openrouter, gpt-4o-mini]

# Dependency graph
requires:
  - phase: 07-ai-report-pipeline
    provides: "07-AI-SPEC.md reportSchema shape and locked persona/no-hallucination text from 07-CONTEXT §specifics"
provides:
  - "YELLOW_BROOM_EXEMPLAR — sanitised few-shot reference (D-02)"
  - "SITE_RISK_EXEMPLAR — stub (D-02 deferred, REPORT-04)"
  - "buildReportPrompt — pure prompt assembler that locks persona + no-hallucination guard at the top"
affects: [07-02 actions-prompt-swap, future-site-risk-exemplar-population]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure data modules under lib/ai/exemplars/ — const exports, no imports, no I/O"
    - "Pure function prompt assemblers under lib/ai/ — caller injects exemplar + label so the function stays template-agnostic"
    - "Verbatim string lockdown via top-level const + header comment citing CONTEXT as source of truth (incl. em-dash punctuation)"

key-files:
  created:
    - lib/ai/exemplars/yellow-broom-fra.ts
    - lib/ai/exemplars/site-risk.ts
    - lib/ai/prompt-builder.ts
  modified: []

key-decisions:
  - "Exemplar JSON shaped as JSON.stringify(...) so the LLM sees structured prose and Plan 02 can drop it directly into the prompt body without re-serialising"
  - "Prompt order locked to PERSONA → NO_HALLUCINATION → 'Few-shot reference: <label>' citation → exemplar body → 'Now draft a report from these answers:' divider → JSON-stringified answers, joined by '\\n\\n'"
  - "expandedAnswers JSON.stringified (escaped), not concatenated raw — mitigation for T-07-01-03 prompt injection"
  - "Site Risk exemplar remains null stub; populating it is a one-line swap when Matt's example arrives"

patterns-established:
  - "lib/ai/ is the home for pure, deterministic AI-prep code (no Supabase, no React) so it can be unit-tested via ESM named imports and reused across server actions"
  - "Exemplars are tagged with a human-readable label (`exemplarLabel`) that surfaces in the prompt header so Matt can audit lineage of any draft"

requirements-completed: [REPORT-03, REPORT-04]

# Metrics
duration: ~25min
completed: 2026-05-29
---

# Phase 07 Plan 01: lib/ai foundation Summary

**YELLOW_BROOM_EXEMPLAR (2004-byte sanitised JSON exemplar, 3 hazards across Low/Medium/High), SITE_RISK_EXEMPLAR stub, and buildReportPrompt pure assembler with verbatim persona + no-hallucination guard — Plan 02 can now swap the inline prompt at actions.ts:466-472 with zero rework.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 3
- **Files created:** 3
- **Files modified:** 0

## Accomplishments

- **REPORT-03 (D-02):** Few-shot reference module shipped — `YELLOW_BROOM_EXEMPLAR` is a 2004-byte JSON-stringified object matching `reportSchema` exactly (`executiveSummary`, `hazards[].{location, description, severity, recommendedAction}`, `complianceStatus`), with sanitised identifiers (`Acme Properties Ltd`, `12 Example Street`) and 3 hazards covering High/Medium/Low severities. `complianceStatus = "Action Required"` mirrors a real mid-tier FRA outcome.
- **REPORT-04 stub:** `SITE_RISK_EXEMPLAR: string | null = null` keeps the import surface stable for Plan 02 without committing to content that's blocked on Matt's example.
- **REPORT-03 assembler:** `buildReportPrompt({exemplar, exemplarLabel, expandedAnswers})` returns a 553-char prompt (for the verify fixture) with PERSONA and NO_HALLUCINATION text **byte-for-byte verbatim** from 07-CONTEXT §specifics — em-dash preserved.
- **Threat mitigations landed:** T-07-01-01 (`const` literal, only reviewed commits mutate), T-07-01-02 (sanitisation verify gate enforces "Acme Properties Ltd" / "12 Example Street" present), T-07-01-03 (NO_HALLUCINATION sits ABOVE the answers block; `JSON.stringify` escapes injected control text), T-07-01-05 (2KB cap asserted by Task 1 verify gate).

## Task Commits

Each task was committed atomically:

1. **Task 1: YELLOW_BROOM_EXEMPLAR module** — `5bd043a` (feat)
2. **Task 2: SITE_RISK_EXEMPLAR stub** — `ce9edf2` (feat)
3. **Task 3: buildReportPrompt assembler** — `e97ec7d` (feat)

## Files Created/Modified

- `lib/ai/exemplars/yellow-broom-fra.ts` — exports `YELLOW_BROOM_EXEMPLAR: string`, sanitised JSON exemplar matching `reportSchema`, 2004 bytes / 3 hazards (High/Medium/Low), `complianceStatus = "Action Required"`. Pure const, no imports.
- `lib/ai/exemplars/site-risk.ts` — exports `SITE_RISK_EXEMPLAR: string | null = null`. Stub flagged in header comment, cites 07-CONTEXT §deferred.
- `lib/ai/prompt-builder.ts` — exports `buildReportPrompt(args)`; declares top-level `PERSONA` and `NO_HALLUCINATION` const strings copied verbatim from 07-CONTEXT §specifics. Output order: persona → guard → `Few-shot reference: <label>` → exemplar → `Now draft a report from these answers:` → JSON.stringify(expandedAnswers, null, 2), joined by `\n\n`. No template lookup, no env reads, no I/O.

## Decisions Made

- **Exemplar encoded with `JSON.stringify(...)` at module level** (not as a tagged template literal) — guarantees parseability and prevents subtle whitespace-or-escape drift if the exemplar is hand-edited later. Plan 07-01 verify gate parses it on every run.
- **3 hazards (High / Medium / Low) rather than 4** — the plan's "2–4 hazards across different severities (Low/Medium/High at minimum)" was met at the minimum end after the first draft (4 hazards, 2314 bytes) blew the 2KB cap. Trimming to 3 hazards + tightening the executiveSummary brought it to 2004 bytes.
- **`expandedAnswers` rendered with `JSON.stringify(x, null, 2)`** — readable for the LLM and asserts answers are escaped, not raw-concatenated (prompt-injection mitigation per T-07-01-03 in the plan's threat model).
- **Verbatim text test in the verify harness** — explicitly checks the full persona and no-hallucination strings appear in the output (including the em-dash). Punctuation drift here would silently degrade the prompt; the test makes it noisy.

## Deviations from Plan

None — plan executed as written. (One in-progress correction: the first Task 1 draft was 2314 bytes; trimmed back to 2004 bytes by condensing the executiveSummary and three hazard descriptions before any commit. This is an iteration within the task, not a deviation from the plan contract.)

**Total deviations:** 0
**Impact on plan:** All Plan 07-01 automated verify gates pass (T1: 2004 bytes / 3 hazards / sanitised tokens present, T2: stub null, T3: 553-char prompt with verbatim persona + guard, ordering correct). The TypeScript phase of `npm run build` succeeds cleanly — `lib/ai/` types resolve as the plan required.

## Issues Encountered

- **tsx interop wrap when importing via `import('...')` callback** — first verify attempt accessed `m.YELLOW_BROOM_EXEMPLAR` directly and got `undefined` because tsx in CJS-callback mode wraps the namespace under `default`. Switched the harness to an ESM file (`scripts/verify-*.mjs`) using a static named import, which is the exact form Plan 02 will use (`import { YELLOW_BROOM_EXEMPLAR } from "@/lib/ai/exemplars/yellow-broom-fra"`). All gates then passed. Harness file removed before commit.
- **`npm run build` page-data collection fails on unrelated `/admin/templates/[id]` route** with `supabaseUrl is required.` This is a pre-existing env-var condition in this worktree, NOT regression from Plan 07-01 (the three files created here are imported by nothing yet — Plan 02 wires them up). The TypeScript compile + type-check phase of the build PASSES, which is what the plan's overall verification actually requires. Logged to `.planning/phases/07-ai-report-pipeline/deferred-items.md` for wave-end remediation. **Scope-boundary: out of scope per execute-plan rules.**

## Self-Check: PASSED

Verified after writing this SUMMARY:
- `lib/ai/exemplars/yellow-broom-fra.ts` — FOUND
- `lib/ai/exemplars/site-risk.ts` — FOUND
- `lib/ai/prompt-builder.ts` — FOUND
- Commit `5bd043a` — FOUND in git log
- Commit `ce9edf2` — FOUND in git log
- Commit `e97ec7d` — FOUND in git log
- All three Plan 07-01 `<automated>` verify gates re-run together — ALL PASSED

## Next Phase Readiness

- Plan 07-02 (the inline-prompt swap at `app/admin/assessments/actions.ts:466-472`) is unblocked. The exact import path it needs is `@/lib/ai/exemplars/yellow-broom-fra` for the exemplar and `@/lib/ai/prompt-builder` for the assembler.
- Recommended invocation in Plan 02:
  ```ts
  import { YELLOW_BROOM_EXEMPLAR } from "@/lib/ai/exemplars/yellow-broom-fra"
  import { buildReportPrompt } from "@/lib/ai/prompt-builder"
  // ...
  const prompt = buildReportPrompt({
    exemplar: YELLOW_BROOM_EXEMPLAR,
    exemplarLabel: "YELLOW BROOM 2023 FRA, anonymised",
    expandedAnswers, // already computed by runReportDraftGeneration
  })
  ```
- Site Risk variant (REPORT-04) remains deferred — when Matt's example arrives, swap `null` for a JSON literal in `lib/ai/exemplars/site-risk.ts` and update the caller in Plan 02 to pick by template type. No other code path needs to change.

---
*Phase: 07-ai-report-pipeline*
*Completed: 2026-05-29*
