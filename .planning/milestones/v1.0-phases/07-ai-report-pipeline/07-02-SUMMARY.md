---
phase: 07-ai-report-pipeline
plan: 02
subsystem: ai

tags: [ai-sdk, prompt-engineering, workflow-errors, status-machine, openrouter, server-actions]

# Dependency graph
requires:
  - phase: 07-ai-report-pipeline
    provides: "Plan 01 lib/ai/* (YELLOW_BROOM_EXEMPLAR + buildReportPrompt)"
  - phase: 07-ai-report-pipeline
    provides: "07-AI-SPEC.md §2 framework lock (Vercel AI SDK + Zod + gpt-4o-mini @ temp 0.1)"
provides:
  - "runReportDraftGeneration — exemplar-injected prompt + workflow_errors-logging catch + ai_draft_failed status flip"
  - "ai_draft_failed canonical status transition (D-09 taxonomy) — the load-bearing signal Plan 05/06 Review UI keys off"
  - "workflow_errors row tagged workflow_name='ai_report_draft' — surfaces in /admin/month-summary automatically"
affects:
  - 07-05 month-summary surfacing (ai_report_draft tag flows in)
  - 07-06 review-page retry CTA (keys off status == 'ai_draft_failed')
  - 07-07 integration test (mocks OpenRouter to throw, asserts workflow_errors row + status flip)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "buildReportPrompt pure assembler invoked from Server Action — persona + no-hallucination guard now applied uniformly (no inline duplication)"
    - "Catch-block ordering contract: audit insert FIRST, status flip SECOND, revalidate THIRD, rethrow LAST — so the workflow_errors row exists even if the status update later fails"
    - "Service-role adminClient for workflow_errors insert — same client that wrote draft_report_json, ensures the insert succeeds from the after-submit background callback where no admin JWT is in scope"

key-files:
  created: []
  modified:
    - "app/admin/assessments/actions.ts — +36 / -2 lines net across two commits inside runReportDraftGeneration"

key-decisions:
  - "Severity nested under payload (not a top-level column) — workflow_errors table has only workflow_name + error_message + payload as input columns per migrations/001:188-196 (PATTERNS.md correction #1); CONTEXT D-10's `severity='high'` translated to `payload.severity='high'`"
  - "Stack trace included in payload — Matt-only surface at /admin/month-summary, accepted leakage of internal repo paths (T-07-02-03)"
  - "No auto-retry loop — failed rows stay in ai_draft_failed until Matt clicks the Plan 06 retry CTA (T-07-02-04, D-09 / D-11). Avoids cost amplification under sustained OpenRouter outage"
  - "Only the Review URL is revalidated on failure (not /admin/assessments) — the Review page is the surface that needs to flip its CTA; /admin/review-queue keys off status which it already revalidates on the next list-page render"

patterns-established:
  - "Catch-block triad inside AI-pipeline Server Actions: console.error (dev visibility) → adminClient.from('workflow_errors').insert with named workflow_name literal → adminClient.from('form_submissions').update({status: '<failed_variant>'}) → revalidatePath of the surface that renders the failed-state UI → throw with preserved error-message shape"
  - "D-06 hard contract verified via scoped grep, not a code construct: `awk '/async function runReportDraftGeneration/,/^}/' actions.ts | grep -c dispatchNotification` must equal 0 — codified for Plan 07 to turn into a runtime assertion"

requirements-completed: [REPORT-01, REPORT-02, REPORT-07, REPORT-12]

# Metrics
duration: ~10min
completed: 2026-05-29
---

# Phase 07 Plan 02: AI Pipeline Prompt Swap + Workflow-Errors Wrap Summary

**Replaced the inline `Act as a Fire Risk Assessor...` template literal at `actions.ts:466-472` with `buildReportPrompt({exemplar: YELLOW_BROOM_EXEMPLAR, exemplarLabel, expandedAnswers})` (D-02), and wrapped the `generateObject` call in a catch block that inserts a `workflow_errors` row tagged `workflow_name='ai_report_draft'` BEFORE flipping `form_submissions.status` to `ai_draft_failed` BEFORE rethrowing (D-10). Single-file diff; +36 / -2 lines net.**

## Performance

- **Duration:** ~10 min
- **Tasks:** 2 (both committed atomically)
- **Files created:** 0
- **Files modified:** 1 (`app/admin/assessments/actions.ts`)

## Accomplishments

- **REPORT-03 wiring (D-02):** Plan 01's `lib/ai/` outputs are now load-bearing in the runtime AI path. The `runReportDraftGeneration` prompt is built by `buildReportPrompt(...)`; persona + no-hallucination guard are no longer inlined here, and the YELLOW BROOM exemplar is cited verbatim in the prompt header so Matt can audit any draft's lineage.
- **REPORT-01 (trigger → format prompt):** The auto-trigger from `submitAssessmentAction`'s `after()` callback and the manual `generateReportDraft` retry path both flow through the new prompt assembly.
- **REPORT-02 (structured output via Zod):** No change to the `generateObject` config — the `reportSchema` and `openai('openai/gpt-4o-mini')` provider config are intentionally preserved (D-01).
- **REPORT-07 (atomic status transitions):** Adds the missing `ai_draft_failed` failure state to the canonical status machine. Happy path still flips to `draft_ready_for_review`; failure path now flips to `ai_draft_failed` so the Review page can branch on it (Plan 06 owns the CTA).
- **REPORT-12 (workflow_errors visibility):** Any thrown error from `generateObject` (OpenRouter outage, Zod schema violation, network timeout) lands as a `workflow_errors` row tagged `workflow_name='ai_report_draft'` with `payload.submission_id` and `payload.stack`. The row surfaces automatically at `/admin/month-summary` (existing reader, no change needed).
- **D-06 hard contract upheld:** No `dispatchNotification` call exists anywhere inside the `runReportDraftGeneration` function body — confirmed by scoped grep (count == 0). The draft path remains delivery-side-effect-free; Plan 04 adds email dispatch inside `finalizeReport` only.
- **Threat mitigations landed:**
  - T-07-02-01 (prompt injection): NO_HALLUCINATION guard now precedes answers verbatim (from `buildReportPrompt`); `generateObject` Zod-schema-bound output channel unchanged.
  - T-07-02-02 (OPENROUTER_API_KEY disclosure): Key read only inside `runReportDraftGeneration` body via `process.env.OPENROUTER_API_KEY` (line 451); function is not exported.
  - T-07-02-03 (workflow_errors payload contents): `payload.stack` may contain repo paths — accepted, admin-only surface.
  - T-07-02-04 (DoS via repeated failures): No auto-retry loop introduced; row stays in `ai_draft_failed` until Matt retries.
  - T-07-02-05 (repudiation): `submission_id` captured in payload; auth context preserved at calling Server Action layer.
  - T-07-02-06 (cross-org RLS bypass via adminClient): Accepted per PATTERNS.md auth-gate section; callers are auth-gated.

## Task Commits

Each task was committed atomically on `main`:

1. **Task 1: Replace inline prompt with `buildReportPrompt` + YELLOW_BROOM_EXEMPLAR (REPORT-03 wiring, D-02)** — `ce549e7` (feat)
2. **Task 2: Wrap `generateObject` in workflow_errors + ai_draft_failed catch (REPORT-01/02/07/12, D-10)** — `8728942` (feat)

## Files Created/Modified

- `app/admin/assessments/actions.ts` — modified
  - Added 2 named imports near the top (after `expandRepeatingSections`):
    - `import { YELLOW_BROOM_EXEMPLAR } from "@/lib/ai/exemplars/yellow-broom-fra"`
    - `import { buildReportPrompt } from "@/lib/ai/prompt-builder"`
  - Replaced the inline prompt at the `generateObject` call site (was: `prompt: \`Act as a Fire Risk Assessor. Draft a professional report based on the following raw assessment answers:\n\n${JSON.stringify(expandedAnswers, null, 2)}\n\nDo NOT invent any hazards that are not explicitly stated in the input data. Summarize appropriately.\``) with `prompt: buildReportPrompt({ exemplar: YELLOW_BROOM_EXEMPLAR, exemplarLabel: "YELLOW BROOM 2023 FRA, anonymised", expandedAnswers })`. The literal string `"Act as a Fire Risk Assessor"` no longer appears anywhere in the file (grep count == 0).
  - Replaced the catch block body (was: `console.error("generateReportDraft failed:", err); throw new Error(\`Failed to generate report draft via AI: ${err.message || String(err)}\`)`) with the full D-10 sequence:
    1. `console.error("generateReportDraft failed:", err)` (preserved for dev visibility)
    2. `await adminClient.from("workflow_errors").insert({ workflow_name: "ai_report_draft", error_message: err?.message ?? String(err), payload: { submission_id: submissionId, stack: err?.stack ?? null, severity: "high" } })`
    3. `await adminClient.from("form_submissions").update({ status: "ai_draft_failed" }).eq("id", submissionId)`
    4. `revalidatePath(\`/admin/assessments/${submissionId}/review\`)`
    5. `throw new Error(\`Failed to generate report draft via AI: ${err.message || String(err)}\`)` (error-message shape unchanged, preserving the contract for `generateReportDraft`'s manual-retry wrapper)
  - Net diff: +36 / -2 lines across both commits.

## Before / After Snippets

### Prompt swap (Task 1)

**Before** (`actions.ts:466-472`):

```ts
const { object } = await generateObject({
  model: openai('openai/gpt-4o-mini'),
  schema: reportSchema,
  prompt: `Act as a Fire Risk Assessor. Draft a professional report based on the following raw assessment answers:\n\n${JSON.stringify(expandedAnswers, null, 2)}\n\nDo NOT invent any hazards that are not explicitly stated in the input data. Summarize appropriately.`,
})
```

**After** (`actions.ts:470-478`):

```ts
const { object } = await generateObject({
  model: openai('openai/gpt-4o-mini'),
  schema: reportSchema,
  prompt: buildReportPrompt({
    exemplar: YELLOW_BROOM_EXEMPLAR,
    exemplarLabel: "YELLOW BROOM 2023 FRA, anonymised",
    expandedAnswers,
  }),
})
```

The resulting prompt body now opens with the locked persona, no-hallucination guard, and `Few-shot reference: YELLOW BROOM 2023 FRA, anonymised` citation — none of which were present in the pre-swap inline literal.

### Catch block (Task 2)

**Before** (`actions.ts:492-495`):

```ts
} catch (err: any) {
  console.error("generateReportDraft failed:", err)
  throw new Error(`Failed to generate report draft via AI: ${err.message || String(err)}`)
}
```

**After** (`actions.ts:498-530`):

```ts
} catch (err: any) {
  console.error("generateReportDraft failed:", err)

  // D-10: log to workflow_errors BEFORE flipping status / rethrowing.
  await adminClient.from("workflow_errors").insert({
    workflow_name: "ai_report_draft",
    error_message: err?.message ?? String(err),
    payload: {
      submission_id: submissionId,
      stack: err?.stack ?? null,
      severity: "high",
    },
  })

  // D-10: flip status so the Review page can render the retry CTA (Plan 06)
  // instead of the generic "no draft yet" empty-state. Order: workflow_errors
  // insert FIRST so the audit row exists even if this update later fails.
  await adminClient
    .from("form_submissions")
    .update({ status: "ai_draft_failed" })
    .eq("id", submissionId)

  revalidatePath(`/admin/assessments/${submissionId}/review`)

  throw new Error(`Failed to generate report draft via AI: ${err.message || String(err)}`)
}
```

### Exact `workflow_errors` row shape now written on failure

```jsonc
{
  "workflow_name": "ai_report_draft",
  "error_message": "<err.message or stringified err>",
  "payload": {
    "submission_id": "<uuid of the failing submission>",
    "stack": "<err.stack or null>",
    "severity": "high"
  }
}
```

`resolved` defaults to `false`; `created_at` is set by the DB. `/admin/month-summary` reads via the standard `workflow_errors` query and will surface this row automatically — no change needed to the month-summary reader.

### D-06 dispatchNotification absence — verification

Scoped grep over the `runReportDraftGeneration` function body:

```text
awk '/async function runReportDraftGeneration/,/^}/' app/admin/assessments/actions.ts | grep -c "dispatchNotification"
==> 0
```

File-level grep is also 0 today — `dispatchNotification` will only appear in this file once Plan 04 wires it into `finalizeReport`, and even then it must stay outside `runReportDraftGeneration`.

## Decisions Made

- **Severity nested under `payload`, not as a top-level column.** PATTERNS.md correction #1 caught the CONTEXT D-10 wording drift: the live `workflow_errors` table (migrations/001:188-196) has only `workflow_name + error_message + payload` as writable columns. `severity` lives inside `payload.severity` per the existing convention in `cron/expiry/route.ts` and `admin/compliance/actions.ts`.
- **Stack trace included in payload despite path-leakage cost.** Accepted under T-07-02-03 — `/admin/month-summary` is admin-only, and the diagnostic value during the first weeks of post-launch operation outweighs the leakage. Customer PII is intentionally NOT included.
- **`revalidatePath` only the Review URL on failure, not `/admin/assessments`.** The Review page is the only surface that needs to flip its CTA between "Generate" and "Retry" states; the `/admin/review-queue` list page re-reads `status` on its own next render. Avoids an unnecessary cache bust.
- **Error-message string format preserved (` Failed to generate report draft via AI: ...`).** The manual Server Action wrapper at `generateReportDraft` propagates this error to the React client; any change would silently break Plan 06's error-toast copy.

## Deviations from Plan

None — plan executed exactly as written. Both `<automated>` verify blocks (Task 1 grep + tsc gate, Task 2 grep + scoped-awk + tsc gate) pass on the first run after each commit. No Rule 1/2/3 deviations were triggered.

**Total deviations:** 0
**Impact on plan:** All Plan 07-02 contracts uphold. Plan 07 (the integration test) can now mock OpenRouter to throw and assert (a) a `workflow_errors` row with `workflow_name='ai_report_draft'` exists, (b) `form_submissions.status == 'ai_draft_failed'`, (c) the Review page would render the retry CTA — without any further production-code changes.

## Issues Encountered

None. The two-task sequence ran clean. Pre-existing `npm run build` warning at `/admin/templates/[id]` (Plan 01 SUMMARY §Issues, `supabaseUrl is required` during page-data collection) is unchanged — out of scope for this plan per execute-plan rules.

## Self-Check: PASSED

Verified after writing this SUMMARY:
- `app/admin/assessments/actions.ts` — FOUND, contains both `buildReportPrompt(` and `workflow_name: "ai_report_draft"` literals.
- Commit `ce549e7` — FOUND in `git log` (Task 1).
- Commit `8728942` — FOUND in `git log` (Task 2).
- `tsc --noEmit` clean for the modified file — TYPECHECK_OK.
- Grep count for `"Act as a Fire Risk Assessor"` in `actions.ts` — 0.
- Scoped grep for `dispatchNotification` inside `runReportDraftGeneration` — 0.
- All Plan 07-02 `<automated>` verify gates re-run together — ALL PASSED.

## Next Phase Readiness

- **Plan 07-04 (finalizeReport extension, D-07/D-08)** unblocked — it adds `dispatchNotification(report_ready)` inside `finalizeReport` only. The D-06 contract that Plan 02 just locked in (no dispatch in `runReportDraftGeneration`) is now codified.
- **Plan 07-05 (month-summary surfacing)** unblocked — `workflow_name='ai_report_draft'` rows will start flowing in immediately when an AI failure occurs. No reader change required for the basic surfacing.
- **Plan 07-06 (Review UI retry CTA)** unblocked — the `ai_draft_failed` status is now produced and revalidated, so the Review page can branch on `submission.status === 'ai_draft_failed'` and render the retry CTA per the patterns in 07-PATTERNS.md.
- **Plan 07-07 (integration test, REPORT-12 acceptance D-11)** unblocked — the failure-path semantics it needs to assert against are now stable.

---
*Phase: 07-ai-report-pipeline*
*Completed: 2026-05-29*
