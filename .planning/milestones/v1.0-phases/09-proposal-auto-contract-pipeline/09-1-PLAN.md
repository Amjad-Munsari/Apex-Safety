---
description: "Service Catalog Admin UI and Proposal Builder"
dependencies: []
---

# Plan 1: Proposal Pipeline MVP

## Objective
Build the service catalog admin UI, the proposal builder flow, and the React PDF generator.

## Tasks

### 1. Dependencies
- Install `@react-pdf/renderer` and `@ai-sdk/openai` / `ai`.

### 2. Service Catalog (Admin UI)
- Create `app/admin/services/page.tsx` with a list/table of services.
- Create `app/admin/services/actions.ts` with `addService`, `updateService`, `deleteService`, `toggleServiceActive`.
- Create `components/services/service-dialog.tsx` for adding/editing services.

### 3. Proposal Builder Flow
- Create `app/admin/proposals/new/page.tsx`.
- Implement Client Selection.
- Implement Service Selection (add items, adjust qty, show total).
- Create `app/admin/proposals/actions.ts` with `draftProposalScope` using OpenRouter.
- Implement AI Draft Scope text area.
- Implement "Generate PDF" submit button.

### 4. PDF Generation
- Create `components/pdf/proposal-document.tsx` using `@react-pdf/renderer` matching Editorial design.
- Implement `lib/pdf/generator.ts` to `renderToBuffer`.
- Create `createProposal` Server Action to save DB row and upload PDF to Supabase.
