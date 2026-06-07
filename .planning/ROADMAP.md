# Roadmap: 888 Safety & Training Platform

**Milestone:** Phase 1 (v1 — signed scope)
**Granularity:** Fine (18 phases)
**Coverage:** 102/102 v1 requirements mapped
**Created:** 2026-04-15

**Core Value reminder:** Matt narrates an assessment on-site and a client-ready branded PDF report lands in minutes, not days.

---

## Build Order (LOCKED)

The stage sequence is locked and must not be reordered:

1. Scaffolding + Security Foundation (Stage 1)
2. Form Prerequisites — STT, Photo Upload, Renderer (Stage 2)
3. Template System + Schema Versioning (Stage 3) — GREEN-LIGHT GATE
4. Assessment Workflow (Stage 3 / 4 boundary)
5. AI Report Pipeline (Stage 4)
6–10. Stage 5 parallel tracks (Portal, Docs/Expiry, PayPal, Proposal/Contract, Admin)
11. Ops, Seed Data + Handover

---

## Phases

- [x] **Phase 1: Scaffolding + Security Foundation** — Supabase region lock, server-only guard, migration 001, RLS + Storage RLS, Next.js 16 codemod, Twilio sender ID initiated
- [x] **Phase 2: Form Prerequisites** — Form renderer, STT with text-input primary fallback, HEIC + EXIF photo upload, per-field media, draft persistence
- [x] **Phase 3: Template System + Schema Versioning** — Mutable template metadata, immutable version rows, FRA seed, Site Risk placeholder, admin-gated builder UI
- [x] **Phase 4: Client Compliance Portal** — Magic-link portal login, RAG compliance dashboard, document library, assessment downloads, onboarding state, mobile-responsive
- [x] **Phase 5: Document Upload, Notifications + Expiry Alerts** — Admin document upload, Twilio SMS, n8n #2 email, 30/14/7-day expiry cron (n8n #3), dedup constraint, expiry surface
- [x] **Phase 6: Assessment Workflow** — Form assignment, on-site unassigned FRA flow, "anything else" field, draft recovery — **GREEN-LIGHT GATE: Matt live-demo sign-off required before Stage 4/5**
- [x] **Phase 7: AI Report Pipeline** — n8n workflow #1 (GPT-4 structured output, YELLOW BROOM few-shot), PDF to Storage, review gate UI (side-by-side STT + draft), approve/regenerate/edit, n8n error workflow
- [ ] **Phase 8: Hours Balance + PayPal Checkout** — Portal hours display, PayPal Orders v2 checkout, idempotent webhook, atomic credit write, receipt email, configurable pricing
- [x] **Phase 9: Proposal + Auto-Contract Pipeline** — Service selection from Packages.docx, OpenAI proposal draft, PDF render, SignWell e-sign, n8n #4 contract gen, dual-sign, storage
- [x] **Phase 10: Admin Dashboard Logic** — Dynamic wiring of the existing dashboard cards to live data (compliance summary, expiry panel, review queue). Completed 2026-05-01, UAT pass (10-UAT.md, 3/3).
- [x] **Phase 11: Ops, Seed Data + Handover** — Seed 5–10 clients, live walkthrough, quick-reference guide PDF, credential migration
- [x] **Phase 12: Admin Dashboard UI Fixes** — Shipped out-of-flow (no plan/summary artifacts); commit `f2c7cce feat(admin): phase 12 - admin dashboard ui fixes and live data integration`.

### Form Builder Module (Deliverable 11 — added 2026-05-20)

Drag-drop form builder via `@coltorapps/builder` + dnd-kit. Promoted from the v2 backlog (BUILDER / COND / SCHED clusters) — confirmed in scope via Finley (voice note 4/17) and the 2026-04-17 form-template ownership decision. Build prompt of record: `.planning/research/form-builder-build-prompt.md`. Phases 14–16 can overlap once 13 is done; full module ~4–5 weeks.

- [x] **Phase 13: Form Builder Foundation** — Coltorapps integration, 7 basic field types, dnd-kit three-panel builder, schema versioning, interpreter/renderer
- [x] **Phase 14: Custom Field Types** — Signature, rating, multi-photo, geolocation, repeating sections, computed (PAS 79 risk matrix); per-field photo attach + STT
 (completed 2026-05-25)
- [x] **Phase 15: Conditional Logic Engine** — `visibilityRules` per entity, builder condition UI, runtime show/hide/require, circular-dependency detection
- [x] **Phase 16: Multi-Tenancy + Fork-on-Fill** — Template assignment, fork-on-fill, client-built templates, role gating, cross-org RLS (completed 2026-05-26)
- [x] **Phase 17: Assignment Scheduling + Notifications** — Recurrence engine, due-date status machine, n8n reminders (7d / 1d / overdue) with dedup (completed 2026-05-27)
- [x] **Phase 18: FRA Seed Template** — Blank FRA (Type 3) built via the builder, conditional sections, risk matrix, action plan, n8n report webhook (completed 2026-05-27)

### Milestone 2 — Productionization (added 2026-06-07)

- [x] **Phase 19: Client Portal Productionization** — Replace mock/stub client-portal surfaces with real DB-backed data: identity wiring (header/footer), Assignments nav consolidation (drop mock Assessments), completed-submission viewer, Contracts from proposals. Billing/PayPal (Phase 8) excluded. (completed 2026-06-07)

---

## Phase Details

### Phase 4: Client Compliance Portal
**Goal**: A client user who has been invited and signed in sees their compliance status clearly, can download their documents and delivered reports, and has a useful onboarding view with high-fidelity dummy data for the demo.
**Depends on**: Phase 1 (auth)
**Requirements**: PORTAL-01, PORTAL-02, PORTAL-03, PORTAL-04, PORTAL-05, PORTAL-06, PORTAL-07
**Success Criteria** (what must be TRUE):
  1. A client user who logs in sees their compliance items grouped by category with RAG status badges (current / expiring-soon / expired) and expiry dates.
  2. The portal uses high-fidelity dummy data for the demo to show a "full" state.
  3. A client can tap a document row and download it via a short-lived signed Storage URL.
  4. The portal is usable on a phone without horizontal scrolling or broken layout.
  5. The design follows the "High-Fidelity Editorial" system (Slate/Outfit/Newsreader).

---

### Phase 5: Document Upload, Notifications + Expiry Alerts
**Goal**: When Matt uploads a document to a client record, the client is notified immediately; and a daily cron job ensures no expiring document goes unnoticed.
**Depends on**: Phase 4 (portal views)
**Requirements**: DOCS-01, DOCS-02, DOCS-03, DOCS-04, DOCS-05, DOCS-06, EXPIRY-01, EXPIRY-02, EXPIRY-03, EXPIRY-04, EXPIRY-05, EXPIRY-06, EXPIRY-07
**Success Criteria** (what must be TRUE):
  1. Matt can upload a document via an Admin "Client Details" view.
  2. The client receives an email notification (mocked via n8n or direct Vercel function for the demo).
  3. The expiry alerts logic is functional and correctly updates the RAG status on the dashboard/portal.

---

### Phase 6: Assessment Workflow
**Goal**: Matt can open an FRA against any client on-site, fill it end-to-end with STT and photos, and submit it — completing the full on-site capture loop. This phase ends with the Stage 3 green-light gate.
**Depends on**: Phase 3
**Requirements**: ASMT-01, ASMT-02, ASMT-03, ASMT-04, ASMT-05, ASMT-06

**HARD STOP — GREEN-LIGHT GATE:** After Phase 6 is complete, Matt must see a live demo of the full capture loop. Matt's explicit sign-off is required before any Phase 7–10 work begins. No exceptions.

---

### Phase 7: AI Report Pipeline
**Goal**: A submitted FRA assessment produces a branded PDF report that lands in Matt's review queue within minutes.
**Depends on**: Phase 6
**Requirements**: REPORT-01, REPORT-02, REPORT-03, REPORT-04, REPORT-05, REPORT-06, REPORT-07, REPORT-08, REPORT-09, REPORT-10, REPORT-11, REPORT-12

**Gap-closure plans (added 2026-05-29 from 07-VERIFICATION.md):**
- [x] 07-08-PLAN.md — REPORT-05/06: Reinstall @react-pdf/renderer; npm run build clean
- [x] 07-09-PLAN.md — REPORT-08: Migration 017 adds field_media.transcript column
- [x] 07-10-PLAN.md — REPORT-12 / D-11(c): Row-level workflow_errors list + D-09 status taxonomy

---

## Progress Table

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Scaffolding + Security Foundation | 1/1 | Completed | 2026-04-29 |
| 2. Form Prerequisites | 1/1 | Completed | 2026-04-29 |
| 3. Template System + Schema Versioning | 1/1 | Completed | 2026-04-29 |
| 4. Client Compliance Portal | 1/1 | Completed | 2026-04-29 |
| 5. Document Upload + Expiry Alerts | 2/2 | Completed | 2026-04-29 |
| 6. Assessment Workflow | 1/1 | Completed | 2026-04-30 |
| 7. AI Report Pipeline | 10/10 | Complete   | 2026-05-29 |
| 8. Hours Balance + PayPal Checkout | 0/1 | Not started | - |
| 9. Proposal Pipeline | 1/1 | Completed | 2026-05-01 |
| 10. Admin Dashboard Logic | 1/1 | Completed | 2026-05-01 |
| 11. Demo Readiness & Polish | 1/1 | Completed | 2026-05-02 |
| 11. Ops, Seed Data + Handover | 0/1 | Skipped | - |
| 12. Admin Dashboard UI Fixes | 1/1 | Complete   | 2026-05-01 |
| 13. Form Builder Foundation | 4/4 | Complete   | 2026-05-25 |
| 14. Custom Field Types | 8/8 | Complete   | 2026-05-25 |
| 15. Conditional Logic Engine | 9/9 | Complete   | 2026-05-29 |
| 16. Multi-Tenancy + Fork-on-Fill | 8/8 | Complete   | 2026-05-26 |
| 17. Assignment Scheduling + Notifications | 6/6 | Complete   | 2026-05-26 |
| 18. FRA Seed Template | 3/3 | Complete   | 2026-05-27 |

---

## v2 Requirements

**Promoted to phases (2026-05-20):** The form-builder clusters below were promoted from the v2 backlog into Phases 13–18 — confirmed in scope via Finley (voice note 4/17) and the 2026-04-17 form-template ownership decision (see AGENTS.md). A formal re-quote of these requirement codes is still pending; decompose them per phase at `/gsd:plan-phase`.

- **BUILDER-01 to BUILDER-05**: Drag-drop form builder (`@coltorapps/builder` — verify React 19 compat first) → Phases 13, 14, 16
- **COND-01 to COND-04**: Conditional logic engine with DAG cycle detection → Phase 15
- **SCHED-01 to SCHED-03**: Form assignment scheduling with n8n cron reminders → Phase 17

**Still deferred (separate milestone — not assigned phase numbers):**

- **OFFLINE-01 to OFFLINE-05**: PWA / service worker / IndexedDB offline sync

---

## Coverage Audit

| Requirement | Phase |
|-------------|-------|
| FOUND-01 | 1 |
| FOUND-02 | 1 |
| FOUND-03 | 1 |
| FOUND-04 | 1 |
| FOUND-05 | 1 |
| FOUND-06 | 1 |
| FOUND-07 | 1 |
| FOUND-08 | 1 |
| AUTH-01 | 1 |
| AUTH-02 | 1 |
| AUTH-03 | 1 |
| AUTH-04 | 1 |
| AUTH-05 | 1 |
| AUTH-06 | 1 |
| AUTH-07 | 1 |
| OPS-05 | 1 |
| FORM-01 | 2 |
| FORM-02 | 2 |
| FORM-03 | 2 |
| FORM-04 | 2 |
| FORM-05 | 2 |
| FORM-06 | 2 |
| FORM-07 | 2 |
| FORM-08 | 2 |
| FORM-09 | 2 |
| FORM-10 | 2 |
| TMPL-01 | 3 |
| TMPL-02 | 3 |
| TMPL-03 | 3 |
| TMPL-04 | 3 |
| TMPL-05 | 3 |
| TMPL-06 | 3 |
| ASMT-01 | 4 |
| ASMT-02 | 4 |
| ASMT-03 | 4 |
| ASMT-04 | 4 |
| ASMT-05 | 4 |
| ASMT-06 | 4 |
| REPORT-01 | 5 |
| REPORT-02 | 5 |
| REPORT-03 | 5 |
| REPORT-04 | 5 |
| REPORT-05 | 5 |
| REPORT-06 | 5 |
| REPORT-07 | 5 |
| REPORT-08 | 5 |
| REPORT-09 | 5 |
| REPORT-10 | 5 |
| REPORT-11 | 5 |
| REPORT-12 | 5 |
| PORTAL-01 | 6 |
| PORTAL-02 | 6 |
| PORTAL-03 | 6 |
| PORTAL-04 | 6 |
| PORTAL-05 | 6 |
| PORTAL-06 | 6 |
| PORTAL-07 | 6 |
| DOCS-01 | 7 |
| DOCS-02 | 7 |
| DOCS-03 | 7 |
| DOCS-04 | 7 |
| DOCS-05 | 7 |
| DOCS-06 | 7 |
| EXPIRY-01 | 7 |
| EXPIRY-02 | 7 |
| EXPIRY-03 | 7 |
| EXPIRY-04 | 7 |
| EXPIRY-05 | 7 |
| EXPIRY-06 | 7 |
| EXPIRY-07 | 7 |
| PAY-01 | 8 |
| PAY-02 | 8 |
| PAY-03 | 8 |
| PAY-04 | 8 |
| PAY-05 | 8 |
| PAY-06 | 8 |
| PAY-07 | 8 |
| PAY-08 | 8 |
| PROP-01 | 9 |
| PROP-02 | 9 |
| PROP-03 | 9 |
| PROP-04 | 9 |
| PROP-05 | 9 |
| PROP-06 | 9 |
| PROP-07 | 9 |
| CONTRACT-01 | 9 |
| CONTRACT-02 | 9 |
| CONTRACT-03 | 9 |
| CONTRACT-04 | 9 |
| CONTRACT-05 | 9 |
| CONTRACT-06 | 9 |
| ADMIN-01 | 10 |
| ADMIN-02 | 10 |
| ADMIN-03 | 10 |
| ADMIN-04 | 10 |
| ADMIN-05 | 10 |
| ADMIN-06 | 10 |
| ADMIN-07 | 10 |
| OPS-01 | 11 |
| OPS-02 | 11 |
| OPS-03 | 11 |
| OPS-04 | 11 |

**Total mapped: 102/102**

### Phase 12: Admin Dashboard UI Fixes

**Goal:** Polish + live-data integration on top of Phase 10 dashboard wiring.
**Requirements**: N/A (out-of-flow shipment)
**Depends on:** Phase 11
**Plans:** 0 plans (shipped without the GSD plan flow)
**Status:** Completed — see commit `f2c7cce`.

Plans:
- [x] Shipped via commit `f2c7cce feat(admin): phase 12 - admin dashboard ui fixes and live data integration`

> **Phases 13–18 — Form Builder Module.** Spec of record: `.planning/research/form-builder-build-prompt.md`.
> Library: `@coltorapps/builder` + `@coltorapps/builder-react` (headless) with `dnd-kit`. Verify React 19 compat first.
> Multi-tenant from day one: clients get the full builder, identical to admin. Schema versioning is non-negotiable —
> every save = new immutable version, every submission pinned to the version it was filled against.

### Phase 13: Form Builder Foundation
**Goal**: Coltorapps is integrated and the 7 basic field types build, save, and render — a form's schema persists to Supabase with immutable versioning, and a built form can be filled and submitted end-to-end.
**Depends on**: Phase 3 (existing `form_templates` / `template_versions` schema; reconcile with migration 003). The build prompt treats Foundation as having no internal dependency.
**Requirements**: BUILDER-01, BUILDER-02, BUILDER-03, BUILDER-04, BUILDER-05 (v2 cluster — re-quote pending)
**Success Criteria** (what must be TRUE):
  1. Admin can create a template with all 7 basic entity types (text, number, date, select, textarea, checkbox, sectionGroup) via a dnd-kit three-panel builder.
  2. Drag-and-drop reordering and section reparenting work in the canvas.
  3. Saving creates an immutable `template_versions` row; re-saving creates the next version without mutating prior ones.
  4. A user can fill and submit a built form via the interpreter/renderer; the submission is pinned to its exact `version_id`.
  5. Historical submissions render against their original schema, never the latest; builder store ↔ schema JSON round-trips cleanly.
**Plans**: 4 plans

Plans:
**Wave 1**
- [x] 13-01-PLAN.md — Install coltorapps, define 7 entities + attributes + formBuilder, Vitest test infrastructure, sectionGroup reparenting spike (wave 1)

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 13-02-PLAN.md — Three-panel builder UI (palette/canvas/properties) + save/publish server actions with validateSchema (wave 2)
- [x] 13-03-PLAN.md — Coltorapps interpreter renderer + assessment fill rewire + submitAssessmentAction with version pinning (wave 2)

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 13-04-PLAN.md — Drop-and-reseed migration 010, dead-code deletion, supabase db push, human-verify checkpoint (wave 3)

### Phase 14: Custom Field Types
> **Re-implementation, not net-new (reframed 2026-05-20 after Phase 13 discussion).** Phase 13's big-bang cutover to coltorapps drops the custom field types the pre-coltorapps builder had. Phase 14 rebuilds them as coltorapps entities. Their prior React components live in git history (`components/forms/*-field.tsx` before the Phase 13 cutover) — port the UI, rebuild the entity/attribute wiring. Until this phase lands, signature/rating/photo/geo/repeating fields and the full FRA template are unavailable.
**Goal**: All 6 specialty field types work in both builder and interpreter on coltorapps, plus per-field photo attachment and speech-to-text — restoring (and extending) what the Phase 13 cutover regressed.
**Depends on**: Phase 13 (parallel with Phase 15)
**Requirements**: BUILDER-01..05 (specialty field subset — v2; re-quote pending)
**Success Criteria** (what must be TRUE):
  1. Signature, rating, multi-photo, geolocation, repeating-section, and computed field types drag in, configure, save, and render on coltorapps.
  2. Signatures store as PNG and photos compress to 1.2–1.5 MB into the `form-media` Storage bucket.
  3. Per-field photo attachment works on any field via the `attachPhotos` attribute.
  4. Geolocation captures lat/lng on a mobile browser; repeating sections honour min/max bounds; speech-to-text (Web Speech API, en-GB — the current STT implementation per commit d2651a4) works on text/textarea fields.
  5. The computed field outputs the correct PAS 79 risk level with the standard colour coding.
**Plans**: 8 plans

Plans:

**Wave 1** *(foundation — fully parallel)*
- [x] 14-01-PLAN.md — Wave 0 setup (Leaflet install + assets, ROADMAP D-15 fix, 7 shared attributes, PAS 79 utility, storage-path helpers) (wave 1)
- [x] 14-02-PLAN.md — 6 new entity definitions + register in formBuilder + extend computeFormProgress for repeatingSection + geolocation (wave 1)
- [x] 14-03-PLAN.md — uploadMediaAction (auth + MIME + size + field_media) + expandRepeatingSections + runReportDraftGeneration extension (wave 1)

**Wave 2** *(renderers — parallel after Wave 1)*
- [x] 14-04-PLAN.md — SignatureFieldRenderer + RatingFieldRenderer + MultiPhotoFieldRenderer (upload-flow renderers) (wave 2)
- [x] 14-05-PLAN.md — GeoMap + GeolocationFieldRenderer + ComputedFieldRenderer + RepeatingSectionRenderer (derived/container renderers) (wave 2)

**Wave 3** *(integration — parallel after Wave 2)*
- [x] 14-06-PLAN.md — InterpreterRenderer components map extension + AttachPhotosAffordance + MicButton inline into text/textarea + clientId plumbing (wave 3)
- [x] 14-07-PLAN.md — FieldPalette two-section layout (13 buttons) + PropertiesPanel specialty attribute editors + attachPhotos toggle universal (wave 3)

**Wave 4** *(close-out — sequential, user-gated)*
- [x] 14-08-PLAN.md — Migration 011 (specialty smoke test template) + [BLOCKING] supabase db push + 14-UAT.md + human-verify walkthrough (wave 4)

### Phase 15: Conditional Logic Engine
**Goal**: Fields can show, hide, and become required based on other field values, with circular-dependency protection.
**Depends on**: Phase 13 (parallel with Phase 14)
**Requirements**: COND-01, COND-02, COND-03, COND-04, BUILDER-02 (v2 cluster — re-quote pending)
**Success Criteria** (what must be TRUE):
  1. Admin can add `visibilityRules` to any field via the builder UI; rules evaluate at fill-time for show/hide/require.
  2. Hidden fields are excluded from validation and submission data.
  3. Multiple rules combine correctly with AND/OR logic, including nested (cross-section) conditions.
  4. Conditional logic persists through the save/load cycle; circular rule chains are detected and rejected at save time.
  5. N/A works as a distinct select value in conditions ("Some" treated as Yes for show/hide).
**Plans**: 9 plans

Plans:

**Wave 0** *(test infrastructure)*
- [x] 15-00-PLAN.md — Stub 12 Wave-0 test files (visibility unit, progress extension, renderer focus invariants) (wave 0)

**Wave 1** *(pure logic core — parallel after Wave 0)*
- [x] 15-01-PLAN.md — visibilityRulesAttribute factory + attach to all 13 entities + backcompat (wave 1)
- [x] 15-02-PLAN.md — evaluateRule / combineRules / cascade / evaluateVisibility / shouldBeProcessed hook / stripHiddenAnswers + A3 spike (wave 1)
- [x] 15-03-PLAN.md — buildDependencyMap + scope walker + validateRuleGraph (3-colour DFS, D-03 scope errors) (wave 1)

**Wave 2** *(runtime integration — parallel after Wave 1)*
- [x] 15-04-PLAN.md — Interpreter renderer visibility threading (propsRef preserves Phase 14-06 focus invariant) + computeFormProgress extension (wave 2)
- [x] 15-05-PLAN.md — Server-side stripHiddenAnswers in submitAssessmentAction + validateRuleGraph in all 4 save/publish actions (admin + customer) (wave 2)

**Wave 3** *(builder UI — parallel after Wave 1/2)*
- [x] 15-06-PLAN.md — ConditionalLogicSection + RuleRow in PropertiesPanel (UI-SPEC §1) (wave 3)
- [x] 15-07-PLAN.md — CycleErrorBanner + Save/Publish error catch + Sonner toast + publish-blocked tooltip (wave 3)

**Wave 4** *(smoke template + verification — sequential)*
- [x] 15-08-PLAN.md — Migration 012 (PAS 79 + FRA-doors + root-cascade smoke) + [BLOCKING] supabase db push + Playwright e2e + 15-UAT.md + human-verify (wave 4)

### Phase 16: Multi-Tenancy + Fork-on-Fill
**Goal**: Both confirmed use cases are live — admin assigns templates to clients, and clients can fork an assigned template or build their own from scratch.
**Depends on**: Phase 13 (parallel with Phases 14 and 15)
**Requirements**: BUILDER-01..05 (multi-tenancy / fork subset — v2; re-quote pending)
**Success Criteria** (what must be TRUE):
  1. Admin can assign a published template to a client with an optional due date; the client sees it under "Forms Assigned to You".
  2. A client can fill an assigned form, or fork it first — the fork is client-owned and independent of the master (no cascade).
  3. A client can build templates from scratch under "My Templates" using the same builder.
  4. RLS enforces no cross-org template or submission visibility (verified with two client accounts).
  5. Admin sees all templates and submissions across all clients.
**Plans**: 7 plans

Plans:

**Wave 0** *(schema + test infrastructure)*
- [x] 16-01-PLAN.md — Migrations 013 + 014, vitest.config extension, RLS helpers, RLS spec, form-builder Wave-0 scaffolds (wave 0)

**Wave 1** *(admin server-action surface + shared modal)*
- [x] 16-02-PLAN.md — createAssignments + AssignTemplateModal + mount on /admin/templates/[id] (wave 1)

**Wave 2** *(admin viewing surfaces + client lifecycle scaffolding — parallel after Wave 1)*
- [x] 16-03-PLAN.md — /admin/assignments queue + /admin/clients/[id] Assigned Forms tab + active-assignment counter pill (wave 2)
- [x] 16-04-PLAN.md — /client/assignments tabs + landing page + interpreter fill + status transitions (wave 2)

**Wave 3** *(fork + self-fill — parallel after Wave 2)*
- [x] 16-05-PLAN.md — forkAssignedTemplate + CustomiseFirstButton + delete forkOnFill dead code (wave 3)
- [x] 16-06-PLAN.md — /client/templates simplification + /client/templates/[id]/fill + submitCustomerTemplateFillAction (wave 3)

**Wave 4** *(BLOCKING: db push + verification — sequential)*
- [x] 16-07-PLAN.md — Migrations 013/014 applied to live DB; types regenerated; Vitest green for Phase 16 deliverables; 16-UAT.md written. **Known gap §D:** `FormRenderer` import in two fill-client files needs replacement with `InterpreterRenderer` before customer UAT (P1, blocks `npm run build`).

**Wave 5** *(gap closure — sequential)*
- [x] 16-08-PLAN.md — [GAP CLOSURE §D] Rewrite fill clients onto InterpreterRenderer; add createDraft + submitByIdAction pair per surface; delete INSERT actions; unblock `npm run build`.

### Phase 17: Assignment Scheduling + Notifications
**Goal**: Recurring form assignments auto-generate on schedule and clients receive automated reminders.
**Depends on**: Phase 16
**Requirements**: SCHED-01..03 (v2 cluster — re-quote pending; decompose at plan-phase)
**Success Criteria** (what must be TRUE):
  1. Recurring assignments auto-generate when the prior occurrence is completed, referencing the latest published version.
  2. Overdue assignments are flagged in both admin and client dashboards.
  3. A daily cron processes recurrences and overdue marking.
  4. Reminder notifications send at 7 days, 1 day, and on overdue, deduped via `last_reminder_sent`.
**Plans**: 6 plans

Plans:

**Wave 0** *(schema + shared lib + n8n union + test scaffolds)*
- [x] 17-01-PLAN.md — Migration 015 (3 columns + CHECK), lib/assignments/is-overdue.ts extraction, n8n union extension, test scaffolds (wave 0)

**Wave 1** *(pure scheduler functions)*
- [x] 17-02-PLAN.md — generateNextOccurrence + sendAssignmentReminder + filled specs (wave 1)

**Wave 2** *(UI mounts + cron handler — parallel)*
- [x] 17-03-PLAN.md — OverduePill component + mounts on assignment-card + admin tab + Tooltip + ORDER BY swap (wave 2)
- [x] 17-04-PLAN.md — Cron handler + vercel.json + inline recurrence trigger in submitAssignedFillByIdAction (wave 2)

**Wave 3** *(cron regression spec — sequential)*
- [x] 17-05-PLAN.md — cron-reminder-decision.spec.ts filled with 7 regression assertions (wave 3)

**Wave 4** *(BLOCKING: db push + types regen + WCAG + UAT — sequential)*
- [x] 17-06-PLAN.md — Migration 015 applied to live DB; types regenerated; WCAG verified (cream PASS, dark FAIL accepted as design-system baseline); 17-UAT.md authored (wave 4)

### Phase 18: FRA Seed Template
**Goal**: Matt's actual Fire Risk Assessment form (Blank FRA, Type 3) is built with the form builder and seeded as the first real template.
**Depends on**: Phases 14 and 15 (custom fields + conditional logic)
**Requirements**: TMPL-FRA-01..05 (Phase 18 SC-mapped, defined below) — reuses TMPL-01..06 underlying patterns

**Requirement IDs (TMPL-FRA-01..05, SC-mapped):**
- **TMPL-FRA-01** — Blank FRA Type 3 is built using the form builder, matching the Yellow Broom structure (SC#1).
- **TMPL-FRA-02** — Conditional sub-sections render Yes/No → show/hide via Phase 15 visibility-rules (SC#2).
- **TMPL-FRA-03** — Per-field photo + STT enabled on all FRA text/textarea fields (SC#3).
- **TMPL-FRA-04** — PAS 79 risk matrix auto-calculates via Phase 14 `computedField` + Action Plan via `repeatingSection` (SC#4).
- **TMPL-FRA-05** — Admin submission fires the n8n webhook for the AI report pipeline (Module 1 bridge); customer submission does NOT (architectural invariant; SC#5).
**Success Criteria** (what must be TRUE):
  1. The Blank FRA is built using the form builder, matching the Yellow Broom FRA structure across all sections.
  2. Conditional sub-sections work inside the FRA (Yes/No → show/hide).
  3. Per-field photo attachment and speech-to-text are enabled on all FRA text fields.
  4. The risk matrix auto-calculates from the two input fields, and the Action Plan uses repeating sections.
  5. A submission fires the n8n webhook for the AI report pipeline (Module 1 bridge). Site Risk template stays BLOCKED until Matt provides the blank.
**Plans**: 3 plans

Plans:

**Wave 0** *(seed migration + static-analysis spec)*
- [x] 18-01-PLAN.md — Migration 016 (full FRA Type 3 admin master seed: 6 sections, 3 conditional sub-sections, PAS 79 computedField, Action Plan repeatingSection, signature, geolocation, multi-photo) + ≥10-assertion Vitest spec (wave 0)

**Wave 1** *(n8n webhook port)*
- [x] 18-02-PLAN.md — Port legacy n8n webhook into `submitAssessmentAction` via `after(...)`; 4-assertion regression spec (wave 1)

**Wave 2** *(BLOCKING: db push + types + cleanup + UAT — sequential)*
- [x] 18-03-PLAN.md — Migration 016 applied to live DB; legacy `lib/forms/fra-template.ts` deleted after grep-check (P4); 18-UAT.md authored; ROADMAP updated (wave 2)

### Phase 19: Client Portal Productionization

**Goal:** A signed-in client sees their real org and identity in the portal chrome, navigates to real Assignments (mock Assessments removed), opens a read-only view of any completed submission, and downloads their counter-signed contracts — all DB-backed with honest empty states.
**Requirements**: D-01..D-11 (CONTEXT.md decisions — no formal REQ IDs)
**Depends on:** Phase 18
**Plans:** 4/4 plans complete

Plans:

**Wave 0**
- [x] 19-01-PLAN.md — Identity helper getClientContextWithIdentity() + Wave 0 unit test (D-02)

**Wave 1** *(parallel after Wave 0)*
- [x] 19-02-PLAN.md — Layout server/client split + dynamic identity + nav swap (Assessments→Assignments) + delete mock route (D-01, D-03, D-04, D-05, D-06)
- [x] 19-03-PLAN.md — Read-only completed-submission viewer + repoint Completed-tab link (D-07, D-08)
- [x] 19-04-PLAN.md — Contracts from proposals (status "Contract Issued") + signed-URL download + empty state (D-09, D-10, D-11)

---

*Roadmap created: 2026-04-15*
*Last updated: 2026-05-20 (added Phases 13–18 — Form Builder Module)*
*Phase 16 executed 2026-05-26: 7 plans across 5 waves; migrations 013/014 live; 1 known fill-page build gap (UAT.md §D).*
*Phase 16 §D closed 2026-05-27 by Plan 16-08 (FormRenderer → InterpreterRenderer rewrite).*
*Phase 17 executed 2026-05-27: 6 plans across 5 waves; migration 015 live; WCAG noted as design-system follow-up (UAT.md §E.1).*
*Phase 18 executed 2026-05-27: 3 plans across 3 waves; migration 016 live (FRA Type 3 seed, 6 sections / 40 entities); legacy fra-template.ts deleted.*
