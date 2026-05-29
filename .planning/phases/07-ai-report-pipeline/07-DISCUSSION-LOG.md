# Phase 7: AI Report Pipeline - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `07-CONTEXT.md` — this log preserves the alternatives considered.

**Date:** 2026-05-29
**Phase:** 07-ai-report-pipeline
**Areas discussed:** REPORT-08 STT panel, REPORT-10 delivery email, REPORT-03 few-shot strategy, REPORT-12 + status taxonomy

---

## Pre-discussion state

Existing `CONTEXT.md` (legacy, unprefixed) covered only model/provider/storage/UI/PDF engine at a high level. Phase 7 was already implemented end-to-end in code: migration 002, `runReportDraftGeneration` + `generateReportDraft` + `finalizeReport` in `app/admin/assessments/actions.ts`, the Review UI in `app/admin/assessments/[id]/review/review-client.tsx`, and the branded `components/pdf/report-document.tsx`. The existing PLAN.md captured only the schema + draft action + bare review page — it predated the work that's actually shipped and missed REPORT-08, -10, -12 entirely.

The user selected "Update CONTEXT (will need replan)". Existing PLAN.md is now considered stale.

## REPORT-08 — side-by-side STT panel

| Option | Description | Selected |
|--------|-------------|----------|
| Two-column layout (raw left, draft right) | Always-visible split. Best for direct comparison but cramped for FRA's long answer set. | |
| Collapsible "Raw answers" panel above draft | Default-collapsed expander, single column. Less clutter. | ✓ |
| Tab toggle (Draft / Raw) | Compact, but Matt loses simultaneous view. | |
| Per-hazard evidence chips | Each hazard links back to source field/STT. Most rigorous, most work. | |

**User's choice:** Delegated to Claude ("you decide for everything").
**Notes:** Auto-expand on first generation; STT transcripts pulled from `field_media` by `submission_id + field_id`. Per-hazard chips noted in deferred for v2.

## REPORT-10 — delivery email on approve

| Option | Description | Selected |
|--------|-------------|----------|
| Direct SMTP / Resend | Send email straight from `finalizeReport`. | |
| n8n via `dispatchNotification` (new `report_ready` variant) | Reuse the Proton-via-n8n bridge the rest of the platform uses. | ✓ |
| Skip — leave manual | Matt downloads PDF and sends himself. | |

**User's choice:** Delegated to Claude.
**Notes:** Email-infra memory + the existing `dispatchNotification` pattern made this the only consistent choice. Failures log to `workflow_errors` (`report_delivery_email`) and do NOT roll back the status flip — the PDF is the artefact of record.

## REPORT-03 — prompt few-shot strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Inline prose exemplar in prompt string | Quick but locks tone into a literal | |
| Single condensed JSON exemplar in `lib/ai/exemplars/yellow-broom-fra.ts` | Matches `reportSchema` shape; swappable per variant | ✓ |
| Full RAG over historical reports | Best fidelity but rejected by AI-SPEC (no LangChain/LlamaIndex) | |
| No few-shot, rely on persona + schema only | Cheapest but loses tone calibration | |

**User's choice:** Delegated to Claude.
**Notes:** Anonymised YELLOW BROOM. ≤2KB. Cited in the prompt header for audit ("Few-shot reference: YELLOW BROOM 2023 FRA, anonymised"). Site Risk variant (REPORT-04) gets a parallel `site-risk.ts` stub — content blocked on a real example.

## REPORT-12 + status taxonomy

| Option | Description | Selected |
|--------|-------------|----------|
| Throw silently, no `workflow_errors` row | Existing behaviour — invisible in `/admin/month-summary` | |
| Wrap `runReportDraftGeneration`, insert `workflow_errors` on throw, set status `ai_draft_failed`, rethrow | Matches compliance/cron patterns; Matt sees errors and can retry | ✓ |
| Migration to enforce status enum | Cleanest but adds a migration for no behavioural gain | |

**User's choice:** Delegated to Claude.
**Notes:** Status taxonomy locked: `in_progress` / `submitted` / `draft_ready_for_review` / `completed` / `ai_draft_failed`. Migration 002's legacy `DEFAULT 'Draft'` documented as a known inconsistency — no new migration; rely on code always setting status explicitly.

## Claude's Discretion

All four gray areas were delegated mid-discussion after one clarification rejection from the user ("you decide for everything"). Decisions D-04 through D-11 in `07-CONTEXT.md` are Claude's calls grounded in existing code (`runReportDraftGeneration`, `finalizeReport`, `dispatchNotification`), the Proton-via-n8n constraint, the production-ready ship target, and `07-AI-SPEC.md`. Reversible on user review.

## Deferred Ideas

- Per-hazard "evidence chip" UI linking each AI hazard back to the source field/STT — v2 once Matt has lived with the simpler panel.
- Site Risk template exemplar (REPORT-04) — blocked on a completed Site Risk example.
- Brand logo image in PDF — blocked on verified brand assets.
- RAG over historical reports — ruled out by AI-SPEC framework lock.
- Edit-distance telemetry (AI-SPEC §7) — deferred to a follow-up observability pass.
- Status column enum-tightening migration — deferred to a future cleanup phase.
