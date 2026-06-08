# Phase 6: Assessment Workflow - Plan

**Phase:** 06
**Status:** Ready for execution
**Goal:** Enable Matt to initiate, fill, and submit assessments (FRAs) against any client using the existing form renderer, STT, and media pipeline.

---

## 🌊 Wave 1: Server Actions & Foundation

### Task: Implement Assessment Server Actions
- **Requirement:** ASMT-01, ASMT-05
- **Action:** 
  Create `app/admin/assessments/actions.ts`. Export three async functions:
  1. `startAssessment(clientId: string, templateVersionId: string)`:
     - Uses `createServerClient` to get the authenticated user.
     - Uses `createAdminClient` to fetch `template_id` from `template_versions` for `templateVersionId`.
     - Inserts a new row into `form_assignments` (client_id, template_id, template_version_id, assigned_by, status: 'assigned').
     - Inserts a new row into `form_submissions` (assignment_id, client_id, template_version_id, answers_json: {}, submitted_by, status: 'draft').
     - Calls `redirect('/admin/assessments/' + submission.id)`.
  2. `autosaveAnswers(submissionId: string, answersJson: Record<string, unknown>)`:
     - Uses `createAdminClient` to `update({ answers_json: answersJson })` on `form_submissions` where `id = submissionId` and `status = 'draft'`.
  3. `submitAssessment(submissionId: string, finalAnswers: Record<string, unknown>)`:
     - Uses `createAdminClient` to `update({ answers_json: finalAnswers, status: 'submitted', submitted_at: new Date().toISOString() })`.
     - Makes a fire-and-forget POST to `process.env.N8N_ASSESSMENT_WEBHOOK_URL` with body `{ submissionId }` and an `AbortSignal.timeout(3000)`.
     - Catches errors and inserts into `workflow_errors` (workflow_name: 'assessment-submission-webhook', error_message: String(err), payload: { submissionId }).
     - Returns `{ clientId: submission.client_id }`.
- <read_first>
  - `.planning/phases/06-assessment-workflow/06-RESEARCH.md`
  - `lib/supabase/admin.ts`
</read_first>
- <acceptance_criteria>
  - `app/admin/assessments/actions.ts` exports `startAssessment`, `autosaveAnswers`, and `submitAssessment`.
  - `startAssessment` inserts into both `form_assignments` and `form_submissions` atomically using the admin client.
  - `submitAssessment` calls the n8n webhook and catches errors to `workflow_errors`.
</acceptance_criteria>
- **autonomous:** true

### Task: Implement Draft Detection Route
- **Requirement:** ASMT-06
- **Action:** 
  Create `app/admin/assessments/new/page.tsx` as a Server Component.
  - Awaits `searchParams` to get `clientId` and `templateVersionId`. If missing, `redirect('/admin')`.
  - Uses `createAdminClient()` to query `form_submissions` where `client_id = clientId`, `template_version_id = templateVersionId`, and `status = 'draft'`, ordering by `created_at` descending, limiting to 1.
  - Renders a Client Component (e.g., `AssessmentSetup` - to be built in Wave 2) passing `clientId`, `templateVersionId`, and `existingDraft` (the queried draft row, or null).
- <read_first>
  - `.planning/phases/06-assessment-workflow/06-RESEARCH.md`
</read_first>
- <acceptance_criteria>
  - `app/admin/assessments/new/page.tsx` exists and queries `form_submissions` for existing drafts.
  - Passes `existingDraft` to a child component.
</acceptance_criteria>
- **autonomous:** true

---

## 🌊 Wave 2: UI Dialogs & Entry Points

### Task: Build Client & Template Selector Dialog
- **Requirement:** ASMT-03
- **Action:** 
  Create `components/assessments/assessment-selector-dialog.tsx`.
  - A multi-step `Dialog` (from shadcn). 
  - Step 1: Fetches and displays a list of clients. User selects a client.
  - Step 2: Fetches and displays published `template_versions` (`published_at IS NOT NULL`). User selects a template.
  - On "Start Assessment" click, pushes router to `/admin/assessments/new?clientId={id}&templateVersionId={id}`.
  - Uses styling specified in `06-UI-SPEC.md` (e.g. `STEP 1 OF 2`, `bg-amber-500` for active states).
- <read_first>
  - `.planning/phases/06-assessment-workflow/06-UI-SPEC.md`
</read_first>
- <acceptance_criteria>
  - `components/assessments/assessment-selector-dialog.tsx` exists.
  - Dialog has two steps and navigates to `/admin/assessments/new` with search params on completion.
</acceptance_criteria>
- **autonomous:** true

### Task: Build Draft Recovery Dialog
- **Requirement:** ASMT-06
- **Action:** 
  Create `components/assessments/assessment-setup.tsx` (the client component rendered by the route in Wave 1).
  - If `existingDraft` is passed: renders a shadcn `AlertDialog` saying "Resume Existing Draft?" with "Start Fresh" (calls `startAssessment` server action) and "Resume Draft" (calls `router.push('/admin/assessments/' + existingDraft.id)`).
  - If `existingDraft` is null: calls `startAssessment(clientId, templateVersionId)` immediately inside a `useEffect` (or via a loading state).
  - Uses styling from `06-UI-SPEC.md` (amber-400 AlertTriangle icon).
- <read_first>
  - `.planning/phases/06-assessment-workflow/06-UI-SPEC.md`
</read_first>
- <acceptance_criteria>
  - `components/assessments/assessment-setup.tsx` renders an `AlertDialog` if a draft exists.
  - "Start Fresh" calls the server action to create a new assignment/submission.
</acceptance_criteria>
- **autonomous:** true

### Task: Add Sidebar Entry Point
- **Requirement:** ASMT-03
- **Action:** 
  Modify `components/app-sidebar.tsx`.
  - Add a "New Assessment" button below the main navigation items.
  - Style: `bg-amber-500 hover:bg-amber-400 text-black font-semibold text-sm rounded-sm px-4 py-2.5 w-full transition-colors` with a `Plus` lucide icon.
  - Clicking it opens the `AssessmentSelectorDialog` built in Task 3.
- <read_first>
  - `components/app-sidebar.tsx`
  - `.planning/phases/06-assessment-workflow/06-UI-SPEC.md`
</read_first>
- <acceptance_criteria>
  - `components/app-sidebar.tsx` contains the "New Assessment" button.
  - Clicking the button opens the selector dialog.
</acceptance_criteria>
- **autonomous:** true

---

## 🌊 Wave 3: Assessment Form UI & Client Logic

### Task: Build Appendix Field Component
- **Requirement:** ASMT-04
- **Action:** 
  Create `components/assessments/appendix-field.tsx`.
  - Renders a visually distinct section: `border-l-2 border-amber-500/40 pl-6 py-2 mt-8`.
  - Label: "ADDITIONAL OBSERVATIONS".
  - Contains a `Textarea` with a `MicButton` inside (for STT) mapping to `__appendix_notes` in form data.
  - Contains a `MediaField` component mapping to `__appendix_media` in form data.
- <read_first>
  - `components/forms/form-renderer.tsx`
  - `.planning/phases/06-assessment-workflow/06-UI-SPEC.md`
</read_first>
- <acceptance_criteria>
  - `components/assessments/appendix-field.tsx` exists and renders `MicButton` and `MediaField`.
</acceptance_criteria>
- **autonomous:** true

### Task: Build Sticky Form Header & Progress
- **Requirement:** ASMT-03
- **Action:** 
  Create `components/assessments/assessment-form-header.tsx`.
  - Receives `clientName`, `templateName`, `progress` (number 0-100), `onSaveDraft`, `onSubmit`, and `isSubmitting`.
  - Sticky header styling: `sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-slate-800 py-3 px-0 -mx-8 px-8 mb-8`.
  - Renders the progress bar (`h-1.5 bg-slate-800 rounded-full` with `bg-amber-500` fill).
  - Renders "Save Draft" and "Submit Assessment" buttons. Submit is disabled if `progress < 100` or `isSubmitting` is true.
- <read_first>
  - `.planning/phases/06-assessment-workflow/06-UI-SPEC.md`
</read_first>
- <acceptance_criteria>
  - `components/assessments/assessment-form-header.tsx` exists and correctly sets progress bar width.
  - Submit button is disabled when progress < 100.
</acceptance_criteria>
- **autonomous:** true

### Task: Build Assessment Form Page
- **Requirement:** ASMT-01, ASMT-02, ASMT-03
- **Action:** 
  Create `app/admin/assessments/[id]/page.tsx` (Server) and `app/admin/assessments/[id]/assessment-client.tsx` (Client).
  - **Server:** Fetches the `form_submissions` row by `params.id`, joining `clients` (for name) and `template_versions` (for `schema_json` and `template_id`). Passes data to client component.
  - **Client:** 
    - Manages `answers` state initialized from `submission.answers_json`.
    - Implements `handleFieldChange` with an 800ms debounce calling `autosaveAnswers` (cancels timer on `beforeunload` or `visibilitychange`).
    - Implements `calculateProgress` by counting filled required fields from the schema.
    - Implements `handleSubmit` which flushes any pending autosave, calls `submitAssessment`, shows a success toast ("Assessment Submitted"), and router pushes to `/admin/clients/[clientId]`.
    - Renders `AssessmentFormHeader`, `FormRenderer`, and `AppendixField`.
    - Applies `pb-24` padding to the main container.
- <read_first>
  - `components/forms/form-renderer.tsx`
  - `.planning/phases/06-assessment-workflow/06-RESEARCH.md`
</read_first>
- <acceptance_criteria>
  - `app/admin/assessments/[id]/page.tsx` exists and loads submission data.
  - Client component debounces saves to `autosaveAnswers`.
  - Client component renders the `FormRenderer` and `AppendixField`.
</acceptance_criteria>
- **autonomous:** true

---

## Verification Requirements
- [ ] ASMT-01 & ASMT-03: Starting a new assessment creates `form_assignments` and `form_submissions` rows.
- [ ] ASMT-04: Appendix field successfully saves audio transcription and photo URLs to the database.
- [ ] ASMT-05: Submitting triggers the webhook server action without throwing unhandled exceptions.
- [ ] ASMT-06: Draft detection works and prompts the user on re-entry.

---
*Generated by GSD Planner*
