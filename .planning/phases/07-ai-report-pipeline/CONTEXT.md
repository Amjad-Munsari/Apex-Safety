# Phase 7 Context: AI Report Pipeline (Local)

## Goal
Transform submitted assessment data into professional, branded PDF reports using AI, managed entirely within the Next.js application (no n8n).

## Key Decisions
1. **Model**: `openai/gpt-4o-mini` via OpenRouter.
2. **Infrastructure**: Server Actions (`app/admin/assessments/actions.ts`) for AI processing and PDF generation.
3. **Storage**: Reports saved to the `reports` bucket in Supabase.
4. **UI**: A "Review & Approve" interface added to the Admin Portal to allow Matt to edit AI-generated content before final PDF creation.
5. **PDF Engine**: Reuse and extend `@react-pdf/renderer` patterns from the Proposal Pipeline.

## Constraints
- **No n8n**: All logic must be local to the Next.js codebase.
- **No PayPal**: This phase focuses purely on report generation, bypassing any payment requirements for now.
- **Data Integrity**: Ensure the AI maintains the technical accuracy of the fire safety findings.

## Success Criteria
- A submitted assessment triggers an AI drafting process.
- Matt can view a side-by-side comparison of raw data vs. AI draft.
- Matt can edit the draft and click "Approve & Generate PDF".
- The final PDF is stored and accessible for download by both Matt and the Client (via Portal).
