# Phase 7: AI Report Pipeline - Context

**Gathered:** 2026-05-29
**Status:** Ready for replanning

<domain>
## Phase Boundary

A submitted FRA assessment produces a branded PDF report that lands in Matt's review queue within minutes. Scope covers: AI draft generation from raw answers (incl. STT transcripts), the Admin Review & Approve UI with raw-vs-draft comparison, branded PDF render + storage, atomic status transitions, error logging to `workflow_errors`, and the client-delivery email dispatch on approve.

Out of scope (deferred): SignWell-style e-sig, PayPal hours-balance, Site Risk template variant (REPORT-04 blocked on a completed example), full RAG retrieval over historical reports, image-based hazard detection from photos.

</domain>

<decisions>
## Implementation Decisions

### AI draft generation (REPORT-01, REPORT-02, REPORT-03)
- **D-01:** Stack is already locked by `07-AI-SPEC.md` §2: Vercel AI SDK Core (`ai`) + Zod, `openai/gpt-4o-mini` via OpenRouter, temperature `0.1`. Do not change provider or schema shape unless AI-SPEC is revised.
- **D-02:** Few-shot reference (REPORT-03) is injected as a single condensed exemplar block stored at `lib/ai/exemplars/yellow-broom-fra.ts` exporting `YELLOW_BROOM_EXEMPLAR: string`. Loaded once at module init. Prompt structure: `[system persona] + [no-hallucination rule] + [exemplar block] + [expanded answers JSON]`. The exemplar is a labelled JSON shape that matches `reportSchema` (executiveSummary / hazards / complianceStatus) — NOT raw prose. Keep ≤ 2KB to stay well under context. Site Risk variant (REPORT-04) wires the same module pattern — `lib/ai/exemplars/site-risk.ts` stub today, real content deferred. The exemplar source must be cited in the prompt header so Matt can audit lineage ("Few-shot reference: YELLOW BROOM 2023 FRA, anonymised").
- **D-03:** Repeating-section expansion already implemented in `runReportDraftGeneration` (see actions.ts:443) stays — the AI sees one labelled object per door/hazard instance, never opaque `instances[]`.

### Review & Approve UI (REPORT-08, REPORT-09, REPORT-11)
- **D-04:** Raw-vs-draft layout uses a **collapsible "Raw Answers & STT" panel above the editable draft** (single-column page). Default state: collapsed when `draft_report_json` exists; open when the draft is freshly generated (one-time auto-expand). The panel renders each answered field as a row with `[field label] · [value or STT transcript text]`; STT transcripts pulled from `field_media` rows where `media_type='audio'` and matched by `submission_id + field_id`. Rejected: two-column split (too cramped on FRA's long answer set); tab toggle (loses side-by-side); per-hazard evidence chips (over-engineered for solo practitioner v1 — note for v2 in deferred).
- **D-05:** Approve & Generate PDF (REPORT-09) is the only path that produces a client-deliverable PDF — `finalizeReport` already enforces this and is the contract. Manual download URL returned to Matt is signed for 5 min (existing behaviour stays).
- **D-06:** REPORT-11 hard guarantee: no email/delivery side-effect fires from any code path EXCEPT `finalizeReport` after a successful approve. Auto-generated drafts (from `submitAssessmentAction`) only populate `draft_report_json` and flip status to `draft_ready_for_review` — never email the client. Add a unit test asserting `dispatchNotification` is not called from the draft path.

### Delivery email on approve (REPORT-10)
- **D-07:** `finalizeReport` dispatches via the existing `lib/notifications/n8n-dispatch.ts` helper (n8n is the email bridge per the project's Proton Mail constraint). Add a new variant to `NotificationPayload`:
  ```ts
  | {
      type: "report_ready"
      client_email: string
      client_name: string
      report_url: string         // signed URL, 7-day TTL
      assessment_date: string    // formatted en-GB, matches PDF header
      report_storage_path: string // for n8n logging / dedup
    }
  ```
  Generate a 7-day signed URL (`createSignedUrl(fileName, 60*60*24*7)`) for the email payload — separate call from the 5-min URL returned to Matt. n8n side handles the actual Proton send.
- **D-08:** Dispatch failures do NOT roll back the status flip. Order of operations in `finalizeReport`: render PDF → upload → status='completed' + persist `report_storage_path` → dispatch notification → if dispatch fails, insert `workflow_errors` row (`workflow_type='report_delivery_email'`, severity high) and surface a non-blocking toast to Matt ("Report saved, email retry queued"). Rationale: the PDF is the artefact of record; email is a delivery convenience that n8n can replay.

### Error workflow + status taxonomy (REPORT-12)
- **D-09:** Canonical `form_submissions.status` values (lowercase, snake_case):
  | Value | Meaning |
  |---|---|
  | `in_progress` | Customer is filling the form, autosave only |
  | `submitted` | Customer hit Submit; AI draft not yet generated |
  | `draft_ready_for_review` | `draft_report_json` populated, awaiting Matt |
  | `completed` | Matt approved, PDF stored, delivery dispatched |
  | `ai_draft_failed` | AI generation threw; row stays here until Matt retries from the Review page |

  The legacy `status DEFAULT 'Draft'` in migration `002_phase7_draft_report.sql` is a known inconsistency — DO NOT add another migration to change it. New code paths must ALWAYS set status explicitly; the default is only reached if a row is inserted without status, which existing code never does. Document this in `07-CONTEXT.md` and add an assertion in the integration check.
- **D-10:** `runReportDraftGeneration` is wrapped so any throw inserts a `workflow_errors` row (`workflow_type='ai_report_draft'`, severity `high`, payload: `{ submission_id, error_message, stack }`) BEFORE rethrowing. Row is visible in `/admin/month-summary`. After insert, status is set to `ai_draft_failed` so the Review page can show a "Retry draft" button instead of the generic empty-state.
- **D-11:** REPORT-12 acceptance: trigger an AI failure (mocked OpenRouter 500) and verify (a) `workflow_errors` row inserted, (b) `status='ai_draft_failed'`, (c) `/admin/month-summary` shows the error, (d) Review page renders a retry CTA.

### Claude's Discretion
The user delegated all four gray areas mid-discussion ("you decide for everything"). Decisions D-04 through D-11 reflect Claude's calls grounded in: existing code (`runReportDraftGeneration`, `finalizeReport`, `dispatchNotification`), the Proton-via-n8n constraint, the `no demo mocks` and `production-ready ship target` memories, and the `07-AI-SPEC.md` framework lock. Any of these can be reversed by the user on review.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 7 design contracts
- `.planning/phases/07-ai-report-pipeline/07-AI-SPEC.md` — locks model, framework, Zod schema, eval strategy, guardrails. Do NOT reshape `reportSchema` or change provider.
- `.planning/phases/07-ai-report-pipeline/07-RESEARCH.md` — pipeline architecture, pitfalls (context-window, schema complexity, OpenRouter env var).
- `.planning/ROADMAP.md` §Phase 7 — goal + REPORT-01..12 binding.
- `.planning/REQUIREMENTS.md` REPORT-01..12 — full requirement text.

### Existing implementation to extend (NOT rebuild)
- `app/admin/assessments/actions.ts:405-512` — `runReportDraftGeneration`, `generateReportDraft` (already wired with repeating-section expansion).
- `app/admin/assessments/actions.ts:673-757` — `finalizeReport` (PDF render + storage + status flip; missing the n8n dispatch from D-07).
- `app/admin/assessments/[id]/review/review-client.tsx` — Review UI scaffold; needs the D-04 raw-answers panel and the D-11 retry CTA.
- `components/pdf/report-document.tsx` — branded `@react-pdf/renderer` document; brand assets (logo image) deferred.
- `lib/pdf/generator.tsx` — `generateReportPdfBuffer` (no change expected).
- `lib/notifications/n8n-dispatch.ts` — extend `NotificationPayload` union per D-07.
- `supabase/migrations/002_phase7_draft_report.sql` — `draft_report_json`, `status`, `report_storage_path` columns already exist.

### Project-level guardrails
- `AGENTS.md` — `node_modules/next/dist/docs/` is the source of truth for Next.js APIs; do not assume training-data shapes.
- `CLAUDE.md` (→ `AGENTS.md`) — form template ownership context (informational; Phase 7 doesn't touch templates directly).
- Memory: `email_infra.md` — Proton via n8n; never call SMTP/Resend directly.
- Memory: `production_ready_target.md` — Modules 2 + 4 are productionised; no demo mocks in shipped paths.
- Memory: `feedback_no_demo_mocks_in_code.md` — empty-state UI, never fake-data generators.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `runReportDraftGeneration` + `generateReportDraft` (`actions.ts:405,503`) — AI draft already works end-to-end with repeating-section expansion. Wrap with error logging (D-10); inject D-02 exemplar; rest stays.
- `finalizeReport` (`actions.ts:673`) — PDF render + storage + status flip already work. Add D-07 dispatch + D-08 ordering.
- `ReportDocument` (`components/pdf/report-document.tsx`) — branded A4 PDF with severity colour-coding and signed footer. Reuse as-is for v1; brand logo image deferred.
- `dispatchNotification` (`lib/notifications/n8n-dispatch.ts`) — adds a new `report_ready` variant per D-07. Existing payloads remain unchanged.
- `workflow_errors` insert pattern — copy from `app/admin/compliance/actions.ts:82` and `app/api/cron/expiry/route.ts:115`.
- `/admin/month-summary` already reads `workflow_errors` — new `ai_report_draft` and `report_delivery_email` types surface automatically.

### Established Patterns
- **Two-step fetch for pinned template schemas** — never FK-join `form_submissions` → `template_versions` (Phase 13 RESEARCH Pitfall 2). `runReportDraftGeneration` already does this correctly.
- **Status as the state machine driver** — every admin/customer surface routes off `form_submissions.status`. New states must be added to D-09 BEFORE the UI references them.
- **Server Actions for mutations** — no API routes for the draft/finalize flow. `app/api/admin/assessments/[id]/draft/route.ts` exists from earlier scaffolding but is not the canonical path; if unused, mark for removal in PLAN.
- **Inline n8n triggers with workflow_errors fallback** — pattern from `submitAssessmentAction` (actions.ts:367-389): try/catch around the dispatch, insert workflow_errors on failure, never block the primary mutation.

### Integration Points
- `submitAssessmentAction` (`actions.ts:233`) — already fires the draft async per Phase 18 SC#5. Decision D-06 forbids it from sending email; tighten by reviewing that handler.
- `/admin/review-queue` — `revalidatePath` is already called by both `generateReportDraft` and `finalizeReport`; new states must be filterable here.
- Supabase Storage `reports` bucket — `finalizeReport` uploads `{client_id}/report_{submissionId}.pdf` with `upsert: true`. Deletion is handled by `deleteAssessment` (actions.ts:116) — keep that contract.

</code_context>

<specifics>
## Specific Ideas

- **Persona line** for the prompt (locked): "You are a UK Fire Risk Assessor drafting an official report under the Regulatory Reform (Fire Safety) Order 2005. You are assisting Matt Robinson, the competent person, who will review every output before delivery."
- **No-hallucination guard** (locked, place after persona): "Every hazard in your output MUST trace to an explicit statement in the input answers. If the data is silent on a topic, omit it — do not infer."
- **Few-shot exemplar** (D-02): JSON fixture from a sanitised YELLOW BROOM FRA. Sanitisation: real client name → "Acme Properties Ltd"; real site → "12 Example Street"; preserve hazard structure and recommended-action tone.
- **Email subject** (sent by n8n, but encoded in `report_ready` payload): `"Your Fire Risk Assessment is ready — {client_name}"`. n8n template uses these fields literally.
- **Brand text in PDF** is locked at "888 Safety Solutions" / "Fire Safety · Health & Safety · Training" with company number 18552988. Don't paraphrase.

</specifics>

<deferred>
## Deferred Ideas

- **Per-hazard evidence chips** — Review UI showing which field/STT line justifies each AI hazard. Rejected for v1 (D-04) but a strong v2 feature once Matt has lived with the simpler raw-answers panel for a sprint.
- **Site Risk variant exemplar** (REPORT-04) — blocked on a completed Site Risk example from Matt. Stub `lib/ai/exemplars/site-risk.ts` to keep the wiring symmetric; populate when available.
- **Brand logo image in PDF** (REPORT-05 partial) — current ReportDocument uses text wordmark only. Adding the raster logo needs a verified asset from Matt + react-pdf `<Image>` integration. Defer until brand assets confirmed.
- **RAG over historical reports** — promising for tone consistency but out of scope; AI-SPEC explicitly rules out LangChain/LlamaIndex.
- **Edit-distance telemetry** — Section 7 of AI-SPEC mentions tracking how much Matt edits the draft. Useful eval signal; defer the implementation to a follow-up observability pass.
- **Status migration to enforce enum** — D-09 documents inconsistency rather than adding a new migration. A future cleanup phase could swap the column to a Postgres enum + tighten RLS predicates.

</deferred>

---

*Phase: 07-ai-report-pipeline*
*Context gathered: 2026-05-29*
