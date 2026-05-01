# Roadmap: 888 Safety & Training Platform

**Milestone:** Phase 1 (v1 — signed scope)
**Granularity:** Fine (11 phases)
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
- [ ] **Phase 7: AI Report Pipeline** — n8n workflow #1 (GPT-4 structured output, YELLOW BROOM few-shot), PDF to Storage, review gate UI (side-by-side STT + draft), approve/regenerate/edit, n8n error workflow
- [ ] **Phase 8: Hours Balance + PayPal Checkout** — Portal hours display, PayPal Orders v2 checkout, idempotent webhook, atomic credit write, receipt email, configurable pricing
- [ ] **Phase 9: Proposal + Auto-Contract Pipeline** — Service selection from Packages.docx, OpenAI proposal draft, PDF render, SignWell e-sign, n8n #4 contract gen, dual-sign, storage
- [ ] **Phase 10: Admin Dashboard Logic** — Dynamic wiring of the existing dashboard cards to live data (compliance summary, expiry panel, review queue).
- [ ] **Phase 11: Ops, Seed Data + Handover** — Seed 5–10 clients, live walkthrough, quick-reference guide PDF, credential migration

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
| 7. AI Report Pipeline | 0/1 | Not started | - |
| 8. Hours Balance + PayPal Checkout | 0/1 | Not started | - |
| 9. Proposal Pipeline | 1/1 | Completed | 2026-05-01 |
| 10. Admin Dashboard Logic | 1/1 | Completed | 2026-05-01 |
| 11. Demo Readiness & Polish | 1/1 | In Progress | - |
| 11. Ops, Seed Data + Handover | 0/1 | Skipped | - |
| 12. Admin Dashboard UI Fixes | 0/1 | Not started | - |

---

## v2 Requirements (Separate Milestone — Not Part of This Roadmap)

The following are in the original intake but are NOT in the signed Phase 1 scope. They require a re-quote before any work begins. Do not assign phase numbers.

- **BUILDER-01 to BUILDER-05**: Drag-drop form builder (`@coltorapps/builder` — verify React 19 compat first)
- **COND-01 to COND-04**: Conditional logic engine with DAG cycle detection
- **SCHED-01 to SCHED-03**: Form assignment scheduling with n8n cron reminders
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

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 11
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd-plan-phase 12 to break down)

---

*Roadmap created: 2026-04-15*
*Last updated: 2026-04-15 (initial creation)*
