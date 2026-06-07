# Phase 6: Assessment Workflow Context

## Domain Boundary
Completing the loop for on-site data capture. This phase enables Matt to initiate, fill, and submit assessments (FRAs) against any client using the form renderer, STT, and media pipeline built in Phase 2.

## Decisions

### 1. Initiation UX
- **Global Entry Point**: A "New Assessment" button will be added to the global sidebar.
- **Selection Flow**: Entry opens a client/template selection interface.
- **Unassigned Flow**: Matt can start an assessment without a prior assignment row. The system will handle creating the necessary `form_assignments` and `form_submissions` rows behind the scenes.

### 2. Draft Persistence
- **Database Sync**: Progress will be synced to the `form_submissions` table in real-time or via periodic "autosave" (e.g., every field change or every 30s).
- **Recovery**: Opening a "New Assessment" for a client who already has a `draft` will offer to resume the existing draft.

### 3. "Anything Else" Field
- **Structure**: A standard `appendix` field added to the end of every FRA/Site Risk template.
- **Requirement**: Optional/Non-required.
- **Capabilities**: Supports the full media pipeline (STT + Photos).

### 4. Post-Submission
- **Redirect**: Redirect to the Client Profile page (`/admin/clients/[id]`).
- **Feedback**: Immediate success toast. Submission status update in the client's assessment list.

## Code Context
- **Renderer**: `components/forms/form-renderer.tsx`
- **Media**: `components/forms/media-field.tsx`
- **State**: `form_submissions` table (status: `draft` -> `submitted`)
- **Storage**: `form-media` bucket

## Canonical Refs
- [001_initial_schema.sql](file:///c:/dev/Antigravity/888%20Safety/supabase/migrations/001_initial_schema.sql)
- [form-renderer.tsx](file:///c:/dev/Antigravity/888%20Safety/components/forms/form-renderer.tsx)
- [ROADMAP.md](file:///c:/dev/Antigravity/888%20Safety/.planning/ROADMAP.md)
