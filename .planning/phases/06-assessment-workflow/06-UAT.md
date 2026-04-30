---
status: testing
phase: 06-assessment-workflow
source: [06-1-SUMMARY.md]
started: 2026-04-30T15:55:00Z
updated: 2026-04-30T15:55:00Z
---

## Current Test

number: 1
name: Start New Assessment
expected: |
  Clicking "New Assessment", selecting a client and template, and clicking "Start Assessment" opens the assessment form view without errors.
awaiting: user response

## Tests

### 1. Start New Assessment
expected: |
  Clicking "New Assessment", selecting a client and template, and clicking "Start Assessment" opens the assessment form view without errors.
result: pass

### 2. Form Rendering and Autosave
expected: |
  The form renders correctly with "Building Information" and "Fire Protection Systems". Typing in fields automatically triggers a "Saving..." indicator, and changes persist after refreshing the page.
result: pass

### 3. Appendix Field
expected: |
  The "ADDITIONAL OBSERVATIONS" section appears at the bottom. Typing notes into it works, and those notes persist upon refreshing the page.
result: pass

### 4. Draft Detection
expected: |
  Leaving the form and clicking "New Assessment" again for the same client and template shows a "Resume Existing Draft?" prompt. Clicking "Resume Draft" takes you back to the existing form with data intact.
result: pass

### 5. Submit Assessment
expected: |
  Clicking "Submit Assessment" (which should be enabled once all fields are filled) submits the form, shows a success toast, and redirects to the client portal page without unhandled exceptions.
result: pass

## Summary

total: 5
passed: 5
issues: 0
pending: 0
skipped: 0

## Gaps

[none yet]

