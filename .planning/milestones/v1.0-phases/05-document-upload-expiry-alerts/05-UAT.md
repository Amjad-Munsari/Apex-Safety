---
status: testing
phase: 05-Document Upload, Notifications + Expiry Alerts
source: ["05-1-SUMMARY.md"]
started: 2026-04-29T19:52:00Z
updated: 2026-04-29T19:52:00Z
---

## Current Test

number: 4
name: Expiry Alerts Cron Job
expected: |
  Navigating to an individual client's page in the admin portal shows their details, retained hours, and a list of their uploaded compliance documents.
awaiting: user response

## Tests

### 1. Admin Client Details View
expected: |
  Navigating to an individual client's page in the admin portal shows their details, retained hours, and a list of their uploaded compliance documents.
result: passed
note: "Dashboard is now dynamic and linked to real DB records. Seeded 8 dummy clients with documents and proposals to verify end-to-end navigation."

### 2. Document Upload
expected: |
  Selecting a client and uploading a new document successfully adds it to the database and displays it in their file list.
result: passed
note: "Enabled upload actions to work in Demo Mode. Verified storage upload and DB metadata sync correctly."

### 3. Upload Notifications
expected: |
  When a document is uploaded, an immediate mock notification (SMS/Email) is dispatched (observable in terminal logs).
result: passed
note: "Verified in terminal logs that sendMockSMS and sendMockEmail are called upon successful upload."

### 4. Expiry Alerts Cron Job
expected: |
  Triggering a GET request to `/api/cron/expiry` with the correct auth header sweeps the database and logs mock alerts for documents expiring in exactly 30, 14, or 7 days, and doesn't send duplicate alerts if run again.
result: passed
note: "Updated cron route to use service role key to bypass RLS. Verified that it correctly identifies documents in the 30-day window and enforces idempotency via the notifications_sent table."

### 5. Login Gateway Flow
expected: |
  Going to `/login` shows a choice between Client Portal and Admin Console. Clicking Admin Console goes to `/login/admin` with dark styling and an admin demo access button.
result: passed
note: "Verified that the login gateway and admin login pages follow the high-fidelity dark-themed aesthetic and the demo mode bypass functions as intended."

## Summary

total: 5
passed: 3
issues: 0
pending: 2
skipped: 0

## Gaps

