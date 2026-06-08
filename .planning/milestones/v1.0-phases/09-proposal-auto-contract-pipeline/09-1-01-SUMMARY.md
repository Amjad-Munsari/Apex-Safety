# Plan 1 Summary: Proposal Pipeline MVP

## What Was Done
- Installed `@react-pdf/renderer` and `@ai-sdk/openai`.
- Created the **Service Catalog Admin UI** (`/admin/services`) with a data table and an Add/Edit Dialog, connected to Supabase `services` table.
- Created the **Proposal Builder Flow** (`/admin/proposals/new`) which allows Matt to select a client, dynamically add services with quantity, and auto-calculate line items and total investment.
- Implemented **AI Draft Scope** generation using OpenAI (via OpenRouter API).
- Built the **PDF Generation** logic using `@react-pdf/renderer` to create a beautiful branded PDF proposal, upload it to the Supabase `proposals` storage bucket, and update the database row in one atomic server action.

## Verification
- Code builds successfully.
- React PDF generation runs in Node environment seamlessly via Server Actions.
- DB updates properly map services and link to clients.

## Handover Notes
- Requires `OPENROUTER_API_KEY` in `.env.local` to fully test AI drafting, otherwise falls back to a mock string.
- PDF currently uses standard Helvetica/Times fonts to avoid custom TTF bundling overhead at this stage, but matches the "High-Fidelity Editorial" vibe.
