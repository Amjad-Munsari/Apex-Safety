# External Integrations

**Analysis Date:** 2026-04-29

## Current State

The codebase is in early UI prototyping. No backend integration code (API routes, Supabase client, external SDK imports) exists in the application code yet. All integration points described below are **planned** based on the database schema (`supabase/migrations/001_initial_schema.sql`), requirements (`REQUIREMENTS.md`), and configuration files. These are documented here so future phases know what to build toward.

## APIs & External Services

**Supabase (Primary Backend):**
- Purpose: Database, authentication, file storage, real-time
- MCP Server configured: `.mcp.json` points to project ref `lksxdpgkbiuorjdvebdz`
- Client library: Not yet installed (`@supabase/supabase-js` not in `package.json`)
- Auth: Supabase Auth with email/password (admin) and magic-link (clients)
- Region: `eu-west-2` (London) planned for UK GDPR compliance (FOUND-01)
- Connection: Via env vars in `.env.local` (not read; existence confirmed)
- **Action needed:** Install `@supabase/supabase-js`, create `lib/supabase/client.ts` and `lib/supabase/admin.ts` (with `server-only` import per FOUND-02)

**OpenAI / OpenRouter (Planned):**
- Purpose: AI report generation (REPORT-01 to REPORT-12) and proposal text drafting (PROP-03)
- SDK: Not yet installed
- Architecture: Report generation runs via n8n workflows, not directly in the Next.js app
- Proposal generation calls OpenAI via OpenRouter from the app

**PayPal Orders API v2 (Planned):**
- Purpose: Hours balance purchases (PAY-01 to PAY-08)
- SDK: Not yet installed
- Webhook endpoint: `/api/paypal/webhook` (planned)
- Idempotency: `UNIQUE(paypal_order_id)` on `hours_transactions` table (in schema)
- Status: Dev credentials pending (PAY-02)

**SignWell (Planned):**
- Purpose: E-signature for proposals and contracts (PROP-05, CONTRACT-03)
- SDK: Not yet installed
- Webhook endpoint: `/api/esign/webhook` (planned)
- Fields: `proposals.signwell_proposal_doc_id` and `proposals.signwell_contract_doc_id` exist in schema
- Status: Provider confirmation pending from client

**Twilio (Planned):**
- Purpose: SMS notifications for document uploads and expiry alerts (DOCS-03, EXPIRY-05)
- SDK: Not yet installed
- Endpoint: `/api/sms/send` (planned)
- Status: UK sender ID registration needed (OPS-05)

**n8n (Planned External Orchestrator):**
- Purpose: Workflow automation engine running outside the Next.js app
- Workflows planned:
  - Workflow #1: Form submission -> GPT-4 report generation
  - Workflow #2: Universal email sender (report delivery, receipts, notifications)
  - Workflow #3: Daily expiry cron (08:00 UK time) triggered via Vercel cron
  - Workflow #4: Contract generation on proposal signing
  - Workflow #5: Scheduled form assignment (v2)
- Error handling: Failures written to `workflow_errors` table (visible in admin dashboard)

## Data Storage

**Database:**
- PostgreSQL via Supabase
- Connection: Via Supabase client (env vars in `.env.local`)
- Schema: Single migration (`supabase/migrations/001_initial_schema.sql`)
- Tables: `clients`, `admin_users`, `client_users`, `form_templates`, `template_versions`, `form_assignments`, `form_submissions`, `documents`, `hours_transactions`, `services`, `proposals`, `notifications_sent`
- Extensions: `pgcrypto` (for `gen_random_uuid()`)
- Functions: `credit_hours_from_paypal()` (PL/pgSQL, SECURITY DEFINER)
- RLS: Enabled on all tables; admin via `app_metadata.role = 'admin'`, clients scoped to their `client_id`

**File Storage:**
- Supabase Storage (S3-compatible)
- Private buckets: `client-documents`, `reports`, `proposals`, `form-media`
- Public bucket: `brand-assets`
- RLS policies on `storage.objects` using `storage.foldername(name)[1]` for tenant isolation
- Access: Via signed URLs (short-lived)

**Caching:**
- None configured

## Authentication & Identity

**Auth Provider:**
- Supabase Auth (planned, not yet implemented in app code)
- Admin: Email/password sign-in
- Client users: Magic-link invitation (no password at signup, optional password after first sign-in)
- Role enforcement: `admin_users` table membership checked server-side; `app_metadata.role = 'admin'` in JWT for RLS
- Session: Supabase session with refresh tokens

## Monitoring & Observability

**Error Tracking:**
- None (no Sentry, Datadog, etc.)
- n8n workflow errors surface in `workflow_errors` table (planned)

**Logs:**
- Console logging only (no structured logging framework)

## CI/CD & Deployment

**Hosting:**
- Vercel (configured via `vercel.json` with `{"framework": "nextjs"}`)

**CI Pipeline:**
- None detected (no GitHub Actions, no `.github/workflows/`)

**Build:**
- `next build` via Vercel auto-deploy (presumed from Vercel config)

## Environment Configuration

**Required env vars (inferred from `.mcp.json` and requirements):**
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous/public key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (server-only)
- PayPal API credentials (planned)
- SignWell API key (planned)
- Twilio Account SID + Auth Token + From Number (planned)
- OpenRouter API key (planned, for proposal generation)

**Secrets location:**
- `.env.local` (gitignored)
- Vercel environment variables (production)

## Webhooks & Callbacks

**Incoming (Planned):**
- `/api/paypal/webhook` - PayPal `PAYMENT.CAPTURE.COMPLETED` events
- `/api/esign/webhook` - SignWell signature completion events
- n8n webhook triggers for form submission processing

**Outgoing (Planned):**
- Vercel cron -> n8n workflow #3 (daily expiry check)
- Form submission insert -> n8n workflow #1 (report generation)
- Proposal signed -> n8n workflow #4 (contract generation)

## Integration Readiness Summary

| Integration | Package Installed | Client Code | API Routes | Schema Ready |
|------------|-------------------|-------------|------------|--------------|
| Supabase | No | No | No | Yes |
| PayPal | No | No | No | Yes (`paypal_order_id` column) |
| SignWell | No | No | No | Yes (`signwell_*_doc_id` columns) |
| Twilio | No | No | No | Partial |
| OpenAI/OpenRouter | No | No | No | N/A (n8n) |
| n8n | N/A (external) | No | No | Yes (`workflow_errors` planned) |

---

*Integration audit: 2026-04-29*
