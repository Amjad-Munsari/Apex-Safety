---
status: partial
phase: 13-form-builder-foundation
source:
  - 13-01-SUMMARY.md
  - 13-02-SUMMARY.md
  - 13-03-SUMMARY.md
  - 13-04-SUMMARY.md
started: 2026-05-25T22:00:00.000Z
updated: 2026-05-25T22:05:00.000Z
---

## Current Test

[paused — resume with /gsd:verify-work 13]

## Tests

### 1. Cold Start Smoke Test
expected: Kill the dev server. Restart with `npm run dev`. App boots without errors, you can sign in as admin and load /admin without console errors.
result: [pending]

### 2. Template Builder Opens
expected: From /admin/templates, the "Basic Types Smoke Test" template appears. Clicking it opens the three-panel builder (palette on left, canvas in middle, properties on right) with all seeded fields visible on the canvas — including the sectionGroup with its nested child.
result: [pending]

### 3. All 7 Palette Buttons Add Fields
expected: Clicking each of the 7 palette buttons (Short Text, Long Text, Number, Date, Select, Checkbox, Section) adds a field of that type to the canvas.
result: [pending]

### 4. Edit Field Properties Live
expected: Click any field on the canvas → properties panel populates. Edit the field's Label in the right panel → canvas updates immediately as you type, with no focus loss or stutter.
result: [pending]

### 5. Drag to Reorder + Reparent
expected: Drag a field on the canvas to a new position → it reorders. Drag a field into the sectionGroup → it reparents under the section. Drag back out → it returns to root.
result: [pending]

### 6. Save Draft Creates Version 1
expected: Make a change → click "Save draft" → "Saved" tag appears in toolbar. A new template_versions row is created (v1).
result: [pending]

### 7. Save Again Creates Version 2 (Immutable v1)
expected: Make another change → Save again → version 2 created. Version 1's schema_json in DB is unchanged (immutable).
result: [pending]

### 8. Publish Template Sets LIVE Badge
expected: Click "Publish Template" → confirm dialog → "LIVE v{N}" green badge replaces the DRAFT badge.
result: [pending]

### 9. Start a New Assessment
expected: From /admin/assessments/new (or the "+ New Assessment" entry), the 3-step wizard runs: pick client → pick the published template → review → "Begin assessment". You land on the fill page.
result: [pending]

### 10. Fill Form — No Focus Loss
expected: Type into a textField on the assessment fill page. Focus stays in the input as you type every character. Header progress bar climbs as required fields get filled.
result: [pending]

### 11. Select Dropdown Doesn't Warn
expected: Pick an option from a select field. The browser console shows no "uncontrolled to controlled" warning.
result: [pending]

### 12. Header Submit + Redirect to Client
expected: Fill all required fields (progress = 100%) → gold "Submit assessment" button enables in the header → click it → toast "Assessment submitted" → page navigates to the client's record (/admin/clients/[client_id]).
result: [pending]

### 13. View Report URL Goes to /review
expected: On the client's page, the assessments table shows the just-submitted row with status "In review". Clicking "View report" lands on /admin/assessments/[id]/review (NOT back on the client page — no redirect loop).
result: [pending]

### 14. AI Draft Auto-Generates
expected: Wait ~10–30 seconds after submit, then open /review. The page shows the editable AI draft — executive summary, hazards list with severity, compliance status — without you clicking "Generate AI Draft". (Background after() job populated it.)
result: [pending]

### 15. Approve & Generate PDF
expected: Edit a hazard or summary → click "Approve & Generate PDF →" → "PDF generated and saved" toast → PDF opens in a new tab and is downloadable.
result: [pending]

### 16. Version Pinning Holds
expected: Open the older submission (created against template v1) after v2 has been published. The fill page still renders v1's fields, not v2's. (Server fetches the pinned template_version_id, not the latest.)
result: [pending]

## Summary

total: 16
passed: 0
issues: 0
pending: 16
skipped: 0

## Gaps

[none yet]
