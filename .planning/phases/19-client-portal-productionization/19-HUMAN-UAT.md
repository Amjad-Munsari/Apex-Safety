---
status: partial
phase: 19-client-portal-productionization
source: [19-VERIFICATION.md]
started: 2026-06-07
updated: 2026-06-07
---

## Current Test

[awaiting human testing]

> Test account ready: **amjadmunsari@gmail.com** / **amjad123** (org: Munsari Property Group — seeded with documents, 1 active + 1 completed assignment, a submitted FRA, and an issued contract).

## Tests

### 1. Portal header/footer identity
expected: After signing in, the portal chrome shows the real org ("Munsari Property Group") and user ("Amjad Munsari") — no hardcoded/mock identity. Footer shows Matt Robinson · 888FST@proton.me · 0161 552 0918.
result: [pending]

### 2. Mobile nav (Sheet + active link)
expected: On a narrow viewport the mobile drawer opens/closes; the active nav item is highlighted by current path; "Assignments" appears (NOT "Assessments").
result: [pending]

### 3. Submission viewer is read-only
expected: Assignments → Completed → open the FRA submission. All answers render pre-filled; fields cannot be edited/focused; no submit button.
result: [pending]

### 4. Cross-org IDOR returns 404
expected: Manually visiting `/client/assignments/<some-other-org-assignment-id>/submission` returns 404 (not another org's data).
result: [pending]

### 5. Contract download via signed URL
expected: Contracts page lists the issued contract (CON-B8C4E1, £1,452). Download opens a signed URL in a new tab. (Note: the seeded PDF is a placeholder path — the link will resolve but the file 404s until a real PDF is uploaded.)
result: [pending]

### 6. Removed assessments route 404s
expected: Visiting `/client/assessments` returns 404 (route intentionally deleted as mock removal).
result: [pending]

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0
blocked: 0

## Gaps
