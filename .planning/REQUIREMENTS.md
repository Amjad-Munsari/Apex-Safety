# Requirements: 888 Safety & Training Platform

**Defined:** 2026-04-15
**Core Value:** Matt narrates an assessment on-site and a client-ready branded PDF report lands in minutes, not days.

Scope note: v1 = Phase 1 (the 11 signed deliverables). v2 = Phase 2 form builder (in the original intake, not yet quoted — re-quote required). Blockers flagged with ⚠️ are pending Finley/Matt; requirements tagged with them can scaffold but not ship until unblocked.

## v1 Requirements

### Foundation & Security (FOUND)

Stage 1 locks that cannot be retrofitted. Every later requirement depends on these.

- [ ] **FOUND-01**: Supabase project is created in `eu-west-2` (London) region for UK GDPR compliance
- [ ] **FOUND-02**: Admin/service-role Supabase client is isolated behind `import "server-only"` in `lib/supabase/admin.ts`
- [ ] **FOUND-03**: Next.js 16 codemod has been applied (`middleware.ts` → `proxy.ts`, async request APIs, `revalidateTag` signature) before any feature code lands
- [ ] **FOUND-04**: Base schema migration 001 creates `clients`, `client_users`, `admin_users`, `documents`, `form_templates`, `template_versions`, `form_submissions`, `field_media`, `notifications_sent`, `workflow_errors`, `hours_transactions` tables with `deleted_at` soft-delete columns
- [ ] **FOUND-05**: Row-Level Security policies are enabled on every table with client data; cross-tenant reads return zero rows when logged in as Client A attempting Client B resources
- [ ] **FOUND-06**: Storage buckets `client-documents`, `reports`, `proposals`, `form-media` (private) and `brand-assets` (public) exist with `storage.objects` RLS policies that check `storage.foldername(name)[1]` against the caller's `client_id`
- [ ] **FOUND-07**: A logged-out request for a signed/unsigned Storage URL returns 403 (verified in test)
- [ ] **FOUND-08**: Supabase-generated TypeScript types are committed to source and regenerated on schema change

### Authentication & Roles (AUTH)

- [ ] **AUTH-01**: Matt can sign in as admin via email/password and stay signed in across browser refresh
- [ ] **AUTH-02**: Client users receive a magic-link sign-up invitation when Matt adds them (no password required at signup)
- [ ] **AUTH-03**: Client user can set an optional password after first sign-in
- [ ] **AUTH-04**: Client user can request a magic-link re-send if the original invite expired
- [ ] **AUTH-05**: Admin role is enforced via `admin_users` table membership, checked server-side on every admin-scoped route
- [ ] **AUTH-06**: Signed-in client users see only their own `client_id`'s data; admin sees all
- [ ] **AUTH-07**: User can sign out from any page and session is cleared server-side

### Form Templates & Schema Versioning (TMPL)

Ships in Stage 3 and is a pre-condition to any form submission.

- [ ] **TMPL-01**: `form_templates` rows are mutable metadata (name, description, owner), `template_versions` rows are immutable once `published_at` is set
- [ ] **TMPL-02**: Publishing a template increments its version number and creates a new immutable `template_versions` row containing the full JSON schema
- [ ] **TMPL-03**: `form_submissions.template_version_id` pins each submission to the exact schema it was filled against
- [ ] **TMPL-04**: Seed "Fire Risk Assessment (Type 3)" template is loaded from the Blank FRA doc received 2026-04-15
- [ ] **TMPL-05**: Seed "Site Risk Assessment" template exists as a placeholder and renders once the blank template arrives from Matt ⚠️ *blocked on Site Risk template*
- [ ] **TMPL-06**: Form builder UI is gated to admin role only (Matt-only editing — default assumption per open question) ⚠️ *revisit on editable-forms answer*

### Form Rendering, STT & Photo Upload (FORM)

Stage 2 prerequisites. Both STT and photo upload must ship with their fallbacks — not after.

- [ ] **FORM-01**: A JSON schema (text, number, date, dropdown, multi-select, signature, rating, multi-photo, geolocation, repeating section) renders as a fillable form on tablet and phone
- [ ] **FORM-02**: Every text/textarea field has a microphone button that triggers Web Speech API dictation into that field
- [ ] **FORM-03**: Text input fallback is available on every text/textarea field regardless of STT status (primary path on iPad Safari home-screen / offline)
- [ ] **FORM-04**: STT button is visibly disabled with a helpful message when Web Speech API is unavailable (no silent failure)
- [ ] **FORM-05**: Every field supports optional photo attachment stored in `field_media(submission_id, field_key)`, not a single gallery at the bottom
- [ ] **FORM-06**: Photo upload accepts HEIC from iPhone/iPad, auto-rotates via EXIF, and compresses to 1.2–1.5MB (NOT below) while preserving inspection-label legibility verified against the received fusebox photos
- [ ] **FORM-07**: Each photo attachment can carry a short text label (e.g., "Basement", "No pat testing") stored with the media row
- [ ] **FORM-08**: A form draft persists to local storage and recovers on page reload
- [ ] **FORM-09**: Submission posts the full field payload + media refs + `template_version_id` and creates a `form_submissions` row with status `submitted`
- [ ] **FORM-10**: A submitted form can be re-opened read-only and renders against its original `template_version_id` — not the latest

### Assessment Workflow (ASMT)

- [ ] **ASMT-01**: Admin can assign a form template to a client via `form_assignments`
- [ ] **ASMT-02**: Assigned client user sees "Forms assigned to you" list and can open a new instance
- [ ] **ASMT-03**: Matt can open a new FRA against any client from the admin side without prior assignment (on-site flow)
- [ ] **ASMT-04**: Handwritten-notes-at-end is supported via a final free-form "anything else" text field with STT + photo
- [ ] **ASMT-05**: Form submission triggers the report generation pipeline (see REPORT-*)
- [ ] **ASMT-06**: An in-progress assessment is recoverable after browser close on tablet

### AI Report Generation (REPORT)

Lives entirely in n8n per ADR 2026-04-15.

- [ ] **REPORT-01**: n8n workflow #1 triggers on `form_submissions` insert webhook and formats submission into a GPT-4 prompt
- [ ] **REPORT-02**: GPT-4 is invoked with JSON-schema structured output — the model cannot populate fields without evidence in the submission
- [ ] **REPORT-03**: YELLOW BROOM FRA is included as few-shot reference for the FRA template variant
- [ ] **REPORT-04**: Site Risk variant has a comparable few-shot reference ⚠️ *blocked on completed site-risk example*
- [x] **REPORT-05**: Branded PDF is rendered matching 888's header/footer derived from YELLOW BROOM (logo + brand colours) ⚠️ *blocked on brand assets*
- [x] **REPORT-06**: PDF is stored in `reports` Storage bucket under the client's path prefix
- [ ] **REPORT-07**: `form_submissions.report_url` and `form_submissions.status = 'draft_ready_for_review'` are updated atomically on completion
- [ ] **REPORT-08**: Admin review UI shows the generated draft alongside the raw STT transcript verbatim so Matt can compare what he said vs what the AI wrote
- [ ] **REPORT-09**: Matt can approve, request regenerate, or edit the PDF before delivery
- [ ] **REPORT-10**: Approved PDFs flip `status = 'delivered'` and trigger n8n workflow #2 (email)
- [ ] **REPORT-11**: No PDF is auto-delivered to a client without Matt's explicit approval in MVP
- [ ] **REPORT-12**: n8n error workflow is wired to catch workflow #1 failures and write to `workflow_errors` table visible in admin dashboard

### Client Compliance Portal (PORTAL)

- [ ] **PORTAL-01**: Logged-in client user sees a dashboard with compliance items grouped by category
- [ ] **PORTAL-02**: Each compliance item shows a RAG status badge (current / expiring-soon / expired) with its expiry date
- [ ] **PORTAL-03**: Categories and renewal periods are data-driven so Matt can extend without a deploy ⚠️ *blocked on compliance taxonomy from Matt*
- [ ] **PORTAL-04**: Client user can open/download a document they own (signed Storage URL, short-lived)
- [ ] **PORTAL-05**: Portal works mobile-responsively (tablet primary, phone secondary)
- [ ] **PORTAL-06**: Day-one view (no documents yet) shows an onboarding state, not an empty table ⚠️ *copy pending Matt*
- [ ] **PORTAL-07**: Client user sees their current assessments/reports and can download the delivered PDFs

### Document Upload & Notifications (DOCS)

- [ ] **DOCS-01**: Admin can upload a document to a client record with category and optional expiry date
- [ ] **DOCS-02**: On upload, the document is stored in `client-documents` bucket under the client's path prefix with a signed Storage URL
- [ ] **DOCS-03**: On upload, the system fires a Twilio SMS to the client contact via `/api/sms/send`
- [ ] **DOCS-04**: On upload, the system fires an email via n8n workflow #2 (universal email sender)
- [ ] **DOCS-05**: Notification sign-off name is configurable ("888 Safety" vs "Matt") ⚠️ *blocked on Matt's preference*
- [ ] **DOCS-06**: Duplicate-send is prevented by upstream idempotency (single upload event = one SMS + one email)

### Expiry Alert Automation (EXPIRY)

- [ ] **EXPIRY-01**: n8n workflow #3 runs daily at 08:00 UK time (Europe/London) via Vercel cron trigger
- [ ] **EXPIRY-02**: Workflow queries `documents` for items expiring in 30 / 14 / 7 days
- [ ] **EXPIRY-03**: Dedup is enforced by a `UNIQUE(document_id, alert_window, notification_type)` constraint on `notifications_sent` — not application-level only
- [ ] **EXPIRY-04**: Each expiry match sends an email to the client and an email to Matt via n8n workflow #2
- [ ] **EXPIRY-05**: Each expiry match sends an SMS to the client and to Matt via `/api/sms/send`
- [ ] **EXPIRY-06**: Expiry state is visible on the admin dashboard and the client portal
- [ ] **EXPIRY-07**: MVP default on expiry is flag + alert only; no auto-rebook/auto-quote

### Hours Balance & PayPal Checkout (PAY)

- [ ] **PAY-01**: Client portal shows the client's current `hours_balance`
- [ ] **PAY-02**: "Buy More" button initiates a PayPal Orders API v2 checkout (NOT Stripe) ⚠️ *PayPal dev creds pending*
- [ ] **PAY-03**: On `PAYMENT.CAPTURE.COMPLETED` webhook, `/api/paypal/webhook` reads raw body and verifies signature via PayPal's postback endpoint before any DB write
- [ ] **PAY-04**: Idempotency is DB-enforced via `UNIQUE(paypal_order_id)` on `hours_transactions` — application-level check is defense-in-depth only
- [ ] **PAY-05**: On successful capture, `hours_balance` is credited and a `hours_transactions` row is written atomically
- [ ] **PAY-06**: Receipt email is fired via n8n workflow #2 on successful capture
- [ ] **PAY-07**: Pricing model (flat rate vs packages vs bundles) is configurable ⚠️ *blocked on Matt's pricing decision*
- [ ] **PAY-08**: Hours deduction method (manual by Matt vs auto on assessment complete) is configurable ⚠️ *blocked on Matt*

### Proposal Generation (PROP)

- [ ] **PROP-01**: Admin service-selection interface lists services parsed from `Packages.docx` and `Course List Master.xlsx`
- [ ] **PROP-02**: Matt picks services, quantities, and tier; system calculates the price
- [ ] **PROP-03**: "Generate Proposal" calls OpenAI (via OpenRouter) to draft proposal text matching the Blank Proposal One Page Template format
- [ ] **PROP-04**: Server renders proposal PDF with `@react-pdf/renderer` matching Matt's layout
- [ ] **PROP-05**: Proposal is sent via the e-sign provider (default SignWell) for client signature ⚠️ *confirm provider with Matt*
- [ ] **PROP-06**: E-sign webhook `/api/esign/webhook` verifies signature, is idempotent, and updates `proposals.status`
- [ ] **PROP-07**: Signed proposal PDF is stored in `proposals` bucket under the client's path prefix

### Auto-Contract Generation (CONTRACT)

- [ ] **CONTRACT-01**: Proposal-signed webhook triggers n8n workflow #4 (contract generation)
- [ ] **CONTRACT-02**: n8n #4 parameterises the 20-clause Blank Service Agreement with client name, charges schedule, start date, services
- [ ] **CONTRACT-03**: Generated contract is sent to the client for signature via the same e-sign provider
- [ ] **CONTRACT-04**: After client signs, Matt receives a counter-signature request
- [ ] **CONTRACT-05**: After both parties sign, the finalised contract PDF is stored in `proposals` bucket (same pattern) and visible to both Matt and the client
- [ ] **CONTRACT-06**: Contract generation failures surface in admin dashboard via `workflow_errors`

### Admin Dashboard (ADMIN)

- [ ] **ADMIN-01**: Single-page view lists all clients with compliance RAG summary per client
- [ ] **ADMIN-02**: "Upcoming expiries" panel shows all documents expiring in next 30 days across all clients
- [ ] **ADMIN-03**: "Reports awaiting review" panel surfaces any `form_submissions.status = 'draft_ready_for_review'` with a one-click open-to-review path
- [ ] **ADMIN-04**: "Active proposals" panel shows proposals in-flight with status from the e-sign provider
- [ ] **ADMIN-05**: "Hours balances" panel shows each client's current `hours_balance`
- [ ] **ADMIN-06**: "Workflow errors" panel shows recent `workflow_errors` rows (n8n failures) for operational triage
- [ ] **ADMIN-07**: Admin dashboard is desktop-primary but mobile-responsive

### Ops, Seed Data & Handover (OPS)

- [ ] **OPS-01**: 5–10 seed clients from `Sample Contacts.xlsx` are imported before walkthrough
- [ ] **OPS-02**: A live walkthrough session covers admin dashboard, assessment forms, client portal, proposal pipeline, all automations
- [ ] **OPS-03**: A quick-reference markdown guide is exported as PDF and handed to Matt
- [ ] **OPS-04**: PayPal + Supabase + Vercel + n8n credentials are migrated from Ayman's personal accounts to the shared project Gmail ⚠️ *blocked on shared Gmail from Finley*
- [ ] **OPS-05**: Twilio UK sender ID registration is initiated in Stage 1 (lead time unknown) and completed by the first SMS-dependent deliverable

## v2 Requirements

Phase 2 form builder and extensions. In the original intake, not in the signed 10-deliverable scope. Re-quote required before any v2 requirement moves to v1.

### Drag-Drop Form Builder (BUILDER)

- **BUILDER-01**: Admin can drag field types from a palette onto a form canvas
- **BUILDER-02**: Properties panel supports per-field: label, required, placeholder, validation, conditional visibility
- **BUILDER-03**: Publish flow increments template version and marks the previous version immutable
- **BUILDER-04**: `@coltorapps/builder` React 19 compatibility is verified via spike before committing to v2 timeline
- **BUILDER-05**: Builder is gated to admin role unless editable-forms ambiguity resolves otherwise

### Conditional Logic (COND)

- **COND-01**: Visibility rules can be defined per field (show X if Y == value)
- **COND-02**: Required-if rules can be defined per field
- **COND-03**: DAG cycle detection prevents circular dependencies at publish time — not at render time
- **COND-04**: Renderer evaluates conditions live as the user fills the form

### Form Assignment & Scheduling (SCHED)

- **SCHED-01**: Admin can assign a template to a client with a recurrence (daily / weekly / monthly / quarterly / annual)
- **SCHED-02**: n8n workflow #5 (cron) creates new form instances on the schedule and sends a fill-reminder via n8n #2
- **SCHED-03**: Missed schedules surface as overdue in admin dashboard

### Offline / PWA (OFFLINE)

- **OFFLINE-01**: App is installable to home screen on iPad and iPhone
- **OFFLINE-02**: Service worker caches the form renderer and currently assigned templates
- **OFFLINE-03**: Submitted forms enqueue in IndexedDB when offline and sync on reconnect
- **OFFLINE-04**: Sync-when-online indicator is always visible
- **OFFLINE-05**: Web Speech API unavailability in standalone PWA mode is handled by the FORM-03 text fallback

## Out of Scope

| Feature | Reason |
|---------|--------|
| Stripe checkout | Switched to PayPal on 2026-04-06; proposal text is stale on this point |
| Email/password client signup | Magic-link-only per PROJECT.md decision |
| Auto-deliver AI reports without Matt's review | Legal control under Regulatory Reform (Fire Safety) Order 2005, not a UX preference |
| Client-facing form builder (in v1) | Default assumption is Matt-only editing; may move to v2 if Matt confirms broader scope |
| Rebooking / auto-quoting on document expiry (MVP) | MVP default is flag + alert; auto-quote is a later consideration |
| Xero / accounting integration | Optional future n8n workflow; deferred |
| Bespoke code-side AI report generator | Lives in n8n per ADR 2026-04-15 so the team can iterate on prompts without deploys |
| Aggressive image compression below 1MB | Destroys inspection-label legibility (the fusebox photos are proof) |
| In-app chat / CRM / marketplace | ~7–8 active clients; WhatsApp + email already cover ad-hoc comms |
| Real-time geolocation tracking of Matt | Not required by any deliverable; privacy and trust cost |

## Traceability

*Filled by gsd-roadmapper — 2026-04-15.*

| Requirement | Phase | Status |
|-------------|-------|--------|
| FOUND-01 | Phase 1: Scaffolding + Security Foundation | Pending |
| FOUND-02 | Phase 1: Scaffolding + Security Foundation | Pending |
| FOUND-03 | Phase 1: Scaffolding + Security Foundation | Pending |
| FOUND-04 | Phase 1: Scaffolding + Security Foundation | Pending |
| FOUND-05 | Phase 1: Scaffolding + Security Foundation | Pending |
| FOUND-06 | Phase 1: Scaffolding + Security Foundation | Pending |
| FOUND-07 | Phase 1: Scaffolding + Security Foundation | Pending |
| FOUND-08 | Phase 1: Scaffolding + Security Foundation | Pending |
| AUTH-01 | Phase 1: Scaffolding + Security Foundation | Pending |
| AUTH-02 | Phase 1: Scaffolding + Security Foundation | Pending |
| AUTH-03 | Phase 1: Scaffolding + Security Foundation | Pending |
| AUTH-04 | Phase 1: Scaffolding + Security Foundation | Pending |
| AUTH-05 | Phase 1: Scaffolding + Security Foundation | Pending |
| AUTH-06 | Phase 1: Scaffolding + Security Foundation | Pending |
| AUTH-07 | Phase 1: Scaffolding + Security Foundation | Pending |
| OPS-05 | Phase 1: Scaffolding + Security Foundation | Pending |
| FORM-01 | Phase 2: Form Prerequisites | Pending |
| FORM-02 | Phase 2: Form Prerequisites | Pending |
| FORM-03 | Phase 2: Form Prerequisites | Pending |
| FORM-04 | Phase 2: Form Prerequisites | Pending |
| FORM-05 | Phase 2: Form Prerequisites | Pending |
| FORM-06 | Phase 2: Form Prerequisites | Pending |
| FORM-07 | Phase 2: Form Prerequisites | Pending |
| FORM-08 | Phase 2: Form Prerequisites | Pending |
| FORM-09 | Phase 2: Form Prerequisites | Pending |
| FORM-10 | Phase 2: Form Prerequisites | Pending |
| TMPL-01 | Phase 3: Template System + Schema Versioning | Pending |
| TMPL-02 | Phase 3: Template System + Schema Versioning | Pending |
| TMPL-03 | Phase 3: Template System + Schema Versioning | Pending |
| TMPL-04 | Phase 3: Template System + Schema Versioning | Pending |
| TMPL-05 | Phase 3: Template System + Schema Versioning | Pending |
| TMPL-06 | Phase 3: Template System + Schema Versioning | Pending |
| ASMT-01 | Phase 4: Assessment Workflow | Pending |
| ASMT-02 | Phase 4: Assessment Workflow | Pending |
| ASMT-03 | Phase 4: Assessment Workflow | Pending |
| ASMT-04 | Phase 4: Assessment Workflow | Pending |
| ASMT-05 | Phase 4: Assessment Workflow | Pending |
| ASMT-06 | Phase 4: Assessment Workflow | Pending |
| REPORT-01 | Phase 5: AI Report Pipeline | Pending |
| REPORT-02 | Phase 5: AI Report Pipeline | Pending |
| REPORT-03 | Phase 5: AI Report Pipeline | Pending |
| REPORT-04 | Phase 5: AI Report Pipeline | Pending |
| REPORT-05 | Phase 5: AI Report Pipeline | Complete |
| REPORT-06 | Phase 5: AI Report Pipeline | Complete |
| REPORT-07 | Phase 5: AI Report Pipeline | Pending |
| REPORT-08 | Phase 5: AI Report Pipeline | Pending |
| REPORT-09 | Phase 5: AI Report Pipeline | Pending |
| REPORT-10 | Phase 5: AI Report Pipeline | Pending |
| REPORT-11 | Phase 5: AI Report Pipeline | Pending |
| REPORT-12 | Phase 5: AI Report Pipeline | Pending |
| PORTAL-01 | Phase 6: Client Compliance Portal | Pending |
| PORTAL-02 | Phase 6: Client Compliance Portal | Pending |
| PORTAL-03 | Phase 6: Client Compliance Portal | Pending |
| PORTAL-04 | Phase 6: Client Compliance Portal | Pending |
| PORTAL-05 | Phase 6: Client Compliance Portal | Pending |
| PORTAL-06 | Phase 6: Client Compliance Portal | Pending |
| PORTAL-07 | Phase 6: Client Compliance Portal | Pending |
| DOCS-01 | Phase 7: Document Upload, Notifications + Expiry Alerts | Pending |
| DOCS-02 | Phase 7: Document Upload, Notifications + Expiry Alerts | Pending |
| DOCS-03 | Phase 7: Document Upload, Notifications + Expiry Alerts | Pending |
| DOCS-04 | Phase 7: Document Upload, Notifications + Expiry Alerts | Pending |
| DOCS-05 | Phase 7: Document Upload, Notifications + Expiry Alerts | Pending |
| DOCS-06 | Phase 7: Document Upload, Notifications + Expiry Alerts | Pending |
| EXPIRY-01 | Phase 7: Document Upload, Notifications + Expiry Alerts | Pending |
| EXPIRY-02 | Phase 7: Document Upload, Notifications + Expiry Alerts | Pending |
| EXPIRY-03 | Phase 7: Document Upload, Notifications + Expiry Alerts | Pending |
| EXPIRY-04 | Phase 7: Document Upload, Notifications + Expiry Alerts | Pending |
| EXPIRY-05 | Phase 7: Document Upload, Notifications + Expiry Alerts | Pending |
| EXPIRY-06 | Phase 7: Document Upload, Notifications + Expiry Alerts | Pending |
| EXPIRY-07 | Phase 7: Document Upload, Notifications + Expiry Alerts | Pending |
| PAY-01 | Phase 8: Hours Balance + PayPal Checkout | Pending |
| PAY-02 | Phase 8: Hours Balance + PayPal Checkout | Pending |
| PAY-03 | Phase 8: Hours Balance + PayPal Checkout | Pending |
| PAY-04 | Phase 8: Hours Balance + PayPal Checkout | Pending |
| PAY-05 | Phase 8: Hours Balance + PayPal Checkout | Pending |
| PAY-06 | Phase 8: Hours Balance + PayPal Checkout | Pending |
| PAY-07 | Phase 8: Hours Balance + PayPal Checkout | Pending |
| PAY-08 | Phase 8: Hours Balance + PayPal Checkout | Pending |
| PROP-01 | Phase 9: Proposal + Auto-Contract Pipeline | Pending |
| PROP-02 | Phase 9: Proposal + Auto-Contract Pipeline | Pending |
| PROP-03 | Phase 9: Proposal + Auto-Contract Pipeline | Pending |
| PROP-04 | Phase 9: Proposal + Auto-Contract Pipeline | Pending |
| PROP-05 | Phase 9: Proposal + Auto-Contract Pipeline | Pending |
| PROP-06 | Phase 9: Proposal + Auto-Contract Pipeline | Pending |
| PROP-07 | Phase 9: Proposal + Auto-Contract Pipeline | Pending |
| CONTRACT-01 | Phase 9: Proposal + Auto-Contract Pipeline | Pending |
| CONTRACT-02 | Phase 9: Proposal + Auto-Contract Pipeline | Pending |
| CONTRACT-03 | Phase 9: Proposal + Auto-Contract Pipeline | Pending |
| CONTRACT-04 | Phase 9: Proposal + Auto-Contract Pipeline | Pending |
| CONTRACT-05 | Phase 9: Proposal + Auto-Contract Pipeline | Pending |
| CONTRACT-06 | Phase 9: Proposal + Auto-Contract Pipeline | Pending |
| ADMIN-01 | Phase 10: Admin Dashboard | Pending |
| ADMIN-02 | Phase 10: Admin Dashboard | Pending |
| ADMIN-03 | Phase 10: Admin Dashboard | Pending |
| ADMIN-04 | Phase 10: Admin Dashboard | Pending |
| ADMIN-05 | Phase 10: Admin Dashboard | Pending |
| ADMIN-06 | Phase 10: Admin Dashboard | Pending |
| ADMIN-07 | Phase 10: Admin Dashboard | Pending |
| OPS-01 | Phase 11: Ops, Seed Data + Handover | Pending |
| OPS-02 | Phase 11: Ops, Seed Data + Handover | Pending |
| OPS-03 | Phase 11: Ops, Seed Data + Handover | Pending |
| OPS-04 | Phase 11: Ops, Seed Data + Handover | Pending |

**Coverage:**
- v1 requirements: 102
- Mapped to phases: 102
- Unmapped: 0

---
*Requirements defined: 2026-04-15*
*Last updated: 2026-04-15 — traceability filled by gsd-roadmapper*
