---
phase: 07-ai-report-pipeline
plan: 04
subsystem: report-pipeline
tags: [server-action, n8n-dispatch, signed-url, workflow-errors, report-delivery]
requirements:
  - REPORT-05
  - REPORT-06
  - REPORT-07
  - REPORT-09
  - REPORT-10

dependency_graph:
  requires:
    - "Plan 07-02 — runReportDraftGeneration + ai_draft_failed status path"
    - "Plan 07-03 — NotificationPayload.report_ready discriminated arm"
    - "Existing finalizeReport happy path (PDF render + upload + atomic status flip) from Phase 6"
  provides:
    - "finalizeReport with D-07 client URL + D-08 dispatch + workflow_errors fallback"
    - "{ success, downloadUrl, deliveryEmailFailed } return contract for Plan 06 toast"
    - "workflow_name='report_delivery_email' rows for /admin/month-summary surfacing (Plan 07-05)"
  affects:
    - "Plan 07-06 Review UI — keys off deliveryEmailFailed to render non-blocking toast"
    - "Plan 07-07 integration test — can mock dispatchNotification → { ok: false } and assert workflow_errors row + flag"

tech-stack:
  added: []
  patterns:
    - "Two scoped signed URLs from the same storage object — short (5-min) for the caller's immediate UX, long (7-day) embedded in the side-effect payload only (T-07-04-02)"
    - "Inline try-soft (no try/catch needed — dispatchNotification returns DispatchResult { ok, error }) → workflow_errors insert on !ok → continue without throwing (D-08 — PDF is the artefact of record)"
    - "Contact email lookup via client_users two-step pattern (no FK join, copy of cron/expiry/route.ts:87-100)"

key-files:
  created:
    - ".planning/phases/07-ai-report-pipeline/07-04-SUMMARY.md"
  modified:
    - "app/admin/assessments/actions.ts (+51 / -2 net in finalizeReport + 1 new import)"

key-decisions:
  - "Two separate createSignedUrl calls — the 5-min URL (Matt's immediate download) and the 7-day URL (n8n payload only) stay scoped to different audiences (T-07-04-02). The 7-day URL is never returned to the React client component."
  - "contactEmail falls back to '' if client_users lookup is empty rather than throwing — preserves the D-08 ordering (PDF stays as artefact of record). n8n side / Matt notice via deliveryEmailFailed=true."
  - "Atomic update statement (report_storage_path + status='completed' in one .update() call) untouched — REPORT-07 / D-09 contract was already satisfied pre-Plan-04 and is preserved."
  - "dispatchResult.error coalesces to 'unknown dispatch failure' so workflow_errors.error_message is never NULL even on weird DispatchResult shapes."

metrics:
  duration: "~8 minutes"
  completed_date: "2026-05-29"
  tasks_completed: 1
  files_changed: 1
  lines_added: 51
  lines_removed: 2
---

# Phase 7 Plan 04: Wire `finalizeReport` to dispatch `report_ready` (D-07/D-08) Summary

**One-liner:** Extended `finalizeReport` so the Approve path now mints a 7-day client-scoped signed URL, dispatches a `report_ready` payload to the n8n bridge, and on dispatch failure logs a `workflow_errors` row + surfaces `deliveryEmailFailed: boolean` to the caller — without ever rolling back the PDF artefact or splitting the atomic `report_storage_path` + `status='completed'` update.

## Line Count Delta

```
app/admin/assessments/actions.ts | 53 ++++++++++++++++++++++++++++++++++++++--
1 file changed, 51 insertions(+), 2 deletions(-)
```

- 1 new import line: `import { dispatchNotification } from "@/lib/notifications/n8n-dispatch"`.
- 1 new `client_users` lookup block (~9 lines) immediately after the submission fetch.
- 1 new D-07/D-08 block (~40 lines) inserted between the existing `revalidatePath` calls and the existing 5-min `createSignedUrl` call.
- 2 lines changed at the function tail: the return shape grew from `{ success, downloadUrl }` to `{ success, downloadUrl, deliveryEmailFailed }`.

No changes to the PDF render call, the storage upload, or the `.update()` statement — these were already correct (REPORT-05 brand text, REPORT-06 storage, REPORT-07 atomicity) and the plan explicitly forbade touching them.

## Both Signed-URL Calls + TTLs

`finalizeReport` now contains exactly **two** `createSignedUrl` calls, both scoped to `fileName = {client_id}/report_{submissionId}.pdf`:

| Call | TTL | Audience | Where used | Source line |
|---|---|---|---|---|
| `createSignedUrl(fileName, 60 * 60 * 24 * 7)` | **7 days** | end customer (via n8n email) | embedded in `payload.report_url`; **never returned to caller** | ~ line 804 |
| `createSignedUrl(fileName, 60 * 5)` | **5 minutes** | Matt (Approve UI immediate download) | returned as `downloadUrl` | ~ line 847 |

This satisfies the T-07-04-02 mitigation gate: the long-lived URL is confined to the outbound n8n payload, while Matt's browser only ever receives the short-lived one.

## Dispatch Fallback Shape

When `dispatchNotification(payload)` returns `{ ok: false, error?: string }`:

```jsonc
// workflow_errors row inserted (no throw)
{
  "workflow_name": "report_delivery_email",
  "error_message": "<dispatchResult.error or 'unknown dispatch failure'>",
  "payload": {
    "type": "report_ready",
    "client_email": "...",
    "client_name": "...",
    "report_url": "<7-day signed URL>",
    "assessment_date": "<en-GB formatted>",
    "report_storage_path": "<client_id>/report_<submissionId>.pdf",
    "severity": "high"
  }
}
```

Then `deliveryEmailFailed = true` and execution continues to mint Matt's 5-min URL and return. The status flip to `completed` and the PDF in storage are **NOT** reverted (D-08). `/admin/month-summary` will surface this row via its existing `workflow_errors` reader (no reader change needed).

## New Return Signature

```ts
return { success: true, downloadUrl: signedUrlData?.signedUrl ?? null, deliveryEmailFailed }
```

- `success: true` — finalize completed (PDF saved, status flipped). Always `true` if we reach the return statement; failures throw earlier (upload error, update error, auth gate).
- `downloadUrl: string | null` — Matt's 5-min URL (unchanged from pre-Plan-04 behaviour).
- `deliveryEmailFailed: boolean` — **NEW**. `false` on a clean dispatch, `true` if `dispatchNotification` returned `!ok`. Plan 06 keys the non-blocking toast off this flag.

## Atomic Update Confirmation (REPORT-07 / D-09)

The pre-existing `.update()` call writing both `report_storage_path: fileName` AND `status: "completed"` in a single statement is **unchanged**:

```ts
await adminClient
  .from("form_submissions")
  .update({
    draft_report_json: approvedDraft,
    report_storage_path: fileName,
    status: "completed",
  })
  .eq("id", submissionId)
```

Plan 04 does not split this into two updates. The truth (`status='completed'` ⇔ `report_storage_path` set) remains atomic per D-09.

## D-06 Hard Contract Preserved

Scoped grep confirms `runReportDraftGeneration` still has zero `dispatchNotification` calls:

```
awk '/async function runReportDraftGeneration/,/^}/' app/admin/assessments/actions.ts | grep -c "dispatchNotification"
==> 0
```

File-level count is `2` (1 import + 1 call inside `finalizeReport`). No leakage into the draft path — Plan 02's contract holds.

## Verification

All plan automated verify gates green on the post-edit file:

| Gate | Expected | Actual |
|---|---|---|
| `grep -n "createSignedUrl(fileName, 60 * 60 * 24 * 7)"` | 1 match | 1 (line 804) |
| `grep -n 'workflow_name: "report_delivery_email"'` | 1 match | 1 (line 827) |
| `grep -n 'type: "report_ready" as const'` | 1 match | 1 (line 810) |
| `grep -c "deliveryEmailFailed"` | ≥ 3 | 4 (declaration + assignment + return + comment annotation) |
| `grep -c "dispatchNotification"` (file-level) | ≥ 2 | 2 (import + call) |
| `dispatchNotification` inside `runReportDraftGeneration` body | 0 | 0 |
| `createSignedUrl` inside `finalizeReport` body | 2 | 2 |
| `tsc --noEmit` errors filtered to `actions.ts` | none | TYPECHECK_OK |

## Threat Model Compliance

All eight Plan 04 threats addressed by the implementation:

| Threat | Disposition | Status |
|---|---|---|
| T-07-04-01 (auth bypass on finalizeReport) | mitigate | Pre-existing `createClient().auth.getUser()` gate unchanged (lines ~717-721) |
| T-07-04-02 (7-day URL leakage to Matt's browser) | mitigate | Two separate `createSignedUrl` calls; 7-day URL only inside payload, never returned to caller |
| T-07-04-03 (cross-org access to PDF) | mitigate | Storage path includes `client_id`; signed URL is bearer-trust per the project model; 7-day TTL accepted per D-07 |
| T-07-04-04 (email side-effect blocks PDF) | mitigate | D-08 ordering enforced: PDF + upload + status flip BEFORE dispatch; failure inserts workflow_errors and sets flag but does NOT throw |
| T-07-04-05 (delivery repudiation) | mitigate | `workflow_errors.payload.report_storage_path` enables n8n replay; flag surfaces to Matt via Plan 06 toast |
| T-07-04-06 (email-to-wrong-client) | mitigate | `client_users` lookup scoped via `.eq("client_id", submission.client_id).limit(1)`; no user-supplied email path |
| T-07-04-07 (status tampering) | mitigate | Atomic `.update()` writing both columns preserved verbatim |
| T-07-04-08 (webhook secret leakage) | mitigate | Secret stays inside `dispatchNotification` via `X-Webhook-Secret`; Plan 04 never reads or echoes the env var |

## Deviations from Plan

None — plan executed exactly as written. All automated verify gates pass on first run. No Rule 1/2/3 deviations triggered.

**Total deviations:** 0

## Commits

| Task | Description | Commit |
|---|---|---|
| 1 | feat(07-04): add 7-day client URL + n8n dispatch + workflow_errors fallback to finalizeReport | `395243b` |

## Success Criteria

- [x] finalizeReport now wires the client-delivery email side-effect per D-07/D-08
- [x] The PDF is never blocked by an email failure (no throw on `!dispatchResult.ok`)
- [x] Plan 06 has a stable `deliveryEmailFailed: boolean` in the return shape to render the non-blocking toast
- [x] Plan 07 can mock `dispatchNotification` → `{ ok: false }` and assert (a) workflow_errors row with `workflow_name='report_delivery_email'`, (b) `deliveryEmailFailed: true` on the return, (c) status still flipped to `completed`

## Self-Check: PASSED

- `app/admin/assessments/actions.ts` — FOUND, contains all expected literals (verified via grep).
- Commit `395243b` — FOUND in `git log` (Task 1).
- `tsc --noEmit` errors filtered to `actions.ts` — none (TYPECHECK_OK).
- No accidental deletions in the commit (`git diff --diff-filter=D HEAD~1 HEAD` empty).
- `dispatchNotification` count inside `runReportDraftGeneration` — 0 (D-06 preserved).
- All Plan 07-04 `<automated>` verify gates re-run together — ALL PASSED.

## Next Phase Readiness

- **Plan 07-05 (`/admin/month-summary` surfacing)** — `workflow_name='report_delivery_email'` rows now flow on dispatch failure. No reader changes needed for basic listing.
- **Plan 07-06 (Review UI toast)** — Stable `deliveryEmailFailed: boolean` on the return; can be wired to a `<Toast variant="warning">Report saved, email retry queued</Toast>`.
- **Plan 07-07 (integration test)** — Can stub `dispatchNotification` and assert the full D-08 contract (workflow_errors row, no rollback, flag surfacing).

---
*Phase: 07-ai-report-pipeline*
*Completed: 2026-05-29*
