---
phase: 07-ai-report-pipeline
plan: 06
subsystem: admin-review-ui
tags: [client-component, review-page, raw-answers-panel, retry-cta, delivery-toast]
requirements:
  - REPORT-08
  - REPORT-09
  - REPORT-11
dependency_graph:
  requires:
    - "Plan 07-05 — ReviewPage Server Component fetches schemaJson + audioMedia and forwards them via spread cast"
    - "Plan 07-04 — finalizeReport returns { success, downloadUrl, deliveryEmailFailed }"
    - "Plan 07-02 — runReportDraftGeneration drives status='ai_draft_failed' on failure"
  provides:
    - "Typed ReviewClient props { submission, schemaJson, audioMedia } — closes Plan 05's transient {...as any} cast"
    - "D-04 collapsible 'Raw Answers & STT' panel above the editable draft"
    - "D-11 retry CTA path when status='ai_draft_failed'"
    - "D-08 deliveryEmailFailed toast branch in handleApprove"
  affects:
    - "Plan 07-07 integration test — exercises the retry CTA + the deliveryEmailFailed toast branch end-to-end"
tech-stack:
  added: []
  patterns:
    - "Native <details>/<summary> for collapsible — no library dep, default-open controlled by conditional `open` attribute"
    - "Coltorapps-shaped schema walk — Object.entries(schemaJson.entities) filtered through a NON_INPUT_ENTITY_TYPES deny-list; label resolved from entity.attributes.label with entity-id fallback"
    - "Project empty-state convention '—' for unanswered fields (no fake data per `feedback_no_demo_mocks_in_code.md`)"
key-files:
  created:
    - ".planning/phases/07-ai-report-pipeline/07-06-SUMMARY.md"
  modified:
    - "app/admin/assessments/[id]/review/review-client.tsx (+170 / -12 net — new helpers, widened props, raw-answers panel, retry CTA, deliveryEmailFailed branch)"
    - "app/admin/assessments/[id]/review/page.tsx (+3 / -5 — replaced Plan 05's transient {...as any} cast with typed JSX call now that ReviewClient's signature accepts schemaJson + audioMedia)"
key-decisions:
  - "Used native <details>/<summary> instead of pulling a Radix Collapsible — zero new deps, summary line styled to the existing label rhythm (font-mono uppercase tracking-[0.2em] text-[10px] text-white/40) so it visually reads as 'just another section header that happens to fold'."
  - "panelDefaultOpen = !draft || (draft_report_json && !report_storage_path). Open when no draft (Matt is about to generate — wants source data visible), open on freshly-generated draft (one-time auto-expand per D-04), collapsed otherwise (re-visit to an already-approved report)."
  - "Treated `report_storage_path` as the 'already-approved' marker rather than `status==='completed'` — same truth (Plan 04's atomic .update() writes both together) but the storage path is the visual indicator most likely to survive future status-taxonomy churn."
  - "NON_INPUT_ENTITY_TYPES deny-list (section/group/repeatingSection/page/row/column/divider/heading/paragraph) keeps the panel from rendering layout containers as rows. Defensive against future field-type additions: anything NOT on the deny-list is rendered, so a new field type still shows up — just may include a non-input entity until the list is updated."
  - "Closed Plan 05's transient cast in page.tsx in this plan. Plan 06's frontmatter only lists review-client.tsx, but Task 1's done criteria ('TypeScript clean (incl. closing Plan 05's transient prop error)') makes the cast removal in-scope as a Rule 3 dependency-fix."
  - "Used `toast.warning` for the deliveryEmailFailed branch — sonner's `toast` is a callable object exposing `.warning` alongside `.success`/`.error`. No new import needed."
metrics:
  duration: "~15 minutes"
  completed_date: "2026-05-29"
  tasks_completed: 2
  files_changed: 2
  lines_added: 173
  lines_removed: 17
---

# Phase 7 Plan 06: Review UI — Raw Answers Panel + Retry CTA + Delivery Toast Summary

**One-liner:** Extended `review-client.tsx` to render the D-04 "Raw Answers & STT" collapsible above the editable draft (single column, one-time auto-expand on freshly-generated drafts), branch the empty state into a D-11 "Retry Draft" CTA when `status === 'ai_draft_failed'`, and surface Plan 04's `deliveryEmailFailed` flag through the two D-08-verbatim toast strings — without adding any new email/delivery path.

## Signature Change

```diff
-export function ReviewClient({ submission }: { submission: any }) {
+export function ReviewClient({
+  submission,
+  schemaJson,
+  audioMedia,
+}: {
+  submission: any
+  schemaJson: SchemaJsonShape | null
+  audioMedia: AudioMediaRow[]
+}) {
```

`SchemaJsonShape` is a local minimal interface matching the coltorapps shape used by `expandRepeatingSections` (`lib/form-builder/expand-repeating-sections.ts`): `{ entities?: Record<string, { type: string; children?: string[]; attributes?: Record<string, unknown> }> }`. `null` is tolerated — the panel renders a "No pinned schema available" notice instead of crashing.

Plan 05's transient `{...({ submission, schemaJson, audioMedia } as any)}` spread in `page.tsx` is replaced with a plain typed JSX call:

```tsx
<ReviewClient
  submission={submission}
  schemaJson={(version?.schema_json as Record<string, unknown> | undefined) ?? null}
  audioMedia={audioMedia ?? []}
/>
```

## Panel Placement & Behaviour (D-04)

- **Location:** Inserted between the Header block and the Executive Summary block inside the draft-present branch (review-client.tsx lines ~221-245 post-edit). Single-column page preserved; no sidebar/grid introduced.
- **Markup:** Native `<details>`/`<summary>` — zero library deps. Summary line styled `font-mono uppercase tracking-[0.2em] text-[10px] text-white/40 cursor-pointer hover:text-white/60` to match the existing label rhythm.
- **Row construction:** `buildRawAnswerRows(schemaJson, submission.answers_json, audioMedia)` walks `schemaJson.entities`, filters out layout/grouping types (`NON_INPUT_ENTITY_TYPES`), resolves the label via `entity.attributes?.label` with `entityId` fallback, looks up the value as `answers_json[entityId]` → audio transcript by `field_id` → `"—"` (project empty-state convention).
- **One-time auto-expand:** `panelDefaultOpen = !draft || (draft_report_json && !report_storage_path)`. Open when there's no draft yet (Matt is about to generate), open on a freshly-generated draft, collapsed on re-visit to an already-approved report.

The panel renders ONLY inside the draft-present branch (returned at the end of the component). The `!draft` empty-state branch returns its own short JSX — the raw-answers panel is intentionally not surfaced there yet because the empty state already lives at `py-24` centred and adding a long collapsible would push the CTA below the fold on small admin screens. See "Deferred / nuance for Plan 07" below.

## Retry CTA (D-11)

Empty-state branch (renders when `!draft`):
```tsx
const failed = submission.status === "ai_draft_failed"
// Headline: failed ? "AI Draft Failed" : "No AI Draft Yet"
// Copy:     failed ? "The previous AI generation failed. See /admin/month-summary for the logged error, then retry."
//                 : "The assessment has been submitted. Click below to generate an AI draft from the raw answers."
// Button:   generating ? "Generating..." : failed ? "Retry Draft" : "Generate AI Draft"
```

Same `handleGenerate` handler under both labels — `generateReportDraft` → `runReportDraftGeneration` (Plan 02) clears `ai_draft_failed` on success or re-inserts a `workflow_errors` row on repeat failure. No new endpoint, no auto-retry timer, no modal.

## deliveryEmailFailed Toast Branch (D-08)

```ts
const result = await finalizeReport(submission.id, draft)
if (result.deliveryEmailFailed) {
  toast.warning("Report saved, email retry queued")
} else {
  toast.success("PDF generated and saved!")
}
if (result.downloadUrl) {
  window.open(result.downloadUrl, "_blank")
}
router.refresh()
```

Strings match CONTEXT §D-08 verbatim. `toast.warning` is a sonner-supported variant — no import change needed (sonner's `toast` already exposes the callable + named methods including `.warning`).

## REPORT-11 / D-06 Preservation

Scoped grep confirms no client-side dispatch was added:

```
$ grep -n "dispatchNotification\|fetch.*email" app/admin/assessments/[id]/review/review-client.tsx
(no matches — only a comment mention of "n8n" in the D-08 toast block)
```

The Approve & Generate PDF button (unchanged label "Approve & Generate PDF →" at the action bar) remains the sole delivery trigger; the only side effect this plan adds is a toast.

## Threat-Model Check

All five threats in Plan 06's STRIDE register are mitigated as planned:

| Threat | Disposition | Status |
|---|---|---|
| T-07-06-01 (XSS via transcript/answer values) | mitigate | All values rendered via JSX text node `{row.value}` — React's default text-node escaping applies. No `dangerouslySetInnerHTML` anywhere in this plan |
| T-07-06-02 (spoofed retry click) | mitigate | "Retry Draft" calls the existing `generateReportDraft` Server Action which has its own `auth.getUser()` gate (actions.ts:504-509). No new entry point |
| T-07-06-03 (stale draft after failure) | mitigate-via-flag-for-Plan-07 | When status flips to `ai_draft_failed`, the prior `draft_report_json` may still be present. The empty-state retry branch renders ONLY when `!draft`. If a prior draft co-exists with a fresh failure, Matt sees the prior draft + can re-trigger via the existing "↺ Regenerate Draft" button (line ~228 post-edit). Plan 07 should add a banner inside the draft-present branch when `status === 'ai_draft_failed'` to make the stale-vs-fresh distinction explicit — flagged in "Note for Plan 07" below |
| T-07-06-04 (modal storm on dispatch flap) | accept | One toast per Approve click; sonner internal dedup handles repeated approvals. No auto-firing |
| T-07-06-05 (repudiation of Matt's approval) | mitigate | `finalizeReport` is the audit source — status='completed' + `report_storage_path` persisted server-side via the atomic `.update()` Plan 04 preserves. Client toast is a UX echo, not a record of truth |

## Note for Plan 07 — Stale-Draft-After-Failure Nuance (T-07-06-03)

The current empty-state retry CTA assumes `!draft`. There is a window where `submission.status === 'ai_draft_failed'` AND `submission.draft_report_json` is non-null — e.g. an old successful draft was generated, Matt edited some fields without approving, and a fresh "↺ Regenerate Draft" click failed mid-flow. In that case:

- The user sees the prior draft (no retry banner, no failure indicator) and the action bar's "↺ Regenerate Draft" button.
- The status is `ai_draft_failed` but the UI doesn't visibly signal it.

This is acceptable for v1 (the prior draft is still usable; the Regenerate button is right there) but Plan 07's integration test should:
1. Exercise the `!draft` retry path explicitly (covered by Plan 06).
2. Add a follow-up assertion or visual marker for the `draft && ai_draft_failed` co-occurrence — either a small banner above the draft "Last regeneration failed — see month-summary" or a status pill near the header. Defer the UI change until Plan 07 confirms with a real test fixture.

## Verification

All plan automated verify gates green on the post-edit file:

| Gate | Expected | Actual |
|---|---|---|
| `grep -n "schemaJson"` | ≥1 match | 5 matches (interface, prop type, signature, helper, page-side typed call) |
| `grep -n "audioMedia"` | ≥1 match | 5 matches |
| `grep -n "Raw Answers"` | ≥1 match | 3 (section comment + panel comment + summary `<span>`) |
| `grep -n "<details"` | 1 match | 1 (line 223) |
| `grep -n "answers_json"` | ≥1 match | 3 (helper signature comment, helper body comment, prop wiring) |
| `grep -n "Retry Draft"` | 1 match | 1 (line 223 inside button) |
| `grep -n "ai_draft_failed"` | ≥1 match | 2 (comment + `failed` condition) |
| `grep -n "deliveryEmailFailed"` | 1 match | 1 (line 183 branch) |
| `grep -n "Report saved, email retry queued"` | 1 match | 1 verbatim |
| `grep -n "PDF generated and saved"` | 1 match | 1 verbatim |
| `tsc --noEmit` filtered to `review-client.tsx` + `review/page.tsx` | none | 0 errors |
| `grep "dispatchNotification\\|fetch.*email"` in review-client.tsx | 0 dispatch calls | 0 (D-06 / REPORT-11 preserved) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking dependency closure] Closed Plan 05's transient `{...as any}` spread cast in `page.tsx`**
- **Found during:** Task 1 (verifying TypeScript cleanliness)
- **Issue:** Plan 06 frontmatter lists only `review-client.tsx` in `files_modified`, but Task 1's done criteria explicitly says "TypeScript clean (incl. closing Plan 05's transient prop error)" — and the dependency context notes Plan 05's spread cast was intentionally left for Plan 06 to close. With the widened signature in place, the cast in `page.tsx` is no longer needed and the typed JSX call is the natural pairing.
- **Fix:** Replaced the spread+cast in `page.tsx` with a typed JSX call: `<ReviewClient submission={...} schemaJson={...} audioMedia={...} />`. Inner `schema_json` is cast `as Record<string, unknown> | undefined` once at the call site to bridge between Supabase's `Json` return type and the structural interface ReviewClient accepts.
- **Files modified:** `app/admin/assessments/[id]/review/page.tsx` (-5 / +3)
- **Commit:** `1ea7c70` (folded into Task 1 since the cast removal is what closes the Plan 05 TS error referenced in Task 1's done criteria)

### Auto-noted Issues (not auto-fixed — out of scope)

**1. `npm run build` fails with `Module not found: Can't resolve '@react-pdf/renderer'`**
- **Found during:** Plan 07-06 post-Task-2 build verification.
- **Symptom:** `lib/pdf/generator.tsx:2` and `components/pdf/{proposal,report}-document.tsx:2` import `@react-pdf/renderer`; the module is absent from the worktree's `node_modules`.
- **Scope:** Pre-existing repo state, not introduced by Plan 07-06. TypeScript `tsc --noEmit` filtered to the two Plan 07-06 files is clean.
- **Action:** Logged to `.planning/phases/07-ai-report-pipeline/deferred-items.md` for a repo-level `npm install` fix. Plan 07-06 does not touch `lib/pdf/generator.tsx` or `components/pdf/*` — out of single-file scope per executor SCOPE BOUNDARY rule.

**Total deviations:** 1 auto-fix (Rule 3 dependency closure), 1 deferred (out of scope).

## Commits

| Task | Description | Commit |
|---|---|---|
| 1 | feat(07-06): widen ReviewClient props + add D-04 Raw Answers & STT panel | `1ea7c70` |
| 2 | feat(07-06): D-11 retry CTA + D-08 deliveryEmailFailed toast branch | `23da957` |

## Success Criteria

- [x] D-04 layout shipped — collapsible "Raw Answers & STT" panel above editable draft, single column, one-time auto-expand on fresh draft
- [x] D-11 retry path shipped — status-driven "Retry Draft" CTA + month-summary pointer copy
- [x] D-08 toast wording shipped verbatim — both "PDF generated and saved!" and "Report saved, email retry queued"
- [x] REPORT-11 gate preserved — no auto-delivery; Approve click remains the sole trigger; `grep dispatchNotification` in review-client.tsx returns 0
- [x] Plan 05's transient prop error closed — page.tsx now uses typed JSX call

## Known Stubs

None — every renderable value flows from real DB sources (`submission.answers_json`, `field_media.transcript`, `template_versions.schema_json`). Empty cells render `"—"` per the project's no-mocks empty-state convention.

## Self-Check: PASSED

- `app/admin/assessments/[id]/review/review-client.tsx` — FOUND (385 lines post-edit).
- `app/admin/assessments/[id]/review/page.tsx` — FOUND (45 lines post-edit).
- Commit `1ea7c70` — FOUND in `git log` (Task 1).
- Commit `23da957` — FOUND in `git log` (Task 2).
- `tsc --noEmit` filtered to plan files — 0 errors.
- All 12 verify gates from the plan's `<automated>` blocks — ALL PASSED (table above).
- D-06 grep (no client-side dispatch added) — 0 matches in review-client.tsx for `dispatchNotification`/`fetch.*email`.
- No accidental file deletions in either commit (`git diff --diff-filter=D HEAD~2 HEAD` empty).

## Next Plan Readiness

- **Plan 07-07 (integration test)** — Can now exercise the full Plan 07-06 surface:
  1. Stub `dispatchNotification` → `{ ok: false }`, click Approve, assert `toast.warning("Report saved, email retry queued")` appears and `workflow_errors` row exists.
  2. Insert a submission with `status='ai_draft_failed'` and no draft, render the page, assert "Retry Draft" button + month-summary copy.
  3. Render a submission with `draft_report_json` + `answers_json` + audio `field_media`, assert the Raw Answers panel is open (justGenerated heuristic), and that each schema entity is listed with its label and value.
  4. Optionally cover the T-07-06-03 nuance: insert `status='ai_draft_failed'` WITH a `draft_report_json` and assert the draft view is rendered (not the retry empty state) — informs whether the v2 banner mentioned above is needed.

---
*Phase: 07-ai-report-pipeline*
*Completed: 2026-05-29*
