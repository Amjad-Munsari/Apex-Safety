# Architecture Research

**Domain:** Multi-tenant compliance SaaS — fire/site risk assessment, client portal, AI report generation
**Researched:** 2026-04-15
**Confidence:** HIGH (stack locked in PROJECT.md; patterns verified against Supabase docs and Next.js 16 App Router conventions)

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          VERCEL (Next.js 16 App Router)                      │
│                                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │  Admin UI    │  │  Client      │  │  Form        │  │  Public/       │  │
│  │  /admin/**   │  │  Portal      │  │  Renderer    │  │  Auth Routes   │  │
│  │              │  │  /portal/**  │  │  /forms/**   │  │  /auth/**      │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └───────┬────────┘  │
│         │                 │                 │                   │           │
│  ┌──────┴─────────────────┴─────────────────┴───────────────────┴────────┐  │
│  │          Server Actions + Route Handlers (app/api/**)                  │  │
│  │  [PayPal webhook]  [SignWell webhook]  [n8n webhook receivers]         │  │
│  │  [Document upload] [Hours credit]     [SMS send]                       │  │
│  └──────────────────────────────────┬─────────────────────────────────────┘  │
└─────────────────────────────────────┼───────────────────────────────────────┘
                                      │
           ┌──────────────────────────┼──────────────────────────┐
           │                          │                          │
┌──────────▼──────────┐   ┌──────────▼──────────┐   ┌──────────▼──────────┐
│   SUPABASE           │   │   n8n (self-hosted   │   │   EXTERNAL SERVICES │
│                      │   │   or cloud)          │   │                     │
│  Postgres + RLS      │   │                      │   │  OpenAI GPT-4       │
│  Auth (magic-link)   │   │  Workflow #1:        │   │  (via OpenRouter)   │
│  Storage (buckets)   │   │  Report Gen          │   │                     │
│  Realtime            │   │  Workflow #2:        │   │  PayPal Orders v2   │
│                      │   │  Email Sender        │   │                     │
│                      │   │  Workflow #3:        │   │  Twilio SMS         │
│                      │   │  Expiry Engine       │   │                     │
│                      │   │  Workflow #4:        │   │  SignWell e-sign    │
│                      │   │  Contract Gen        │   │                     │
└─────────────────────┘   └─────────────────────┘   └─────────────────────┘
```

---

## Component Map

Each component owns exactly one bounded domain. Cross-domain reads are allowed; writes must go through the owning module.

### 1. Auth Module (`app/auth/**`, `lib/supabase/`)

**Owns:**
- `createServerClient` / `createBrowserClient` from `@supabase/ssr`
- Middleware session refresh (`middleware.ts` at project root)
- Magic-link invite flow (admin triggers → Supabase sends invite email)
- Role resolution (`admin_users` vs `client_users` table lookup post-login)

**Does NOT own:**
- Business-logic authorization (lives in RLS policies)
- User profile data beyond auth metadata

**Key pattern:** Middleware runs `supabase.auth.getUser()` on every request, writes refreshed JWT to both request and response cookies. Pages that need auth import `createServerClient` from `lib/supabase/server.ts` — never call auth directly from components.

**Entry points:**
- `app/auth/callback/route.ts` — handles magic-link code exchange
- `app/auth/invite/route.ts` — admin triggers client invite (Server Action)
- `middleware.ts` — session refresh + role-based redirect

---

### 2. Admin Module (`app/admin/**`)

**Owns:**
- Client CRUD (create client, create `client_users` record, trigger magic-link invite)
- Template management (create/edit/version `form_templates` + `template_versions`)
- Assessment review queue (list `form_submissions` in `draft_ready_for_review` state)
- Report approval flow (admin approves → triggers delivery webhook to n8n #1)
- Document upload (triggers SMS + n8n #2 email)
- Hours management (manual credit adjustments, view `hours_transactions`)
- Proposal pipeline (initiate → track e-sign status → trigger n8n #4)
- Admin dashboard aggregation view

**Does NOT own:**
- Report PDF generation (n8n #1 owns this)
- Email delivery (n8n #2 owns this)
- Expiry scheduling (n8n #3 owns this)
- Contract PDF generation (n8n #4 owns this)
- PayPal transaction processing (Hours module owns this)

---

### 3. Client Portal Module (`app/portal/**`)

**Owns:**
- Client dashboard (compliance status, assigned forms, documents, hours balance)
- Form submission (renders assigned `form_assignments` using Form Renderer)
- Document viewing (RLS-scoped to own client_id)
- Hours purchase (initiates PayPal checkout, redirects to PayPal-hosted page)
- Proposal/contract viewing (read-only, RLS-scoped)

**Does NOT own:**
- Form template definition (Admin module owns this)
- Hours credit (PayPal webhook handler owns this)
- Document upload (Admin module owns this)

**RLS guarantee:** Every portal route must be tested by logging in as Client A and attempting to read Client B's data. If readable, the policy is wrong.

---

### 4. Form Renderer Module (`app/forms/**`, `components/forms/`)

**Owns:**
- Schema-driven form rendering (`form_template_versions.schema_json` → React component tree)
- Field type registry (text, textarea, photo-upload, audio-capture, date, select, checkbox, rating)
- Per-field photo attach (uploads to Supabase Storage, stores `storage_path` in submission answer)
- Web Speech API integration (per-field STT button with text fallback)
- Submission hydration (render a past submission against its pinned schema version)
- Draft state (autosave to `localStorage`, submit when complete)

**Does NOT own:**
- Form template authoring / drag-drop builder (Phase 2, `@coltorapps/builder`)
- Form assignment scheduling (n8n cron, Phase 2)

**Critical invariant:** The renderer must accept a `schema_version_id` and render the form against that exact schema — not the latest version. This makes past submissions immutable.

---

### 5. Assessment Module (`app/admin/assessments/**`)

**Owns:**
- Assessment session management (open, pause, complete lifecycle on `form_assignments`)
- Triggering n8n #1 (report generation) on submission complete
- Report review queue (see Admin module — shared admin view)
- Admin-facing submission detail view

**Does NOT own:**
- Form rendering (Form Renderer owns this)
- PDF generation (n8n #1 owns this)

---

### 6. Documents Module (`app/admin/documents/**`, `app/portal/documents/**`)

**Owns:**
- Upload to Supabase Storage (`client-documents/{client_id}/{filename}`)
- `documents` table writes (metadata: filename, expiry_date, document_category)
- Triggering Twilio SMS on upload (Server Action, synchronous)
- Triggering n8n #2 (email notification) on upload (webhook call, async)

**Does NOT own:**
- Expiry tracking (n8n #3 cron owns this)
- Email body composition (n8n #2 owns this)

---

### 7. Hours Module (`app/api/webhooks/paypal/route.ts`, `app/portal/hours/**`)

**Owns:**
- PayPal Orders v2 checkout session creation (Server Action)
- PayPal webhook receiver (`/api/webhooks/paypal`) — idempotent, signature-verified
- `hours_transactions` table writes
- `clients.hours_balance` increment (inside DB transaction)
- Receipt trigger (calls n8n #2 email with `type: 'receipt'`)

**Does NOT own:**
- Portal display of balance (Client Portal module reads this)
- PayPal credential management (ops concern)

---

### 8. Proposals Module (`app/admin/proposals/**`)

**Owns:**
- Service selection form (reads from `services` seed table, populated from Packages.docx)
- Triggering n8n #4 (proposal PDF generation via OpenAI)
- `proposals` table lifecycle: `draft` → `sent` → `signed` → `contract_sent` → `contract_signed`
- SignWell webhook receiver (`/api/webhooks/signwell/route.ts`) — idempotent
- Proposal/contract document storage references

**Does NOT own:**
- PDF generation (n8n #4 owns this)
- Contract clause content (template seeded from Blank Service Agreement)

---

### 9. Notifications Module (n8n #2 + #3, `lib/notifications.ts`)

**Owns:**
- Twilio SMS dispatch (called synchronously from Documents module Server Action)
- n8n #2 (universal email sender — called by all other modules via webhook)
- n8n #3 (expiry cron — autonomous, reads `documents` table directly)
- `notifications_sent` dedup table

**Does NOT own:**
- Business-logic triggers (caller modules decide when to notify)
- Email template content beyond what n8n #2 composes

---

## Data Flow

### Flow 1: Assessment Form Submission → Report Delivery

```
Matt (tablet) fills FRA form in Form Renderer
    │
    ▼ Server Action (form_submissions INSERT)
Supabase: form_submissions row created
  - schema_version_id pinned
  - answers JSONB stored
  - status = 'submitted'
    │
    ▼ Server Action calls n8n #1 webhook
n8n Workflow #1 receives {submission_id}
  - Fetches submission + schema + client from Supabase (service-role key)
  - Builds prompt from schema fields + answers + YELLOW BROOM few-shot
  - Calls OpenAI GPT-4 (via OpenRouter)
  - Receives report text
  - Renders branded PDF (with 888 Safety header/footer)
  - Uploads PDF to Supabase Storage: reports/{client_id}/{submission_id}.pdf
  - Updates form_submissions: status = 'draft_ready_for_review', report_storage_path set
  - Calls back: POST /api/n8n/report-ready {submission_id}
    │
    ▼ Route Handler /api/n8n/report-ready (n8n callback)
Admin dashboard shows new item in review queue
    │
    ▼ Matt reviews PDF in admin UI, clicks Approve
Server Action: form_submissions.status = 'delivered'
n8n #2 email webhook called with type='report_delivery'
  - n8n #2 sends email to client with PDF link (Supabase signed URL, 7-day expiry)
Client receives email + PDF
```

### Flow 2: Client Document Upload → Expiry Alert Chain

```
Matt uploads document in Admin → Documents module
    │
    ▼ Server Action:
1. Upload to Storage: client-documents/{client_id}/{filename}
2. INSERT documents row (client_id, filename, expiry_date, storage_path, category)
3. Twilio SMS sent synchronously (lib/notifications.ts → Twilio API)
4. POST to n8n #2 webhook: {type:'doc_upload', client_id, document_id}
    │
    ▼ n8n #2 sends upload notification email to client
    │
    ▼ n8n #3 cron fires at 08:00 UK daily
Queries: documents WHERE expiry_date BETWEEN now() AND now() + 30 days
For each document × each window (30/14/7):
  - Check notifications_sent WHERE (document_id, window, 'expiry_alert')
  - If not sent → call n8n #2 with type='expiry_alert'
  - INSERT notifications_sent (dedup record)
    │
    ▼ n8n #2 sends expiry alert email to client
```

### Flow 3: PayPal Hours Purchase

```
Client clicks "Buy Hours" in Portal
    │
    ▼ Server Action: create PayPal Order
PayPal Orders v2 API → returns order_id + approval URL
Server Action redirects client to PayPal-hosted approval page
    │
    ▼ Client approves on PayPal, PayPal calls:
POST /api/webhooks/paypal (Route Handler)
  - Extract raw body (DO NOT parse before verification)
  - POST to PayPal /v1/notifications/verify-webhook-signature
  - If verification_status != 'SUCCESS' → return 400, log
  - Check idempotency: SELECT FROM hours_transactions WHERE paypal_order_id = X
  - If already processed → return 200 (idempotent)
  - BEGIN TRANSACTION
    - INSERT hours_transactions (client_id, paypal_order_id, amount, hours_credited)
    - UPDATE clients SET hours_balance = hours_balance + hours_credited
  - COMMIT
  - POST to n8n #2 webhook: {type:'receipt', client_id, hours_credited}
    │
    ▼ n8n #2 sends receipt email
```

### Flow 4: Proposal → Contract Pipeline

```
Matt selects services in Admin → Proposals UI
    │
    ▼ Server Action: INSERT proposals row (status='draft')
POST to n8n #4 webhook: {proposal_id, client_id, services[]}
    │
    ▼ n8n #4:
- Fetches client info + service details from Supabase
- Calls OpenAI GPT-4 to draft proposal text (Blank Proposal template + Packages.docx as context)
- Renders PDF matching Blank Proposal One Page Template
- Uploads to Storage: proposals/{client_id}/{proposal_id}.pdf
- Updates proposals: status='draft_ready', pdf_path set
- Calls back: POST /api/n8n/proposal-ready {proposal_id}
    │
    ▼ Matt reviews, clicks Send → Server Action
- Creates SignWell document from proposal PDF
- proposals.status = 'sent'
- POST to n8n #2: {type:'proposal_sent', client_id}
    │
    ▼ Client signs via SignWell email link
POST /api/webhooks/signwell (Route Handler)
  - Verify SignWell signature header
  - event='document_completed' → proposals.status = 'signed'
  - POST to n8n #4: {type:'contract_gen', proposal_id}
    │
    ▼ n8n #4 (contract generation leg):
- Fetches signed proposal + Blank Service Agreement template
- Calls OpenAI to populate Service Agreement (20 clauses + 3 schedules)
- Renders PDF
- Uploads to Storage: contracts/{client_id}/{proposal_id}_contract.pdf
- Updates proposals: status='contract_sent', contract_path set
- Creates second SignWell document (dual-sign)
- Calls back: POST /api/n8n/contract-ready {proposal_id}
    │
    ▼ Both parties sign → SignWell webhook fires again
proposals.status = 'contract_signed'
```

---

## n8n Workflow Contracts

### Workflow #1: Assessment Report Generation

**Trigger:** POST from code (Server Action) immediately after form submission is saved.

**Input shape:**
```json
{
  "submission_id": "uuid",
  "client_id": "uuid",
  "template_type": "fra | site_risk",
  "callback_url": "https://app.888safety.co.uk/api/n8n/report-ready"
}
```

**What it does:**
1. Supabase REST: fetch `form_submissions` + `form_template_versions` (schema_json) by `submission_id`
2. Supabase REST: fetch `clients` (client name, site address, Matt's branding details)
3. Build OpenAI prompt: schema field labels + answers + YELLOW BROOM FRA as few-shot example
4. Call OpenAI GPT-4 (OpenRouter) — streaming disabled, single-shot completion
5. Compose PDF using n8n's HTML-to-PDF node (or puppeteer via Execute Command) with 888 Safety branding
6. Supabase Storage upload: `reports/{client_id}/{submission_id}.pdf` (service-role key)
7. Supabase REST: PATCH `form_submissions` — set `status='draft_ready_for_review'`, `report_storage_path`
8. POST callback to `callback_url`

**Output / side effects:**
- Supabase Storage: PDF file created
- `form_submissions.status` changed to `draft_ready_for_review`
- `form_submissions.report_storage_path` set

**Failure modes:**
- OpenAI timeout → n8n retry with exponential backoff (max 3 attempts)
- PDF generation failure → `form_submissions.status = 'generation_failed'`, alert Matt via n8n #2
- Supabase upload failure → retry; on exhaustion, status = 'generation_failed'
- Callback failure → n8n retries callback; code endpoint is idempotent (check current status before updating)

**Contract with code:** Code polls `form_submissions.status` via Supabase Realtime subscription. The callback (`/api/n8n/report-ready`) also updates a `last_notified_at` timestamp for belt-and-suspenders.

---

### Workflow #2: Universal Email Sender

**Trigger:** POST webhook from any code module or from n8n #1/#3/#4.

**Input shape:**
```json
{
  "type": "doc_upload | expiry_alert | report_delivery | receipt | proposal_sent | contract_ready | custom",
  "client_id": "uuid",
  "document_id": "uuid | null",
  "submission_id": "uuid | null",
  "proposal_id": "uuid | null",
  "hours_credited": "number | null",
  "custom_subject": "string | null",
  "custom_body": "string | null"
}
```

**What it does:**
1. Supabase REST: resolve `client_id` → client email, name
2. Select email template by `type`
3. For `report_delivery` / `doc_upload` / `contract_ready`: generate Supabase Storage signed URL (7-day expiry) for the relevant file
4. Send via SendGrid / Resend (Matt's preference TBD — default Resend for simplicity)
5. INSERT `notifications_sent` row (for dedup in n8n #3)

**Output / side effects:**
- Email sent to client
- `notifications_sent` row inserted

**Failure modes:**
- Email provider failure → n8n retries (3x). Do NOT re-insert `notifications_sent` on retry — check before inserting.
- Missing client email → log error, do not throw (graceful skip)

**Contract with code:** Callers are fire-and-forget (POST and move on). Code does not wait for email confirmation.

---

### Workflow #3: Expiry Alert Engine (Cron)

**Trigger:** Cron schedule — 08:00 UK time daily (Europe/London timezone). n8n schedule trigger.

**Input shape:** None (self-contained — reads Supabase directly).

**What it does:**
1. Supabase REST: SELECT documents WHERE `expiry_date` BETWEEN now() AND now() + 31 days AND active = true
2. For each document × each window [30, 14, 7]:
   - Compute alert day: `expiry_date - window days`
   - If today = alert day (±tolerance 0 — exact match on date):
     - SELECT notifications_sent WHERE `(document_id, alert_window, 'expiry_alert')` — dedup check
     - If not found: POST to n8n #2 `{type:'expiry_alert', client_id, document_id, days_remaining: window}`
     - INSERT notifications_sent
3. Log run summary to Supabase `cron_runs` table (optional monitoring)

**Output / side effects:**
- 0–N emails sent via n8n #2
- `notifications_sent` rows inserted

**Failure modes:**
- Network error on Supabase query → n8n retries the full cron run
- n8n #2 webhook fails → n8n #3 does NOT insert `notifications_sent` (so next run retries)
- Double-fire risk: if cron fires twice, dedup in `notifications_sent` prevents duplicate emails

**Dedup key:** `(document_id, alert_window, notification_type)` — UNIQUE constraint in Postgres. INSERT ON CONFLICT DO NOTHING in n8n #3.

---

### Workflow #4: Proposal & Contract Generation

**Trigger:** POST webhook from Admin Proposals module (two legs: proposal gen and contract gen, differentiated by `type` field).

**Input shape:**
```json
{
  "type": "proposal_gen | contract_gen",
  "proposal_id": "uuid",
  "client_id": "uuid",
  "services": ["uuid", "uuid"],
  "callback_url": "https://app.888safety.co.uk/api/n8n/proposal-ready | /contract-ready"
}
```

**What it does (proposal_gen leg):**
1. Fetch client details + selected services from Supabase
2. Call OpenAI (OpenRouter) with Blank Proposal template as system prompt, services as input
3. Render proposal PDF (matching Blank Proposal One Page Template format)
4. Upload: `proposals/{client_id}/{proposal_id}.pdf`
5. PATCH `proposals`: `status='draft_ready'`, `pdf_path` set
6. POST callback

**What it does (contract_gen leg):**
1. Fetch signed proposal details + service list
2. Call OpenAI to populate Blank Service Agreement (20 clauses, 3 schedules)
3. Render contract PDF
4. Upload: `contracts/{client_id}/{proposal_id}_contract.pdf`
5. PATCH `proposals`: `status='contract_sent'`, `contract_path` set
6. Create SignWell document via API (dual-sign — Matt + client)
7. POST callback

**Failure modes:** Same retry/callback pattern as Workflow #1.

---

## Supabase Schema Skeleton

### Core Tables

```sql
-- ─────────────────────────────────────────────────────────────
-- TENANTS
-- ─────────────────────────────────────────────────────────────

CREATE TABLE clients (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  site_address    TEXT,
  hours_balance   NUMERIC(10,2) NOT NULL DEFAULT 0,
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- No RLS needed on clients itself — admin sees all, portal users access via client_users JOIN

CREATE TABLE admin_users (
  id       UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name     TEXT NOT NULL,
  email    TEXT NOT NULL
);
-- RLS: SELECT/UPDATE WHERE id = auth.uid()

CREATE TABLE client_users (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id   UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  email       TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'member',  -- 'owner' | 'member'
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- RLS: client_users can SELECT their own row only.
--      Admins use service-role for management.

-- ─────────────────────────────────────────────────────────────
-- FORM BUILDER
-- ─────────────────────────────────────────────────────────────

CREATE TABLE form_templates (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,        -- 'FRA Type 3', 'Site Risk Assessment'
  template_type TEXT NOT NULL,       -- 'fra' | 'site_risk' | 'custom'
  owner_id     UUID REFERENCES admin_users(id),  -- NULL = global seed
  owner_type   TEXT DEFAULT 'admin', -- 'admin' | 'client' (Phase 2 expansion)
  is_published  BOOLEAN DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- RLS: Admins full access. Client portal: SELECT WHERE is_published = TRUE.

CREATE TABLE template_versions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id     UUID NOT NULL REFERENCES form_templates(id) ON DELETE CASCADE,
  version_number  INTEGER NOT NULL,  -- monotonically incrementing per template
  schema_json     JSONB NOT NULL,    -- full field schema (see schema format below)
  published_at    TIMESTAMPTZ,
  created_by      UUID REFERENCES admin_users(id),
  UNIQUE(template_id, version_number)
);
-- Schema is append-only once published. Never mutate a published version.
-- RLS: Admins full access. Clients: SELECT on published versions only.

-- schema_json shape:
-- {
--   "fields": [
--     {
--       "id": "field_uuid",
--       "type": "text|textarea|photo|audio|date|select|checkbox|rating",
--       "label": "Escape Routes",
--       "required": true,
--       "allows_photo": true,
--       "allows_audio": true,
--       "options": ["option1", "option2"],  // for select/checkbox
--       "order": 0
--     }
--   ],
--   "sections": [ { "id": "uuid", "label": "Section name", "field_ids": [...] } ]
-- }

-- ─────────────────────────────────────────────────────────────
-- FORM ASSIGNMENTS & SUBMISSIONS
-- ─────────────────────────────────────────────────────────────

CREATE TABLE form_assignments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id           UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  template_id         UUID NOT NULL REFERENCES form_templates(id),
  template_version_id UUID NOT NULL REFERENCES template_versions(id),
  assigned_by         UUID REFERENCES admin_users(id),
  due_date            DATE,
  status              TEXT NOT NULL DEFAULT 'assigned',  -- 'assigned'|'in_progress'|'submitted'
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- RLS:
--   Client SELECT: WHERE client_id IN (SELECT client_id FROM client_users WHERE id = auth.uid())
--   Admin: full access

CREATE TABLE form_submissions (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id        UUID NOT NULL REFERENCES form_assignments(id),
  client_id            UUID NOT NULL REFERENCES clients(id),  -- denormalised for RLS performance
  template_version_id  UUID NOT NULL REFERENCES template_versions(id),  -- pinned schema
  answers_json         JSONB NOT NULL,   -- {field_id: {value, photo_paths[], audio_path}}
  submitted_by         UUID,             -- auth.uid() of submitter (admin or client)
  submitted_at         TIMESTAMPTZ,
  status               TEXT NOT NULL DEFAULT 'draft',
    -- 'draft' | 'submitted' | 'draft_ready_for_review' | 'generation_failed' | 'delivered'
  report_storage_path  TEXT,            -- set by n8n #1 on completion
  reviewed_by          UUID REFERENCES admin_users(id),
  reviewed_at          TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- RLS:
--   Client SELECT: WHERE client_id IN (SELECT client_id FROM client_users WHERE id = auth.uid())
--     AND status = 'delivered'   ← clients only see delivered reports
--   Admin: full SELECT/UPDATE access
--   INSERT: authenticated users only (client_id verified via client_users JOIN)

-- ─────────────────────────────────────────────────────────────
-- DOCUMENTS
-- ─────────────────────────────────────────────────────────────

CREATE TABLE documents (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id        UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  filename         TEXT NOT NULL,
  document_category TEXT NOT NULL,   -- 'fire_certificate' | 'pat_test' | 'risk_assessment' | ...
  storage_path     TEXT NOT NULL,    -- 'client-documents/{client_id}/{filename}'
  expiry_date      DATE,
  uploaded_by      UUID REFERENCES admin_users(id),
  uploaded_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  active           BOOLEAN NOT NULL DEFAULT TRUE
);
-- RLS:
--   Client SELECT: WHERE client_id IN (SELECT client_id FROM client_users WHERE id = auth.uid())
--   Admin: full access

-- ─────────────────────────────────────────────────────────────
-- HOURS / BILLING
-- ─────────────────────────────────────────────────────────────

CREATE TABLE hours_transactions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id        UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  paypal_order_id  TEXT UNIQUE,          -- NULL for manual adjustments; UNIQUE for idempotency
  transaction_type TEXT NOT NULL,       -- 'purchase' | 'deduction' | 'manual_credit' | 'manual_debit'
  hours_amount     NUMERIC(10,2) NOT NULL,
  gbp_amount       NUMERIC(10,2),       -- NULL for non-purchase transactions
  notes            TEXT,
  created_by       UUID,                -- admin_user id for manual; NULL for PayPal
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- RLS:
--   Client SELECT: WHERE client_id IN (SELECT client_id FROM client_users WHERE id = auth.uid())
--   Admin: full access
--   INSERT: Route Handler uses service-role (PayPal webhook); admin uses anon client with RLS

-- ─────────────────────────────────────────────────────────────
-- PROPOSALS & CONTRACTS
-- ─────────────────────────────────────────────────────────────

CREATE TABLE services (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  description TEXT,
  unit_price  NUMERIC(10,2),
  category    TEXT,   -- from Packages.docx / Course List Master.xlsx
  active      BOOLEAN DEFAULT TRUE
);
-- RLS: SELECT for all authenticated users. Admin INSERT/UPDATE.

CREATE TABLE proposals (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id         UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  services_json     JSONB NOT NULL,      -- snapshot of selected services at time of proposal
  status            TEXT NOT NULL DEFAULT 'draft',
    -- 'draft' | 'draft_ready' | 'sent' | 'signed' | 'contract_sent' | 'contract_signed' | 'declined'
  proposal_pdf_path TEXT,
  contract_pdf_path TEXT,
  signwell_proposal_doc_id  TEXT,
  signwell_contract_doc_id  TEXT,
  created_by        UUID REFERENCES admin_users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- RLS:
--   Client SELECT: WHERE client_id IN (SELECT client_id FROM client_users WHERE id = auth.uid())
--     AND status IN ('sent','signed','contract_sent','contract_signed')
--   Admin: full access

-- ─────────────────────────────────────────────────────────────
-- NOTIFICATIONS (DEDUP)
-- ─────────────────────────────────────────────────────────────

CREATE TABLE notifications_sent (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id         UUID NOT NULL REFERENCES clients(id),
  notification_type TEXT NOT NULL,   -- 'expiry_alert' | 'doc_upload' | 'receipt' | ...
  document_id       UUID REFERENCES documents(id),
  alert_window      INTEGER,         -- 30 | 14 | 7 (for expiry_alert type only)
  sent_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (document_id, alert_window, notification_type)  -- dedup key for expiry alerts
);
-- RLS: Admin SELECT only. n8n uses service-role key for INSERT.
```

---

## RLS Policy Shape (per table)

```
clients:          NO RLS (admin sees all; client access mediated through client_users JOIN)
admin_users:      PERMISSIVE SELECT/UPDATE WHERE id = auth.uid()
client_users:     PERMISSIVE SELECT WHERE id = auth.uid()
form_templates:   PERMISSIVE SELECT WHERE is_published = TRUE OR owner_id = admin auth.uid()
template_versions: PERMISSIVE SELECT WHERE published_at IS NOT NULL (clients) OR admin
form_assignments: PERMISSIVE SELECT WHERE client_id IN (
                    SELECT client_id FROM client_users WHERE id = auth.uid()
                  )
form_submissions: PERMISSIVE SELECT WHERE client_id IN (
                    SELECT client_id FROM client_users WHERE id = auth.uid()
                  ) AND status = 'delivered'   ← client
                  PERMISSIVE SELECT/UPDATE (no filter) ← admin (JWT claim 'role'='admin')
documents:        PERMISSIVE SELECT WHERE client_id IN (
                    SELECT client_id FROM client_users WHERE id = auth.uid()
                  )
hours_transactions: PERMISSIVE SELECT WHERE client_id IN (
                    SELECT client_id FROM client_users WHERE id = auth.uid()
                  )
proposals:        PERMISSIVE SELECT WHERE client_id IN (...) AND status IN ('sent','signed',...)
notifications_sent: NO client RLS (admin + service-role only)
```

**Admin role detection pattern:**
```sql
-- In RLS policies, distinguish admin from client:
-- Store 'role' in auth.jwt() -> app_metadata.role = 'admin' | 'client'
-- Set this via Supabase Admin API when creating admin_users

CREATE POLICY "admin_full_access" ON form_submissions
  FOR ALL
  USING ((auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' = 'admin');

CREATE POLICY "client_read_delivered" ON form_submissions
  FOR SELECT
  USING (
    status = 'delivered'
    AND client_id IN (
      SELECT client_id FROM client_users WHERE id = auth.uid()
    )
  );
```

**Performance:** Index every column referenced in RLS USING clause. Critical indexes:
```sql
CREATE INDEX ON client_users(id);
CREATE INDEX ON client_users(client_id);
CREATE INDEX ON form_submissions(client_id);
CREATE INDEX ON form_submissions(status);
CREATE INDEX ON documents(client_id);
CREATE INDEX ON hours_transactions(client_id);
CREATE INDEX ON notifications_sent(document_id, alert_window, notification_type);
```

---

## Storage Partitioning

**Decision: Path-prefix-per-client within shared named buckets (NOT bucket-per-client)**

**Rationale:**
- Supabase enforces a limit on the number of buckets per project (soft limit ~100)
- With 7–8 clients today, bucket-per-client would work, but growth and management overhead are unnecessary
- Path-prefix approach allows a single RLS policy per bucket based on `storage.foldername(name)[0]` matching `client_id`
- Storage buckets treat "folders" as key prefixes — RLS on `storage.objects` can check the path prefix

**Bucket layout:**

```
[PRIVATE bucket] client-documents
  └── {client_id}/
      └── {filename}

[PRIVATE bucket] reports
  └── {client_id}/
      └── {submission_id}.pdf

[PRIVATE bucket] proposals
  └── {client_id}/
      └── {proposal_id}.pdf
      └── {proposal_id}_contract.pdf

[PRIVATE bucket] form-media
  └── {client_id}/
      └── {submission_id}/
          └── {field_id}/
              └── {photo_1.jpg}
              └── {audio_1.webm}

[PUBLIC bucket] brand-assets
  └── logo.png
  └── pdf-header.png
```

**Storage RLS policy shape (example for client-documents bucket):**

```sql
-- Allow clients to SELECT (download) their own documents
CREATE POLICY "client_read_own_documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'client-documents'
  AND (storage.foldername(name))[1] IN (
    SELECT client_id::text FROM client_users WHERE id = auth.uid()
  )
);

-- Allow admins to INSERT/SELECT/DELETE
CREATE POLICY "admin_full_access_documents"
ON storage.objects FOR ALL
USING (
  bucket_id = 'client-documents'
  AND (auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' = 'admin'
);
```

**Access pattern for private files:**
- Clients access documents via Supabase Storage **signed URLs** generated server-side (never expose the service-role key to the browser)
- Signed URLs: 7-day expiry for report delivery emails, 1-hour expiry for in-portal viewing
- Server Action generates signed URL → returns to component → component renders `<a href={signedUrl}>`

---

## Webhook + Route Handler Patterns

### PayPal Webhook (`/api/webhooks/paypal/route.ts`)

```typescript
// Pattern — raw body preservation is mandatory
export async function POST(request: Request) {
  const rawBody = await request.text()  // NOT request.json()

  // 1. Extract PayPal verification headers
  const headers = {
    auth_algo: request.headers.get('paypal-auth-algo'),
    cert_url: request.headers.get('paypal-cert-url'),
    transmission_id: request.headers.get('paypal-transmission-id'),
    transmission_sig: request.headers.get('paypal-transmission-sig'),
    transmission_time: request.headers.get('paypal-transmission-time'),
  }

  // 2. Verify with PayPal API (postback verification)
  const verifyResponse = await fetch(
    'https://api-m.paypal.com/v1/notifications/verify-webhook-signature',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...headers,
        webhook_id: process.env.PAYPAL_WEBHOOK_ID,
        webhook_event: JSON.parse(rawBody),
      }),
    }
  )
  const { verification_status } = await verifyResponse.json()
  if (verification_status !== 'SUCCESS') return new Response('Invalid signature', { status: 400 })

  // 3. Parse event
  const event = JSON.parse(rawBody)
  if (event.event_type !== 'CHECKOUT.ORDER.APPROVED') return new Response('OK', { status: 200 })

  // 4. Idempotency check
  const orderId = event.resource.id
  const existing = await supabase
    .from('hours_transactions')
    .select('id')
    .eq('paypal_order_id', orderId)
    .maybeSingle()
  if (existing.data) return new Response('Already processed', { status: 200 })

  // 5. Capture + credit (in DB transaction via RPC)
  await supabase.rpc('credit_hours_from_paypal', {
    p_client_id: clientId,
    p_order_id: orderId,
    p_hours: hoursAmount,
    p_gbp: gbpAmount,
  })

  // 6. Trigger receipt email (fire-and-forget)
  fetch(process.env.N8N_WEBHOOK_URL_EMAIL, { method: 'POST', body: JSON.stringify({type:'receipt',...}) })

  return new Response('OK', { status: 200 })
}
```

### SignWell Webhook (`/api/webhooks/signwell/route.ts`)

```
Verification: SignWell sends HMAC-SHA256 signature in X-SignWell-Signature header.
Verify using the shared secret from the SignWell dashboard.
Events: document_viewed | document_completed | document_declined
On document_completed: update proposals.status based on signwell_*_doc_id match.
Idempotency: check proposals.status before updating — already in terminal state → skip.
```

### n8n Callback Receivers (`/api/n8n/report-ready/route.ts`, etc.)

```
Auth: n8n sends a shared secret header (N8N_CALLBACK_SECRET env var).
Check: if (request.headers.get('x-n8n-secret') !== process.env.N8N_CALLBACK_SECRET) → 401
Idempotency: check current status before mutating. If already 'draft_ready_for_review' → 200.
These are internal-only — never expose to the public internet without the secret.
```

**General webhook rules:**
1. Always return 200/202 quickly. Do slow work after the response using `waitUntil` (Vercel Edge) or fire-and-forget `fetch`.
2. Raw body for signature verification — set `export const dynamic = 'force-dynamic'` on webhook routes.
3. UNIQUE constraints in Postgres are the true idempotency guard — application-level dedup is defense-in-depth only.
4. Log all received webhooks to a `webhook_log` table (event_type, payload digest, status) for debugging.

---

## Recommended Project Structure

```
app/
├── (admin)/                    # Admin layout group (admin_users only)
│   ├── admin/
│   │   ├── page.tsx            # Dashboard
│   │   ├── clients/            # Client CRUD
│   │   ├── templates/          # Form template management
│   │   ├── assessments/        # Assessment review queue
│   │   ├── documents/          # Document upload
│   │   ├── hours/              # Hours management
│   │   └── proposals/          # Proposal pipeline
│   └── layout.tsx              # Admin auth guard
│
├── (portal)/                   # Client portal layout group
│   ├── portal/
│   │   ├── page.tsx            # Client dashboard
│   │   ├── forms/              # Assigned form submissions
│   │   ├── documents/          # Client document view
│   │   ├── hours/              # Hours balance + purchase
│   │   └── proposals/          # Proposal/contract view
│   └── layout.tsx              # Client auth guard
│
├── auth/
│   ├── callback/route.ts       # Magic-link code exchange
│   └── invite/route.ts         # Admin triggers client invite
│
├── api/
│   ├── webhooks/
│   │   ├── paypal/route.ts     # PayPal Orders webhook
│   │   └── signwell/route.ts   # SignWell e-sign webhook
│   └── n8n/
│       ├── report-ready/route.ts
│       ├── proposal-ready/route.ts
│       └── contract-ready/route.ts
│
└── forms/
    └── [assignmentId]/
        └── page.tsx            # Form Renderer entry (shared admin + client)

lib/
├── supabase/
│   ├── server.ts               # createServerClient (Server Components/Actions/Route Handlers)
│   ├── client.ts               # createBrowserClient (Client Components only)
│   └── admin.ts                # createClient with SERVICE_ROLE_KEY (webhook handlers only)
├── n8n/
│   └── webhooks.ts             # typed helpers: triggerReportGen(), triggerEmailSend(), etc.
├── paypal/
│   └── client.ts               # PayPal API helpers, access token management
├── signwell/
│   └── client.ts               # SignWell API helpers
└── notifications/
    └── sms.ts                  # Twilio SMS dispatch

components/
├── forms/
│   ├── FormRenderer.tsx        # Schema-driven renderer
│   ├── fields/                 # Field type components
│   │   ├── TextField.tsx
│   │   ├── PhotoField.tsx      # Per-field photo attach
│   │   ├── AudioField.tsx      # Web Speech API + audio capture
│   │   └── ...
│   └── FormProgress.tsx        # Autosave / draft indicator
├── admin/
│   └── ...
└── portal/
    └── ...

supabase/
├── migrations/                 # All schema changes as versioned migrations
└── seed.sql                    # Seed: FRA template, Site Risk template, services
```

---

## Build Order Dependencies

This maps directly to the locked Stage sequence in PROJECT.md.

```
Stage 1: Scaffolding
  - Next.js 16 App Router scaffold
  - Supabase project + Auth configured
  - @supabase/ssr middleware pattern (middleware.ts)
  - Role routing: admin vs client detected from JWT app_metadata
  - Tailwind 4 + base layout shells
  GATE: Can log in as Matt (admin), redirected to /admin. Can log in as test client, redirected to /portal.

Stage 2: Form Prerequisites           ← BLOCKS Stage 3
  - Supabase schema: clients, admin_users, client_users, form_templates, template_versions,
    form_assignments, form_submissions
  - RLS policies on all the above (verified with cross-client test)
  - Storage buckets created + policies applied: form-media, reports, client-documents, proposals
  - Field type components (TextField, PhotoField, AudioField, etc.)
  - FormRenderer component (renders schema_json → React form)
  - Submission save (Server Action: INSERT form_submissions)
  - Schema version pinning (submission stores template_version_id)
  GATE: Can render a hardcoded test schema, fill fields, attach photos, save — submission appears in Supabase with pinned version.

Stage 3: Form Builder + FRA Seed      ← GREEN-LIGHT GATE (Matt demo sign-off)
  - FRA seed template inserted (schema_json built from Blank FRA Type 3 asset)
  - Form assignment flow (admin assigns FRA to a client)
  - Form Renderer wired to real assignment (fetches template_version by assignment)
  - D1 deliverable: Matt can fill the FRA on tablet, submit, view submission in admin
  - STT per-field tested on Surface Pro / iPad
  GATE: Live demo to Matt. Matt signs off. Stages 4–5 unlock.

Stage 4: Assessment + AI Pipeline     ← BLOCKED on Stage 3 gate
  - n8n Workflow #1 (report gen) built + connected
  - Report review queue in admin
  - Approve → delivered flow
  - D3 deliverable: end-to-end FRA → report → Matt reviews → client delivery
  DEPENDS ON: Stage 3 gate + n8n instance running + OpenAI/OpenRouter credentials

Stage 5 (parallelisable after Stage 3 gate):
  5A: Client Portal (D4)
    DEPENDS ON: Stage 2 (RLS, storage), Matt's compliance taxonomy (for D7)
  5B: Hours + PayPal (D5)
    DEPENDS ON: Stage 2 (hours_transactions schema), PayPal credentials
  5C: Document Upload + Notifications (D6 + D7)
    DEPENDS ON: Stage 2 (documents schema, storage), Twilio credentials
    n8n Workflow #2 + #3 built
  5D: Proposal + Contract Pipeline (D8)
    DEPENDS ON: n8n Workflow #4, SignWell account, Stage 2 (proposals schema)
  5E: Admin Dashboard (D9)
    DEPENDS ON: All 5A-5D data existing to aggregate

Stage 6: Handover (D10 + D11)
  DEPENDS ON: All Stage 5 complete
```

**Hard blockers summary:**

| What | Blocks |
|------|--------|
| Stage 2 RLS + storage NOT done | Cannot safely build any Stage 3/4/5 feature |
| Stage 3 green-light NOT given | Cannot start Stage 4 or Stage 5 |
| n8n instance NOT running | Cannot build any n8n workflow |
| PayPal credentials NOT received | Cannot wire PayPal webhook end-to-end |
| Site Risk template NOT received | D2 blocked entirely |
| Matt's compliance taxonomy NOT received | D4 (full portal) + D7 (expiry) blocked |
| SignWell account NOT set up | D8 blocked at contract-sign step |

---

## Architectural Patterns to Follow

### Pattern 1: Server Action for Mutations, Route Handler for External Webhooks

**What:** Server Actions handle all app-internal mutations (form submit, document upload, proposal create). Route Handlers handle only external callbacks (PayPal, SignWell, n8n callbacks).

**Why:** Server Actions run in the authenticated session context — `auth.uid()` is automatically available. Route Handlers for external webhooks run without a user session; they use the service-role key after verifying the caller's signature.

### Pattern 2: Supabase RLS as the Authorization Layer

**What:** Never enforce multi-tenant isolation in application code alone. RLS policies are the authoritative boundary. Application code is defense-in-depth.

**Why:** Any code path (direct Supabase SDK call, accidental Server Action, even direct Postgres connection) is blocked by RLS. Bugs in code cannot leak cross-tenant data if RLS is correct.

**Verification ritual:** Before every Stage 5 feature ship, log in as Client A, attempt to access Client B's records via the Supabase client (not service-role). If data is returned, RLS is wrong.

### Pattern 3: n8n Callback Loop (not polling)

**What:** Code triggers n8n workflow via webhook and returns immediately. n8n calls back to a Route Handler when done. UI listens via Supabase Realtime subscription on the relevant row's `status` column.

**Why:** Avoids long-running server-side waits. Supabase Realtime pushes status changes to the UI without polling. n8n workflows can take 30–120 seconds for PDF generation.

**Implementation:** `supabase.channel('report-status').on('postgres_changes', {table:'form_submissions', filter:`id=eq.${submissionId}`}, handler).subscribe()`

### Pattern 4: Schema-Pinned Submissions

**What:** Every `form_submissions` row stores `template_version_id`. The Form Renderer hydrates past submissions by fetching that specific version's `schema_json`.

**Why:** Prevents the pitfall where editing a template retroactively breaks the rendering of past submissions — a classic form-builder mistake. Template versions are immutable once published.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Fetching Supabase with anon key in n8n

**What people do:** Use the Supabase anon/public key in n8n workflows to read/write tables.
**Why it's wrong:** n8n runs server-side without an authenticated user session. RLS policies using `auth.uid()` will block all reads (auth.uid() returns NULL for service-level calls without JWT context). Data operations silently fail or return empty.
**Do this instead:** Use the Supabase service-role key in n8n (stored as n8n credential). This bypasses RLS — which is correct for an internal automation tool. Scope service-role to n8n only; never expose it to the browser.

### Anti-Pattern 2: Parsing Webhook Body Before Signature Verification

**What people do:** Let Next.js auto-parse `request.json()` in webhook handlers, then try to verify signature.
**Why it's wrong:** PayPal (and SignWell) require the exact raw bytes for signature verification. JSON serialization/deserialization can reorder keys or alter whitespace, causing verification to fail. Also, Next.js may buffer/transform the body.
**Do this instead:** Always `await request.text()` first. Parse to JSON manually after verification.

### Anti-Pattern 3: Embedding `report_storage_path` as a Public URL

**What people do:** Store the full public Supabase Storage URL in the `report_storage_path` column. Render it directly in `<img>` or `<a>` tags.
**Why it's wrong:** Reports are in private buckets. Public URLs don't work. Signed URLs expire — storing them in the DB means they'll be stale.
**Do this instead:** Store the path prefix only (`reports/{client_id}/{submission_id}.pdf`). Generate a signed URL at render time via a Server Component or Server Action (never client-side with service-role).

### Anti-Pattern 4: Mutating a Published Template Version

**What people do:** Update `schema_json` on an existing `template_versions` row when Matt edits the FRA template.
**Why it's wrong:** Past submissions reference that `template_version_id`. Mutating the schema makes it impossible to re-render past submissions accurately.
**Do this instead:** INSERT a new `template_versions` row with `version_number + 1`. Old submissions continue to reference the old version. New assignments use the new version.

---

## Integration Points

| Service | Integration Pattern | Auth | Notes |
|---------|---------------------|------|-------|
| Supabase Auth | `@supabase/ssr` cookie-based, middleware refresh | Anon key + JWT | `middleware.ts` refreshes session on every request |
| Supabase DB | Server Components / Server Actions use server client | Anon key + RLS | Service-role key ONLY in webhook handlers + n8n |
| Supabase Storage | Server Actions for upload; signed URLs for download | Service-role for upload; signed URL for client access | Never expose signed URLs from client-side with service-role |
| n8n Workflows | HTTP POST webhook (code → n8n); HTTP callback (n8n → code) | Shared secret header | `lib/n8n/webhooks.ts` wraps all calls |
| OpenAI (via OpenRouter) | n8n HTTP Request node | OpenRouter API key stored in n8n credential | Code never calls OpenAI directly (ADR 2026-04-15) |
| PayPal Orders v2 | Server Action for order create; Route Handler for webhook | Client ID + Secret (OAuth2) + Webhook ID | Postback verification pattern |
| Twilio SMS | Server Action (synchronous), `lib/notifications/sms.ts` | Account SID + Auth Token | Fire synchronously on document upload; handle errors gracefully |
| SignWell | Server Action for document create; Route Handler for webhook | API Key + HMAC secret | Dual-sign flow (proposal + contract) |

---

## Sources

- [Supabase: Setting up Server-Side Auth for Next.js](https://supabase.com/docs/guides/auth/server-side/nextjs) — `@supabase/ssr` middleware pattern (HIGH confidence)
- [Supabase: Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security) — `auth.uid()` in policies (HIGH confidence)
- [Supabase: Storage Access Control](https://supabase.com/docs/guides/storage/security/access-control) — `storage.foldername()` in storage policies (HIGH confidence)
- [Supabase: RLS Performance and Best Practices](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv) — index requirements for RLS columns (HIGH confidence)
- [PayPal: Verify Webhook Signature](https://developer.paypal.com/docs/api/webhooks/v1/) — postback verification pattern (HIGH confidence)
- [n8n: Idempotent Webhook Retries](https://medium.com/@Modexa/idempotent-webhook-retries-in-n8n-without-duplicates-8380273a95a2) — dedup key pattern (MEDIUM confidence)
- [Supabase: Storage Inefficient Folder Operations](https://supabase.com/docs/guides/troubleshooting/supabase-storage-inefficient-folder-operations-and-hierarchical-rls-challenges-b05a4d) — path-prefix RLS challenges (HIGH confidence)
- [Makerkit: Next.js Server Actions Complete Guide](https://makerkit.dev/blog/tutorials/nextjs-server-actions) — Server Action vs Route Handler decision (MEDIUM confidence)
- [Makerkit: Supabase RLS Best Practices](https://makerkit.dev/blog/tutorials/supabase-rls-best-practices) — production multi-tenant patterns (MEDIUM confidence)

---

*Architecture research for: 888 Safety & Training Platform (multi-tenant compliance SaaS)*
*Researched: 2026-04-15*
