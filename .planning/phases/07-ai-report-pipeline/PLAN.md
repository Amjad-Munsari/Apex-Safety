# Phase 7 Plan: AI Report Pipeline

## Overview
Implement the automated report generation flow: Assessment -> AI Draft -> Human Review -> PDF Generation.

## Proposed Changes

### 1. Database & Infrastructure
- [ ] Ensure `form_submissions` table has a `draft_report_json` column to store AI-generated content before approval.
- [ ] Ensure `report_storage_path` is correctly used for the final PDF.

### 2. AI Processing Logic
- [ ] Create `app/admin/assessments/actions.ts` (if not exists).
- [ ] Implement `generateReportDraft(submissionId: string)`:
    - Fetch raw assessment data and template info.
    - Prompt AI to transform notes/STT into professional report sections (Executive Summary, Observations, Recommendations).
    - Store result in `draft_report_json`.

### 3. Review & Approval UI
- [ ] Update `app/admin/assessments/[id]/page.tsx`:
    - Add a "Report Review" tab/section.
    - Display AI draft side-by-side with raw answers.
    - Allow inline editing of the draft.
    - Add "Approve & Generate PDF" button.

### 4. PDF Generation
- [ ] Create `components/pdf/report-document.tsx`:
    - Branded report template (888 Safety style).
    - Handles dynamic sections from AI draft.
- [ ] Implement `finalizeReport(submissionId: string)`:
    - Generate PDF using `@react-pdf/renderer`.
    - Upload to Supabase `reports` bucket.
    - Update submission status to `Completed`.

## Verification Plan

### Automated Tests
- Script to trigger AI drafting for a dummy submission and verify the output structure.

### Manual Verification
- Submit an assessment (or use a dummy).
- Verify AI draft appears in the review queue.
- Edit draft and approve.
- Download and verify the final PDF.
