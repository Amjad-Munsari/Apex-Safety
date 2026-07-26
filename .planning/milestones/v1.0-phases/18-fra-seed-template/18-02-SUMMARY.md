---
phase: 18-fra-seed-template
plan: "02"
subsystem: server-actions
tags: [n8n, webhook, server-actions, ai-pipeline, vitest, fire-and-forget]

# Dependency graph
requires:
  - phase: 18-fra-seed-template
    plan: "01"
    provides: "migration 016 authored (not yet pushed)"
  - phase: 13-form-validation
    provides: "submitAssessmentAction validate+scrub+AI pipeline"
  - phase: 17-assignment-scheduling-notifications
    provides: "workflow_errors table + vitest scheduler test idiom"
provides:
  - "app/admin/assessments/actions.ts — submitAssessmentAction with inline n8n webhook fire (Phase 18 SC#5)"
  - "tests/scheduler/n8n-assessment-webhook.test.ts — 4-assertion regression spec"
affects:
  - 18-03 (ROADMAP SC#5 now satisfied from code side; UAT smoke in 18-03 confirms end-to-end)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Second after() callback immediately after the first (AI) after() — Option A pattern, independently observable in stack traces"
    - "Inline fire-and-forget POST (not extracted to lib/notifications/) per RESEARCH §Q5"
    - "Env-var-gated webhook (N8N_ASSESSMENT_WEBHOOK_URL guard + early return)"
    - "3s AbortSignal.timeout — prevents background task from hanging on a slow n8n endpoint"
    - "workflow_errors insert on catch, never re-throw — submission already written; n8n failure is a downstream concern"

key-files:
  created:
    - tests/scheduler/n8n-assessment-webhook.test.ts
  modified:
    - app/admin/assessments/actions.ts

key-decisions:
  - "Option A chosen: second after() callback rather than extending existing block — keeps the two background tasks independently observable in stack traces and logs"
  - "Inline, not extracted to lib/notifications/n8n-dispatch.ts — that helper targets a different URL (N8N_WEBHOOK_URL → general email routing); assessment webhook targets N8N_ASSESSMENT_WEBHOOK_URL (different workflow), per RESEARCH §Q5"
  - "client assignments.ts untouched (Pitfall P7 permanent invariant)"
  - "Legacy submitAssessment unchanged — both paths now fire the webhook"

# Metrics
duration: 20min
completed: 2026-05-27
---

# Phase 18 Plan 02: n8n Assessment Webhook Port Summary

**Inline n8n fire-and-forget POST wired into submitAssessmentAction via a second after() callback, gated on N8N_ASSESSMENT_WEBHOOK_URL, with 3s timeout and workflow_errors failure logging; guarded by 4 regression assertions.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-05-27
- **Tasks:** 2
- **Files modified:** 1 (actions.ts)
- **Files created:** 1 (spec)

## Accomplishments

### Task 1: Inline webhook fire into submitAssessmentAction

Inserted ~22 lines into `app/admin/assessments/actions.ts` immediately after the existing AI-draft `after(...)` block at line 308. Added as a SECOND `after(...)` callback (Option A), not an extension of the existing one.

**Exact insertion point:** after line 308 (closing brace of the AI `after()` callback), before the closing brace of `submitAssessmentAction`.

**Shape (mirrors legacy submitAssessment lines 194-212 byte-for-byte in logic):**
```ts
after(async () => {
  const webhookUrl = process.env.N8N_ASSESSMENT_WEBHOOK_URL
  if (!webhookUrl) return
  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ submissionId }),
      signal: AbortSignal.timeout(3000),
    })
  } catch (err) {
    console.error("Phase 18 SC#5 n8n webhook trigger failed", { submissionId, err })
    await adminClient.from("workflow_errors").insert({
      workflow_name: "assessment-submission-webhook",
      error_message: String(err),
      payload: { submissionId },
    })
  }
})
```

**Why Option A (second after()) instead of Option B (extend existing):** the two background tasks serve different purposes (AI draft generation vs. n8n Module 1 downstream). Keeping them as separate `after()` registrations makes each independently observable in Vercel logs and stack traces. A failure in one cannot affect the other's error reporting.

**Invariants confirmed:**
- Legacy `submitAssessment` (lines 166-215) is byte-for-byte unchanged — webhook fire and AI pipeline now both exist in the modern path
- `app/client/assignments/actions.ts` is untouched (Pitfall P7 permanent invariant)
- No new import added (`after`, `adminClient`, `fetch`-as-global, `AbortSignal` all already in scope)
- No new file under `lib/notifications/` or `lib/n8n/` — inline per RESEARCH §Q5 explicit guidance

### Task 2: Regression spec tests/scheduler/n8n-assessment-webhook.test.ts

Created spec (237 lines) with 4 `it()` blocks:

| # | Test name | What it asserts |
|---|-----------|-----------------|
| 1 | skips the webhook when N8N_ASSESSMENT_WEBHOOK_URL is unset | Empty env var → no fetch call to n8n URL, no workflow_errors insert |
| 2 | POSTs { submissionId } to the configured webhook URL with content-type JSON and a 3s timeout | Fetch called with correct URL, method POST, Content-Type header, body = JSON({ submissionId }), signal defined (AbortSignal.timeout) |
| 3 | inserts a workflow_errors row when fetch rejects, and never throws | fetch rejection → resolves undefined (no throw), workflowErrorsInsertSpy called with workflow_name='assessment-submission-webhook' + payload={submissionId} |
| 4 | does not insert workflow_errors when fetch resolves successfully | fetch success → no workflow_errors insert |

**Mock pattern used (hoisting-safe, same idiom as Phase 17 scheduler specs):**
- `vi.mock("@/lib/supabase/admin")` — `from()` dispatch by table name; workflow_errors + form_submissions + template_versions chains all stubbed
- `vi.mock("@/lib/auth-helpers")` — `requireActorUserId` resolves a fixed admin ID
- `vi.mock("next/server", { after: cb => cb() })` — eagerly invokes callbacks so tests can await side effects synchronously
- `vi.mock("next/cache")` + `vi.mock("next/navigation")` + `vi.mock("@/lib/supabase/server")` — prevent `server-only` errors in jsdom environment
- `vi.mock("@coltorapps/builder")` + `vi.mock("@/lib/form-builder")` + visibility mocks — suppress Phase 13/15 validation pipeline side effects
- `vi.mock("ai")` + `vi.mock("@ai-sdk/openai")` — suppress AI draft generation (not the target of this spec)
- `vi.spyOn(global, "fetch")` — intercept the webhook HTTP call
- `vi.stubEnv("N8N_ASSESSMENT_WEBHOOK_URL", ...)` — control the env-var gate per test

**Note on AI pipeline stderr:** the `runReportDraftGeneration` after() callback fires (eagerly, via the after() mock) and fails with "openai is not a function" because `createOpenAI` is mocked as a no-op. This error is caught and logged by the existing AI after() try/catch (`console.error("Auto report-draft generation failed")`). This is expected behavior — the AI pipeline is not the target of this spec, and the error is non-throwing. The 4 test assertions all pass.

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Wire n8n webhook into submitAssessmentAction | `d30786b` | `app/admin/assessments/actions.ts` (+30 lines) |
| 2 | Regression spec | `5e2f1e7` | `tests/scheduler/n8n-assessment-webhook.test.ts` (new, 237 lines) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Missing next/* and @/lib/supabase/server mocks**
- **Found during:** Task 2 first test run
- **Issue:** `submitAssessmentAction` is a Server Action; its module transitively imports `server-only` (via `@/lib/supabase/admin` and the `auth-helpers` → `@/lib/supabase/server` chain). In the jsdom Vitest environment, these throw "This module cannot be imported from a Client Component module" at test collection time.
- **Fix:** Added `vi.mock("next/cache")`, `vi.mock("next/navigation")`, and `vi.mock("@/lib/supabase/server")` to the test file, following the exact same pattern established by `tests/form-builder/upload-media-action.test.ts` (which mocks the same modules for the same reason). The plan's action outline noted "mocks may need adjustment" — this is the standard adjustment for Server Actions in the jsdom test environment.
- **Files modified:** `tests/scheduler/n8n-assessment-webhook.test.ts`
- **Impact:** Zero scope creep. All 4 test behaviors locked by the plan are preserved.

### Total deviations

1 auto-fixed (Rule 3 — blocking test infrastructure gap, standard fix for Server Actions in jsdom).

## Invariants Confirmed

- `grep -c "N8N_ASSESSMENT_WEBHOOK_URL" app/admin/assessments/actions.ts` = 3 (legacy `submitAssessment` + new `submitAssessmentAction` guard + new `submitAssessmentAction` fetch — ≥ 2 ✓)
- `grep -c "AbortSignal.timeout(3000)" app/admin/assessments/actions.ts` = 2 (one per function ✓)
- `grep -c "assessment-submission-webhook" app/admin/assessments/actions.ts` = 2 (one per function ✓)
- `grep -c "@/lib/notifications/n8n-dispatch" app/admin/assessments/actions.ts` = 0 (inline, not extracted ✓)
- `git diff --name-only main HEAD | grep "app/client/assignments/actions.ts"` = (empty) ✓
- `npm test -- tests/scheduler/n8n-assessment-webhook --run` = 4 passing ✓
- Pre-existing 4 failures in `tests/form-builder/specialty-entities.test.ts` unchanged (out-of-scope; documented in Plan 18-01)

## User Setup Required

None — Plan 18-02 is pure code changes. No DB push, no env var changes required to use the new code path (env var `N8N_ASSESSMENT_WEBHOOK_URL` already existed; the gate is additive).

## Next Plan Readiness

- **Plan 18-03** (BLOCKING: `supabase db push`, types regen, UAT) requires migration 016 from Plan 18-01. It can now also document ROADMAP SC#5 as satisfied (code-complete) in `18-UAT.md §D`. Plan 18-03 Task 4 should add a curl smoke (`curl -X POST $N8N_ASSESSMENT_WEBHOOK_URL -H 'Content-Type: application/json' -d '{"submissionId":"<real-id>"}'`) to confirm end-to-end against Matt's live n8n workflow.

---
*Phase: 18-fra-seed-template*
*Plan: 02*
*Completed: 2026-05-27*
