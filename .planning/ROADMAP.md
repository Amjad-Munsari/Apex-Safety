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

- [ ] **Phase 1: Scaffolding + Security Foundation** — Supabase region lock, server-only guard, migration 001, RLS + Storage RLS, Next.js 16 codemod, Twilio sender ID initiated
- [ ] **Phase 2: Form Prerequisites** — Form renderer, STT with text-input primary fallback, HEIC + EXIF photo upload, per-field media, draft persistence
- [ ] **Phase 3: Template System + Schema Versioning** — Mutable template metadata, immutable version rows, FRA seed, Site Risk placeholder, admin-gated builder UI
- [ ] **Phase 4: Assessment Workflow** — Form assignment, on-site unassigned FRA flow, "anything else" field, draft recovery — **GREEN-LIGHT GATE: Matt live-demo sign-off required before Stage 4/5**
- [ ] **Phase 5: AI Report Pipeline** — n8n workflow #1 (GPT-4 structured output, YELLOW BROOM few-shot), PDF to Storage, review gate UI (side-by-side STT + draft), approve/regenerate/edit, n8n error workflow
- [ ] **Phase 6: Client Compliance Portal** — Magic-link portal login, RAG compliance dashboard, document library, assessment downloads, onboarding state, mobile-responsive
- [ ] **Phase 7: Document Upload, Notifications + Expiry Alerts** — Admin document upload, Twilio SMS, n8n #2 email, 30/14/7-day expiry cron (n8n #3), dedup constraint, expiry surface
- [ ] **Phase 8: Hours Balance + PayPal Checkout** — Portal hours display, PayPal Orders v2 checkout, idempotent webhook, atomic credit write, receipt email, configurable pricing
- [ ] **Phase 9: Proposal + Auto-Contract Pipeline** — Service selection from Packages.docx, OpenAI proposal draft, PDF render, SignWell e-sign, n8n #4 contract gen, dual-sign, storage
- [ ] **Phase 10: Admin Dashboard** — Single-pane client RAG summary, expiry panel, review queue, active proposals, hours balances, workflow errors, desktop-primary responsive
- [ ] **Phase 11: Ops, Seed Data + Handover** — Seed 5–10 clients, live walkthrough, quick-reference guide PDF, credential migration

---

## Phase Details

### Phase 1: Scaffolding + Security Foundation
**Goal**: The project infrastructure is locked so no security, GDPR, or breaking-change debt can be introduced by later phases.
**Depends on**: Nothing (first phase)
**Requirements**: FOUND-01, FOUND-02, FOUND-03, FOUND-04, FOUND-05, FOUND-06, FOUND-07, FOUND-08, AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06, AUTH-07, OPS-05
**Success Criteria** (what must be TRUE):
  1. A browser that is not authenticated receives a 403 when attempting any Supabase Storage URL — verified in an automated integration test.
  2. Importing `lib/supabase/admin.ts` from any Client Component causes a build error (the `server-only` guard is wired and tested).
  3. Matt can sign in with email/password, refresh the browser, and remain signed in; a client user who follows a magic-link invite lands in the portal and can set a password; both can sign out from any page with the session cleared server-side.
  4. A test user logged in as Client A that attempts to read Client B's rows across every multi-tenant table returns zero rows.
  5. The Next.js 16 codemod has been applied: `proxy.ts` exists, all request APIs are async, `revalidateTag` signature is updated, no `middleware.ts` file remains.
  6. Twilio UK sender ID registration ("888Safety") has been submitted — lead time is being tracked.
**Plans**: TBD
**UI hint**: yes

**Blocker notes:**
- FOUND-01: Supabase region eu-west-2 is a one-time decision — set at project creation, document in PROJECT.md immediately.
- OPS-05: Twilio sender ID registration initiated here; completion required before any SMS-sending phase ships.

---

### Phase 2: Form Prerequisites
**Goal**: Matt can fill a hardcoded-schema form on tablet, attach per-field photos, use speech-to-text, and have his submission pinned to a schema version — proving the core capture infrastructure before any real templates are loaded.
**Depends on**: Phase 1
**Requirements**: FORM-01, FORM-02, FORM-03, FORM-04, FORM-05, FORM-06, FORM-07, FORM-08, FORM-09, FORM-10
**Success Criteria** (what must be TRUE):
  1. Matt can upload a photo from an iPad, see it compressed to 1.2–1.5MB (not below), and the inspection label text on the fusebox photos is legible — verified against the received `photo-fusebox-01.jpg` / `-02.jpg`.
  2. On iPad Safari in standalone (home-screen) mode, the microphone button is visibly disabled with a helpful message, and the text input field is immediately present for all text/textarea fields — no silent failure.
  3. Every text field has a working microphone button on a non-standalone browser; dictated text appears in the field.
  4. A partially-filled form survives a browser close and reload — the draft is recovered from local storage.
  5. A submitted form reopened as read-only renders its answers against the original `template_version_id` snapshot even if the schema has since changed.
**Plans**: TBD
**UI hint**: yes

**Blocker notes:**
- FORM-06: HEIC images must be detected (`file.type === 'image/heic'`), converted to JPEG via `heic2any`, and EXIF-rotated before compression. The 1.2–1.5MB target (not 800KB) is non-negotiable for inspection-label legibility.
- FORM-03 / FORM-04: Text input fallback ships alongside STT — it is the primary path in PWA mode, not a recovery plan.

---

### Phase 3: Template System + Schema Versioning
**Goal**: Matt can manage form templates through the admin UI, publish immutable versions, and the FRA seed template is live — proving the schema versioning contract that every downstream submission depends on.
**Depends on**: Phase 2
**Requirements**: TMPL-01, TMPL-02, TMPL-03, TMPL-04, TMPL-05, TMPL-06
**Success Criteria** (what must be TRUE):
  1. Matt publishes v1 of the FRA template, fills a submission against it, then publishes v2 with a structural change; re-opening the original submission renders it correctly using the v1 snapshot — not the v2 schema.
  2. The "Fire Risk Assessment (Type 3)" seed template is loaded from the Blank FRA doc and renders all its fields correctly on tablet.
  3. The "Site Risk Assessment" placeholder template exists in the database and renders a skeleton form — it will be filled once Matt's blank template arrives.
  4. The form builder UI (template create/edit/publish) is accessible only to admin-role users; a client-portal session attempting those routes is redirected or returns 403.
**Plans**: TBD
**UI hint**: yes

**Blocker notes:**
- TMPL-05: Site Risk Assessment template is a placeholder that scaffolds against a skeleton schema now and ships its real content when Matt provides the blank template. Note this dependency explicitly in the admin UI.
- TMPL-06: The Matt-only editing assumption is the working default. If the editable-forms open question resolves differently, TMPL-06's scope expands — no rework to the template engine itself, only the permission layer.

---

### Phase 4: Assessment Workflow
**Goal**: Matt can open an FRA against any client on-site, fill it end-to-end with STT and photos, and submit it — completing the full on-site capture loop that is the product's core value. This phase ends with the Stage 3 green-light gate.
**Depends on**: Phase 3
**Requirements**: ASMT-01, ASMT-02, ASMT-03, ASMT-04, ASMT-05, ASMT-06

**HARD STOP — GREEN-LIGHT GATE:** After Phase 4 is complete, Matt must see a live demo of the full capture loop (assign template, open FRA, narrate fields via STT, attach photos, submit, see submission pinned to version). Matt's explicit sign-off is required before any Phase 5–10 work begins. No exceptions.

**Success Criteria** (what must be TRUE):
  1. Matt can open a new FRA against any client from the admin side without a prior assignment — the on-site flow works without setup friction.
  2. A client user who has been assigned a form sees it in their "Forms assigned to you" list and can open a new instance.
  3. The final "anything else" field supports STT + photo attachment — Matt's end-of-site narrative notes are captured in the submission.
  4. If the browser is closed mid-assessment on the tablet, reopening the app recovers the in-progress form from local storage.
  5. Submitting a form triggers the report generation pipeline hook (n8n #1 webhook endpoint receives the event — even if n8n is not yet built, the outbound call is logged/verified).
**Plans**: TBD
**UI hint**: yes

---

### Phase 5: AI Report Pipeline
**Goal**: A submitted FRA assessment produces a branded PDF report that lands in Matt's review queue within minutes, where he can see the raw STT transcript alongside the AI draft, and approve or reject before delivery.
**Depends on**: Phase 4 (green-light gate must be passed)
**Requirements**: REPORT-01, REPORT-02, REPORT-03, REPORT-04, REPORT-05, REPORT-06, REPORT-07, REPORT-08, REPORT-09, REPORT-10, REPORT-11, REPORT-12
**Success Criteria** (what must be TRUE):
  1. Within minutes of a form submission, a PDF appears in the "Reports awaiting review" panel with status `draft_ready_for_review` — Matt did not trigger this manually.
  2. The review UI shows the raw STT transcript verbatim in one panel and the GPT-4 generated draft in the adjacent panel — Matt can compare what he said vs what the AI wrote.
  3. Matt can approve the draft (flips to `delivered`), request regeneration, or edit the content before delivering — no report is auto-delivered without his action.
  4. A simulated n8n workflow #1 failure writes a row to `workflow_errors` and it is visible in the admin dashboard — silent failures are impossible.
  5. The generated PDF matches 888's header/footer branding derived from YELLOW BROOM (logo + brand colours).
**Plans**: TBD
**UI hint**: yes

**Blocker notes:**
- REPORT-04: Site Risk few-shot variant blocked on Matt's completed site-risk example. The FRA variant ships; site-risk variant scaffolds and ships when the example arrives.
- REPORT-05: Brand assets (logo, hex colours) must arrive before the first real branded PDF is generated. Placeholder branding is acceptable for testing in Stage 4.
- REPORT-12: The n8n error workflow is established alongside workflow #1 — not after all four workflows are complete. This pattern is reused by all subsequent n8n workflows.

---

### Phase 6: Client Compliance Portal
**Goal**: A client user who has been invited and signed in sees their compliance status clearly, can download their documents and delivered reports, and has a useful onboarding view even if no documents have been uploaded yet.
**Depends on**: Phase 1 (auth), Phase 3 (submissions model)
**Requirements**: PORTAL-01, PORTAL-02, PORTAL-03, PORTAL-04, PORTAL-05, PORTAL-06, PORTAL-07
**Success Criteria** (what must be TRUE):
  1. A client user who logs in sees their compliance items grouped by category with RAG status badges (current / expiring-soon / expired) and expiry dates — not a blank table.
  2. A client with no documents yet sees a meaningful onboarding state that explains what to expect — not an empty table or a 404.
  3. A client can tap a document row and download it via a short-lived signed Storage URL — they cannot construct a URL for another client's document.
  4. The portal is usable on a phone without horizontal scrolling or broken layout.
  5. Categories and renewal periods can be extended by Matt via data entry (no deploy required).
**Plans**: TBD
**UI hint**: yes

**Blocker notes:**
- PORTAL-03: Compliance taxonomy (categories + renewal periods) is data-driven but the initial seed data is blocked on Matt's list. Scaffold the data model now; populate once Matt provides it.
- PORTAL-06: Onboarding copy pending Matt. Use placeholder copy that clearly signals "pending client content."

---

### Phase 7: Document Upload, Notifications + Expiry Alerts
**Goal**: When Matt uploads a document to a client record, the client is notified immediately by SMS and email; and a daily cron job ensures no expiring document goes unnoticed for Matt or the client.
**Depends on**: Phase 1 (auth, Twilio sender ID complete), Phase 6 (portal views expiry state)
**Requirements**: DOCS-01, DOCS-02, DOCS-03, DOCS-04, DOCS-05, DOCS-06, EXPIRY-01, EXPIRY-02, EXPIRY-03, EXPIRY-04, EXPIRY-05, EXPIRY-06, EXPIRY-07
**Success Criteria** (what must be TRUE):
  1. Matt uploads a document to a client record; within seconds the client receives an SMS and an email — triggered once, not twice, regardless of any retry on the upload.
  2. The daily 08:00 UK-time cron runs and sends expiry alerts for documents expiring in 30, 14, and 7 days; the `notifications_sent` UNIQUE constraint prevents duplicate alerts for the same document-window-recipient combination.
  3. The admin dashboard and client portal both surface expiry state (RAG badges with dates) — a document expiring in 8 days shows "expiring soon," not "current."
  4. On document expiry, the system flags and alerts only — no auto-rebook or auto-quote is triggered.
  5. The notification sign-off name is configurable in the admin settings and defaults to "888 Safety" until Matt specifies otherwise.
**Plans**: TBD
**UI hint**: yes

**Blocker notes:**
- DOCS-05: Notification sign-off name ("888 Safety" vs "Matt") is pending Matt's preference. Build the configurable field now; populate once confirmed.
- OPS-05 (Phase 1): Twilio sender ID registration must be complete before Phase 7 ships to production. Track lead time from Phase 1 submission.

---

### Phase 8: Hours Balance + PayPal Checkout
**Goal**: A client can see their consulting hours balance in the portal and top up via PayPal, with the credit applied atomically and a receipt sent — the full payment loop is complete and idempotent.
**Depends on**: Phase 6 (portal), Phase 1 (schema constraint landed in migration 001)
**Requirements**: PAY-01, PAY-02, PAY-03, PAY-04, PAY-05, PAY-06, PAY-07, PAY-08
**Success Criteria** (what must be TRUE):
  1. A client sees their current hours balance in the portal and can tap "Buy More" to initiate a PayPal checkout — the checkout uses PayPal Orders API v2 (not Stripe).
  2. On `PAYMENT.CAPTURE.COMPLETED`, the webhook handler verifies the PayPal signature before any DB write; replaying the same event does not double-credit the balance (idempotency enforced by UNIQUE `paypal_order_id` constraint).
  3. After a successful capture, `hours_balance` is updated atomically in the same DB transaction as the `hours_transactions` row — no partial state is possible.
  4. The client receives a receipt email via n8n #2 on successful capture.
  5. The pricing model (flat rate / packages / bundles) and deduction method (manual by Matt vs auto) are configurable in admin settings — not hardcoded.
**Plans**: TBD
**UI hint**: yes

**Blocker notes:**
- PAY-02: PayPal developer credentials are pending. Build and test with PayPal sandbox; switch to live credentials when the shared Gmail is provisioned.
- PAY-07 / PAY-08: Pricing model and deduction method blocked on Matt's decision. Scaffold the configuration fields; apply logic once Matt decides.

---

### Phase 9: Proposal + Auto-Contract Pipeline
**Goal**: Matt can select services, generate an AI-drafted proposal PDF, send it for client signature, and have a service agreement automatically generated and counter-signed — the full sales pipeline from service selection to signed contract runs without leaving the platform.
**Depends on**: Phase 1 (auth, Storage), Phase 5 (n8n error workflow pattern), Phase 10 (admin dashboard shows pipeline)
**Requirements**: PROP-01, PROP-02, PROP-03, PROP-04, PROP-05, PROP-06, PROP-07, CONTRACT-01, CONTRACT-02, CONTRACT-03, CONTRACT-04, CONTRACT-05, CONTRACT-06
**Success Criteria** (what must be TRUE):
  1. Matt selects services from the parsed Packages.docx / Course List Master.xlsx catalogue, enters quantities and tier, and the system calculates the total — no manual price lookup needed.
  2. "Generate Proposal" produces a PDF that visually matches the Blank Proposal One Page Template, with AI-drafted body text from OpenAI via OpenRouter.
  3. The proposal is sent via SignWell and Matt can see its e-sign status in the admin dashboard; the SignWell webhook is idempotent and verifies the signature.
  4. On client signature, n8n #4 automatically generates and sends a Service Agreement (20-clause Blank Service Agreement parameterised with client details) for client e-sign, then routes to Matt for counter-signature.
  5. After both parties sign, the finalised contract PDF is stored in the `proposals` bucket under the client's path prefix and is visible to both Matt and the client.
  6. Any n8n #4 failure surfaces in the admin dashboard `workflow_errors` panel.
**Plans**: TBD
**UI hint**: yes

**Blocker notes:**
- PROP-05: E-sign provider is defaulting to SignWell. If Matt specifies a different provider, the webhook handler and send API calls need to target that provider instead.
- CONTRACT-02: Contract parameterisation uses the Blank Service Agreement (received 2026-04-15). Verify clause count and schedule structure before n8n #4 is built.

---

### Phase 10: Admin Dashboard
**Goal**: Matt has a single-screen operational view of every live concern — compliance status across all clients, expiring documents, reports awaiting review, in-flight proposals, hours balances, and n8n workflow errors — without navigating multiple sections.
**Depends on**: Phase 5 (reports), Phase 6 (portal/compliance), Phase 7 (expiry), Phase 8 (hours), Phase 9 (proposals)
**Requirements**: ADMIN-01, ADMIN-02, ADMIN-03, ADMIN-04, ADMIN-05, ADMIN-06, ADMIN-07
**Success Criteria** (what must be TRUE):
  1. From a single page, Matt can see all clients with a RAG compliance summary per client — one glance shows who needs attention.
  2. The "Upcoming expiries" panel shows all documents across all clients expiring in the next 30 days, not just a single client's documents.
  3. The "Reports awaiting review" panel shows any `draft_ready_for_review` submission with a one-click path directly into the review UI.
  4. The "Workflow errors" panel shows recent n8n failures — Matt can triage automation problems without accessing the n8n dashboard.
  5. The dashboard is usable on a laptop/desktop in full width and does not break on a mobile screen.
**Plans**: TBD
**UI hint**: yes

---

### Phase 11: Ops, Seed Data + Handover
**Goal**: The platform is populated with real client data, Matt is trained and confident operating it independently, and all infrastructure is transferred to the shared project account.
**Depends on**: Phase 10 (all features complete)
**Requirements**: OPS-01, OPS-02, OPS-03, OPS-04
**Success Criteria** (what must be TRUE):
  1. 5–10 real clients from Sample Contacts.xlsx are imported and visible in the admin dashboard with their compliance records.
  2. Matt can navigate from the admin dashboard to client portal to assessment form to report review queue without assistance — the walkthrough session has been completed.
  3. A quick-reference PDF guide covering admin dashboard, assessment forms, client portal, proposal pipeline, and all automations has been handed to Matt.
  4. Supabase, Vercel, n8n, and PayPal credentials are migrated to the shared project Gmail account; Ayman's personal account credentials are rotated and invalidated.
**Plans**: TBD

**Blocker notes:**
- OPS-04: Blocked on shared Gmail from Finley. Document the full credential inventory now. Rotate all secrets immediately after transfer — do not reuse personal-account keys.

---

## Progress Table

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Scaffolding + Security Foundation | 0/? | Not started | - |
| 2. Form Prerequisites | 0/? | Not started | - |
| 3. Template System + Schema Versioning | 0/? | Not started | - |
| 4. Assessment Workflow | 0/? | Not started | - |
| 5. AI Report Pipeline | 0/? | Not started | - |
| 6. Client Compliance Portal | 0/? | Not started | - |
| 7. Document Upload, Notifications + Expiry Alerts | 0/? | Not started | - |
| 8. Hours Balance + PayPal Checkout | 0/? | Not started | - |
| 9. Proposal + Auto-Contract Pipeline | 0/? | Not started | - |
| 10. Admin Dashboard | 0/? | Not started | - |
| 11. Ops, Seed Data + Handover | 0/? | Not started | - |

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

---

*Roadmap created: 2026-04-15*
*Last updated: 2026-04-15 (initial creation)*
