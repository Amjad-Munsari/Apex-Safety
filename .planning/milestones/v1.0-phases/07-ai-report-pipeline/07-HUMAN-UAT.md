---
status: partial
phase: 07-ai-report-pipeline
source: [07-VERIFICATION.md]
started: 2026-05-29T18:30:00Z
updated: 2026-05-29T18:30:00Z
---

## Current Test

[awaiting human testing — queued with 13/14/15 UAT for single dedicated walkthrough per user direction]

## Tests

### 1. Live end-to-end submission
expected: |
  Submit FRA against live OpenRouter + Supabase + n8n → AI draft populates within ~30s →
  /admin/review-queue shows draft_ready_for_review → Review page renders raw-answers panel
  + editable draft → Approve produces PDF in reports bucket → client receives delivery
  email via n8n with 7-day signed URL.
result: pending

### 2. YELLOW_BROOM_EXEMPLAR draft quality
expected: |
  AI draft tone matches Matt's authoring style; no invented hazards; severities calibrated
  against the YELLOW BROOM reference. Domain-expert judgment per AI-SPEC §5 "Manual Human
  in the Loop".
result: pending

### 3. D-04 Raw Answers panel auto-expand UX
expected: |
  Panel opens automatically the first time Matt visits a freshly-generated draft;
  collapses cleanly on re-visit (report_storage_path set). panelDefaultOpen logic
  at review-client.tsx:156-158 is correct by inspection; felt experience needs Matt sign-off.
result: pending

### 4. Proton email rendering + 7-day signed URL
expected: |
  Email subject "Your Fire Risk Assessment is ready — {client_name}". Body links to a
  working Supabase signed URL that opens the PDF in a fresh browser session (no auth
  cookie). 7-day TTL holds.
result: pending

### 5. D-11(c) live workflow_errors drill-down
expected: |
  Inject a real ai_report_draft failure (e.g. bogus OPENROUTER_API_KEY) → /admin/month-summary
  lists the row with workflow_name='ai_report_draft', error message, severity pill 'high',
  deep-link to /admin/assessments/{submission_id}/review, en-GB timestamp.
  The payload-JSONB read fix (commit e60944b) was not separately re-tested with a fresh
  failure post-fix; needs a live trigger.
result: pending

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps

(none — all 3 originally-blocking code gaps closed in 07-08/09/10 + audit follow-ups;
remaining work is live-stack human verification only)
