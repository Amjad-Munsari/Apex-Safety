---
phase: 07-ai-report-pipeline
verified: 2026-05-29T18:00:00Z
status: gaps_found
score: 9/12 must-haves verified (3 gaps)
overrides_applied: 0
gaps:
  - truth: "REPORT-08: Admin review UI shows the generated draft alongside the raw STT transcript verbatim"
    status: failed
    reason: "Page-level query selects `transcript` from `field_media`, but the column does not exist in any migration (001-016). Every visit to /admin/assessments/[id]/review for a real DB will produce a PostgREST 400 (`column field_media.transcript does not exist`) and the audioMedia fetch will silently return null, dropping STT into '(audio attached, no transcript yet)' placeholder. Functional STT transcript display is impossible without a schema migration."
    artifacts:
      - path: "app/admin/assessments/[id]/review/page.tsx"
        issue: "Line 30 selects `transcript` column that has no migration backing it"
      - path: "supabase/migrations/001_initial_schema.sql"
        issue: "field_media table (lines 100-108) lacks a `transcript` column; no later migration adds it"
    missing:
      - "Migration adding `transcript TEXT` to field_media table"
      - "OR: revise the select to drop transcript and have review-client.tsx render a stable placeholder when audio media exists"
      - "Plan 05 SUMMARY already flags this — orchestrator must surface a follow-up plan, not advance"

  - truth: "REPORT-05/REPORT-06: Branded PDF is rendered and stored in `reports` bucket"
    status: failed
    reason: "`@react-pdf/renderer` is declared in package.json (^4.5.1) but is NOT present in node_modules. Any attempt to invoke finalizeReport at runtime — the sole path that produces a client-deliverable PDF — will crash with `Cannot find module '@react-pdf/renderer'` at `lib/pdf/generator.tsx:2`. `npm run build` also fails for the same reason (documented in deferred-items.md). The PDF render contract is unreachable; the approve flow cannot save a PDF and therefore the entire delivery side of the phase goal ('produces a branded PDF report') is non-functional in this worktree state."
    artifacts:
      - path: "lib/pdf/generator.tsx"
        issue: "Imports `@react-pdf/renderer` (line 2) which is uninstalled"
      - path: "components/pdf/report-document.tsx"
        issue: "Imports `@react-pdf/renderer` which is uninstalled"
      - path: ".planning/phases/07-ai-report-pipeline/deferred-items.md"
        issue: "Documents the build failure but defers to a 'repo-level fix'; no plan in the wave addresses it"
    missing:
      - "Run `npm install` to restore @react-pdf/renderer (the explicit fix recommended in deferred-items.md)"
      - "Until then, finalizeReport cannot produce a PDF; ALL downstream truths (PDF in storage, status=completed, signed URL, n8n dispatch) cannot fire end-to-end"

  - truth: "REPORT-12 / D-11: workflow_errors rows are VISIBLE in /admin/month-summary"
    status: partial
    reason: "month-summary page (app/admin/month-summary/page.tsx) only displays a single COUNT of workflow_errors created this month (line 26-29) — it does NOT list individual rows, render workflow_name, error_message, or payload. CONTEXT D-10 explicitly states 'Row is visible in /admin/month-summary'; D-11 acceptance requires '(c) /admin/month-summary shows the error'. As implemented, Matt sees only a number ('Workflow Errors: 1'), not which workflow failed, why, or for which submission. The new `ai_report_draft` and `report_delivery_email` tags flow into the table (verified in actions.ts) but cannot be audited from the UI. Plan 07 frontmatter dismisses D-11(c) as 'covered transitively' which is incorrect — a count badge is not an audit surface."
    artifacts:
      - path: "app/admin/month-summary/page.tsx"
        issue: "Only count() of workflow_errors is displayed (lines 26-29, 67-75); no row-level rendering, no workflow_name filter, no error_message display"
      - path: "app/admin/month-summary/page.tsx"
        issue: "statusLabel/statusColor maps (lines 77-89) still reference legacy 'draft'/'delivered' tokens — the new D-09 canonical 'completed' and 'ai_draft_failed' would render as raw lowercase strings"
    missing:
      - "An errors list section that fetches recent workflow_errors rows (workflow_name + error_message + submission_id + created_at) and renders them with severity styling"
      - "OR: an audit page route or expanded card that lets Matt drill into the count to see individual rows"
      - "Status taxonomy update in the statusLabel/statusColor maps to align with D-09 (completed / ai_draft_failed / submitted / draft_ready_for_review)"

deferred:
  - truth: "REPORT-04: Site Risk variant has a comparable few-shot reference"
    addressed_in: "Future phase — blocked on Matt providing a Site Risk example"
    evidence: "07-CONTEXT.md §deferred 'Site Risk variant exemplar' and §decisions D-02 explicitly defer; SITE_RISK_EXEMPLAR is wired as `string | null = null` stub keeping the import surface stable"
  - truth: "REPORT-05 brand logo image in PDF"
    addressed_in: "Future phase — blocked on brand assets"
    evidence: "07-CONTEXT.md §deferred 'Brand logo image in PDF (REPORT-05 partial)'; text wordmark is the v1 contract"

human_verification:
  - test: "Run a real OpenRouter call end-to-end (assuming @react-pdf/renderer reinstalled and field_media.transcript added)"
    expected: "Submitted FRA → AI draft appears in Review UI within ~30s, raw answers + STT visible, Approve produces PDF in storage, client receives delivery email via n8n"
    why_human: "Requires live OpenRouter credentials, n8n webhook, real Supabase, Matt's test client; cannot be programmatically verified without external services"
  - test: "Verify the YELLOW_BROOM_EXEMPLAR produces high-quality drafts in practice"
    expected: "AI draft tone matches Matt's authoring style; no invented hazards; severities calibrated"
    why_human: "Quality of LLM output is a domain-expert judgment (Matt) per AI-SPEC §5 'Manual Human in the Loop'"
  - test: "Verify the D-04 Raw Answers panel is readable on Matt's typical screen and the one-time auto-expand feels right"
    expected: "Panel is legible; auto-expand on fresh draft, collapsed on re-visit"
    why_human: "Visual/UX evaluation"
  - test: "Verify the email delivered via n8n renders correctly in Matt's Proton client and the 7-day signed URL works for an external recipient"
    expected: "Email subject 'Your Fire Risk Assessment is ready — {client_name}', signed URL opens the PDF for an unauthenticated browser"
    why_human: "End-to-end Proton + n8n + Supabase signed-URL flow needs a live test recipient"
---

# Phase 7: AI Report Pipeline — Verification Report

**Phase Goal:** A submitted FRA assessment produces a branded PDF report that lands in Matt's review queue within minutes — AI draft from raw answers + STT, Admin Review & Approve UI with raw-vs-draft, branded PDF render + storage, atomic status transitions, workflow_errors logging, client-delivery email on approve.

**Verified:** 2026-05-29
**Status:** gaps_found
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (mapped to REPORT-01..12)

| #   | Truth (REPORT ID + D-decision) | Status     | Evidence       |
| --- | ------------------------------ | ---------- | -------------- |
| 1   | REPORT-01: Submission triggers AI prompt formatting via `runReportDraftGeneration` | VERIFIED | actions.ts:469-478 calls `buildReportPrompt({exemplar, exemplarLabel, expandedAnswers})`; `submitAssessmentAction`'s `after()` hook invokes it; legacy "Act as a Fire Risk Assessor" literal grep count = 0 |
| 2   | REPORT-02: GPT-4 invoked with JSON-schema structured output via Zod | VERIFIED | actions.ts:454-464 declares `reportSchema` (executiveSummary / hazards / complianceStatus enums); generateObject({model: openai('openai/gpt-4o-mini'), schema: reportSchema, ...}) at :472; AI-SPEC §2 framework lock honoured |
| 3   | REPORT-03 / D-02: YELLOW BROOM few-shot reference injected into FRA prompt | VERIFIED | `lib/ai/exemplars/yellow-broom-fra.ts` exports a JSON-stringified exemplar (≤2KB, 3 hazards across Low/Medium/High, sanitised identifiers); prompt-builder.ts injects it with citation `Few-shot reference: YELLOW BROOM 2023 FRA, anonymised`; verbatim PERSONA + NO_HALLUCINATION from CONTEXT §specifics |
| 4   | REPORT-04: Site Risk variant has comparable few-shot reference | DEFERRED | `lib/ai/exemplars/site-risk.ts` exports `SITE_RISK_EXEMPLAR: string \| null = null`; explicitly blocked on Matt's example per CONTEXT §deferred — wiring is stable for a one-line swap |
| 5   | **REPORT-05 / REPORT-06: Branded PDF rendered and stored in `reports` bucket** | **FAILED** | `@react-pdf/renderer` is NOT installed in node_modules despite being in package.json `^4.5.1`. `npm run build` fails with `Module not found: Can't resolve '@react-pdf/renderer'`. finalizeReport's dynamic import `await import("@/lib/pdf/generator")` crashes at runtime. The PDF cannot be rendered, uploaded, or signed. (Text wordmark vs brand logo deferred per CONTEXT, but the renderer itself must work.) |
| 6   | REPORT-07 / D-09: Atomic status transitions — `report_storage_path` + `status='completed'` written in a single UPDATE | VERIFIED | actions.ts:751-760 `.update({draft_report_json, report_storage_path: fileName, status: "completed"}).eq("id", submissionId)` — single statement; canonical D-09 status taxonomy used (no legacy 'delivered') |
| 7   | **REPORT-08: Admin review UI shows draft alongside raw STT transcript verbatim** | **FAILED** | Page-level fetch queries non-existent `field_media.transcript` column. Will produce a PostgREST 400 at runtime; `audioMedia` is silently null; STT transcripts cannot surface. Plan 05 SUMMARY explicitly flagged this gap. The collapsible panel UI is built (review-client.tsx:240-264) but its STT data source is unreachable. |
| 8   | REPORT-09: Matt can approve, regenerate, or edit the PDF before delivery | VERIFIED (UI only) | review-client.tsx exposes editable textareas (Executive Summary), per-hazard fields, complianceStatus radio, Regenerate button, and "Approve & Generate PDF" CTA; handleApprove calls finalizeReport with edited draft. (Runtime blocked by item #5 PDF renderer.) |
| 9   | REPORT-10 / D-07: Approved PDFs flip status='completed' and dispatch n8n `report_ready` | VERIFIED | actions.ts:797-832 mints 7-day signed URL, dispatches via `dispatchNotification({type: "report_ready", client_email, client_name, report_url, assessment_date, report_storage_path})`; NotificationPayload union extended in lib/notifications/n8n-dispatch.ts:31-37 |
| 10  | REPORT-11 / D-06: No PDF auto-delivered without Matt's explicit approval | VERIFIED | Scoped grep `awk '/async function runReportDraftGeneration/,/^}/' actions.ts \| grep -c dispatchNotification` = 0; contract test `D-06 / REPORT-11` (2 cases) green; ONLY finalizeReport (post-Approve click) calls dispatchNotification |
| 11  | **REPORT-12 / D-11: workflow_errors rows visible in admin dashboard** | **PARTIAL** | Rows ARE inserted (verified via test 3+5 green, workflow_name='ai_report_draft' and 'report_delivery_email' both write correctly); however, /admin/month-summary only DISPLAYS A COUNT (page.tsx:26-29, 67-75) — no row-level rendering of workflow_name/error_message/submission_id. Matt sees 'Workflow Errors: N' but cannot audit what failed. D-11 acceptance (c) is unmet. |
| 12  | D-10: Catch-block ordering (workflow_errors INSERT before status flip before rethrow) | VERIFIED | actions.ts:507-525 — insert → update → revalidatePath → throw; contract test #3 asserts callLog ordering green |

**Score:** 9/12 truths verified (3 gaps: REPORT-05/06 combined, REPORT-08, REPORT-12)

---

## Deferred Items

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | REPORT-04 Site Risk exemplar content | Future phase | CONTEXT §deferred — blocked on Matt's example; stub null wired |
| 2 | REPORT-05 brand logo image (raster) in PDF | Future phase | CONTEXT §deferred — text wordmark only for v1 |

---

## Required Artifacts

| Artifact | Expected    | Status | Details |
| -------- | ----------- | ------ | ------- |
| `lib/ai/exemplars/yellow-broom-fra.ts` | YELLOW_BROOM_EXEMPLAR const string, ≤2KB, schema-shaped JSON | VERIFIED | 3084-byte file; exported const is JSON-stringified object (~2004 bytes payload) with executiveSummary, 3 hazards (High/Medium/Low), complianceStatus='Action Required'; sanitised identifiers present |
| `lib/ai/exemplars/site-risk.ts` | SITE_RISK_EXEMPLAR stub = null | VERIFIED | 718-byte file; exports `string \| null = null`; header documents the stub status |
| `lib/ai/prompt-builder.ts` | buildReportPrompt pure assembler with locked persona + guard | VERIFIED | PERSONA + NO_HALLUCINATION verbatim from CONTEXT §specifics (em-dash preserved); output order: persona → guard → citation → exemplar → divider → JSON-stringified answers |
| `lib/notifications/n8n-dispatch.ts` | NotificationPayload union extended with report_ready | VERIFIED | Lines 30-37 add the 6-field variant; dispatchNotification body unchanged |
| `app/admin/assessments/actions.ts` | runReportDraftGeneration uses buildReportPrompt + workflow_errors wrap; finalizeReport mints 7-day URL + dispatches report_ready | VERIFIED | Both functions wired correctly; D-06 contract preserved (no dispatch in draft path); D-10 ordering preserved (insert → update → revalidate → throw); D-08 fallback present (workflow_errors row + deliveryEmailFailed flag, no rollback) |
| `app/admin/assessments/[id]/review/page.tsx` | Two-step fetch of pinned schema + audio media | PARTIAL/ARTIFACT_BROKEN | Two-step fetch present, but selects non-existent `transcript` column from field_media — runtime failure path |
| `app/admin/assessments/[id]/review/review-client.tsx` | D-04 collapsible panel + D-11 retry CTA + D-08 deliveryEmailFailed toast | VERIFIED (UI) | Panel renders above editable draft (line 240), `<details>` with one-time auto-expand; ai_draft_failed branch renders "Retry Draft" headline + /admin/month-summary pointer; toast.warning/success with D-08 verbatim strings; no client-side dispatch added |
| `tests/phase07/ai-report-pipeline.test.ts` | 5 Vitest contract tests pinning D-06/D-08/D-10/D-11 | VERIFIED | `npx vitest run tests/phase07/ai-report-pipeline.test.ts` → 5/5 passed in 2.85s; tests cover happy path, AI failure path (no email), workflow_errors ordering, status flip, dispatch fallback non-rollback. (Test directory deviation from PLAN frontmatter is documented in 07-07 SUMMARY; vitest.config.ts include glob updated.) |
| `lib/pdf/generator.tsx` (transitive dep) | @react-pdf/renderer installed and resolvable | **MISSING** | Imports `@react-pdf/renderer` (line 2); `ls node_modules/@react-pdf/renderer` → not found; documented in deferred-items.md but not addressed in any Phase 7 plan |

---

## Key Link Verification

| From | To  | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| `actions.ts:runReportDraftGeneration` | `lib/ai/prompt-builder.ts buildReportPrompt` | named import + call | WIRED | Import line 17-18; call at actions.ts:474 |
| `actions.ts:runReportDraftGeneration` catch | `workflow_errors` table | adminClient.insert with workflow_name='ai_report_draft' | WIRED | Line 508-516; payload includes submission_id, stack, severity='high'; contract test 3 verifies row shape |
| `actions.ts:finalizeReport` | `lib/notifications/n8n-dispatch dispatchNotification` | report_ready payload | WIRED | Line 822 invokes with 6-field payload; T-07-04-02 mitigation present (7-day URL not returned to caller) |
| `actions.ts:finalizeReport` fallback | `workflow_errors` | adminClient.insert with workflow_name='report_delivery_email' | WIRED | Line 826-831; contract test 5 verifies row + no status rollback |
| `review/page.tsx` | `ReviewClient` | typed props (submission, schemaJson, audioMedia) | WIRED | Line 36-42; Plan 05's transient `as any` cast removed by Plan 06 |
| `review/page.tsx` | `field_media.transcript` | `.select("field_id, storage_path, transcript")` | **BROKEN** | Column does not exist in schema (migrations 001-016); will produce PostgREST 400 |
| `review-client.tsx handleApprove` | `finalizeReport return.deliveryEmailFailed` | toast branching | WIRED | Line 183-187 branches on flag; D-08 strings verbatim |
| `finalizeReport` | `@react-pdf/renderer` (via `lib/pdf/generator`) | dynamic import | **BROKEN** | Module not installed in node_modules; dynamic import will throw at runtime |
| `review-queue/page.tsx` | `form_submissions.status='draft_ready_for_review'` | `getReportsAwaitingReview` | WIRED | `lib/supabase/dashboard.ts:78` filters by canonical D-09 token |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| review-client.tsx Raw Answers panel | `rawRows` | `buildRawAnswerRows(schemaJson, submission.answers_json, audioMedia)` walking schema entities | NO (audioMedia is empty/null due to schema gap; answers_json flows but transcripts do not) | HOLLOW |
| review-client.tsx editable draft fields | `draft.executiveSummary`, `draft.hazards`, `draft.complianceStatus` | `submission.draft_report_json` (populated by runReportDraftGeneration when OpenRouter is healthy) | YES (when AI path runs to completion) | FLOWING |
| month-summary Workflow Errors card | `errorsRes.count` | `count("exact", head=true)` over workflow_errors | YES (count number) | FLOWING (count only) — but rows themselves are NOT surfaced |
| finalizeReport PDF buffer | `pdfBuffer` | `await generateReportPdfBuffer(...)` from `lib/pdf/generator` | NO — `@react-pdf/renderer` not installed; throws at runtime | DISCONNECTED |
| dispatchNotification call | `payload.report_url` | `createSignedUrl(fileName, 60*60*24*7)` against `reports` bucket | YES (assuming upload step succeeded — gated on PDF buffer) | DEPENDS_ON_PDF |

---

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Phase 7 contract tests pass | `npx vitest run tests/phase07/ai-report-pipeline.test.ts` | 5/5 passed in 2.85s | PASS |
| YELLOW_BROOM_EXEMPLAR is JSON-parseable and within byte budget | inspect lib/ai/exemplars/yellow-broom-fra.ts | 3084-byte source / ≤2KB payload after JSON.stringify; 3 hazards across enum severities | PASS |
| prompt-builder exports buildReportPrompt with verbatim persona/guard | grep PERSONA + NO_HALLUCINATION in lib/ai/prompt-builder.ts | verbatim CONTEXT §specifics text including em-dash | PASS |
| Vitest globs include tests/phase07 | inspect vitest.config.ts include array | `"tests/phase07/**/*.{test,spec}.{ts,tsx}"` added per 07-07 SUMMARY | PASS |
| @react-pdf/renderer resolves | `ls node_modules/@react-pdf/renderer` | not found | FAIL |
| field_media has transcript column | `grep -E "transcript" supabase/migrations/*` | only 2 hits in 001 (for `field_media` table mention) — no column definition | FAIL |
| TypeScript compile clean for Phase 7 files | `tsc --noEmit` filtered to Phase 7 files | no errors emitted for actions.ts / review-client.tsx / page.tsx / n8n-dispatch.ts / lib/ai/* | PASS |
| Git commits exist for each claimed plan | `git log --oneline` | All 12 claimed commits present (5bd043a, ce9edf2, e97ec7d, ce549e7, 8728942, 9877f98, 395243b, 665ede8, 1ea7c70, 23da957, 30589c9, plus doc commits) | PASS |

---

## Probe Execution

Phase 7 PLAN/SUMMARY does not declare conventional `scripts/*/tests/probe-*.sh` style probes (this is a Next.js app phase, not a migration/CLI tooling phase). The Vitest contract suite serves as the equivalent runnable check and is exercised in Behavioral Spot-Checks above. SKIPPED (no probes declared for this phase).

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| REPORT-01 | 07-02 | Submission → AI prompt formatting (n8n in original wording; CONTEXT supersedes with in-process Vercel AI SDK) | SATISFIED | runReportDraftGeneration wired with buildReportPrompt; submitAssessmentAction `after()` hook still triggers it (Phase 6 baseline) |
| REPORT-02 | 07-02 | GPT-4 structured output | SATISFIED | generateObject + Zod reportSchema; AI-SPEC framework lock honoured |
| REPORT-03 | 07-01, 07-02 | YELLOW BROOM few-shot reference | SATISFIED | YELLOW_BROOM_EXEMPLAR + buildReportPrompt citation line |
| REPORT-04 | 07-01 | Site Risk few-shot | DEFERRED | Stub wired; content blocked on Matt's example (CONTEXT §deferred) |
| REPORT-05 | 07-04 | Branded PDF render | BLOCKED | @react-pdf/renderer missing from node_modules — render path unreachable at runtime |
| REPORT-06 | 07-04 | PDF stored in `reports` bucket | BLOCKED | Upload code exists (actions.ts:738-748) but transitively blocked by REPORT-05 (no PDF to upload) |
| REPORT-07 | 07-02, 07-04 | Atomic status + path update | SATISFIED | Single `.update()` writes both columns; D-09 'completed' token (instead of legacy 'delivered' from REQUIREMENTS.md — explicit CONTEXT override) |
| REPORT-08 | 07-05, 07-06 | Raw STT transcript shown alongside draft | BLOCKED | UI shipped; data source broken (`field_media.transcript` column missing) |
| REPORT-09 | 07-06 | Approve/regenerate/edit | SATISFIED (UI) | All three controls present in review-client.tsx; runtime blocked downstream by REPORT-05 |
| REPORT-10 | 07-03, 07-04 | Approved PDFs trigger n8n delivery email; status='delivered' (CONTEXT supersedes → 'completed') | SATISFIED | NotificationPayload.report_ready variant + dispatchNotification call wired; D-09 status flip to 'completed' |
| REPORT-11 | 07-06, 07-07 | No PDF auto-delivered without Matt approval | SATISFIED | D-06 grep == 0; contract tests 1+2 lock the absence; review-client adds no dispatch path |
| REPORT-12 | 07-02, 07-07 | n8n error workflow writes to workflow_errors visible in admin dashboard | PARTIAL | workflow_errors writes work (verified); but admin dashboard only shows COUNT, not rows — D-11(c) acceptance unmet |

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `app/admin/assessments/[id]/review/page.tsx` | 30 | `.select("field_id, storage_path, transcript")` — non-existent column | 🛑 Blocker | Runtime PostgREST 400 on every Review page load with audio media |
| `lib/pdf/generator.tsx` (and `components/pdf/*-document.tsx`) | 2 | `import "@react-pdf/renderer"` against uninstalled dep | 🛑 Blocker | finalizeReport throws at runtime; build fails |
| `app/admin/month-summary/page.tsx` | 77-89 | statusLabel/statusColor maps use legacy 'draft'/'delivered' tokens | ⚠️ Warning | New D-09 canonical statuses ('completed', 'ai_draft_failed') render as raw lowercase strings |
| `app/admin/month-summary/page.tsx` | 26-29 | workflow_errors fetched as count-only, never as row list | ⚠️ Warning | D-11(c) acceptance "/admin/month-summary shows the error" unmet — only a number is visible |
| `.planning/phases/07-ai-report-pipeline/deferred-items.md` | — | Two BLOCKER-level repo-state issues (env, @react-pdf/renderer) are deferred without a closure plan or follow-up | ⚠️ Warning | Out-of-scope-shaped notes for problems that prevent the phase from running end-to-end |
| `supabase/migrations/002_phase7_draft_report.sql` | 5 | `status text DEFAULT 'Draft'` legacy default vs D-09 lowercase taxonomy | ℹ️ Info | Known inconsistency per CONTEXT D-09; new code always sets status explicitly so the default is never hit — accepted |

No `TBD`, `FIXME`, or `XXX` debt markers found in Phase 7-modified files (verified via grep).

---

## Human Verification Required

(See frontmatter `human_verification` for details. Items defer behaviour that requires a live OpenRouter/n8n/Proton stack or Matt's domain-expert judgment.)

---

## Gaps Summary

The phase has shipped substantial scaffolding and the contract tests prove the catch-block / dispatch-fallback ordering invariants. **However, three gaps prevent the phase goal from being achievable end-to-end:**

1. **PDF render path is broken at the repo level** — `@react-pdf/renderer` is in package.json but missing from node_modules. Without it, `finalizeReport` cannot produce a PDF, so the central artefact promised by the phase goal ("produces a branded PDF report") cannot land in storage. This is documented in `deferred-items.md` but was punted out of every plan in the wave. Either run `npm install` to close it, or surface a follow-up plan that runs it as part of phase acceptance.

2. **STT transcript display is structurally broken** — Plan 05's SUMMARY itself flags that `field_media.transcript` does not exist in any migration, but the column is still being selected in `page.tsx`. The plan instructed "Followed the plan literally on field_media `transcript` column selection despite the column not existing." This is a known-broken query shipped into a goal-critical surface. REPORT-08 ("raw STT transcript verbatim") cannot function. Need a migration or a graceful UI fallback.

3. **REPORT-12 admin-dashboard visibility is overstated** — workflow_errors rows ARE being inserted with the right tags, but `/admin/month-summary` only renders a count. D-11(c) acceptance ("`/admin/month-summary` shows the error") and CONTEXT D-10 ("Row is visible in `/admin/month-summary`") both require row-level rendering. A count badge is not an auditable surface. Either expand the page to list recent errors, or revise the contract.

**Strengths to preserve:**
- D-06 hard contract (no email from draft path) is robust — both scoped grep AND contract tests lock it.
- D-10 ordering (workflow_errors insert before status flip before rethrow) is provably correct via callLog assertion.
- D-08 dispatch-fallback (no rollback, deliveryEmailFailed surfaces to UI) works against the test seam.
- PERSONA + NO_HALLUCINATION text is verbatim from CONTEXT including em-dash.
- finalizeReport's atomic update (report_storage_path + status='completed' in one statement) is preserved.

**Recommendation:** Do NOT mark Phase 7 complete in the roadmap. Open a follow-up plan covering: (a) `npm install` + verification that build succeeds, (b) field_media.transcript migration OR graceful fallback in review-client, (c) month-summary errors-list section. Items (a) and (b) are non-negotiable for the phase goal; (c) closes the D-11 contract.

---

*Verified: 2026-05-29T18:00:00Z*
*Verifier: Claude (gsd-verifier)*
