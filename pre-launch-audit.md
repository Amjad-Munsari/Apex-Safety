# Pre-Launch Audit — 888 Safety & Training Platform

Audit date: 20 July 2026  
Audited commit: `20b177ee02be8c2c91f8849491862dd05393f72e` (`main`, matching `origin/main`)  
Audit type: Read-only production-readiness review

## Verdict

**DO NOT SHIP.** The application has two launch-blocking security defects: it relies on a vulnerable Next.js proxy for admin authorization, and the database migration exposes a service-role payment-credit function without restricting who can execute it. Several sold or newly confirmed requirements—speech dictation, credits with an editable conversion rate, dependable expiry delivery, and tamper-evident signing—are absent or materially unsafe, while the live Supabase configuration could not be verified.

## Findings

| # | Severity | Area | Finding | Evidence | Required fix |
|---|---|---|---|---|---|
| 1 | **CRITICAL** | Admin authorization | Admin authorization exists only in `proxy.ts`; the admin layout has no second server-side role check. Next 16.2.4 is affected by the App Router proxy bypass through `.rsc` and segment-prefetch routes, after which admin pages query with the service-role client. | `proxy.ts:10`, `lib/supabase/session.ts:76`, `app/admin/layout.tsx:11`, `lib/supabase/admin.ts:5`, `package.json:32`; GHSA-26hh-7cqf-hhc6 | Upgrade Next to at least 16.2.6 and add `requireAdmin()` inside the admin layout and every service-role page/action. |
| 2 | **CRITICAL** | PayPal / credits | `credit_hours_from_paypal` is `SECURITY DEFINER`, accepts arbitrary client/order/value arguments, and has no caller validation or later `REVOKE EXECUTE`. If applied with default function grants, an anon/authenticated caller can credit any client without paying. | `supabase/migrations/001_initial_schema.sql:429` | Revoke execution from `PUBLIC`, `anon` and `authenticated`; grant only `service_role`; fix `search_path`; validate a server-recorded PayPal capture inside one idempotent transaction. |
| 3 | **HIGH** | E-signature integrity | The PDF is hashed when the signing link is sent, but the signing endpoint never re-hashes the current file. Admin regeneration can overwrite the same path after sending, so the hash does not prove which document the signer viewed. | `app/admin/proposals/actions.ts:159`, `app/api/sign/[token]/route.ts:179`, `app/admin/proposals/actions.ts:441` | Make sent PDFs immutable/versioned and compare the exact served bytes at redemption before accepting a signature. |
| 4 | **HIGH** | E-signature failure handling | The proposal becomes `Signed` and the token is consumed before the audit row and stamped PDF are secured. Either operation may fail while the route still returns success and issues a contract. | `app/api/sign/[token]/route.ts:200`, `:245`, `:267`, `:324` | Make signature evidence, signed artefact and lifecycle transition transactional; issue a contract only after all evidence exists. |
| 5 | **HIGH** | Assessment webhook | The assessment n8n request has no authentication header. Missing configuration silently disables it and HTTP 4xx/5xx responses count as success because `response.ok` is not checked. | `app/admin/assessments/actions.ts:449` | Add an HMAC/bearer secret, enforce it in n8n, reject non-2xx responses and log every failure. |
| 6 | **HIGH** | Proposal delivery | A proposal is marked `Sent` even if n8n email delivery fails; failure is only logged to the server console. | `app/admin/proposals/actions.ts:168`, `:195` | Persist delivery state and failure details, surface them in the UI and provide retry. |
| 7 | **HIGH** | Proposal creation | PDF errors are swallowed after creating the proposal row, while the UI reports “Proposal sent & PDF Generated!”. | `app/admin/proposals/actions.ts:345`, `components/proposals/advanced-proposal-builder.tsx:210` | Return a typed partial failure and never show PDF success until the object exists. |
| 8 | **HIGH** | Expiry alerts | The cron selects only exact 30/14/7-day dates. A failed run is not caught up later; dispatch followed by failed dedup insertion can duplicate an alert; the recipient is an arbitrary first client user. | `app/api/cron/expiry/route.ts:45`, `:99`, `:113`, `:151` | Use queued notification jobs with unique document/threshold/recipient keys, retries and an explicit compliance contact. |
| 9 | **HIGH** | Form versioning | Submissions pin and render their original `template_version_id`, but versions are not immutable. Admin/customer policies permit mutation and templates can be deleted with cascading version deletion. | `supabase/migrations/001_initial_schema.sql:57`, `004_form_templates_rls_fixes.sql:43`, `app/admin/templates/actions.ts:294`, `app/admin/assessments/[id]/page.tsx:18` | Forbid update/delete on published or referenced versions and soft-delete templates. |
| 10 | **HIGH** | Risk calculation | A locally chosen 5×5 likelihood × consequence banding is labelled PAS 79 while a `TODO` asks Matt to verify it; the AI prompt calls the result authoritative. | `lib/form-builder/risk/pas79.ts:4`, `:23`, `lib/ai/prompt-builder.ts:64` | Have a competent professional approve/version the matrix, reproduce its legend and remove the “PAS 79 formula” claim. |
| 11 | **HIGH** | Email delivery | SMTP, DKIM, SPF, DMARC alignment, sending domain and `Reply-To` are not represented in code. Live Supabase Auth SMTP was inaccessible, and DNS returned no TXT for the tested `888safety.co.uk` root or `_dmarc` host. | `lib/notifications/n8n-dispatch.ts:116`, `.env.example:26`, `app/login/client/page.tsx:67` | Prove invitation/reset/report/proposal/expiry delivery to Gmail, Outlook and the client domain, with aligned SPF/DKIM/DMARC and monitored replies. |
| 12 | **HIGH** | Test credentials | The repository seeds `admin@test.com` and `user@test.com`; a helper creates `user@test.com` using default password `test123`. Production presence is unverified. | `supabase/seed.sql:132`, `scripts/ensure-client-test-user.mjs:21` | Remove test users/data from production, eliminate the default password and rotate credentials. |
| 13 | **HIGH** | Media capture | Photos are compressed, but saved private Storage paths are rendered directly as `<img src>`, so committed thumbnails normally break. Removing a photo leaves storage/audit orphans. | `hooks/use-media-processor.ts:10`, `components/form-interpreter/multi-photo-field-renderer.tsx:253`, `:295` | Resolve signed preview URLs and delete removed objects/metadata; add progress and retry. |
| 14 | **HIGH** | Build/dependencies | `npm audit` found 15 vulnerabilities: 1 critical, 6 high, 6 moderate and 2 low. Narrow ESLint reported 65 errors/31 warnings, and standalone `tsc` failed on test code. | `package.json:32`, `:58`, `components/admin/admin-search.tsx:10` | Upgrade affected packages and make build, lint, typecheck and tests mandatory CI gates. |
| 15 | **HIGH** | Live infrastructure | The intended Supabase project was unavailable through the authenticated CLI, leaving live migrations, RLS, grants, Storage privacy, Auth SMTP and region **UNVERIFIED**. | `.env.example:4`, `supabase/migrations/001_initial_schema.sql:202`, `vercel.json:1` | Link the real project, compare migrations, export policies/grants/buckets and run live RLS tests. |
| 16 | **MEDIUM** | Login UX | Both login forms call the same Supabase password API, confirming the client report. The client page uses a hardcoded email for its first redirect, but the proxy derives actual role from `admin_users`; page selection does not itself grant authority. | `app/login/admin/page.tsx:17`, `app/login/client/page.tsx:8`, `lib/supabase/session.ts:28` | Use one login page and resolve role server-side. |
| 17 | **MEDIUM** | Manual balances | Matt can adjust hours, but it is a read-then-write operation and ledger insertion is best-effort. Concurrent writes can be lost and the audit lacks actor/reason. | `app/admin/clients/actions.ts:210`, `:236`, `:246` | Use one atomic RPC recording actor, reason, requested and applied deltas. |
| 18 | **MEDIUM** | Error states | Several client pages convert database failures into empty arrays, making outages appear as “no data”. | `app/client/compliance/page.tsx:65`, `reports/page.tsx:41`, `proposals/page.tsx:34` | Show distinct retryable errors with correlation IDs. |
| 19 | **MEDIUM** | Date consistency | Cron uses UTC date equality while the portal uses the current instant and considers exactly 30 days “CURRENT”, so UI and email can disagree. | `app/api/cron/expiry/route.ts:45`, `app/client/compliance/page.tsx:32` | Centralise UK business-date calculation and test BST/GMT boundaries. |
| 20 | **MEDIUM** | Input validation | The public signing endpoint accepts unbounded names/base64 values and checks only a PNG prefix; document upload trusts browser MIME metadata. | `app/api/sign/[token]/route.ts:125`, `lib/documents/actions.ts:14` | Add server schemas, decoded byte limits and magic-byte validation. |
| 21 | **MEDIUM** | Performance | Core lists are unpaginated and expiry processing performs per-document dedup/contact queries. | `app/client/reports/page.tsx:41`, `assignments/page.tsx:13`, `app/api/cron/expiry/route.ts:99` | Add pagination and batch cron work. |
| 22 | **MEDIUM** | GDPR | Assessment answers go through OpenRouter to `openai/gpt-4o-mini`; no privacy notice, retention policy, export or access-audit implementation was found. | `app/admin/assessments/actions.ts:526`, `:545`, `app/admin/clients/actions.ts:139` | Complete the UK GDPR data-flow/DPA, disclose processors, confirm region and define retention/export/deletion/access auditing. |
| 23 | **LOW** | Prototype UI | Branding colours are browser-local despite implying global settings; “All systems operational” and client “demo mode” are hardcoded/nonfunctional. | `components/admin/settings-form.tsx:34`, `app/login/admin/page.tsx:61`, `app/login/client/page.tsx:75` | Persist branding and remove false status/demo copy. |
| 24 | **LOW** | Contracts | The contract list is live, but `/client/contracts/[id]` always returns `notFound()`. | `app/client/contracts/page.tsx:22`, `app/client/contracts/[id]/page.tsx:1` | Implement a tenant-scoped detail page or remove the route. |
| 25 | **SCOPE GAP** | Speech-to-text | Speech recognition is absent. Text controls are ordinary inputs and audio uploads are rejected. | `components/form-interpreter/text-field-renderer.tsx:32`, `textarea-field-renderer.tsx:31`, `app/admin/assessments/actions.ts:723` | Implement speech controls, permission/error states and a typing fallback that never blocks submission. |
| 26 | **SCOPE GAP** | Credits | Hours remain canonical and no credits model or configurable 4:1 rate exists. Multiplying stored hours by an editable rate would retroactively mutate effective balances. | `supabase/migrations/001_initial_schema.sql:15`, `:131`, `lib/settings/app-settings.ts:5` | Store credits canonically, migrate once at 4:1 and record the rate on each future conversion. |
| 27 | **SCOPE GAP** | Offline/PWA | No service worker, IndexedDB queue, background sync, offline indicator or cache invalidation exists. | No implementation under `app/`, `components/`, `lib/` or `public/` | Implement a version-aware local queue or remove offline claims. |
| 28 | **SCOPE GAP** | SMS | No Twilio or SMS implementation exists; notifications use n8n. | `lib/notifications/n8n-dispatch.ts:116`, `package.json:1` | Confirm whether SMS is Phase 1; implement or remove the claim. |
| 29 | **SCOPE GAP** | Contractor Directory | Admin/client directory and RLS exist despite being absent from earlier scope. | `supabase/migrations/024_contractors.sql:9`, `app/client/directory/page.tsx:1` | Obtain written acceptance as a scope addition or remove it from handover. |

## RLS inventory

This is the migration-defined state; live state remains unverified.

| Data set | Actual table | RLS | Repository policies |
|---|---|---|---|
| Clients | `clients` | Enabled | `clients_admin_all`; `clients_own_select` |
| Client users | `client_users` | Enabled | `client_users_admin_all`; `client_users_self_select` |
| Documents | `documents` | Enabled | `documents_admin_all`; `documents_client_own` |
| Assessments | `form_submissions` | Enabled | Admin all; own-tenant select/insert; own draft update with client/status checks |
| Credits/hours | `hours_transactions` | Enabled | `hours_transactions_admin_all`; `hours_transactions_client_own` |
| Proposals | `proposals` | Enabled | `proposals_admin_all`; `proposals_client_visible` |
| Notifications | `notifications_sent` | Enabled | `notifications_sent_admin_select` |
| Templates | `form_templates` | Enabled | Admin all; published master read; customer-own CRUD |
| Versions | `template_versions` | Enabled | Admin all; published read; customer-owned select/insert/update |
| Assignments | `form_assignments` | Enabled | Admin all; own-tenant select/insert/update |

RLS is enabled at `supabase/migrations/001_initial_schema.sql:202`; policy hardening is in migrations `020` and `022`. No requested tenant table lacks RLS in the repository, but all five executable cross-tenant tests were skipped because the required Supabase variables were unavailable (`tests/rls/multi-tenancy.spec.ts:17`).

## Provider, pipeline and storage conclusions

PayPal is the only implemented provider. There are no Stripe SDK imports, routes, checkout sessions, `stripe_session_id` columns or webhook handlers. PayPal creation/capture checks the authenticated client, order ownership, completion state, package, currency and amount, but the unrestricted database RPC underneath defeats that protection.

The actual report path is: authenticated tenant-scoped submission → pinned-schema server validation → direct OpenRouter/OpenAI draft → Matt review → server-side PDF → private Supabase Storage → submission update → seven-day signed URL → n8n delivery. It is not an n8n → OpenAI → PDF pipeline. AI failures enter `workflow_errors`; report delivery failures are logged, but there is no automatic retry or dead-letter queue.

Migrations intend `client-documents`, `reports`, `proposals` and `form-media` to be private, with first path-segment tenant policies. Client downloads normally use signed URLs. Live bucket settings and policies remain unverified.

## Live/demo inventory

| Page | State | Evidence |
|---|---|---|
| Client Dashboard | Live Supabase | `app/client/page.tsx:54` |
| Compliance | Live Supabase | `app/client/compliance/page.tsx:65` |
| Reports | Live Supabase | `app/client/reports/page.tsx:26` |
| Billing | Live Supabase/PayPal | `app/client/billing/page.tsx:13` |
| Proposals | Live Supabase | `app/client/proposals/page.tsx:24` |
| Contracts list | Live Supabase | `app/client/contracts/page.tsx:22` |
| Contract detail | Placeholder/404 | `app/client/contracts/[id]/page.tsx:1` |
| Assessments | Live Supabase | `app/client/assignments/page.tsx:9` |
| My Templates | Live Supabase | `app/client/templates/page.tsx:8` |
| Contractor Directory | Live Supabase | `app/client/directory/page.tsx:1` |
| Admin Notifications | Live `notifications_sent` | `app/admin/notifications/page.tsx:35` |
| Admin branding colours | Browser-local demo state | `components/admin/settings-form.tsx:34` |

The documents claiming the whole client portal uses hardcoded fixtures are outdated.

## Form builder field types

The active palette has eleven types: Short Text, Number, Date, Select, Long Text, Checkbox, Section, Photos, Location, Computed and Repeating Section (`components/form-builder/field-palette.tsx:40`, `lib/form-builder/index.ts:3`). Signature and Rating are not registered; documentation listing either is wrong.

## Launch blockers

1. Upgrade Next and enforce server-side authorization inside every protected layout/page/action.
2. Revoke public execution of `credit_hours_from_paypal` and prove the anonymous exploit fails.
3. Connect the actual Supabase project and prove live RLS, grants and private Storage with two tenants.
4. Implement canonical credits, one-time 4:1 conversion and atomic audited manual adjustment.
5. Implement the sold speech-to-text workflow with a typing fallback.
6. Repair e-signature immutability and transactional evidence.
7. Make report, proposal and expiry delivery failures visible and retryable.
8. Prove production email authentication and deliverability.
9. Remove production test users/default passwords and rotate deployment credentials.
10. Clear dependency, lint, typecheck and production-build gates.

## Documentation/reality mismatches

- Both login forms accept any valid Supabase account; role separation happens after authentication.
- Stripe is absent; PayPal is implemented.
- Credits and an editable 4:1 rate are absent; hours remain canonical.
- Proposal/contract balances are separate, matching Finley’s latest clarification.
- Speech-to-text is absent.
- Third-party signing is absent; first-party signing exists, but its tamper-evident claim is unsupported.
- Core portal pages are live, not demo fixtures.
- Signature and Rating builder fields are inactive; Computed Field is active.
- The “PAS 79 formula” is a project-defined matrix awaiting approval.
- Next.js calls OpenRouter/OpenAI directly; n8n is not the AI orchestrator.
- Assessment data goes through OpenRouter, not directly to OpenAI alone.
- Twilio/SMS and offline/PWA functionality are absent.
- Contractor Directory exists outside earlier scope.
- “All systems operational” and “demo mode” login copy are false/static.

## Open client decisions

- Is self-serve PayPal still required, or will Matt assign all credits after offline conversations?
- Must rate edits affect only future conversions? Historical balances should remain unchanged.
- Should speech use browser Web Speech, server transcription, or both?
- Is hardened first-party signing acceptable, or is a third-party provider required?
- Are offline forms and SMS Phase 1?
- Which client user is the designated compliance-alert recipient?
- What risk matrix and wording has Matt professionally approved?
- Is Contractor Directory an accepted scope addition?
- What is the sending domain, monitored reply mailbox and retention policy?

## Executable Test Plan

### Required staging fixtures

Create these accounts in staging with email confirmed, then delete them after testing. Never create these credentials in production.

| Role | Email | Temporary password | Mapping |
|---|---|---|---|
| Admin | `audit.admin@example.test` | `888-Audit-Admin!2026-Delete` | `admin_users` row |
| Client A | `audit.client.a@example.test` | `888-Audit-A!2026-Delete` | `Audit Tenant A Ltd` |
| Client B | `audit.client.b@example.test` | `888-Audit-B!2026-Delete` | `Audit Tenant B Ltd` |

For each tenant create one uniquely named compliance PDF, submitted assessment, proposal, contract and customer template. Create documents expiring in exactly 30, 14 and 7 UK calendar days. Record every generated Client, Document, Submission, Assignment, Proposal and Template UUID on a fixture sheet.

### Security and isolation

#### SEC-01 — Login matrix

**Preconditions:** All three accounts.  
**Steps:** Try Client A at both login pages, then the admin at both pages.  
**Expected:** Client A always finishes on `/client`; admin always finishes on `/admin`; no client sees admin content.  
**Severity:** CRITICAL.

#### SEC-02 — Direct admin URLs

**Preconditions:** Client A logged in.  
**Steps:** Open `/admin`, `/admin/clients`, `/admin/assessments`, `/admin/compliance`, `/admin/proposals` and `/admin/notifications`.  
**Expected:** Every request redirects before any admin content appears.  
**Severity:** CRITICAL.

#### SEC-03 — Next transport bypass

**Preconditions:** Signed out; terminal available.  
**Steps:** Run:

```bash
curl -i https://fire-safety-platform.vercel.app/admin.rsc \
  -H 'RSC: 1' \
  -H 'Next-Router-Prefetch: 1'

curl -i 'https://fire-safety-platform.vercel.app/admin?_rsc=audit' \
  -H 'RSC: 1' \
  -H 'Next-Router-Prefetch: 1'
```

**Expected:** Redirect/unauthorized only, with no client data or RSC admin payload.  
**Severity:** CRITICAL.

#### SEC-04 — Cross-tenant URL IDOR

**Preconditions:** Client A logged in; Tenant B UUIDs available.  
**Steps:** Put B’s UUIDs into `/client/assignments/<ID>`, `/client/assignments/<ID>/submission`, `/client/proposals/<ID>` and every copied report/document URL.  
**Expected:** 404, denial or redirect; no metadata, answers or signed URLs.  
**Severity:** CRITICAL.

#### SEC-05 — Cross-tenant REST

**Preconditions:** Supabase URL, anon key, Client A access token and B IDs.  
**Steps:** Run:

```bash
curl "$SUPABASE_URL/rest/v1/documents?id=eq.$B_DOCUMENT_ID&select=*" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $CLIENT_A_TOKEN"

curl "$SUPABASE_URL/rest/v1/form_submissions?id=eq.$B_SUBMISSION_ID&select=*" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $CLIENT_A_TOKEN"
```

**Expected:** Both return `[]`.  
**Severity:** CRITICAL.

#### SEC-06 — Unpaid-credit RPC

**Preconditions:** Staging only; Tenant A ID and anon key.  
**Steps:** Record the balance, then run:

```bash
curl -i "$SUPABASE_URL/rest/v1/rpc/credit_hours_from_paypal" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  --data "{\"p_client_id\":\"$A_CLIENT_ID\",\"p_order_id\":\"UNPAID-AUDIT-001\",\"p_hours\":1,\"p_gbp\":0}"
```

**Expected:** 401/403 and no balance/ledger change. Current repository code is expected to fail until fixed.  
**Severity:** CRITICAL.

#### SEC-07 — Storage isolation

**Steps:** Open a B raw object URL unauthenticated, open its signed URL as A, then retry after expiry.  
**Expected:** Raw and cross-tenant access denied; expired URLs denied.  
**Severity:** CRITICAL.

#### SEC-08 — Admin API

**Steps:** As Client A, open `/api/admin/search?q=Audit%20Tenant%20B`.  
**Expected:** HTTP 401 and no result.  
**Severity:** CRITICAL.

### Credits and PayPal

#### PAY-01 — Purchase

Use a dedicated PayPal sandbox buyer. Cancel one order, complete another and retry capture twice. Expected: cancellation gives no balance, completion gives exactly one ledger/balance movement, and replay gives nothing. **Severity:** CRITICAL for unpaid/duplicate credit.

#### PAY-02 — Tampering

Alter the package ID and attempt to capture another tenant’s order. Expected: both rejected. **Severity:** CRITICAL.

#### CRD-01 — Manual credits

Add 20 credits with reason “Offline purchase 20 July”, deduct 3 and attempt an over-deduction. Expected: atomic balance/ledger writes capturing Matt, time, applied amount and reason. **Severity:** HIGH.

#### CRD-02 — Rate history

Change the rate from 4 to 5 after a 4:1 transaction. Expected: historical balances/transactions remain unchanged; new conversions record 5:1. **Severity:** HIGH.

### Assessments and reports

#### AST-01 — Speech/fallback

On Chrome/iPad Safari and Firefox mobile, dictate into text fields, deny permission, disable network, then type and submit. Expected: supported transcription is editable; unavailable speech has a clear fallback; typing/submission always work. **Severity:** HIGH.

#### AST-02 — Mobile photos

Upload five 10–15 MB phone images over mobile data, reload, remove one and submit. Expected: progress, compression, persistent thumbnails, deletion cleanup and successful submission. **Severity:** HIGH.

#### RPT-01 — Full report

Submit A’s assessment, wait for AI, review/edit, finalize and download as both roles. Expected: one draft, consistent server PDF, completed state, private signed download and one email. **Severity:** HIGH.

#### RPT-02 — Failure recovery

Disable OpenRouter, Storage and n8n one at a time in staging. Expected: AI becomes `ai_draft_failed` with retry; Storage never marks completed; n8n leaves the PDF but clearly flags delivery failure with retry. **Severity:** HIGH.

### Proposals, signing and contracts

#### SIG-01 — Document integrity

Send a proposal, save its PDF, regenerate/replace it, then redeem the original signing link. Expected: signing rejected because the document hash changed. Current code is expected to fail. **Severity:** HIGH.

#### SIG-02 — Evidence failure

Force signature-row insertion or stamping to fail. Expected: no Signed state and no contract until evidence is persisted. Current code is expected to fail. **Severity:** HIGH.

#### SIG-03 — Token controls

Sign once, reuse the link, use an expired link and send an oversized fake PNG data URL. Expected: success once, then 409; expiry 410; invalid/oversized image 400. **Severity:** HIGH.

### Alerts and email

#### ALT-01 — Threshold/dedup

Run expiry twice for the 30/14/7 fixtures. Expected: exactly one alert and notification row per document/threshold/recipient. **Severity:** HIGH.

#### ALT-02 — Recovery/timezone

Skip the exact 30-day run and run next day, including a BST transition date. Expected: missed alert caught up once and portal/email agree. **Severity:** HIGH.

#### EML-01 — Deliverability

Send invitation, reset, report, proposal and expiry messages to Gmail, Outlook and the client domain. Expected: inbox delivery, SPF/DKIM/DMARC aligned and replies reach a monitored mailbox. **Severity:** HIGH.

### Form builder

#### FRM-01 — Version preservation

Complete a v1 submission, publish a materially changed v2, reopen v1, then try deleting v1/template. Expected: v1 renders exactly and cannot be mutated/deleted. **Severity:** HIGH.

#### FRM-02 — Palette/ownership

Submit all eleven active types, fork a master and create a customer template. Expected: every active type works, customer edits create an owned fork, Matt’s master remains unchanged and Signature/Rating are not advertised. **Severity:** HIGH.

### UX and offline

#### UX-01 — Offline

Enter answers on iPad, disconnect, reload, submit and reconnect. Expected if in scope: visible local-save state and exactly-once sync against the same schema version. Until implemented, the app must say connectivity is required. **Severity:** HIGH if sold.

#### UX-02 — Mobile/accessibility

Complete every type on iPad/Surface, keyboard-only and screen reader at 200% zoom. Expected: no clipping, 44 px touch targets, visible focus, labels/errors and announced status. **Severity:** MEDIUM.

#### UX-03 — Empty versus outage

Open every client module with zero data, then deny DB access. Expected: truthful empty states versus distinct retryable outage errors. **Severity:** MEDIUM.

### Pre-Go-Live

#### GO-01 — Cleanup and rotation

Search Auth and all tenant tables for `admin@test.com`, `user@test.com`, `Demo Client`, `Merlin`, `Yellow Broom`, `test123`, `example.test` and audit fixtures. Delete them and rotate Supabase service role, OpenRouter, PayPal, n8n, cron and Vercel credentials. Expected: no test data and old privileged credentials fail. **Severity:** CRITICAL.

#### GO-02 — Live database proof

Link production Supabase, list migrations, export policies/grants/buckets and run the five RLS tests without skips. Expected: migration parity, private buckets, service-role-only credit RPC and five passing tests. **Severity:** CRITICAL.

#### GO-03 — Live PayPal

After RPC hardening, make and reconcile the smallest real purchase. Expected: one charge, one immutable credit transaction and no sandbox endpoint. **Severity:** CRITICAL.

#### GO-04 — Release gates

Run `npm audit`, `npm run lint`, `npx tsc --noEmit`, `npm test` and `npm run build` with production-shaped environment variables. Expected: no critical/high production advisories, zero lint/type errors, no skipped RLS tests, passing tests/build. **Severity:** HIGH.

#### GO-05 — Acceptance pack

Run the entire plan against the release candidate and retain screenshots, email headers, DB exports and results. Expected: no CRITICAL/HIGH failure and evidence for every live configuration. **Result if it fails:** DO NOT SHIP.

## Audit execution record

- `npm test -- --reporter=verbose`: 70 files; 597 passed, 5 skipped, 3 todo. The five RLS tests were skipped for missing live Supabase variables.
- `npx tsc --noEmit`: failed on test TypeScript errors.
- Narrow application ESLint: 65 errors and 31 warnings.
- `npm audit --json`: 15 vulnerabilities—1 critical, 6 high, 6 moderate, 2 low.
- `npm run build`: compiled and type-checked, then failed page-data collection because no local Supabase URL was available.
- Vercel deployment: Ready; alias `fire-safety-platform.vercel.app`.
- Supabase live policies, Storage, region and SMTP: **UNVERIFIED**.
- Repository secret scan: no current real API key found; `.env*` is ignored except `.env.example` (`.gitignore:34`).
- No application code was modified during the audit.
