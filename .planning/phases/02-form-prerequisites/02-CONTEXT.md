# Phase 2: Form Prerequisites - Context

**Gathered:** 2026-04-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Matt can fill a hardcoded-schema form on tablet, attach per-field photos, use speech-to-text, and have his submission pinned to a schema version — proving the core capture infrastructure before any real templates are loaded.

</domain>

<decisions>
## Implementation Decisions

### Speech-to-Text (STT) Integration
- **D-01:** Use **OpenAI Whisper via OpenRouter** for transcription. This ensures high accuracy and consistent behavior across mobile devices (iPad Safari standalone mode) where native Web Speech API support can be inconsistent.
- **D-02:** Transcription will be triggered per-field via a microphone button, as specified in the roadmap.

### Media Processing Pipeline
- **D-03:** **Client-side (Browser) processing** for all media. Use `heic2any` for HEIC-to-JPEG conversion and a browser-side compression library (e.g., `browser-image-compression`) to target the 1.2–1.5MB range.
- **D-04:** EXIF-rotation must be handled during the client-side conversion process to ensure correct orientation.
- **D-05:** Compression must prioritize legibility of inspection labels (verified against `photo-fusebox-01.jpg` baseline).

### Draft Persistence
- **D-06:** **Cloud-synced drafts** using the `form_submissions` table in Supabase (with `status = 'draft'`). This allows Matt to switch devices mid-assessment and ensures data safety beyond simple Local Storage.
- **D-07:** Sync should occur periodically (e.g., on field blur or every 30 seconds) to minimize data loss.

### Renderer Architecture
- **D-08:** **JSON Schema-driven Renderer**. The form component will be built to consume a schema object, defining fields, types, and validation rules. This future-proofs the system for the Phase 3 Template System.

### the agent's Discretion
- Selection of specific browser-side compression and HEIC conversion libraries.
- Precise implementation of the "microphone button" UI/UX within the form fields.
- Local Storage fallback strategy if network is unavailable during draft sync.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap
- `ROADMAP.md` § Phase 2 — Goal and success criteria
- `REQUIREMENTS.md` § FORM-01 to FORM-10 — Detailed form requirements

### Reference Assets
- `photo-fusebox-01.jpg` — Quality baseline for compression legibility

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `components/ui/input.tsx` & `textarea.tsx` — Base field components
- `lib/supabase/client.ts` — For draft sync to `form_submissions`

### Established Patterns
- `proxy.ts` — Session management for all form routes
- Tailwind 4 styling — Consistency with the admin dashboard mockup

### Integration Points
- `app/client/forms` (proposed) — Where the renderer will live

</code_context>

<deferred>
## Deferred Ideas

- Drag-drop form builder — Phase 3/v2
- Full offline sync (Service Workers/IndexedDB) — v2 separate milestone

</deferred>

---

*Phase: 02-form-prerequisites*
*Context gathered: 2026-04-29 (auto)*
