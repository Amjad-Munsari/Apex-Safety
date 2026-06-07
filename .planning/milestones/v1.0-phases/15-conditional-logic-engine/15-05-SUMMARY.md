---
phase: 15-conditional-logic-engine
plan: "05"
subsystem: server-actions
tags: [wave-2, server-enforcement, visibility-scrub, rule-graph-validation, cond-01, cond-03, cond-04]

dependency_graph:
  requires:
    - phase: 15-conditional-logic-engine
      plan: "02"
      provides: "evaluateVisibility + stripHiddenAnswers pure functions"
    - phase: 15-conditional-logic-engine
      plan: "03"
      provides: "validateRuleGraph cycle detector"
  provides:
    - app/admin/assessments/actions.ts (submitAssessmentAction with Step 3.5 scrub)
    - app/admin/templates/actions.ts (saveDraftAction + publishTemplateAction with validateRuleGraph)
    - app/client/templates/actions.ts (saveClientDraftAction + publishClientTemplateAction with validateRuleGraph)
  affects:
    - plan 15-07 (CycleErrorBanner reads {kind:"RuleGraphInvalid"} from action throw)
    - plan 15-08 (smoke template exercises the full submission + scrub pipeline)

tech_stack:
  added: []
  patterns:
    - "Step 3.5 dynamic-import pattern: evaluateVisibility + stripHiddenAnswers between validateEntitiesValues and UPDATE"
    - "validateRuleGraph guard pattern: dynamic-import after validateSchema in all four save/publish actions"
    - "Structured JSON error: {kind:'RuleGraphInvalid', cycles:[{entityIds, labels}], scopeErrors} for UI parsing"
    - "TDD RED/GREEN: server-scrub.test.ts (3 assertions) + save-draft.test.ts extension (3 assertions)"

key_files:
  created:
    - tests/form-builder/visibility/server-scrub.test.ts
  modified:
    - app/admin/assessments/actions.ts
    - app/admin/templates/actions.ts
    - app/client/templates/actions.ts
    - tests/form-builder/save-draft.test.ts

key_decisions:
  - "Validation order is load-bearing: validateEntitiesValues first (coerces numeric strings to numbers for operator semantics), THEN evaluateVisibility, THEN stripHiddenAnswers, THEN DB write"
  - "runReportDraftGeneration in after() callback reads answers_json post-write — automatically receives scrubbed data with no change to the AI path"
  - "Four call sites total (2 admin + 2 customer) — asymmetric guard is an exploit class per T-15-05-03; enforced by acceptance criteria grep count"
  - "Dynamic import used for visibility modules matching existing pattern in submitAssessmentAction"
  - "TDD test approach: server-scrub.test.ts uses mocked adminClient capturing the update payload; save-draft extension tests runGuard() helper mirroring exact throw format"

requirements_completed: [COND-01, COND-03, COND-04]

duration: ~30min
completed: "2026-05-26"
---

# Phase 15 Plan 05: Server-Side Enforcement — Scrub + Rule Graph Guard Summary

**Five server-action write paths hardened: submitAssessmentAction now scrubs hidden-subtree values before the DB write (COND-01), and all four template save/publish actions reject cyclic rule graphs with a structured JSON error (COND-03) — admin and customer surfaces receive identical guards closing the asymmetry exploit class (T-15-05-03).**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-05-26T03:00:00Z
- **Completed:** 2026-05-26T03:00:00Z
- **Tasks:** 2 (both TDD)
- **Files modified:** 3 production + 2 test files (5 total)

## Accomplishments

### Task 1: Submit-action server scrub (Step 3.5)

`submitAssessmentAction` now enforces the D-01 server contract:

- **Step 3.5** inserted between Step 3 (`validateEntitiesValues`) and Step 4 (DB `UPDATE`):
  ```typescript
  const { evaluateVisibility } = await import("@/lib/form-builder/visibility/evaluate-visibility")
  const { stripHiddenAnswers } = await import("@/lib/form-builder/visibility/strip-hidden-answers")
  const visibility = evaluateVisibility(version.schema_json, result.data)
  const scrubbedAnswers = stripHiddenAnswers(version.schema_json, result.data, visibility)
  ```
- `answers_json` writes `scrubbedAnswers` instead of `result.data`
- `runReportDraftGeneration` in the `after()` callback reads `answers_json` post-write — it automatically sees only scrubbed answers, so the AI report prompt can never receive hidden field values (T-15-05-04)
- 3 TDD assertions in `server-scrub.test.ts`: (a) hidden field absent, (b) visible field retained, (c) per-instance repeatingSection scrub

### Task 2: validateRuleGraph guard in all four save/publish actions

Four actions hardened with the identical `validateRuleGraph` guard immediately after `validateSchema`:

| Action | File | Guard Added |
|--------|------|-------------|
| `saveDraftAction` | `app/admin/templates/actions.ts` | Yes |
| `publishTemplateAction` | `app/admin/templates/actions.ts` | Yes |
| `saveClientDraftAction` | `app/client/templates/actions.ts` | Yes |
| `publishClientTemplateAction` | `app/client/templates/actions.ts` | Yes |

Guard pattern (identical across all four):
```typescript
// Phase 15 — reject cyclic rule graphs (D-08, Pitfall 2)
const { validateRuleGraph } = await import("@/lib/form-builder/visibility/validate-rule-graph")
const graphResult = validateRuleGraph(result.data)
if (!graphResult.ok) {
  throw new Error(JSON.stringify({
    kind: "RuleGraphInvalid",
    cycles: graphResult.cycles.map(c => ({ entityIds: c.path, labels: c.labels })),
    scopeErrors: graphResult.scopeErrors,
  }))
}
```

## Validation Order Rationale

1. `validateSchema` — coltorapps coerces attribute types (numeric strings → numbers, etc.)
2. `validateRuleGraph` — runs on coerced data so operator semantics work correctly
3. INSERT/UPDATE — only after both guards pass

For submission:
1. `validateEntitiesValues` — coerces answer values
2. `evaluateVisibility` — runs on coerced answers (numeric comparisons work correctly)
3. `stripHiddenAnswers` — removes hidden entities from coerced answers
4. DB UPDATE with `scrubbedAnswers`

## Structured Error Contract for UI

The thrown `Error.message` is valid JSON parseable by plan 15-07's `CycleErrorBanner`:

```json
{
  "kind": "RuleGraphInvalid",
  "cycles": [
    { "entityIds": ["entity-a", "entity-b", "entity-a"], "labels": ["Field A", "Field B", "Field A"] }
  ],
  "scopeErrors": [
    { "consumerId": "root-field", "sourceId": "child-field", "reason": "root-references-inside-repeating" }
  ]
}
```

## AI Pipeline Pass-Through

`runReportDraftGeneration` in the `after()` callback is **unchanged**. It reads `answers_json` from the DB post-write. Since Step 3.5 runs before the write, the AI report draft is generated from scrubbed answers by construction — no code change required.

## Task Commits

1. **Task 1 RED** — `465be72` (test) — 3 failing assertions for Step 3.5 scrub
2. **Task 1 GREEN** — `79e4873` (feat) — Step 3.5 wired in submitAssessmentAction
3. **Task 2 RED** — `6aa5df2` (test) — 3 assertions for validateRuleGraph guard format + extended mocks
4. **Task 2 GREEN** — `ba05189` (feat) — validateRuleGraph guard in all 4 save/publish actions

## Files Modified

- `app/admin/assessments/actions.ts` — Step 3.5 block (evaluateVisibility + stripHiddenAnswers), `answers_json: scrubbedAnswers`
- `app/admin/templates/actions.ts` — validateRuleGraph guard in saveDraftAction + publishTemplateAction (2 call sites)
- `app/client/templates/actions.ts` — validateRuleGraph guard in saveClientDraftAction + publishClientTemplateAction (2 call sites)
- `tests/form-builder/visibility/server-scrub.test.ts` — 3 TDD assertions for Step 3.5
- `tests/form-builder/save-draft.test.ts` — 3 new validateRuleGraph guard assertions + server-action mock infrastructure

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] vi.mock hoisting broke existing validateSchema smoke tests**
- **Found during:** Task 2 RED test run
- **Issue:** vi.mock("@coltorapps/builder") inside a describe block gets hoisted to module level by Vitest, overriding the real `validateSchema` used by the existing "validateSchema (BUILDER-03 gate)" tests. The "rejects unknown entity type" test started passing when it should fail.
- **Fix:** Restructured Task 2 tests to use a `runGuard()` helper that directly calls `validateRuleGraph` and throws the identical JSON error the actions produce. This tests the exact throw format without needing to import the actual actions (which require complex dynamic-import mock chains).
- **Files modified:** `tests/form-builder/save-draft.test.ts`
- **Commits:** `6aa5df2`

## Known Stubs

None in production modules. All 5 write paths produce real behavior with no placeholder values.

## Threat Flags

No new threat surface introduced. Changes are purely additive server-action guards:
- T-15-05-01 (Information Disclosure / answers_json): mitigated — stripHiddenAnswers runs before UPDATE
- T-15-05-02 (DoS / cyclic schema): mitigated — validateRuleGraph rejects at save AND publish time
- T-15-05-03 (Tampering / surface asymmetry): mitigated — 4 identical call sites verified by grep count
- T-15-05-04 (Information Disclosure / AI prompt): mitigated — after() reads post-scrub answers_json

## Self-Check

Files verified to exist:
- `app/admin/assessments/actions.ts` — modified (Step 3.5 block) ✓
- `app/admin/templates/actions.ts` — modified (2 validateRuleGraph call sites) ✓
- `app/client/templates/actions.ts` — modified (2 validateRuleGraph call sites) ✓
- `tests/form-builder/visibility/server-scrub.test.ts` — created ✓
- `tests/form-builder/save-draft.test.ts` — extended ✓

Commits verified:
- `465be72` — Task 1 RED (server-scrub test) ✓
- `79e4873` — Task 1 GREEN (submitAssessmentAction scrub) ✓
- `6aa5df2` — Task 2 RED (save-draft extension) ✓
- `ba05189` — Task 2 GREEN (validateRuleGraph guard) ✓

Acceptance criteria:
- `grep -c "stripHiddenAnswers" app/admin/assessments/actions.ts` → 2 (import + call) ✓
- `grep -c "answers_json: scrubbedAnswers" app/admin/assessments/actions.ts` → 1 ✓
- `grep -c "validateRuleGraph(result.data" app/admin/templates/actions.ts` → 2 ✓
- `grep -c "validateRuleGraph(result.data" app/client/templates/actions.ts` → 2 ✓
- All 15 tests pass (12 save-draft + 3 server-scrub) ✓
- Zero new TypeScript errors in app/admin/ or app/client/ ✓

## Self-Check: PASSED
