---
wave: 1
depends_on: []
files_modified:
  - "types/database.ts"
  - "app/api/admin/assessments/[id]/draft/route.ts"
  - "app/admin/assessments/[id]/review/page.tsx"
  - "app/admin/assessments/actions.ts"
autonomous: false
---

# Phase 7: AI Report Pipeline

## Goal
A submitted FRA assessment produces a branded PDF report that lands in Matt's review queue within minutes. 

## Requirements Addressed
REPORT-01 to REPORT-12

---

<task>
<read_first>
- `types/database.ts`
- `.planning/phases/07-ai-report-pipeline/07-AI-SPEC.md`
</read_first>
<action>
Update the Supabase database schema and local types to support the draft report.
Add a `draft_report_json` column (type `jsonb`) and a `status` column (type `text` defaulting to `'Draft'`) to the `form_submissions` table in the database if they don't exist. Update `types/database.ts` to include these fields in the `form_submissions` type.

Run the Supabase migrations command to push these changes if using migrations, or manually add them via the dashboard if in local dev without migrations enabled.
</action>
<acceptance_criteria>
- `types/database.ts` contains `draft_report_json: Json | null` and `status: string | null` in the `form_submissions` interface.
</acceptance_criteria>
</task>

<task>
<read_first>
- `.planning/phases/07-ai-report-pipeline/07-AI-SPEC.md`
- `app/admin/assessments/actions.ts` (create if doesn't exist)
</read_first>
<action>
Implement the Server Action `generateReportDraft(submissionId: string)` inside `app/admin/assessments/actions.ts`.
This action must:
1. Fetch the `form_submissions` row matching `submissionId` using the Supabase admin client.
2. Initialize `createOpenAI` from `@ai-sdk/openai` with `baseURL: "https://openrouter.ai/api/v1"` and `apiKey: process.env.OPENROUTER_API_KEY`.
3. Define the Zod schema exactly as specified in the AI-SPEC:
   ```typescript
   const reportSchema = z.object({
     executiveSummary: z.string(),
     hazards: z.array(z.object({
       location: z.string(),
       description: z.string(),
       severity: z.enum(["Low", "Medium", "High", "Critical"]),
       recommendedAction: z.string(),
     })),
     complianceStatus: z.enum(["Pass", "Action Required", "Fail"]),
   });
   ```
4. Call `generateObject` with `model: openai('openai/gpt-4o-mini')` and the raw answers from the submission.
5. Update the `draft_report_json` column for the submission with the resulting JSON object and update `status` to `'Reviewing'`.
6. Call `revalidatePath('/admin/assessments')` and return `{ success: true }`.
</action>
<acceptance_criteria>
- `app/admin/assessments/actions.ts` exports `generateReportDraft`.
- The action uses `generateObject` from `ai`.
- The action updates the `draft_report_json` column.
</acceptance_criteria>
</task>

<task>
<read_first>
- `app/admin/assessments/[id]/review/page.tsx` (create new)
- `app/admin/assessments/actions.ts`
</read_first>
<action>
Create a new Admin review page at `app/admin/assessments/[id]/review/page.tsx`.
This page must:
1. Fetch the submission by `params.id`.
2. Parse the `draft_report_json` field. If null, display a button "Generate AI Draft" that calls the `generateReportDraft` Server Action.
3. If `draft_report_json` exists, display an interactive form that allows editing the `executiveSummary`, `hazards`, and `complianceStatus`.
4. Include an "Approve & Generate PDF" button that will later trigger the PDF compilation step.
</action>
<acceptance_criteria>
- `app/admin/assessments/[id]/review/page.tsx` exists and renders without crashing.
- The UI contains a form mapped to the `reportSchema` fields.
</acceptance_criteria>
</task>

## Verification
- Run the server action `generateReportDraft` on a mock submission.
- Ensure the Supabase `draft_report_json` column successfully receives the structured JSON output.
- Navigate to `/admin/assessments/[id]/review` and ensure the editable draft UI renders the correct data.
