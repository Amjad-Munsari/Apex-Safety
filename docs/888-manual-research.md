# 888 Safety & Training — Manual Research Brief

**Research snapshot:** 26 July 2026
**Source basis:** current application source and migrations, plus live production, database, and n8n checks completed on 25–26 July 2026
**Production URL:** `https://www.merlinsafetysystem.com`

This brief is the evidence layer for `docs/888-user-testing-manual.md`. It was derived from the current application code, committed migrations, configuration, the latest production handoff, and production-state checks on 25–26 July 2026. Earlier user guides and proposal documents were not used as behavioural sources. The 20 July production-readiness audit was used only as a checklist, then every finding was rechecked against the current checkout and, for partner automation, the live n8n workspace.

## State labels

| Label | Meaning in this brief |
|---|---|
| **Live** | The screen and its core read/write path are implemented against the live data store. This does not claim that every external dependency is production-ready. |
| **Partial** | The main path exists, but a material branch, failure state, safety control, or operational dependency remains unfinished or unproven. |
| **Staged (not live)** | Code or configuration exists in the current source set but is not part of a deployed, confirmed path. |
| **Not built** | No working implementation exists in the repository. |

## Corrections to older documentation and audit findings

| Claim to correct | Current ground truth | State and evidence |
|---|---|---|
| Payments use Stripe. | The only checkout implementation is PayPal Orders v2. Package price, currency, buyer organisation, completion state, and order identity are checked on the server before credits are added. | **Partial:** the flow is built, but production credentials currently fail PayPal authentication. `lib/paypal.ts:14-27`; `app/api/paypal/create-order/route.ts:16-68`; `app/api/paypal/capture-order/route.ts:60-172`; `HANDOFF.md:109-117` |
| The client portal is hardcoded demo data. | The dashboard, compliance documents, reports, billing ledger, assignments, templates, proposals, contracts list, and directory all query the signed-in organisation's live rows. | **Live:** examples at `app/client/page.tsx:54-87`; `app/client/compliance/page.tsx:66-88`; `app/client/reports/page.tsx:27-79`; `app/client/billing/page.tsx:14-39` |
| Speech-to-text exists. | Text fields are ordinary typed inputs. Audio is explicitly rejected by the upload action, and the review panel is now labelled “Raw Answers.” | **Not built:** `components/form-interpreter/text-field-renderer.tsx:32-62`; `components/form-interpreter/textarea-field-renderer.tsx:31-49`; `app/admin/assessments/actions.ts:555-559`; `app/admin/assessments/[id]/review/review-client.tsx:254-262` |
| n8n calls OpenAI and produces the report. | The application sends answers directly to OpenRouter using `openai/gpt-4o-mini`, stores the structured draft, lets Matt edit it, and generates the PDF on the server. | **Live, dependent on OpenRouter:** `lib/reports/report-draft.ts:22-112`; `app/admin/assessments/actions.ts:729-876` |
| n8n sends all customer email. | Ten transactional email types are sent directly through Resend. n8n sends four internal notices to Matt: client template created, client form submitted, client template customised, and Matt-led assessment submitted. | **Live:** both production webhooks authenticate, validate their event, retry Gmail up to three times, and return success only after Gmail accepts the message. The matching application secrets are deployed, and all four exact production payloads returned the terminal delivery receipt on 26 July 2026. The application treats any other response as a failure and attempts to write Workflow Errors; those audit writes are best-effort, and a missing assessment URL is skipped. `lib/notifications/email-templates.ts:21-33`; `lib/notifications/dispatch.ts:235-309`; `lib/notifications/client-form-events.ts:28-72`; `app/admin/assessments/actions.ts:431-471`; `docs/n8n/workflows/email-notifications.json:1-118`; `docs/n8n/workflows/assessment-report-notifications.json:1-125`; `HANDOFF.md:143` |
| The application needs SMTP to send its account and workflow email. | The current account actions generate invite/recovery links themselves and dispatch them through Resend, which also sends the other application emails. SMTP is not the active application transport. | **Live:** email delivery is owner-confirmed operational as of 25 July 2026. Individual send failures are recorded rather than silently treated as delivery. `app/admin/clients/actions.ts:420-455`; `app/admin/clients/actions.ts:458-562`; `app/login/forgot/actions.ts:42-72`; `lib/notifications/dispatch.ts:180-219` |
| Stored balance is hours and the editable 4:1 credits model is absent. | This became stale after migration 026. Balances and ledger movements are now stored as whole credits. The legacy column names remain, and the default editable reference rate is four credits per hour. Rate changes do not alter existing balances. | **Live:** `supabase/migrations/026_credits_model.sql:4-18`; `supabase/migrations/026_credits_model.sql:50-57`; `components/admin/settings-form.tsx:214-237`; `app/admin/clients/actions.ts:307-376` |
| The PayPal credit function is publicly callable. | The public, anonymous, and ordinary signed-in roles were revoked; only the server role may call either balance-moving function. The latest production handoff records live denial probes. | **Resolved:** `supabase/migrations/025_revoke_credit_hours_from_paypal_public.sql:21-26`; `supabase/migrations/026_credits_model.sql:123-130`; `supabase/migrations/027_credit_hours_from_paypal_search_path.sql:46-53`; `HANDOFF.md:64-66` |
| The form builder has Signature and Rating fields. | The active palette has exactly 11 types: Short Text, Number, Date, Select, Long Text, Checkbox, Section, Photos, Location, Computed, and Repeating Section. Signature and Rating were removed from registration. | **Live:** `components/form-builder/field-palette.tsx:19-53`; `lib/form-builder/index.ts:16-30` |
| Customers cannot create or fork templates. | Customers can build an organisation-owned template from scratch, and can fork an assigned master before filling it. The fork points back to the master through `parent_template_id`; Matt can inspect customer templates read-only. | **Partial:** both user flows work, but create-from-scratch does not check whether its initial blank-version insert succeeded before returning and sending the activity notice. Fork creation does check every write. `supabase/migrations/003_form_template_customer_ownership.sql:12-33`; `supabase/migrations/003_form_template_customer_ownership.sql:43-92`; `app/client/templates/actions.ts:49-85`; `app/client/assignments/actions.ts:483-536`; `app/admin/templates/[id]/page.tsx:25-57` |
| Signing uses DocuSign, SignWell, or PandaDoc. | Signing is first-party. A public, single-use link shows the proposal and accepts a drawn or typed signature after the signer accepts the terms. | **Live with a legal/process decision still required:** `components/sign/sign-flow.tsx:243-320`; `components/sign/sign-flow.tsx:322-377`; `app/api/sign/[token]/route.ts:229-328` |
| Signing overwrites the exact PDF whose hash was recorded. | The endpoint re-downloads and verifies the original PDF, creates and stores a content-addressed stamped copy, then consumes the token, advances the proposal, links the stamped file, and inserts the evidence row in one database transaction. A failed preparation leaves the token unused; a failed commit removes the uncommitted stamped file. | **Resolved for new signatures; migrations 029, 032, and 033 are applied in production:** `app/api/sign/[token]/route.ts:169-304`; `supabase/migrations/032_atomic_proposal_signature_redemption.sql:1-99`; `supabase/migrations/033_sent_proposal_immutability.sql:1-40` |
| Expiry alerts only fire on exact days and never catch up. | The current job scans a range, chooses the smallest crossed 30/14/7/expired window, sends to the organisation's designated contact, uses a provider idempotency key, retries failed sends, and records an audit-write failure. | **Resolved:** `app/api/cron/expiry/route.ts:50-97`; `app/api/cron/expiry/route.ts:108-197`; `lib/notifications/expiry-window.ts:1-35` |
| Admin protection exists only in the route proxy. | Both protected layouts repeat the server-side role check, and the audited application dependency was upgraded from 16.2.4 to 16.2.11. | **Resolved in this release:** `app/admin/layout.tsx:18-22`; `app/client/layout.tsx:16-21`; `package.json:32`; `package.json:54-59` |
| Contractor Directory is not part of the build. | Matt can manage contractors and clients can browse active, non-deleted entries. | **Live code, empty production data:** `app/admin/directory/page.tsx:11-41`; `lib/data/contractors-server.ts:45-82`; `supabase/migrations/024_contractors.sql:9-48`; `HANDOFF.md:52-55` |

The active Select renderer accepts one choice. The deployed palette description is “Single choice from list” (`components/form-builder/field-palette.tsx:41-48`; `components/form-interpreter/select-field-renderer.tsx:39-60`).

## Route inventory

There is no `/portal/*` route tree. `/login` is the client sign-in, `/login/admin` is the operator sign-in, and `/login/client` only redirects old bookmarks to `/login` (`app/login/client/page.tsx:1-7`).

### Admin console

| Route | What it actually renders and where the data comes from | State | Evidence |
|---|---|---|---|
| `/admin` | Live client list, compliance counts, expiries, proposals, report review queue, monthly headline, and workflow errors. | **Live** | `app/admin/page.tsx:22-52`; `lib/supabase/dashboard.ts:4-78` |
| `/admin/clients` | Live client organisations with document RAG, credit balance, proposal state, and outstanding assignments. | **Live** | `app/admin/clients/page.tsx:10-40`; `app/admin/clients/page.tsx:43-116` |
| `/admin/clients/[id]` | One organisation with Contacts, Documents, Compliance, Assessments, Reports, Proposals, Credits, Assigned Forms, and Access tabs. | **Live** | `app/admin/clients/[id]/page.tsx:20-67`; `app/admin/clients/[id]/client-tabs.tsx:264-289` |
| `/admin/compliance` | All stored compliance documents, split into Current, Expiring, Expired, and No Expiry Date, with an upload action. | **Live** | `app/admin/compliance/page.tsx:33-75`; `app/admin/compliance/page.tsx:77-120` |
| `/admin/expiries` | Documents expiring within 30 days or already overdue, with a manual reminder button. It is not in the sidebar. | **Live** | `app/admin/expiries/page.tsx:9-26`; `app/admin/expiries/page.tsx:42-85` |
| `/admin/assessments/new` | Starts a new assessment for an active client using the latest published version of an eligible template. | **Live, blocked by empty production templates** | `app/admin/assessments/new/page.tsx:18-89`; `app/admin/assessments/actions.ts:41-112`; `HANDOFF.md:52-55` |
| `/admin/assessments/[id]` | The live fill screen for an assessment submission using its pinned template version. | **Live** | `app/admin/assessments/[id]/page.tsx:21-54` |
| `/admin/assessments/[id]/view` | Read-only view of saved answers against the pinned template version. | **Live** | `app/admin/assessments/[id]/view/page.tsx:21-41` |
| `/admin/assessments/[id]/review` | Raw answers, editable AI report draft, retry/regenerate, and the final approval action. | **Live, AI-dependent** | `app/admin/assessments/[id]/review/page.tsx:17-30`; `app/admin/assessments/[id]/review/review-client.tsx:160-212` |
| `/admin/review-queue` | Awaiting-review and completed report lists. It is reached from the dashboard rather than the sidebar. | **Live** | `app/admin/review-queue/page.tsx:20-31`; `app/admin/review-queue/page.tsx:72-127` |
| `/admin/assignments` | Filterable live assignment queue; Matt can edit due dates/instructions or revoke unfinished work. It is not in the sidebar. | **Live** | `app/admin/assignments/page.tsx:117-150`; `app/admin/assignments/page.tsx:175-288` |
| `/admin/proposals` | Four-column live pipeline: Draft, Sent, Signed, Contract Issued. | **Live** | `app/admin/proposals/page.tsx:7-18`; `app/admin/proposals/page.tsx:69-119` |
| `/admin/proposals/new` | Active-client and active-service proposal builder with AI scope drafting, VAT calculation, PDF generation, draft save, and send. | **Partial** | `app/admin/proposals/new/page.tsx:11-41`; `components/proposals/advanced-proposal-builder.tsx:161-229`; `app/admin/proposals/actions.ts:216-384` |
| `/admin/proposals/[id]` | Proposal detail, current PDF, status action, service lines, and issued contract PDF when present. | **Live** | `app/admin/proposals/[id]/page.tsx:31-69`; `app/admin/proposals/[id]/page.tsx:149-210` |
| `/admin/hours` | Despite the legacy route name, this is the live credit-balance overview. It is not in the sidebar. | **Live** | `app/admin/hours/page.tsx:8-20`; `app/admin/hours/page.tsx:23-88` |
| `/admin/month-summary` | Live counts and recent rows for the current UTC month. | **Live** | `app/admin/month-summary/page.tsx:9-60`; `app/admin/month-summary/page.tsx:69-123` |
| `/admin/templates` | Matt's masters and customer-owned templates, split by owner. | **Live, empty production data** | `app/admin/templates/page.tsx:9-46`; `HANDOFF.md:52-55` |
| `/admin/templates/[id]` | Full builder for Matt-owned templates; read-only inspection for customer-owned templates; assignment action for Matt's templates. | **Live** | `app/admin/templates/[id]/page.tsx:14-57` |
| `/admin/services` | Live CRUD catalogue used as proposal line items; inactive items remain visible to Matt and are hidden from new proposals. | **Live code, empty production data** | `app/admin/services/page.tsx:19-55`; `lib/data/services-server.ts:47-66`; `HANDOFF.md:52-55` |
| `/admin/directory` | Live CRUD directory grouped by contractor category. | **Live code, empty production data** | `app/admin/directory/page.tsx:11-41`; `lib/data/contractors-server.ts:45-59`; `HANDOFF.md:52-55` |
| `/admin/notifications` | The latest 200 successful automated and manually triggered expiry-reminder ledger rows. It is not a complete outbox for every email or n8n event. | **Live but narrow** | `app/admin/notifications/page.tsx:31-47`; `app/admin/compliance/actions.ts:44-115` |
| `/admin/settings` | Stored logo, practice-wide portal colours, reminder toggles, credits reference rate, theme, saved future email-brand labels, and a link to workflow errors. | **Partial:** portal branding persists across devices, while the current email From/brand still comes from deployment settings. | `app/admin/settings/page.tsx:10-44`; `app/admin/settings/actions.ts:27-78`; `app/admin/layout.tsx:30-44`; `app/client/layout.tsx:23-33` |
| `/admin/errors` | The 50 most recent recorded workflow errors, rendered read-only. There is no retry or resolve control. | **Live but read-only** | `app/admin/errors/page.tsx:8-35`; `app/admin/errors/page.tsx:35-74` |

The admin sidebar exposes Dashboard, Clients, Compliance, Proposals, Workflow Errors, Month Summary, Form Templates, Service Catalog, Contractors, Notifications, and Settings. Assessments, reports, assignments, credit overview, and expiries are reached from dashboards, client records, or direct links (`components/app-sidebar.tsx:30-45`).

### Client portal

| Route | What it actually renders and where the data comes from | State | Evidence |
|---|---|---|---|
| `/client` | The signed-in organisation's compliance totals, urgent documents, and credit balance. | **Live** | `app/client/page.tsx:54-87`; `app/client/page.tsx:89-150` |
| `/client/compliance` | The organisation's stored documents, grouped by category, with view/download links. | **Live** | `app/client/compliance/page.tsx:66-88`; `app/client/compliance/page.tsx:92-115` |
| `/client/reports` | Report-stage assessments whose draft is ready, failed, or completed; work still at `submitted` is excluded while drafting runs. Final rows can download the stored PDF. | **Live** | `app/client/reports/page.tsx:27-79`; `app/client/reports/actions.ts:17-47` |
| `/client/billing` | Current credit balance, last 50 ledger movements, and the PayPal package selector. | **Partial: live data, checkout blocked by credentials** | `app/client/billing/page.tsx:14-39`; `lib/billing/packages.ts:26-30`; `HANDOFF.md:109-117` |
| `/client/assignments` | Active and completed assigned forms for the organisation. This is the Forms → Assessments navigation destination. | **Live** | `app/client/assignments/page.tsx:9-27`; `app/client/assignments/page.tsx:44-101` |
| `/client/assignments/[id]` | Assignment instructions, due date, and the choice to fill the assigned version or customise it first. | **Live** | `app/client/assignments/[id]/page.tsx:91-150` |
| `/client/assignments/[id]/fill` | Resumable fill using the assignment's pinned template version, with signed photo previews and complete removal of the stored photo and its audit row. | **Live** | `app/client/assignments/actions.ts:98-178`; `app/client/assignments/[id]/fill/page.tsx:21-61`; `components/form-interpreter/multi-photo-field-renderer.tsx:150-173`; `components/form-interpreter/multi-photo-field-renderer.tsx:282-303` |
| `/client/assignments/[id]/submission` | Read-only submitted answers rendered against the pinned template. | **Live** | `app/client/assignments/[id]/submission/page.tsx:35-81` |
| `/client/templates` | Customer-owned templates created from scratch or forked from an assignment. | **Live** | `app/client/templates/page.tsx:8-25`; `app/client/templates/page.tsx:44-78` |
| `/client/templates/[id]` | The form builder for a template owned by the signed-in organisation. | **Live** | `app/client/templates/[id]/page.tsx:13-31`; `app/client/templates/actions.ts:89-138` |
| `/client/templates/[id]/fill` | Self-fill a published customer template without an assignment. | **Live** | `app/client/templates/actions.ts:254-332`; `app/client/templates/[id]/fill/page.tsx:30-63` |
| `/client/proposals` | Sent, Signed, and Contract Issued proposals for the organisation; Drafts are hidden. | **Live** | `app/client/proposals/page.tsx:24-59` |
| `/client/proposals/[id]` | Tenant-scoped proposal view/download and Accept & Sign action while the proposal is Sent. | **Live** | `app/client/proposals/[id]/page.tsx:21-85`; `app/client/proposals/[id]/page.tsx:115-180` |
| `/client/contracts` | Issued contract PDFs derived from proposals whose status is Contract Issued. | **Live list** | `app/client/contracts/page.tsx:22-42`; `app/client/contracts/page.tsx:46-95` |
| `/client/contracts/[id]` | Tenant-scoped issued-contract detail with embedded one-hour view link, download link, service summary, total, and issued date. | **Live** | `app/client/contracts/[id]/page.tsx:24-78`; `app/client/contracts/[id]/page.tsx:80-158` |
| `/client/directory` | Active, non-deleted approved contractors. | **Live code, empty production data** | `app/client/directory/page.tsx:6-27`; `lib/data/contractors-server.ts:62-82`; `HANDOFF.md:52-55` |
| `/client/assessments` | A second live submission-history view with simplified Scheduled/In Progress/Submitted/Completed labels. It is not the main navigation destination. | **Live but overlapping** | `app/client/assessments/page.tsx:23-63`; `app/client/assessments/status.ts:31-40` |
| `/client/assessments/[id]` | Detail/status page for a tenant-scoped submission and final-report actions when completed. | **Live** | `app/client/assessments/[id]/page.tsx:48-87`; `app/client/assessments/[id]/page.tsx:130-169` |

The client portal's visible navigation is Dashboard, Documents → Compliance/Reports, Forms → Assessments/Templates, Agreements → Proposals/Contracts, Directory, and Billing. It changes to a menu on smaller screens (`app/client/_components/client-portal-nav.tsx:26-56`; `app/client/_components/client-portal-nav.tsx:85-130`).

## Real data flows

### Assessment to report

1. Matt starts an assessment for an active client and published template. The application creates an assignment and a draft submission pinned to that exact template version (`app/admin/assessments/actions.ts:41-112`).
2. Matt or the client fills the pinned form. On final submit, the server validates the answers, enforces required fields, removes answers hidden by conditional rules, and saves the submission as `submitted` (`app/admin/assessments/actions.ts:261-418`; `app/client/assignments/actions.ts:221-350`).
3. The deployed application schedules the same background report task after Matt submits, after a client completes an assignment, and after a client self-fills its own template. It sends the cleaned answers directly to OpenRouter using `openai/gpt-4o-mini`. Success stores a structured draft and changes the status to `draft_ready_for_review`; failure records a workflow error and changes it to `ai_draft_failed` (`lib/reports/report-draft.ts:22-164`; `app/admin/assessments/actions.ts:417-422`; `app/client/assignments/actions.ts:331-366`; `app/client/templates/actions.ts:475-508`).
4. Matt opens Review Report Draft, compares the source answers with the generated text, edits the summary, status, and hazards, or regenerates. None of that creates a final report until he selects **Approve & Generate PDF** (`app/admin/assessments/[id]/review/review-client.tsx:244-395`).
5. Approval creates a PDF on the server, stores it privately, saves the approved text, changes the submission to `completed`, emails a seven-day link, and returns a five-minute link for Matt. A failed email does not roll back the final PDF; it creates a workflow error (`app/admin/assessments/actions.ts:729-876`).
6. The client sees live draft/failure/final status in Reports and can request a five-minute view or download link only for its own stored report (`app/client/reports/page.tsx:39-70`; `app/client/reports/actions.ts:17-47`).

The client-to-report handoff defect is fixed and deployed: both client submission paths call the shared report scheduler after the `submitted` write succeeds (`app/client/assignments/actions.ts:331-366`; `app/client/templates/actions.ts:475-508`; `lib/reports/report-draft.ts:140-164`).

The assessment n8n webhook is separate from AI generation and fires only when Matt submits through the admin assessment action. The application posts `{ submissionId }` with a bearer secret, allows 15 seconds, and requires both `ok: true` and `delivered: true` in the final JSON receipt. It attempts a Workflow Error write for a missing secret, rejection, timeout, incomplete success, or network failure, but it returns without either a send or an error row when the webhook URL is absent; the URL is present in production (`app/admin/assessments/actions.ts:431-471`; `lib/notifications/dispatch.ts:238-267`; `tests/scheduler/n8n-assessment-webhook.test.ts:186-202`). The live n8n workflow authenticates the request, rejects a missing ID with `422`, retries Gmail up to three times, sends one fixed admin email to `888FST@proton.me`, and returns its success receipt only after Gmail accepts the send (`docs/n8n/workflows/assessment-report-notifications.json:1-125`; `docs/n8n/workflows/assessment-report-notifications.json:127-178`). n8n permits a 30-second execution, so the application can record a 15-second timeout while n8n continues and later sends; there is no application retry. The workflow does not query the submission, contact a client, generate AI content, create a PDF, or back up to Drive.

### Assigned forms and customer templates

Matt assigns the latest published version of his template to one or more active clients, with optional instructions and due date (`app/admin/assignments/actions.ts:18-73`). The client can:

- fill the pinned version as-is, with a reusable draft and statuses Pending/Assigned → In Progress → Completed (`app/client/assignments/actions.ts:71-96`; `app/client/assignments/actions.ts:123-178`; `app/client/assignments/actions.ts:323-364`);
- select **Customise first**, which creates a customer-owned fork linked to the original master and rewires the assignment to the forked version; Matt's master is not changed (`app/client/assignments/actions.ts:410-539`);
- build an organisation-owned template from scratch, save each change as a new version, publish it, and self-fill it without an assignment (`app/client/templates/actions.ts:49-85`; `app/client/templates/actions.ts:89-244`; `app/client/templates/actions.ts:254-332`).

Customer-template self-fill stores the answers, attempts the client-form activity event, and schedules the same AI draft as assigned and Matt-led work (`app/client/templates/actions.ts:481-520`; `lib/reports/report-draft.ts:140-164`). The event includes the authoritative organisation name. The live n8n workflow validates the event and returns success only after its admin email is accepted; an invalid event returns `422`, while a missing terminal receipt causes the application to attempt a best-effort Workflow Error write (`lib/auth-helpers.ts:179-186`; `lib/notifications/dispatch.ts:106-132`; `lib/notifications/client-form-events.ts:28-72`; `lib/notifications/dispatch.ts:238-309`; `docs/n8n/workflows/email-notifications.json:119-350`; `docs/n8n/workflows/email-notifications.json:351-474`).

Assignment reminders run daily at 07:00 UTC, select 7-day, 1-day, and overdue milestones, prefer an organisation owner as recipient, and retry after a failed send. Completed recurring assignments create the next occurrence once (`app/api/cron/assignment-scheduler/route.ts:54-142`; `app/api/cron/assignment-scheduler/route.ts:145-208`; `vercel.json:8-11`).

### Proposal to signature to contract

1. Matt selects an active client and active catalogue items. The AI scope helper calls OpenRouter using `gpt-4o-mini`; production fails visibly if the key is missing (`app/admin/proposals/actions.ts:15-74`).
2. The server recalculates line totals, adds 20% VAT, generates the proposal PDF, stores it privately, and leaves or reuses a Draft row. On the Send path, it continues into signature delivery (`app/admin/proposals/actions.ts:216-384`).
3. Sending requires an existing PDF and client contact email. The server creates a random single-use token, stores only its hash, hashes the PDF, sets a 30-day expiry, changes the proposal to Sent, and emails the signing link (`app/admin/proposals/actions.ts:93-213`).
4. The public signing page shows the proposal and one-hour PDF link. The signer enters name/email, draws or types a signature, accepts the terms, and submits (`app/api/sign/[token]/route.ts:99-165`; `components/sign/sign-flow.tsx:243-377`).
5. Submission re-downloads the exact original PDF and rejects it if its current hash differs from the hash recorded at send time. It creates and stores a separate content-addressed stamped PDF first, then one server-only database operation consumes the unexpired token, changes the proposal to Signed, links both hashes/paths, and inserts the signature evidence row. Preparation failure leaves the token unused; commit failure removes the uncommitted stamped file (`app/api/sign/[token]/route.ts:169-304`; `supabase/migrations/032_atomic_proposal_signature_redemption.sql:45-99`).
6. A successful online signature attempts to issue the contract automatically. Contract issuance rebuilds the service agreement, adds 20% VAT, stores the PDF, changes the proposal to Contract Issued, and emails a seven-day link. Failure is recorded for Matt and can be retried with **Issue contract** (`app/api/sign/[token]/route.ts:347-383`; `lib/proposals/issue-contract.ts:35-181`).
7. Matt can record a paper/email signature manually. That stores a clearly marked offline audit row, consumes the online link, and allows contract issue (`app/admin/proposals/actions.ts:590-668`).

Current exceptions:

- The deployed flow leaves the Draft for retry but fails visibly when proposal PDF generation or upload fails, so the builder no longer reports a successful send without a document (`app/admin/proposals/actions.ts:345-381`; `components/proposals/advanced-proposal-builder.tsx:210-240`).
- A proposal still becomes Sent before delivery is known. The deployed flow records a signature-email failure in Workflow Errors and shows Matt a warning with the proposal link; there is still no automatic retry queue (`app/admin/proposals/actions.ts:195-222`; `components/proposals/advanced-proposal-builder.tsx:229-239`).
- Sent proposal terms, client, totals, original PDF path, and original hash are database-protected from later material edits (`supabase/migrations/033_sent_proposal_immutability.sql:1-40`).
- The first-party signature evidence is now transactional and preserves both exact documents, but whether it is the accepted business/legal signing method is still an external decision. **UNVERIFIED**.
- The client contract list and tenant-scoped detail route both work (`app/client/contracts/page.tsx:22-95`; `app/client/contracts/[id]/page.tsx:24-158`).

### Credit purchase and manual adjustment

The stored unit is whole credits. The database still calls the columns `hours_balance` and `hours_amount`, but migration 026 changes their meaning and adds an editable `credits_per_hour` reference rate, default 4 (`supabase/migrations/026_credits_model.sql:4-18`; `supabase/migrations/026_credits_model.sql:50-57`).

Clients can select 20 credits for £495, 40 for £950, or 80 for £1,800. The application creates a PayPal order using a server-owned price, redirects the client to PayPal, then verifies the returned order's client, package, GBP amount, and completion state before adding credits atomically. Duplicate capture requests do not add credits twice (`lib/billing/packages.ts:26-46`; `app/api/paypal/create-order/route.ts:16-68`; `app/api/paypal/capture-order/route.ts:99-172`).

Matt can add or deduct whole credits from an active client. The database locks the client row, prevents an overdraft, changes the balance, and writes the ledger movement in one operation (`supabase/migrations/026_credits_model.sql:80-121`; `app/admin/clients/actions.ts:307-376`).

Current exceptions:

- Production has PayPal enabled in sandbox mode but both stored credential pairs fail authentication, so no purchase can complete (`HANDOFF.md:109-117`).
- The page says VAT is included, but there is no generated receipt or invoice email (`HANDOFF.md:57-58`).
- Credits are intentionally independent of proposals and contracts; no proposal signing automatically changes a credit balance (`HANDOFF.md:15-23`).

### Compliance and notifications

Matt uploads a PDF or image up to 25 MB, chooses a category, and may supply an expiry date. The server checks the file's actual header as well as its claimed type before storage; upload email follows the Settings toggle. Clients can only mint short-lived links for documents belonging to their organisation (`lib/documents/actions.ts:14-153`; `lib/files/file-signature.ts:1-66`; `app/client/compliance/actions.ts:6-40`).

The screen thresholds are:

- **Expired:** the expiry date is today or earlier.
- **Expiring:** the expiry date is 1–30 UK calendar days ahead, including exactly 30 days.
- **Current:** the expiry date is more than 30 UK calendar days ahead.
- **No Expiry Date:** a separate status. The client dashboard includes undated records in its broad Current total, while the document list preserves the separate undated label (`lib/compliance/expiry-status.ts:1-68`; `app/admin/compliance/page.tsx:57-78`; `app/client/compliance/page.tsx:68-118`; `app/client/page.tsx:93-129`).

The daily 06:00 UTC reminder job scans from 30 days overdue to 30 days ahead and can issue one notice at each 30/14/7/expired window. A late run catches the latest missed window rather than sending all missed notices. Failure is recorded and retried; success is deduplicated (`app/api/cron/expiry/route.ts:46-95`; `app/api/cron/expiry/route.ts:113-187`; `vercel.json:3-7`).

The expiry job now uses `clients.contact_name` and `clients.contact_email`, so its recipient is deterministic (`app/api/cron/expiry/route.ts:72-89`; `app/api/cron/expiry/route.ts:132-158`). Upload notices and final-report delivery still select a portal user, so the business rule for those recipients remains **Partial** (`lib/documents/actions.ts:116-145`; `app/admin/assessments/actions.ts:836-927`).

## Automation ground truth

### Live n8n rebuild and audit — 26 July 2026

The original 25 July audit found two broken workflows. Before changing them, both live definitions were exported to a mode-`600` temporary backup and hashed. The live workspace now has three active workflows, and the exact deployable definitions are versioned under `docs/n8n/workflows/`. The workflow generator resolves named credentials, updates the two known workflow IDs, creates or updates the failure workflow, activates all three, and exports the same definitions that were deployed (`scripts/n8n/deploy-production.mjs:6-27`; `scripts/n8n/deploy-production.mjs:457-559`).

| Live workflow | What it now does | Authentication, recovery, and evidence |
|---|---|---|
| `Email Notifications` (`hif6MMPvywQF6z6u`) | Routes on the request body's `type` field and accepts only `client_form_created`, `client_form_submitted`, and `client_template_cloned`; validates the organisation and event fields; sends the matching plain-text admin message to `888FST@proton.me`; and rejects unknown or incomplete events with `422`. The eight obsolete customer-email branches are gone. | Header authentication is required. Each Gmail send has three attempts with a one-second delay. The `200` receipt is downstream of Gmail and contains `{ ok: true, delivered: true }`. Success and error payloads are not retained in n8n. After the coordinated secret rotation, all three exact event payloads returned that terminal receipt and Gmail accepted each message; unauthenticated access still returned `403`. `lib/notifications/dispatch.ts:106-132`; `docs/n8n/workflows/email-notifications.json:1-118`; `docs/n8n/workflows/email-notifications.json:119-350`; `docs/n8n/workflows/email-notifications.json:351-474`; `docs/n8n/workflows/email-notifications.json:574-617`; `HANDOFF.md:143` |
| `Assessment Report Notifications` (`eijErYNTCnWHuITQ`) | Validates `submissionId`, sends one admin message with the review link, returns the same final delivery receipt, and returns `422` for an invalid event. It still does not generate the report, contact the client, or store a file. | Bearer-header authentication is required. After the production-secret cutover, an unauthenticated call returned `403`, the exact assessment payload returned `200` with the terminal receipt after Gmail accepted the message, and an authenticated empty payload returned `422`. Three Gmail attempts and no success/error payload retention are configured. `docs/n8n/workflows/assessment-report-notifications.json:1-125`; `docs/n8n/workflows/assessment-report-notifications.json:127-178`; `HANDOFF.md:143` |
| `888 Automation Failure Alerts` (`fzflrF6ByBnfRhxN`) | Starts with n8n's failure trigger and sends Matt the source workflow, last step, error, and execution link. | Same-owner workflows may invoke it; Gmail has the same retry settings. A controlled source workflow returned `500`, the alert execution completed with `success`, and the temporary workflow plus retained canary execution were removed. `docs/n8n/workflows/automation-failure-alerts.json:1-44`; `docs/n8n/workflows/automation-failure-alerts.json:46-67` |

The application event contract was changed with the workflows. Client events now carry the authoritative organisation name returned by the signed-in organisation lookup, and all three call sites send it (`lib/auth-helpers.ts:179-186`; `lib/notifications/dispatch.ts:106-132`; `app/client/templates/actions.ts:75-84`; `app/client/templates/actions.ts:506-515`; `app/client/assignments/actions.ts:354-362`; `app/client/assignments/actions.ts:525-536`). Both application paths reject an ordinary `2xx` that lacks both required delivery flags, so n8n's former “empty `200` after an internal failure” behaviour is treated as an application-side failure. The subsequent Workflow Error insert is best-effort and its own database error is not surfaced (`lib/notifications/dispatch.ts:238-309`; `lib/notifications/client-form-events.ts:28-72`; `app/admin/assessments/actions.ts:431-471`).

The post-rebuild n8n security audit reports no unprotected webhook and no database-query, filesystem, community-node, custom-node, or risky built-in-node finding. It still identifies two unused Gmail OAuth credentials, `Ayman personal` and `team@hexonasystems.com`, and reports that version `2.31.6` is available over the current `2.31.5`. The single user's MFA flag remains off. Those account-level items were not changed because deleting credentials, enabling MFA, updating the hosted instance, and rotating the public API key require explicit owner controls.

The coordinated production cutover completed on 26 July 2026. Vercel now holds the matching general and assessment secrets and both production webhook URLs, the existing n8n general credential was rotated to the same new value, and the Ready production deployment is aliased to `www.merlinsafetysystem.com`. All four exact application payloads returned `200` with `{ ok: true, delivered: true }` after Gmail acceptance, while both unauthenticated routes returned `403`. Historical executions `1` and `2`, which retained the old general secret, were deleted and confirmed absent. The notice paths are **Live**; the shared n8n API key still needs rotation because it was posted in chat (`HANDOFF.md:143`; `HANDOFF.md:150`).

### n8n finding disposition

| Original finding | Current disposition |
|---|---|
| Invalid `888 / Matt` recipient and blank client name | **Resolved in live n8n and application source.** All admin messages use `888FST@proton.me`; the application sends and n8n requires `client_name`. |
| Webhook acknowledged before Gmail; no retry or failure alert | **Resolved in live n8n and application source.** Gmail retries three times, the success receipt follows Gmail, the application requires that receipt, and the failure-alert canary passed. |
| Public assessment webhook | **Resolved in live n8n.** Unauthenticated requests return `403`; invalid authenticated events return `422`; the matching production application secret and valid-event canary now pass. |
| Eight obsolete customer-email branches | **Resolved.** n8n now has only the three admin activity events; all ten customer-facing email types remain in Resend. |
| General secret exposed through retained failures; audit API key shared | **Webhook-secret exposure resolved; API-key rotation open.** The general secret was rotated at both ends and the two retained failures were deleted. Rotate the shared n8n API key and replace the ignored local copy. |
| MFA off; two unused mail credentials; one bug-fix update available | **Open account-hardening work.** Confirm credential ownership before deletion, enable MFA, and schedule the hosted update. |

### Application automation map

| Automation | Real trigger and data flow | Current state and recovery |
|---|---|---|
| Transactional email | Ten payload types — expiry alert, admin digest, document upload, assignment reminder, report ready, signature request, signature confirmation, contract issued, portal invite, and password reset — render in the application and go directly to Resend (`lib/notifications/email-templates.ts:21-33`; `lib/notifications/dispatch.ts:185-231`). | **Live, owner-confirmed.** Individual call sites usually record send failures, but there is no complete sent/delivered outbox and no common retry queue. |
| Client-form activity notices | Client create, submit, and fork actions send the organisation name and record references to the authenticated general n8n webhook after the database write (`lib/notifications/client-form-events.ts:28-72`; `app/client/templates/actions.ts:51-86`; `app/client/assignments/actions.ts:331-367`). | **Live with best-effort recovery.** The matching production secret is deployed. All three exact production event payloads passed the authenticated route and returned terminal Gmail-acceptance receipts. The database write remains committed if a later notice fails; the caller waits up to eight seconds, then attempts a Workflow Error write. n8n may continue for up to 30 seconds and send after that application timeout. There is no retry, and an error-row insert failure is ignored (`lib/notifications/dispatch.ts:235-309`; `lib/notifications/client-form-events.ts:28-72`; `docs/n8n/workflows/email-notifications.json:608-617`; `HANDOFF.md:143`). |
| Matt-submitted assessment notice | Only the admin submit action schedules the separate authenticated n8n POST containing `{ submissionId }`; client submissions do not call it (`app/admin/assessments/actions.ts:431-471`; `app/client/assignments/actions.ts:354-367`; `app/client/templates/actions.ts:506-520`). | **Live with best-effort recovery.** The matching production secret is deployed, and authentication, rejection, terminal receipt, Gmail acceptance, and failure alerting passed controlled canaries. The post-response caller waits up to 15 seconds, but n8n may run for 30; a timeout can therefore be logged before a late email. A missing URL is skipped and all Workflow Error inserts ignore their own write result (`app/admin/assessments/actions.ts:431-471`; `docs/n8n/workflows/assessment-report-notifications.json:169-178`; `HANDOFF.md:143`). |
| Assessment report drafting | Every committed admin, assigned-client, or customer-self-fill submission schedules a server-side OpenRouter call to `openai/gpt-4o-mini`, then stores the structured draft or records `ai_draft_failed` (`lib/reports/report-draft.ts:22-164`). | **Live with review required.** Matt has a manual Retry Draft action. There is no claim/lock, so concurrent automatic/manual runs can make duplicate paid calls and race to overwrite the draft. |
| Proposal scope drafting | Matt explicitly requests a scope paragraph; the server sends only the selected service names/descriptions to the same OpenRouter model (`app/admin/proposals/actions.ts:24-74`). | **Live when configured.** It fails visibly in production; Matt edits the result before it enters a proposal. |
| Expiry reminders | Vercel calls the protected route daily at 06:00 UTC. The job honours the Settings toggle, sends catch-up 30/14/7/expired notices through Resend, uses a provider idempotency key, records successful thresholds, and emails each admin a digest (`vercel.json:3-7`; `app/api/cron/expiry/route.ts:11-43`; `app/api/cron/expiry/route.ts:50-235`). | **Live code; no production record has yet been eligible.** Production has zero documents and the toggle is on. A missing client contact is only logged to server output; the admin digest has no provider idempotency key. |
| Assignment reminders and recurrence | Vercel calls the protected route daily at 07:00 UTC. It sends 7-day, 1-day, and overdue reminders, then creates the next weekly/monthly/quarterly/annual assignment after completion (`vercel.json:8-11`; `app/api/cron/assignment-scheduler/route.ts:54-208`). | **Live code; no production assignment has yet exercised it.** A failed reminder is recorded and retried. A successful email followed by a failed `last_reminder_sent` update can resend next day because that update error is ignored (`app/api/cron/assignment-scheduler/route.ts:136-142`). Recurrence failures reset the claim but are only console-logged (`app/api/cron/assignment-scheduler/route.ts:185-199`). |
| Report approval and delivery | Matt's approval generates and stores the PDF, marks the submission completed, creates a seven-day client link, sends a Resend email, and returns a five-minute Matt link (`app/admin/assessments/actions.ts:798-944`). | **Live but not concurrency-safe.** The status guard is a read followed by an unconditional update, so two approval requests can both generate and email. Recipient selection is an unordered first portal user, and signed-link creation errors are ignored before dispatch. |
| Proposal signing and contract issue | The online signing route verifies the original PDF, prepares a stamped copy, then redeems the token and stores evidence atomically. It sends a signature confirmation and tries to issue/email the contract (`app/api/sign/[token]/route.ts:169-378`; `supabase/migrations/032_atomic_proposal_signature_redemption.sql:45-99`; `lib/proposals/issue-contract.ts:35-181`). | **Online signing commit is live and strong.** Contract issuance still uses a read-then-update guard, so concurrent manual/automatic issue attempts can both generate and email. Signed-link errors can produce an empty email link. The manual “mark signed” path changes status before inserting evidence and only console-logs an evidence failure (`app/admin/proposals/actions.ts:609-683`). |
| PayPal purchase to credits | The client creates an approved PayPal order; return capture verifies the organisation, package, GBP amount, currency, and completion state, then a server-only database operation adds the credits once (`app/api/paypal/create-order/route.ts:16-68`; `app/api/paypal/capture-order/route.ts:60-172`). | **Held.** Current credentials fail authentication. There is no PayPal webhook for delayed capture, refund, reversal, or dispute reconciliation, so only the browser return/capture path can add credits. |
| Workflow Errors | Application call sites attempt to insert failures into `workflow_errors`; Matt sees the 50 newest rows that were stored (`lib/supabase/dashboard.ts:402-417`; `app/admin/errors/page.tsx:8-74`). n8n success is accepted only with its terminal delivery receipt (`lib/notifications/dispatch.ts:238-309`). | **Partial.** Partner-notice error inserts do not check their own database result, and an absent assessment URL is skipped, so a failure can exist without a row. A read failure is also converted to an empty list, so the UI can say “No operational errors detected” when the log could not be read. Only seven of at least 22 written workflow names have tailored explanations (`lib/notifications/client-form-events.ts:28-72`; `app/admin/assessments/actions.ts:431-471`; `lib/workflow-errors.ts:20-65`). The separate n8n failure workflow emails Matt when an n8n execution itself fails. |

### Automation findings that must not be filed as new QA bugs

- Successful n8n webhook executions are intentionally not retained. Confirm a canary with the final `{ ok: true, delivered: true }` receipt and Matt's controlled inbox; an empty Executions list is expected.
- Invalid authenticated events return `422`, and unauthenticated events return `403`. These are security controls, not email defects.
- An eight-second client-event timeout or 15-second assessment timeout can be followed by a late admin email because n8n may continue for 30 seconds. Check the committed record and inbox before repeating an action.
- Workflow Error writes for these four notices are best-effort. An empty page does not prove the transport succeeded, and a missing assessment webhook URL is skipped without a row.
- The four controlled production canaries passed on 26 July 2026. QA 15 may now exercise the real user actions with throwaway records; do not repeat a committed action merely to chase an email.
- `scripts/verify-n8n.ps1` now covers only the four real admin notices, requires both secrets, checks the terminal receipt, and warns that it sends real email. It must not be run casually against production.
- Email delivery through Resend is owner-confirmed working. The absence of a complete provider outbox is an observability limitation, not evidence that email is down.

## Providers and configuration

| Provider or service | Actual purpose | Current state | Evidence |
|---|---|---|---|
| Live data, authentication, private file storage | Accounts, organisation-scoped records, reports, proposals, documents, and form media. | **Live:** migrations 031–034 were applied and directly verified in production on 25 July 2026. | `supabase/migrations/031_template_version_immutability.sql:1-126`; `supabase/migrations/032_atomic_proposal_signature_redemption.sql:1-99`; `supabase/migrations/033_sent_proposal_immutability.sql:1-40`; `supabase/migrations/034_persist_brand_colours.sql:1-15` |
| OpenRouter → `openai/gpt-4o-mini` | Assessment report drafts and proposal scope paragraphs. | **Live when the key is valid; output always needs Matt's review.** | `lib/reports/report-draft.ts:60-94`; `app/admin/proposals/actions.ts:57-74` |
| Resend | Invites, password resets, expiry notices/digest, upload notices, assignment reminders, report links, signature requests/confirmation, and contract links. | **Live:** delivery is owner-confirmed operational as of 25 July 2026. The application records individual send failures, but it does not provide a complete delivery/open-status outbox. | `lib/notifications/email-templates.ts:21-33`; `lib/notifications/dispatch.ts:180-219`; `HANDOFF.md:35-38` |
| n8n | Three client-form activity notices and a separate Matt-submitted assessment notice. It does not generate AI content, PDFs, or ordinary customer email. | **Live:** both production endpoints authenticate, validate, retry Gmail, alert on workflow failure, and return success only after delivery acceptance. The matching secrets are deployed, and all four exact event canaries passed. | `lib/notifications/client-form-events.ts:28-72`; `lib/notifications/dispatch.ts:238-309`; `app/admin/assessments/actions.ts:431-471`; `docs/n8n/workflows/automation-failure-alerts.json:1-67`; `HANDOFF.md:143` |
| PayPal | Client self-service credit purchases. | **Partial:** code path exists; production credentials are invalid. | `lib/paypal.ts:20-45`; `HANDOFF.md:109-117` |
| Twilio/SMS | No application integration. Generic local authentication configuration comments are not a product feature. | **Not built** | `package.json:12-45`; `HANDOFF.md:141-145` |
| Offline/PWA | No service worker, offline store/queue, background sync, or install experience. | **Not built** | `HANDOFF.md:141-145`; no implementation found under `app/`, `components/`, `lib/`, or `public/` |

## Database and access model

The core model is organisation-based. `clients` is the organisation; `client_users` links signed-in people to one organisation; `admin_users` grants operator access. Documents, assignments, submissions, ledger entries, and proposals all carry a `client_id` (`supabase/migrations/001_initial_schema.sql:15-40`; `supabase/migrations/001_initial_schema.sql:72-142`; `supabase/migrations/001_initial_schema.sql:148-170`).

Customer templates use polymorphic ownership:

- `owner_type='admin'` with an admin user ID identifies Matt's master;
- `owner_type='customer'` with a client organisation ID identifies a customer-built or forked template;
- `parent_template_id` points a fork back to its master and is null for originals (`supabase/migrations/003_form_template_customer_ownership.sql:12-33`).

All main client-data tables have row-level access controls enabled. Later migrations replace dead role claims with membership checks, correct client-visible proposal/submission statuses, constrain client form writes to their own organisation, and repair storage administration policies (`supabase/migrations/001_initial_schema.sql:198-215`; `supabase/migrations/0201_security_rls_hardening.sql:26-113`; `supabase/migrations/022_client_write_policies_and_admin_claim_fixes.sql:25-76`; `supabase/migrations/022_client_write_policies_and_admin_claim_fixes.sql:84-119`). The latest production handoff records live anonymous-write and cross-role probes as denied (`HANDOFF.md:64-66`).

Template saves append new version rows. Published or referenced versions cannot be updated, signed-in users no longer have hard-delete access to template parents, and both admin and customer delete actions now hide/unpublish the template while preserving every pinned version. Migration 031 was applied and its policies/triggers verified in production on 25 July 2026 (`app/admin/templates/actions.ts:149-215`; `app/admin/templates/actions.ts:293-320`; `app/client/templates/actions.ts:91-265`; `supabase/migrations/031_template_version_immutability.sql:1-126`).

## Status vocabularies

These are text values rather than database enums, so the application owns the vocabulary.

| Area | Stored values and display meaning | Evidence |
|---|---|---|
| Assignment | `assigned` and legacy `pending` both mean not started; then `in_progress`; then `completed`. Revocation uses `deleted_at`. | `app/client/assignments/actions.ts:71-96`; `app/admin/assignments/actions.ts:117-139` |
| Submission/report | Work can move `draft` → `submitted` → `draft_ready_for_review` → `completed`; `ai_draft_failed` is the retry state. Matt-led, client-assigned, and customer self-fill submissions use the same draft scheduler. Some client screens collapse the middle states to In Progress. | `app/admin/month-summary/page.tsx:101-123`; `app/client/assessments/status.ts:19-40`; `lib/reports/report-draft.ts:96-136`; `app/client/assignments/actions.ts:331-366` |
| Proposal/agreement | `Draft` → `Sent` → `Signed` → `Contract Issued`. | `app/admin/proposals/page.tsx:7-18`; `app/admin/proposals/page.tsx:69-78` |
| Template | `is_published=false` displays Draft; `is_published=true` displays Published. A latest unpublished version can coexist with older published versions. | `app/admin/templates/page.tsx:20-46`; `app/admin/templates/[id]/page.tsx:32-45` |
| Compliance | Current, Expiring, Expired, plus No Expiry Date. Expiry day and earlier are Expired; 1–30 UK calendar days are Expiring; more than 30 days is Current. | `lib/compliance/expiry-status.ts:43-68` |

## Test identities and credentials

No complete, current tester credential pair can truthfully be recovered from the repository.

| Identity | What is confirmed | Login instruction |
|---|---|---|
| Matt Robinson | Production contains only `mathew.robinson@888safetyandtraining.com` in `admin_users`. No password is stored in the repository. | Use `/login/admin` with Matt's existing password, or use **Forgot?** to set a new one. Password: **UNVERIFIED**. `HANDOFF.md:159-163` |
| Sarah Whitfield, Facilities Manager, Hallam House Care Home | The name and organisation appear in test/seed fixtures, but there is no confirmed Sarah authentication account or password. Production currently has zero clients. | Matt must create Hallam House, add Sarah under Access, and send/copy the invite link before QA. Credentials: **UNVERIFIED**. `tests/auth-helpers/client-context-with-identity.test.ts:93-105`; `HANDOFF.md:52-55`; `HANDOFF.md:162-163` |
| Repository test admin | Seed metadata links `admin@test.com` to Matt, but the seed explicitly says the authentication user must be created separately and supplies no password. The 25 July live check confirms this authentication account is absent from production. | Not a login. `supabase/seed.sql:132-143` |
| Repository test client | A helper can create `user@test.com` only after an operator explicitly sets `ALLOW_TEST_USER_SEED=true` and supplies a password of at least 16 characters. It refuses to run without both gates and is intended only for non-production. It is not Sarah; the 25 July live check confirms it is absent from production. | Staging/local helper only; never assume it exists. `scripts/ensure-client-test-user.mjs:8-35` |

All test passwords, invite links, and helper accounts must be replaced or deleted before handover. No test password is stored in the repository.

Both login pages call the same password authentication service, then check the account's role. The client page signs an operator back out with an operator-access message; the admin page signs a client back out with a client-portal message. An already signed-in user who visits a login URL is redirected by role (`app/login/page.tsx:18-50`; `app/login/admin/page.tsx:17-49`; `lib/supabase/session.ts:64-103`).

## Current readiness ledger

### Live enough for controlled testing

- Live organisation and client-access management, with invite/reset flow production-tested (`app/admin/clients/actions.ts:26-81`; `app/admin/clients/actions.ts:420-562`; `HANDOFF.md:35-38`).
- Live dashboards, compliance documents, manual expiry reminders, assignments, customer form building/forking, report generation/review, proposal pipeline, transactional first-party signing, contract generation/list/detail, manual credits, and contractor directory.
- Live tenant and role controls, including a second role check in both protected layouts and production denial probes (`app/admin/layout.tsx:18-22`; `app/client/layout.tsx:17-22`; `HANDOFF.md:64-66`).
- Live credit denomination and editable reference rate, with both balance functions restricted to the server role (`supabase/migrations/026_credits_model.sql:4-18`; `supabase/migrations/026_credits_model.sql:123-130`; `HANDOFF.md:64-66`).
- Live template and sent-proposal immutability controls plus the atomic signing commit, directly verified in production after migrations 031–034 (`supabase/migrations/031_template_version_immutability.sql:1-126`; `supabase/migrations/032_atomic_proposal_signature_redemption.sql:1-99`; `supabase/migrations/033_sent_proposal_immutability.sql:1-40`).
- Live n8n admin notices: both webhook secrets and URLs are deployed, the three workflows are active, all four exact event canaries passed the terminal Gmail-acceptance receipt, unauthenticated calls return `403`, and the old secret-bearing executions were deleted (`HANDOFF.md:143`; `HANDOFF.md:150`).
- The audited application dependency is upgraded to 16.2.11, the production build passes, all 701 runnable tests pass, the automation-change set is lint-clean, and the production dependency audit reports zero vulnerabilities (`package.json:32`; `package.json:54-67`).

### Partial or held for controlled testing only

| Area | Why it is not a go-live pass |
|---|---|
| Production setup | Production has no clients, templates, service catalogue, contractors, or proposals. Matt cannot run the core assessment or proposal workflow until he supplies and approves the real content (`HANDOFF.md:52-55`). |
| Client onboarding | New Client accepts a Site Address and the client record has an Edit details control for organisation name, primary contact, email, phone, and address. Job title is still not modelled, so Sarah's “Facilities Manager” title remains test context rather than stored account data (`components/clients/new-client-dialog.tsx:23-56`; `components/clients/new-client-dialog.tsx:101-135`; `app/admin/clients/actions.ts:84-123`; `app/admin/clients/[id]/page.tsx:318-340`). |
| PayPal | Credentials fail both sandbox and live authentication; real-money test is blocked (`HANDOFF.md:109-117`). |
| Email | Delivery is owner-confirmed operational as of 25 July 2026. The remaining limitations are operational visibility and recovery: Notifications is not a complete outbox, and several flows record a failure without offering an automatic resend (`lib/notifications/dispatch.ts:180-219`; `app/admin/notifications/page.tsx:31-47`; `app/admin/errors/page.tsx:8-35`). |
| n8n account hardening | The production notice paths are live and all four canaries pass. The old general secret and retained executions are cleared. MFA, API-key rotation, two unused mail credentials, and the hosted bug-fix update remain account-level work (`lib/notifications/dispatch.ts:238-309`; `app/admin/assessments/actions.ts:431-471`; `HANDOFF.md:143-150`). |
| Customer template creation | Create-from-scratch inserts the template row, then does not inspect the result of the initial blank-version insert before returning and sending `client_form_created`. A rare version-write failure can therefore leave a listed template that cannot open normally while still producing Matt's activity notice. Fork-on-fill checks each write (`app/client/templates/actions.ts:51-85`; `app/client/assignments/actions.ts:483-536`). |
| AI reports | Drafting is wired, but sparse forms can produce invented detail. Matt's review is the controlling safety step, and the local PAS 79 matrix still requires his professional approval (`HANDOFF.md:141-145`; `lib/form-builder/risk/pas79.ts:4-35`). |
| Client assignment to report | **Live:** assigned-form and customer self-fill submissions schedule report drafting after the committed submission (`app/client/assignments/actions.ts:331-366`; `app/client/templates/actions.ts:475-508`). |
| Proposal delivery | **Live with a recovery limitation:** PDF failure fails visibly while preserving the Draft, and signature-email failure creates a Workflow Error plus an on-screen warning. There is still no automatic retry queue (`app/admin/proposals/actions.ts:345-399`; `app/admin/proposals/actions.ts:195-222`). |
| First-party signing | The original and stamped copies, hashes, token consumption, status change, and audit row are now committed safely for new signatures, but formal acceptance of this signing method is **UNVERIFIED** (`app/api/sign/[token]/route.ts:169-315`; `supabase/migrations/032_atomic_proposal_signature_redemption.sql:45-99`). |
| Photos | **Live with a form-rule limitation:** committed per-field photos reload after refresh, use 15-minute signed previews, and removal deletes both the private object and its audit row. Uploads are limited to five per affordance and the server checks the actual image header. A Photos field marked Required is still intentionally presented as “recommended” and does not block submission (`components/form-interpreter/attach-photos-affordance.tsx:109-245`; `app/admin/assessments/actions.ts:567-670`). |
| Settings | Logo, toggles, reference rate, and practice-wide portal colours persist; both protected layouts apply the colours on every device. PDF colours remain static. Saved sign-off/sender labels are explicitly staged for a later email-brand cutover; the active Resend From/brand still comes from deployment configuration (`app/admin/settings/actions.ts:27-78`; `app/admin/layout.tsx:30-44`; `app/client/layout.tsx:23-33`; `lib/notifications/dispatch.ts:202-224`; `lib/notifications/email-templates.ts:19-33`). |
| Public brand and contact details | The client footer shows 888 Safety & Training and `0161 552 0918`; generated PDFs show 888 Safety branding with `0114 555 0188`; email defaults to “Merlin Safety System” unless an environment value overrides it. The public identity must be agreed and aligned before handover (`app/client/layout.tsx:52-60`; `components/pdf/report-document.tsx:149-155`; `lib/notifications/email-templates.ts:19-33`; `HANDOFF.md:141-142`). |
| Client failure states | **Live:** Compliance, Reports, Proposals, Assignments, Assessments, Templates, Contracts, Billing, and Directory show a load-error panel rather than treating a failed query as an empty result (`components/client/data-load-error.tsx:3-18`; `app/client/compliance/page.tsx:76-112`; `app/client/reports/page.tsx:34-94`; `app/client/proposals/page.tsx:35-86`; `app/client/assignments/page.tsx:14-47`; `app/client/contracts/page.tsx:38-115`; `app/client/billing/page.tsx:30-48`; `app/client/directory/page.tsx:4-36`). |
| Dependency security | **Resolved for production dependencies:** the application is on 16.2.11 and `npm audit --omit=dev` reports zero vulnerabilities. The repository-wide lint command still includes pre-existing failures in vendored developer tooling and older untouched files; changed application files are clean (`package.json:32`; `package.json:54-67`; `eslint.config.mjs:1-17`). |
| Password reset | **Live:** the public action keeps the same response but applies hashed per-account (3/hour) and per-IP (20/hour) counters. It fails open if the limiter itself is unavailable. Migration 030 and the application change were confirmed in production on 25 July 2026 (`app/login/forgot/actions.ts:18-40`; `lib/rate-limit.ts:22-59`; `supabase/migrations/030_rate_limit.sql:32-99`). |
| Data governance | Processor disclosure, retention, access-audit, export, region, and approved privacy wording are **UNVERIFIED**. Assessment answers leave the platform for OpenRouter (`lib/reports/report-draft.ts:60-94`; `pre-launch-audit.md:36`). |

### Not built

- Speech-to-text.
- SMS/Twilio notifications.
- Offline/PWA operation.
- Billing receipt or invoice generation.
- A retry/resolve workflow inside Workflow Errors.

## Pending dependencies and decisions

| Dependency or decision | What it unlocks | Current status |
|---|---|---|
| Matt's real FRA/site-risk questions and approved risk matrix | A usable master template and trustworthy computed risk wording | **Needed; production has zero templates.** |
| Job-title storage decision | A saved role/title for contacts such as “Facilities Manager” | **Not modelled; site address and profile editing are live.** |
| Matt-approved service list and prices | Proposal creation | **Seed catalogue exists but was deliberately not loaded.** |
| Valid PayPal Live Client ID and newly generated secret | Real-money purchase test and credit top-up | **Blocked outside the repository.** |
| One agreed public brand, phone number, sender, and monitored reply mailbox | Consistent portal, PDF, and email identity | **Delivery works; identity is still inconsistent.** |
| Rotate the n8n API key, enable MFA, remove confirmed-unused mail credentials, and apply the available bug-fix update | Close the remaining partner-automation account exposure | **Required account hardening. The two webhook secrets, four canaries, and deletion of old secret-bearing executions are complete.** |
| Written acceptance of first-party signing | Business/legal sign-off on proposal acceptance | **UNVERIFIED.** |
| Speech-to-text implementation choice | Sold dictation workflow | **Not built.** |
| Decision on SMS and offline scope | Mobile/offline field operation and text alerts | **Not built.** |
| Approved upload/report recipient rule | Deterministic upload-notice and final-report recipient; expiry reminders already use the organisation contact | **Partially built.** |
| Repository-wide lint baseline cleanup | Makes the broad `npm run lint` gate useful without vendored-tooling and legacy noise | **Pending; changed files are clean.** |
| Privacy/retention/processor decisions | Responsible handling of client assessment data | **UNVERIFIED.** |
