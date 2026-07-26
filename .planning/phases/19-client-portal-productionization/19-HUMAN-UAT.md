---
status: resolved
phase: 19-client-portal-productionization
source: [19-VERIFICATION.md]
started: 2026-06-07
updated: 2026-06-07
---

## Current Test

[complete — all 6 verified by user 2026-06-07]

> Test account: **amjadmunsari@gmail.com** / **amjad123** (org: Munsari Property Group — seeded with documents, 1 active + 1 completed assessment, a submitted FRA, and an issued contract).

## Tests

### 1. Portal header/footer identity
expected: After signing in, the portal chrome shows the real org ("Munsari Property Group") and user ("Amjad Munsari") — no hardcoded/mock identity. Footer shows Matt Robinson · info@888safetyandtraining.com · 0333 049 8979.
result: passed

### 2. Mobile nav (Sheet + active link)
expected: On a narrow viewport the mobile drawer opens/closes; the active nav item is highlighted by current path; nav reads "Assessments" (renamed to match admin — was "Assignments").
result: passed

### 3. Submission viewer is read-only
expected: Assessments → Completed → open the FRA submission. All answers render pre-filled; fields cannot be edited/focused; no submit button.
result: passed

### 4. Cross-org IDOR returns 404
expected: Manually visiting `/client/assignments/<some-other-org-assignment-id>/submission` returns 404 (not another org's data).
result: passed

### 5. Contract download via signed URL
expected: Contracts page lists the issued contract (CON-B8C4E1, £1,452). Download opens a signed URL in a new tab. (Seeded PDF is a placeholder path — link resolves but the file 404s until a real PDF is uploaded.)
result: passed

### 6. Removed assessments route 404s
expected: Visiting `/client/assessments` returns 404 (legacy mock route deleted; the live "Assessments" nav points at /client/assignments).
result: passed

## Summary

total: 6
passed: 6
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
