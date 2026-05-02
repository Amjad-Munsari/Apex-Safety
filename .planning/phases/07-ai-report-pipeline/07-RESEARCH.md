# Phase 7 Research: AI Report Pipeline

## Standard Stack

The established stack for this feature based on project constraints and AI-SPEC decisions:
- **Vercel AI SDK Core**: Specifically the `ai` package using `generateObject()`.
- **Zod**: For strictly defining the expected output schema.
- **Supabase**: To fetch assessment data and save the draft.
- **@react-pdf/renderer**: To be integrated later for the final PDF step (existing dependency).

## Architecture Patterns

### The Drafting Pipeline
1. **Trigger**: Server Action `draftReport(assessmentId: string)` called from the admin UI.
2. **Data Assembly**: Fetch the assessment and its answers. Transform this into a clean, text-heavy string (e.g., markdown or structured string) to feed into the prompt context.
3. **Generation**: Call `generateObject` with the assembled data and a predefined Zod schema for the report structure.
4. **Storage**: Serialize the returned `object` into JSON and store it in `draft_report_json` on the `form_submissions` row.
5. **UI Return**: Return success to the client, triggering a refresh to show the Review & Approve UI.

## Don't Hand-Roll

- **JSON Parsing & Retries**: Do not manually `JSON.parse()` a raw text response or write regex. Use Vercel AI SDK's `generateObject()` which handles schema-matching and internal retries.
- **LLM Fetch Logic**: Do not use `fetch('https://openrouter.ai/api/v1/chat/completions')`. Use `@ai-sdk/openai` configured with the OpenRouter baseURL and API key.

## Common Pitfalls

- **Context Window Overload**: Passing massive base64 images directly into the prompt without resizing. (For now, rely on text-based STT notes and text fields; avoid passing raw images unless strictly necessary).
- **Zod Schema Complexity**: Overly nested Zod schemas confuse the LLM. Keep the schema flat and use `z.describe()` to give the LLM explicit instructions for each field.
- **Timeout Restrictions**: Vercel Serverless functions typically time out at 15-60 seconds depending on the plan. This pipeline must complete within the limit, or the generation must run asynchronously (e.g., via background jobs). However, for a local solo practice, standard Vercel timeouts with `gpt-4o-mini` are usually fast enough (~5-10s).
- **OpenRouter Environment Variables**: Ensure `OPENROUTER_API_KEY` is present.

## Code Examples

### AI Provider Configuration
```typescript
import { createOpenAI } from '@ai-sdk/openai';

// OpenRouter drop-in replacement
export const openrouter = createOpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
});
```

### generateObject Usage
```typescript
import { generateObject } from 'ai';
import { z } from 'zod';
import { openrouter } from '@/lib/ai-provider';

export const reportSchema = z.object({
  executiveSummary: z.string().describe("A professional 2-3 sentence summary of the fire safety status."),
  hazards: z.array(z.object({
    location: z.string(),
    description: z.string(),
    severity: z.enum(["Low", "Medium", "High", "Critical"]),
    recommendedAction: z.string()
  })),
  complianceStatus: z.enum(["Pass", "Action Required", "Fail"])
});

export async function generateDraft(assessmentData: string) {
  const { object } = await generateObject({
    model: openrouter('openai/gpt-4o-mini'),
    schema: reportSchema,
    prompt: `Act as a Fire Risk Assessor. Draft a report based on this raw data: ${assessmentData}`,
  });
  
  return object;
}
```
