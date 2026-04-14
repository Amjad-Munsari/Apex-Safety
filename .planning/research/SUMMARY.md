# Project Research Summary

**Project:** 888 Safety & Training Platform
**Domain:** UK Health & Safety compliance SaaS — solo consultancy (fire/site risk assessment, client portal, AI report gen, proposal/contract pipeline)
**Researched:** 2026-04-15
**Confidence:** HIGH (stack verified against official docs + npm registry; architecture patterns verified against Supabase and Next.js 16 docs; pitfalls sourced from post-mortems and official caveats)

---

## Executive Summary

888 Safety & Training is a narrow-domain compliance SaaS replacing a manual dictaphone-to-PA-to-Google-Docs workflow. The product's core value is a single on-site session: Matt narrates an assessment via speech-to-text, submits the form, and receives a branded PDF report in minutes rather than 5 days. Every other feature — the client portal, the proposal pipeline, the expiry alerts — exists to make the consultancy self-service enough that Matt stops losing time to administrative overhead.

The recommended build approach is form-builder-first with an explicit green-light gate. The FRA and Site Risk Assessment forms are not standalone screens; they are seed templates rendered by a generic form engine that Matt will own post-launch. Building the renderer and the schema versioning system before wiring any AI report generation is the correct order because every downstream deliverable (D3, D4, D7) depends on the submission data model being correct from the first row. The n8n / code split ADR (AI-heavy and multi-step work in n8n; auth-gated transactional work in code) is the structural backbone of the architecture and must be respected throughout — re-routing report generation into Vercel functions would hit serverless timeout and memory limits immediately.

The two most consequential risks are not technical. The first is legal: under the Regulatory Reform (Fire Safety) Order 2005, a delivered FRA is a legal document. The human review gate (draft → approved → delivered) is a liability control, not a UX convenience. It cannot be removed, skipped, or soft-pedalled as "auto-deliver is available if you want it." The second is data sovereignty: the Supabase project region must be set to `eu-west-2` (London) at project creation. This decision cannot be changed after the fact without a full data migration. Both of these must be resolved in Stage 1 before any other work begins.

---

## Cross-Cutting Blockers

Items that must land in Stage 1 or Stage 2 because multiple later stages depend on them. Missing any of these will require retrofitting under delivery pressure.

### 1. Supabase Region: eu-west-2 — Lock at Project Creation

Supabase project region is a one-time decision. UK GDPR adequacy requirements apply to building/site assessment data (occupancy information, personal contact data). The project must be created in `eu-west-2` (London) or `eu-west-1` (Ireland). Default free-tier selection may be a US region. **This cannot be undone without a full data migration.** Document the region in PROJECT.md immediately after the project is created.

### 2. `server-only` Guard on Admin Supabase Client — Stage 1

Create `lib/supabase/admin.ts` as the single source of the service-role Supabase client. Add `import 'server-only'` at the top of that file. This causes a build error if the service-role client ever leaks into a Client Component. The service role bypasses all RLS — one leak exposes all client data. This file and pattern must exist before any other code is written.

### 3. Schema Versioning Before First Submission — Stage 3 Gate

The `template_versions` table with an immutable, append-only schema snapshot must exist before D1 (FRA form) accepts any submission. Submissions pin to `template_version_id` at capture time; the form renderer always receives the historical snapshot, never resolves the current version at render time. There is no retroactive fix if submissions are created before versioning exists — those records become unrecoverable for historical rendering. The Stage 3 green-light demo must demonstrate: submit a form against v1, publish v2, confirm v1 submission renders correctly.

### 4. Storage RLS Separate from Table RLS — Stage 1

Table RLS policies on `assessments`, `documents`, and `submissions` do not protect files in Supabase Storage. Storage uses policies on `storage.objects` — a completely separate system. All Storage buckets must be private from day one, with explicit path-prefix policies keyed to `client_id` (e.g., `storage.foldername(name)[1] = auth.uid()::text`). The integration test suite must include: "log in as Client A, attempt to fetch a Storage URL belonging to Client B — must return 403."

### 5. Next.js 16 Breaking Changes — Before Any Feature Work

Run these before writing any feature code:
- Rename `middleware.ts` → `proxy.ts` with exported `proxy` function (the old filename generates deprecation warnings in Next.js 16 and will be removed)
- All request APIs are now fully async: `await cookies()`, `await headers()`, `const { id } = await params` — no synchronous fallback exists
- `revalidateTag('tag')` → `revalidateTag('tag', 'max')` (TypeScript error without the second arg)
- `next lint` CLI command is removed in Next.js 16; use `eslint .` directly
- Turbopack is the default bundler; any webpack-only plugin will break `next build`

### 6. STT Text Fallback as Primary Path, Not Recovery — Stage 2

Web Speech API is unavailable when the app runs as a PWA installed from the iPad home screen (iOS Safari standalone mode). Matt is likely to install the app to his home screen. The fallback is not a degraded experience — it is the primary path that must ship alongside the STT feature. Detection pattern: `'SpeechRecognition' in window || 'webkitSpeechRecognition' in window` — if false, show text input immediately. Detect standalone mode via `window.navigator.standalone === true` on iOS and treat STT as unreliable by default in that context.

### 7. GDPR Soft-Delete Pattern — Stage 1 Schema Migration 001

Every table holding client-identifiable data needs `deleted_at TIMESTAMPTZ` from migration 001. Erasure requests are handled by anonymising personal identifiers (name → "Deleted User", phone → NULL, email → NULL) while retaining the structural compliance record (fire assessment records are legally required to persist). Adding soft-delete after data has been written requires touching every table in a production migration — high risk. The `gdpr_erasure_log` table is itself a compliance record and must be append-only.

---

## Structural Differentiators (Not Just Features)

These are not UX decisions — they are schema or infrastructure decisions that determine whether certain features are buildable at all.

### Per-Field Photo Requires `field_media` Table

SiteDocs and iAuditor attach photos at the form or section level. Matt's workflow requires a photo linked to an individual field ("Basement photo" attached to the Basement field, not floating in a gallery). This requires a dedicated `field_media(id, submission_id, field_key, storage_path, label, media_type)` table — it cannot be approximated by a JSON array in the submissions `answers_json`. The n8n PDF renderer must receive a typed map of `field_key → signed Storage URL` to embed photos in the correct report section. A gallery-based approach would require error-prone post-processing mapping.

### STT Transcript Alongside Generated Draft — Not Optional

In the AI report review UI, the raw STT transcript must be displayed verbatim alongside the GPT-4 generated draft. This is how Matt verifies the AI has not hallucinated findings. A fire safety report that references a non-existent hazard (or misses a real one) because the model drifted from the few-shot example is a legal liability under the Regulatory Reform (Fire Safety) Order 2005. The side-by-side view must be built into the Stage 4 review UI from day one — it is not a "nice to have" admin feature.

### Review Gate Is a Legal Control, Not UX

The `draft_ready_for_review → approved → delivered` state machine on `form_submissions` is a liability control. Under the Regulatory Reform (Fire Safety) Order 2005, a delivered FRA is a legal document. Auto-deliver would remove Matt's last opportunity to catch AI hallucinations before the document becomes a legal record. This is explicitly out of scope in PROJECT.md and must not appear as an option or toggle in Phase 1 — not even as an experimental opt-in.

---

## Key Findings

### Recommended Stack

All major technology decisions are locked. The stack is a cohesive modern Next.js 16 / Supabase / n8n stack with no major integration conflicts, provided the Next.js 16 breaking changes are addressed before feature development begins.

**Core technologies with version pins:**

| Technology | Version | Critical Note |
|------------|---------|---------------|
| Next.js | 16.1.7 | `middleware.ts` deprecated → rename to `proxy.ts`; Node.js 20.9+ required |
| React | 19.2 | Ships with Next 16; use async Server Components for data fetching |
| Tailwind CSS | 4.x | CSS-first config; no `tailwind.config.js` by default; use `@config` if needed |
| TypeScript | 5.x (min 5.1) | Required; run `supabase gen types` at every schema change |
| `@supabase/supabase-js` | 2.103.0 | Use `getAll`/`setAll` cookie API (not `get`/`set`) |
| `@supabase/ssr` | 0.10.2 | Three client patterns: proxy / Server Components / Client Components |
| `react-hook-form` | 7.66.0 | Do NOT upgrade to v8 beta; stay on v7 |
| `@hookform/resolvers` | 5.2.2+ | Must be 5.2.2 or later for Zod v4 type compatibility |
| `zod` | 4.0.1 | Use v4 directly; do not install v3 alongside it |
| `@react-pdf/renderer` | 4.4.1 | Use `renderToBuffer` in Route Handlers; `PDFDownloadLink` is client-only |
| `@paypal/react-paypal-js` | 9.1.1 | V6 SDK hooks API; order creation/capture server-side only |
| `twilio` | 5.13.1 | Node.js SDK; Route Handlers / Server Actions only |
| `@sentry/nextjs` | 10.48.0 | Use `instrumentation.ts` + `onRequestError` hook |
| `browser-image-compression` | 2.0.2 | `maxSizeMB: 1.4`, `maxWidthOrHeight: 3000` — NOT 800KB |
| `date-fns` | 4.1.0 | ESM-only; verify Turbopack handles it |
| `@coltorapps/builder` | 0.2.4 | Phase 2 only; React 19 compatibility unconfirmed — verify before Phase 2 build |
| `vitest` | 4.x | Do NOT use Jest with Next.js 16; ESM conflicts |
| `playwright` | 1.51+ | Required for Server Component E2E (Vitest cannot unit-test async Server Components) |

**Anti-choices to enforce as team rules:**
- Never use `@supabase/auth-helpers-nextjs` (deprecated for App Router)
- Never use `getSession()` server-side — always `getUser()` (getSession does not validate the cookie)
- Never call PayPal REST API or instantiate Twilio from a Client Component
- Never use `moment.js` — use `date-fns` + `date-fns-tz`
- Never use `jest` — use `vitest`
- Never use `react-signature-canvas` (stale alpha) — use `react-signature-pad-wrapper` 4.3.2

### Expected Features

**Must have (Phase 1 table stakes):**
- Tablet-first form renderer (schema-driven, not hardcoded)
- Per-field photo attachment with short text label (`field_media` table, keyed to `field_key`)
- STT on every text field with text input as primary fallback (not recovery)
- AI report generation with human review gate — draft → approved → delivered
- Branded PDF output matching Matt's existing template (YELLOW BROOM few-shot)
- Raw STT transcript displayed alongside AI draft in review UI
- Magic-link client auth with Supabase RLS multi-tenant isolation
- Compliance status dashboard (RAG badges) + document library in portal
- 30/14/7-day expiry alert cron (n8n #3, dedup via `(document_id, window, recipient)`)
- PayPal Orders v2 hours top-up with idempotent webhook handler
- Document upload notifications — Twilio SMS (code) + email (n8n #2)
- Proposal generation + e-sign + auto-contract (SignWell, dual-sign)
- Admin single-pane dashboard with report review queue and n8n error surface
- Schema versioning from day one (immutable `template_versions`, submissions pin to version)
- Save-as-draft / autosave; submission read-only freeze post-submit
- Soft-delete pattern on all client-data tables (GDPR erasure)
- Audit trail (`submission_events`, immutable)

**Should have (differentiators vs SiteDocs/AssessKit):**
- STT on every text field with live transcript preview (catches silent iPad PWA failures)
- Side-by-side STT transcript + AI draft in admin review (hallucination detection)
- Minutes-not-days turnaround: narrate on-site → PDF same session
- AI-assisted proposal drafting from Packages.docx service catalogue
- Seamless assessment → proposal → contract pipeline in one product
- Tablet-native UX (large tap targets, side-by-side field + preview at tablet breakpoint)
- n8n workflow error surface in Admin Dashboard (D9)
- HEIC-to-JPEG conversion + EXIF rotation correction on photo upload

**Defer to Phase 2+:**
- Offline mode (PWA + IndexedDB + service worker) — Phase 2
- Drag-drop form builder (`@coltorapps/builder`) — Phase 2
- Conditional logic engine with DAG cycle detection — Phase 2
- Form assignment scheduling with cron reminders — Phase 2
- Repeating sections, geolocation fields — Phase 2
- Client-facing form editing (pending Matt scope confirmation)
- Auto-deliver toggle for AI reports (after Matt trusts quality across 20+ reports)
- Xero integration (optional n8n workflow, explicitly deferred)
- Rebooking/auto-quoting on expiry — Stage 5+ per PROJECT.md

### Architecture Approach

The system is organised around a hard n8n / code split (ADR 2026-04-15). Code owns transactional, auth-gated, idempotent work: PayPal webhook, Twilio SMS dispatch, SignWell webhook handler, document upload Storage write. n8n owns AI-heavy, multi-step, team-iterable work: report generation, universal email sender, expiry cron, contract generation. This split exists because AI prompt quality is the primary determinant of report quality — keeping prompts in n8n means Ayman and Amjad can iterate without deploys. All PDF generation is in n8n; Vercel serverless functions have timeout/memory constraints that make PDF generation in code untenable.

**Major components and responsibilities:**

1. **Auth Module** (`lib/supabase/`, `proxy.ts`) — Three Supabase client patterns (proxy, Server Component, Client Component); magic-link invite flow; role resolution (`admin_users` vs `client_users`); never use `getSession()` server-side
2. **Form Renderer** (`app/forms/**`, `components/forms/`) — Schema-driven render from `template_version.schema_json`; must accept `schema_version_id` and render the historical snapshot, not the current version; per-field STT, photo upload, label
3. **Admin Module** (`app/admin/**`) — Client CRUD, template management, assessment review queue, report approval, proposal pipeline; does NOT own PDF generation or email delivery
4. **Client Portal** (`app/portal/**`) — RLS-scoped dashboard, document library, hours display, PayPal checkout initiation; adversarial test: Client A cannot access Client B's data
5. **Assessment Module** (`app/admin/assessments/**`) — Triggers n8n #1 on submission; surfaces review queue; owns `form_submissions` lifecycle
6. **Documents Module** — Storage upload; triggers Twilio SMS synchronously; triggers n8n #2 async; does NOT own expiry scheduling
7. **Hours Module** (`app/api/webhooks/paypal/`) — PayPal Orders v2, idempotent webhook (UNIQUE `paypal_event_id` constraint), DB transaction on credit
8. **Proposals Module** (`app/admin/proposals/**`) — Service selection, n8n #4 trigger, SignWell webhook handler, `proposals` state machine
9. **n8n Workflows** — #1 Report Gen, #2 Universal Email, #3 Expiry Cron, #4 Proposal/Contract Gen; each must have an Error Trigger sub-workflow writing to `workflow_errors` table

**Schema foundations (must exist in migration 001):**
- `clients` table with `hours_balance`, `active`, soft-delete (`deleted_at`)
- `client_users` with `client_id` FK (RLS anchor for portal)
- `admin_users` separate from `client_users` (different access surface)
- `template_versions` with `schema_json JSONB`, `version_number`, append-only constraint
- `form_submissions` with `template_version_id` FK (pinned), `answers_json JSONB`, `status` enum, `report_storage_path`
- `field_media` with `(submission_id, field_key)` as the lookup key
- `notifications_sent` with UNIQUE `(document_id, alert_window, notification_type)` (dedup)
- `hours_transactions` with UNIQUE `paypal_order_id` (idempotency)
- `gdpr_erasure_log` (append-only, itself a compliance record)
- `workflow_errors` (surfaced on Admin Dashboard)
- Indexes on every `client_id` and `user_id` column used in RLS policies

### Critical Pitfalls

**Safety-critical (ship-blocking if missed):**

1. **Storage RLS separate from Table RLS** — Table policies do not protect Storage files. All buckets must be private; write explicit `storage.objects` policies with `client_id` path-prefix checks. Test: fetch a Storage URL while logged out — must return 403. Address: Stage 1.

2. **Service role key leakage** — Add `import 'server-only'` to `lib/supabase/admin.ts` before any other code is written. Add `.env*` to `.gitignore` on the very first commit. In n8n: store service key as a Credential, never in a plain text field. Address: Stage 1.

3. **Schema versioning before first submission** — No retroactive fix exists. Submissions created without `template_version_id` cannot be rendered correctly after a template edit. The Stage 3 demo must prove v1 submissions render after v2 is published. Address: Stage 3 gate.

4. **STT fallback as primary path** — iPad Safari PWA (standalone mode) silently drops the Web Speech API. Matt will install the app to his home screen. Text input must ship alongside STT, not as a recovery plan. Detect `window.navigator.standalone === true` and downgrade immediately. Address: Stage 2.

5. **AI hallucination review gate** — The `draft → approved → delivered` state machine is a legal requirement under the Regulatory Reform (Fire Safety) Order 2005. Show the raw STT transcript verbatim alongside every generated draft. Use GPT-4 structured output (JSON schema mode) so the model can only populate fields it has evidence for. Address: Stage 4.

**High risk (will cause production incidents):**

6. **SECURITY DEFINER views bypass RLS** — Any Postgres view created without `WITH (security_invoker = true)` runs as the superuser role and returns data from all tenants. Run the Supabase Database Advisor linter. Add to PR checklist: "Does this migration create a view? Does it have `security_invoker = true`?"

7. **Next.js 16 caching serves stale compliance data** — Mark all compliance portal pages as `export const dynamic = 'force-dynamic'` in Phase 1. Never use `unstable_cache` around compliance status, expiry dates, or report state. Test caching only in production build (`next build && next start`), not in `next dev`.

8. **n8n silent failures** — Every n8n workflow must have an Error Trigger sub-workflow that writes to `workflow_errors` table and notifies Matt. The Admin Dashboard (D9) must surface this table. Build the error workflow alongside Workflow #1, not after all four are complete.

9. **PayPal webhook duplicate credits** — UNIQUE constraint on `paypal_order_id` in `hours_transactions` is the idempotency mechanism. The Route Handler must return 200 to PayPal immediately; process side effects async. PayPal sandbox webhook delivery is unreliable — use the Webhook Simulator for handler testing. Address: Stage 5 (but schema constraint in Stage 1).

10. **HEIC images from iPad** — iPhone/iPad default to HEIC format. Browsers cannot display HEIC natively. Detect `file.type === 'image/heic'` before upload; convert to JPEG using `heic2any` in the browser. Apply EXIF rotation correction after conversion. Address: Stage 2 (photo upload component).

11. **Twilio UK Sender ID registration** — Unregistered alphanumeric sender IDs may be blocked by UK networks under the 2025 SMS Sender ID Register standard. Register "888Safety" (max 11 chars, no spaces) with Twilio for UK before any SMS is sent. Honour STOP opt-outs via a Twilio inbound webhook handler.

12. **Supabase region must be eu-west-2** — Set at project creation; cannot be changed. UK GDPR adequacy. Document the region choice immediately.

---

## Open Questions: Research-Resolved vs Still Blocking

### Answered by Research (no longer blocking)

| Question | Resolution |
|----------|------------|
| Which Supabase auth package for App Router? | `@supabase/ssr` 0.10.2 — `@supabase/auth-helpers-nextjs` is deprecated |
| PayPal vs Stripe? | PayPal Orders v2 — locked per PROJECT.md 2026-04-06 |
| E-sign provider? | SignWell REST API v1 (default) — no official npm package; direct fetch |
| Form builder library? | `@coltorapps/builder` 0.2.4 (Phase 2 only; verify React 19 compat before build) |
| Testing framework? | Vitest 4.x + Playwright 1.51+ — do not use Jest |
| PDF generation approach? | `@react-pdf/renderer` 4.4.1 for proposal (code-side); n8n HTML-to-PDF for AI reports |
| STT approach? | Web Speech API (browser-native) + text input as primary fallback — no cloud STT dependency |
| n8n vs code split? | ADR 2026-04-15 locked — AI/multi-step in n8n; transactional/auth-gated in code |
| Image compression target? | 1.2–1.5MB (`browser-image-compression` 2.0.2, `maxSizeMB: 1.4`) — NOT 800KB |
| middleware.ts in Next.js 16? | Rename to `proxy.ts` — middleware.ts is deprecated in v16 |

### Still Blocking Scope (chase via Finley)

| Question | Blocks | Action |
|----------|--------|--------|
| Blank Site Risk template + completed example | D2 entirely, site-risk half of D3 | Chase Matt via Finley — D2 cannot start without it |
| Compliance document categories + renewal periods | Full D4/D7 (expiry alert system) | Without these, n8n #3 cannot know what to alert on |
| Hours pricing model (flat rate / packages / bundles / expiry rules) | D5 beyond webhook plumbing | Plumbing ships; pricing logic blocked |
| Brand assets (logo, hex colours, PDF header/footer) | D3 branded PDF output | Needed before first n8n report generation test in Stage 4 |
| E-sign provider confirmation | D8 e-sign step | Default is SignWell; if Matt specifies another, scope shifts |
| Shared project Gmail | PayPal dev credentials, accounts handoff (D11) | Document current secret inventory now; do not wait for Gmail to arrive |
| Editable-forms ambiguity (Matt-only vs client-editable) | Stage 3 scope boundary only | Stages 1–2 are unblocked; default is Matt-only |
| Conditional logic rules for Phase 2 | Phase 2 form builder | Phase 2 only; draft message prepared but not sent |
| Notification sign-off name ("888 Safety" vs "Matt") | Twilio sender ID registration | Needed before SMS testing |

---

## Implications for Roadmap

### Suggested Phase Structure

The locked build order from PROJECT.md (Scaffolding → Form Prerequisites → Form Builder → Assessment + AI → Everything Else) maps directly to research findings. The rationale from research reinforces and adds specificity to each stage boundary.

---

**Stage 1: Scaffolding + Security Foundation**

**Rationale:** Multiple later stages depend on decisions made here that cannot be retrofitted. Supabase region, Storage RLS, service-role key guard, soft-delete schema pattern, and base table structure must all exist before any feature code is written.

**Delivers:**
- Next.js 16 project with `proxy.ts`, ESLint flat config, Turbopack confirmed, Node.js 20.9+ on Vercel
- `lib/supabase/admin.ts` with `server-only` guard (service-role client, never constructed ad-hoc)
- `lib/supabase/server.ts` and `lib/supabase/client.ts` (user-role clients, three-pattern setup)
- Supabase project in eu-west-2, all buckets private, Storage RLS with `client_id` path-prefix policies
- Migration 001: all core tables with `deleted_at`, `client_id` indexes, `template_versions` (append-only), `field_media`, `notifications_sent` UNIQUE constraint, `hours_transactions` UNIQUE `paypal_order_id`, `gdpr_erasure_log`, `workflow_errors`
- `.env*` in `.gitignore` before any `git add .`; current secret inventory documented
- Sentry + Vercel Analytics wired up; Vitest + Playwright test setup
- PR checklist entry: "Does this migration create a view? Does it have `security_invoker = true`?"

**Pitfalls addressed:** Storage RLS (P1), service role leakage (P2), SECURITY DEFINER views (P4), `auth.uid()` in triggers (P5), GDPR soft-delete (P16), wrong region (P16), personal account migration (P17)

**Research flag:** Standard patterns — no additional research needed.

---

**Stage 2: Form Prerequisites (STT + Photo Upload Components)**

**Rationale:** The form renderer is the dependency for D1, D2, D3, and indirectly D4/D7. Before building the full renderer, the two hardest components must exist and be tested in isolation on the actual target device.

**Delivers:**
- `SpeechField` component: Web Speech API STT; feature-detect before showing mic button; `window.navigator.standalone === true` detection (show text input immediately in PWA mode); live transcript preview; `onerror` + `onend` handlers with auto-fallback; tested on actual iPad opened from home screen icon
- `PhotoField` component: HEIC detection and `heic2any` conversion; EXIF rotation correction; `browser-image-compression` at `maxSizeMB: 1.4, maxWidthOrHeight: 3000`; Supabase Storage upload to `field-photos/{client_id}/{submission_id}/{field_key}/`; `field_media` row insert; inline display beneath field; short text label input; verified against `photo-fusebox-01.jpg` and `-02.jpg`
- RLS performance profile: seed test data, run `EXPLAIN ANALYZE` under authenticated role, confirm no per-row subquery loops; add `SECURITY DEFINER` helper function if needed
- `supabase gen types` in CI after every migration

**Pitfalls addressed:** STT iPad PWA silent failure (P9), HEIC images (P10), RLS performance (P3)

**Research flag:** STT on actual iPad from home screen (not desktop Chrome simulation) is a required test step before Stage 2 sign-off. Cannot be simulated.

---

**Stage 3: Form Renderer + Schema Versioning (Green-Light Gate)**

**Rationale:** FRA and Site Risk Assessment are seed templates in a generic renderer. The renderer must accept a `schema_version_id` and render against that exact historical snapshot. This stage builds the renderer, seeds the FRA template, and demonstrates schema versioning before Matt signs off. Stage 4 cannot start before this gate passes.

**Delivers:**
- Schema-driven form renderer: all Phase 1 field types (text, textarea, yes/no/na, date, select, photo, signature); renders from `template_version.schema_json`; always uses pinned `schema_version_id`; submission hydration (read-only past submissions against historical snapshot)
- Save-as-draft / autosave on field blur; `status = 'draft' | 'submitted'`; read-only freeze post-submit
- FRA seed template (from Blank FRA Type 3) seeded as `template_versions` v1
- Admin template management: create version, publish (immutable), never UPDATE a published row
- Schema versioning green-light demo: submit v1, publish v2 schema change, confirm v1 submission renders correctly against its pinned snapshot
- Matt green-light sign-off via live demo on tablet (Stage 4 cannot start without this)

**Pitfalls addressed:** Schema versioning retroactive corruption (P7), conditional logic circular dependencies (P8 — DAG validation before publish button, Phase 1 can hard-code simple conditionals in seed schema)

**Research flag:** Conditional logic DAG validation: Phase 1 seed schema can hard-code simple conditionals. Full DAG check is Phase 2. Document this boundary clearly in the Stage 3 PR.

---

**Stage 4: Assessment + AI Report Pipeline**

**Rationale:** With the form renderer and submission data model correct, the full assessment flow can be built. This stage also establishes the n8n error workflow pattern that all four n8n workflows will use. The report review UI must surface the STT transcript alongside the generated draft from day one — this is a legal requirement, not a polish item.

**Delivers:**
- Form assignment flow (admin assigns `template_version_id` to client)
- Submission Server Action: creates `form_submissions` row with pinned `template_version_id`; triggers n8n #1 webhook
- n8n Workflow #1: fetches submission + schema + client; builds prompt with YELLOW BROOM few-shot; GPT-4 via OpenRouter in structured output (JSON schema) mode; generates branded PDF; uploads to `reports/{client_id}/{submission_id}.pdf`; patches status to `draft_ready_for_review`; calls back `/api/n8n/report-ready`
- n8n Error Trigger sub-workflow: writes to `workflow_errors` table; notifies Matt — built alongside Workflow #1, not deferred
- Admin review UI: PDF iframe (signed URL, 7-day expiry); raw STT transcript verbatim; Approve → `delivered`; Reject + optional regeneration note fed back to prompt
- n8n Workflow #2 (Universal Email Sender) — all email delivery routed through here (report delivery, doc upload, receipts, proposals)
- Supabase Realtime subscription on `form_submissions.status` in admin UI
- n8n infrastructure confirmed: minimum 2GB RAM instance; PDF via HTTP Request node to PDF generation API (not Puppeteer in container); tested against full multi-page YELLOW BROOM FRA
- Blocked dependencies to resolve before Stage 4: brand assets (logo, hex, header/footer)

**Pitfalls addressed:** AI hallucination without review gate (P11), n8n silent failures (P12), PDF generation on Vercel (P18), Next.js 16 stale compliance cache (P6)

**Research flag:** n8n HTML-to-PDF approach (Gotenberg vs hosted service vs n8n native) must be decided and tested against the YELLOW BROOM FRA before Stage 4 build starts.

---

**Stage 5: Everything Else (Parallelisable)**

**Rationale:** Once the form + AI pipeline is proven, the remaining deliverables are independent at the data layer. The shared dependencies (Supabase schema, n8n #2 email sender) are already built by Stage 4. Ayman and Amjad can parallelize across D4–D9.

**Delivers (can parallelize):**
- D4 — Client portal: magic-link invite flow; RLS-scoped dashboard; compliance status RAG badges; document library; proposal/contract read-only view; `export const dynamic = 'force-dynamic'` on all compliance pages
- D5 — Hours balance + PayPal Orders v2: checkout Server Action (server-side order creation); `/api/webhooks/paypal` Route Handler (UNIQUE `paypal_event_id`, signature-verified, return 200 immediately, process async); client portal balance display; blocked on Matt's pricing model
- D6 — Document upload notifications: Twilio SMS (synchronous in Server Action with `sms_log` dedup check before send); n8n #2 email (async webhook); Twilio UK Sender ID "888Safety" registered; STOP opt-out webhook handler; Twilio inbound webhook for STOP processing
- D7 — Expiry alert cron: n8n #3 daily 08:00 Europe/London; dedup via UNIQUE `(document_id, alert_window, notification_type)` — check before send, not after; blocked on compliance taxonomy from Matt
- D8 — Proposal + auto-contract pipeline: `services` table seeded from Packages.docx + Course List Master.xlsx; n8n #4 proposal generation; SignWell API integration (dual-sign); on `document.completed` webhook — update status, then queue delayed PDF fetch 30s later (not synchronous); `signwell_event_id` UNIQUE constraint; `proposals` state machine: draft → draft_ready → sent → signed → contract_sent → contract_signed
- D9 — Admin dashboard: client list, expiry calendar, report review queue, proposal pipeline view, hours balances per client, `workflow_errors` surface
- D10/D11 — Seed data: 5–10 clients from Sample Contacts.xlsx migration script; live walkthrough session; PayPal credentials migrated to shared project Gmail; all personal account secrets rotated after transfer (use Supabase official project transfer tool, not delete + recreate)

**Pitfalls addressed:** PayPal duplicate credits (P13), SignWell webhook race condition (P14), Twilio UK compliance (P15), personal account migration (P17), Next.js 16 stale portal cache (P6)

**Research flags:**
- PayPal: use Webhook Simulator (not sandbox payments) for handler testing; sandbox `PAYMENT.CAPTURE.COMPLETED` is unreliable
- SignWell: test delayed PDF fetch race condition explicitly in sandbox before shipping
- Twilio UK Sender ID registration lead time unknown — initiate in Stage 1 alongside schema work

---

**Phase 2: Form Builder + Offline (Separate Milestone, Re-Quote Required)**

**Delivers:**
- `@coltorapps/builder` 0.2.4 drag-drop form builder — verify React 19 compatibility via spike before committing to timeline
- Full field palette (signature, rating, multi-photo, geolocation, repeating sections)
- Conditional logic engine with DAG cycle detection (reject circular dependencies at publish time with user-facing error; `required-if` on a hidden field = not required)
- Form assignment + scheduling (recurrence patterns via `rrule` 2.x)
- Offline PWA (service worker + IndexedDB queue + sync-when-online indicator)
- Schema versioning already exists from Stage 3 — Phase 2 builder publishes new versions using the same immutable-version pattern

**Research flag:** `@coltorapps/builder` React 19 compatibility is MEDIUM confidence (unconfirmed). Run a spike (two field types in a React 19 environment) before any Phase 2 timeline commitment or quote.

---

### Phase Ordering Rationale

- Stage 1 first: Storage RLS, service-role guard, region, and soft-delete cannot be retrofitted without touching every table and every file in production.
- Stage 2 before Stage 3: STT and photo upload are the most device-specific components. Failures are diagnosable in isolation; failures discovered during Stage 3 form builder work block the whole stage.
- Stage 3 before Stage 4: Submissions created before `template_version_id` versioning exists are unrecoverable. The green-light demo gives Matt and the team confidence that the foundation is correct before AI work begins.
- Stage 4 before Stage 5: The n8n error workflow pattern established in Stage 4 is inherited by Workflows #2–4 in Stage 5. Universal email sender (n8n #2) is built in Stage 4 and consumed by D6/D7/D8/D9 in Stage 5.
- Stage 5 parallelised: remaining deliverables share only the schema and n8n #2 — both complete by Stage 4 end.

### Research Flags

**Needs explicit device/integration testing before/during build:**
- Stage 2: STT on actual iPad from home screen icon — required, not optional
- Stage 4: n8n PDF generation approach against multi-page YELLOW BROOM FRA — decide before Stage 4 starts
- Stage 5 (D5): PayPal sandbox unreliability — use Webhook Simulator for handler tests
- Stage 5 (D8): SignWell delayed-fetch race condition — test explicitly in sandbox
- Stage 5 (D6): Twilio UK Sender ID registration — initiate in Stage 1 (unknown lead time)
- Phase 2: `@coltorapps/builder` React 19 compatibility spike — before any Phase 2 commitment

**Standard patterns (no additional research needed):**
- Stage 1 Next.js 16 scaffolding (breaking changes fully documented)
- Stage 3 schema-driven form renderer (established pattern)
- Stage 4 Supabase Realtime subscription on `form_submissions.status`
- Stage 5 magic-link auth flow (Supabase Auth, well-documented)

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All versions verified against official docs and npm registry 2026-04-15. One exception: `@coltorapps/builder` 0.2.4 React 19 compat is unconfirmed (MEDIUM) |
| Features | HIGH (inspection/proposal); MEDIUM (portal at solo-consultancy scale) | Competitor analysis covers 10+ products; solo-consultancy portal has thinner prior art but patterns are clear |
| Architecture | HIGH | Patterns verified against Supabase and Next.js 16 App Router official docs; schema skeleton is specific and buildable |
| Pitfalls | HIGH | 18 pitfalls documented with specific prevention steps and phase assignments; verified against official caveats and post-mortems |

**Overall confidence: HIGH**

### Gaps to Address During Planning/Execution

- **Compliance taxonomy (document categories + renewal periods):** Required before D7 scope can be finalised. Chase via Finley before Stage 5 D7 build starts.
- **Hours pricing model:** D5 webhook plumbing ships without it; pricing and deduction logic is blocked. Chase before Stage 5 D5 build.
- **Brand assets (logo, hex colours, PDF header/footer):** Required before first n8n PDF generation test. Chase before Stage 4 starts.
- **`@coltorapps/builder` React 19 compatibility:** Run a spike before any Phase 2 timeline commitment.
- **n8n PDF generation approach:** Gotenberg vs hosted HTML-to-PDF service vs n8n native node — decide and test against YELLOW BROOM FRA before Stage 4.
- **Site Risk template + example:** D2 and site-risk half of D3 fully blocked. Stage 5 can proceed on D4/D6/D7/D8/D9; D2 waits.
- **Twilio UK Sender ID registration lead time:** Unknown. Initiate in Stage 1 to avoid blocking D6 in Stage 5.

---

## Sources

### Primary (HIGH confidence)
- Next.js 16 Blog + 16.1 Blog + Upgrade Guide — breaking changes, caching model, proxy.ts, React 19.2 (official, updated 2026-04-10)
- Supabase `@supabase/ssr` Context7 — createServerClient patterns for proxy, Server Components, Route Handlers
- Supabase Storage RLS docs — `storage.objects` policy model, path-prefix patterns
- npm registry (live, 2026-04-15) — all version pins verified: supabase-js 2.103.0, @supabase/ssr 0.10.2, react-hook-form 7.66.0, @hookform/resolvers 5.2.2, zod 4.0.1, @react-pdf/renderer 4.4.1, @paypal/react-paypal-js 9.1.1, twilio 5.13.1, @sentry/nextjs 10.48.0, browser-image-compression 2.0.2, date-fns 4.1.0, @openrouter/ai-sdk-provider 2.5.1, react-signature-pad-wrapper 4.3.2
- Context7 `/colinhacks/zod` — Zod v4 release, library-author dual-compat guide
- Context7 `/getsentry/sentry-docs` — Next.js 16 instrumentation.ts, onRequestError
- OpenRouter official docs — Vercel AI SDK integration guide

### Secondary (MEDIUM confidence)
- SafetyCulture, SiteDocs, AssessKit, Aurora FRA, Re-Flow, iProtectU, simPRO, PandaDoc, SignWell feature docs — competitor analysis (10+ products)
- GitHub `coltorapps/builder` v0.2.4 — React 19 compatibility unconfirmed
- React Hook Form GitHub issues — Zod v4 + @hookform/resolvers 5.2.2 compatibility confirmed in community tracker
- Zapier STT roundup 2026 — Web Speech API iOS Safari PWA limitations documented
- PayPal community issues — sandbox PAYMENT.CAPTURE.COMPLETED unreliable delivery (documented community issue)

### Tertiary (Inferred from patterns)
- SignWell webhook race condition timing — documented in e-sign provider APIs generally; SignWell-specific timing unconfirmed, treat as standard e-sign pattern
- n8n PDF memory sizing (2GB minimum) — inferred from PDF generation memory profiles generally; confirm against n8n docs before Stage 4 infrastructure provisioning

---

*Research completed: 2026-04-15*
*Ready for roadmap: yes — open questions noted above do not block Stages 1–4*
