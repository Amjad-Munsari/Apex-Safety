---
phase: 07-ai-report-pipeline
plan: 03
subsystem: notifications
tags: [type-extension, discriminated-union, n8n, report-pipeline]
requirements:
  - REPORT-10
dependency_graph:
  requires:
    - "lib/notifications/n8n-dispatch.ts (pre-existing NotificationPayload union)"
  provides:
    - "NotificationPayload.report_ready variant (6-field discriminated arm)"
  affects:
    - "Plan 04 finalizeReport — unblocks type-safe { type: 'report_ready' } construction"
tech_stack:
  added: []
  patterns:
    - "discriminated union extension (additive type-only edit)"
key_files:
  created: []
  modified:
    - "lib/notifications/n8n-dispatch.ts"
decisions:
  - "Appended after the last existing arm (document_uploaded). Plan referenced assignment_reminder as predecessor, but that arm does not exist in the file (only expiry_alert + document_uploaded are present). Appending after document_uploaded preserves the documented field order and the union semantics — discriminated unions are unordered for type-resolution purposes."
metrics:
  duration: "~10 minutes"
  completed_date: "2026-05-29"
  tasks_completed: 1
  files_changed: 1
  lines_added: 8
  lines_removed: 0
---

# Phase 7 Plan 03: Extend NotificationPayload with report_ready variant — Summary

**One-liner:** Added the `report_ready` arm to the `NotificationPayload` discriminated union per CONTEXT D-07, unblocking Plan 04 to dispatch report-delivery notifications via the existing n8n bridge — pure type extension, dispatcher body untouched.

## What Shipped

### lib/notifications/n8n-dispatch.ts (modified)

Appended a fourth arm to the existing union (after `document_uploaded`):

```typescript
| {
    type: "report_ready"
    client_email: string
    client_name: string
    report_url: string         // 7-day signed URL
    assessment_date: string    // en-GB formatted, matches PDF header
    report_storage_path: string // for n8n logging / dedup
  }
```

Field set, order, and inline comments match CONTEXT §D-07 verbatim. The `dispatchNotification` function (lines 37-65 post-edit) is byte-identical to its pre-edit state — it remains provider-agnostic, JSON-stringifies the payload, and forwards via `fetch` to `N8N_WEBHOOK_URL` with the `X-Webhook-Secret` header.

## Verification

Plan's automated verify gates (all green):

| Gate | Expected | Actual |
|---|---|---|
| `grep -c 'type: "report_ready"'` | 1 | 1 |
| `grep -E "report_url\|assessment_date\|report_storage_path" \| wc -l` | ≥3 | 3 |
| `tsc --noEmit` errors in n8n-dispatch.ts | none | TYPECHECK_OK |
| `dispatchNotification` line count | unchanged | unchanged (function body in git diff is empty) |

Confirmed via `git diff` post-commit: only 8 insertions inside the union literal; no other hunks.

## Deviations from Plan

### Auto-fixed Issues

None — plan executed as written with one annotation:

**1. [Annotation only — no code deviation] Plan's "Append after assignment_reminder arm" anchor**
- **Found during:** Task 1 read-first inspection of `lib/notifications/n8n-dispatch.ts`
- **Issue:** The plan instructs "Append after the `assignment_reminder` arm. 07-PATTERNS.md (lines 250-254) also shows `assignment_reminder` as an existing arm. The actual file only contains `expiry_alert` and `document_uploaded` — no `assignment_reminder` arm exists.
- **Resolution:** Appended after the last existing arm (`document_uploaded`). This satisfies the spirit of the instruction (additive extension at the union tail) without inventing a referenced-but-absent arm. The discriminated-union semantics are arm-order-independent for type resolution; downstream consumers (Plan 04) are unaffected.
- **Files modified:** `lib/notifications/n8n-dispatch.ts`
- **Commit:** 9877f98
- **Classification:** Documentation-only annotation, not a Rule 1/2/3 fix. The 07-PATTERNS.md "existing union pattern" snippet is stale/aspirational; the live file is the source of truth.

### Threat Model Compliance

The plan's threat register lists four threats (T-07-03-01..04), all marked `mitigate` or `accept`:

| Threat | Disposition | Status |
|---|---|---|
| T-07-03-01 (TLS for report_url in transit) | mitigate | Pre-existing — `dispatchNotification` gates on HTTPS `N8N_WEBHOOK_URL` (lines 28-32, unchanged) |
| T-07-03-02 (webhook body tampering) | mitigate | Pre-existing — `X-Webhook-Secret` header (line 46, unchanged) |
| T-07-03-03 (report_storage_path leakage) | accept | Path is Supabase-internal identifier; documented |
| T-07-03-04 (caller omits required fields) | mitigate | Discriminated union ensures Plan 04 cannot construct `{ type: "report_ready", ... }` without all 6 fields — TS will fail to compile |

All four addressed by the type-extension edit itself (3 & 4) or pre-existing dispatcher code (1 & 2). No new mitigations required.

## Commits

| Task | Description | Commit |
|---|---|---|
| 1 | feat(07-03): extend NotificationPayload with report_ready variant | 9877f98 |

## Success Criteria

- [x] 1 file modified, single semantic edit
- [x] Plan 04 unblocked to wire dispatch (`{ type: "report_ready" as const, ... }` now type-checks)
- [x] TypeScript build clean
- [x] `dispatchNotification` function body byte-identical to pre-edit state

## Self-Check: PASSED

- File `lib/notifications/n8n-dispatch.ts` exists and contains the new arm (verified).
- Commit `9877f98` exists on `worktree-agent-a3fad377332261a8e` (verified via `git log`).
- No accidental deletions (verified via `git diff --diff-filter=D HEAD~1 HEAD` — empty).
