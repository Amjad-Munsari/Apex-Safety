# Pitfalls Research

**Domain:** Multi-tenant H&S compliance SaaS — fire/site risk assessment, AI report gen, e-sign, PayPal, Twilio, n8n
**Researched:** 2026-04-15
**Confidence:** HIGH (stack-specific, verified against official docs and community post-mortems)

---

## Critical Pitfalls

### Pitfall 1: Storage RLS Is a Completely Separate System from Table RLS

**SAFETY-CRITICAL — A table RLS policy that isolates client_id data does nothing to protect files in Supabase Storage.**

**What goes wrong:**
You add RLS to `assessments`, `documents`, `submissions` tables — all correct. You also upload assessment photos and generated PDFs to Supabase Storage. But Storage uses policies on `storage.objects`, not your application tables. If you forget to write Storage bucket policies, or write them incorrectly, Client B can retrieve Client A's fire risk assessment PDF by constructing the storage URL, even though the table rows are locked down. Public bucket + no Storage RLS = all files world-readable.

**Why it happens:**
Developers write table RLS and assume storage inherits those rules. It does not. Storage is a separate subsystem. You can have zero Storage policies and still get no upload errors (because the bucket might be set to allow anon uploads), making the hole invisible until you audit.

**How to avoid:**
- Make all Storage buckets private (not public) by default
- Write explicit `storage.objects` INSERT/SELECT/DELETE policies that check `auth.uid()` AND match the path prefix to the user's `client_id` (e.g., `storage.foldername(name)[1] = auth.uid()::text`)
- Never derive access from `bucket_id` alone — path-prefix the tenant
- Add a dedicated "Client A cannot GET Client B's files" test to your integration test suite using two separate Supabase browser clients with different JWT tokens

**Warning signs:**
- You can fetch a storage URL while logged out (bucket is public)
- Storage upload succeeds in tests run from the SQL Editor (SQL Editor bypasses RLS — that means nothing)
- Your Storage policies have `true` as the condition (copied from a quickstart tutorial)

**Phase to address:** Stage 1 Scaffolding — establish the bucket policy pattern before any file is ever uploaded. Retrofit is high-risk.

---

### Pitfall 2: Service Role Key Leaking into Client-Side Code or n8n Credentials

**SAFETY-CRITICAL — Service role bypasses all RLS. One leak = all client data exposed.**

**What goes wrong:**
The service role key is placed in a Next.js environment variable without the `NEXT_PUBLIC_` prefix, but a Server Action or Route Handler accidentally imports it and the key ends up in a client bundle. Or, during the "pair on personal accounts" phase, the key is committed to `.env` that accidentally gets tracked. Or the n8n instance has the service role key as a plain credential and n8n logs it in an execution trace visible to anyone who can see the n8n dashboard.

For this specific project: Ayman and Amjad are working on personal accounts, PayPal credentials are pending, and a project Gmail handoff is planned. During this transition, secrets live in personal `.env.local` files and personal Vercel dashboard environment variables — high risk of "just put it in the message" or an accidental commit.

**Why it happens:**
Two people sharing secrets across personal accounts, under delivery pressure, before a shared secret store exists.

**How to avoid:**
- Add `.env*` to `.gitignore` on the very first commit — do this before `git add .` ever runs
- Use Vercel's environment variable UI (never CLI `--env`) for any secret that goes to production
- Create a `supabaseAdmin` server-only singleton that uses the service key and lives in `lib/supabase/admin.ts` — import from there, never construct ad-hoc
- Mark that file with `import 'server-only'` to cause a build error if it leaks to a client component
- In n8n: store the service key as a Credential, never paste it into a node's plain text field where it appears in execution logs
- Before the Gmail handoff: rotate all secrets immediately after transfer, do not reuse personal-account keys in the shared account

**Warning signs:**
- `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` exists anywhere in your codebase
- `supabaseAdmin` is imported by a file in `app/` that renders in the browser
- n8n execution logs show the raw Authorization header value

**Phase to address:** Stage 1 Scaffolding — establish the file and the `server-only` guard before any other code is written.

---

### Pitfall 3: RLS Policies That Work in Testing But Have Recursive Performance Bombs in Production

**What goes wrong:**
A policy like `auth.uid() IN (SELECT user_id FROM client_users WHERE client_id = assessments.client_id)` is written for the `assessments` table. When `assessments` returns 50 rows, Postgres evaluates this subquery 50 times. With multiple joins, this can turn a 10ms query into a 2s query. At 7–8 clients with modest data this is invisible; once Matt's assistant starts bulk-viewing compliance status across all clients, it degrades.

A related variant: an RLS policy on Table A joins Table B, and Table B also has RLS, causing Postgres to evaluate Table B's policies for each row of Table A (recursive RLS).

**Why it happens:**
RLS policies are written defensively and correctly from a security standpoint but without profiling. The SQL Editor bypasses RLS so EXPLAIN ANALYZE there doesn't show the real cost.

**How to avoid:**
- Structure policies with the user-scoped filter first: `client_id IN (SELECT client_id FROM client_users WHERE user_id = auth.uid())` — not the reverse
- Index every `client_id` column and every `user_id` column that appears in RLS policies
- For join-heavy policies, extract the join into a `SECURITY DEFINER` function that is itself RLS-aware but only executes once: `SELECT get_user_client_ids(auth.uid())`
- Test RLS performance using the Supabase client SDK with a real JWT, not the SQL Editor
- Run `EXPLAIN ANALYZE` from a role that has RLS enabled: `SET ROLE authenticated; SET request.jwt.claim.sub = '<user_uuid>';`

**Warning signs:**
- Compliance dashboard loads slowly when many documents are listed
- `EXPLAIN ANALYZE` shows a loop node iterating per-row on a subquery
- Any RLS policy that uses a correlated subquery referencing the outer table's column

**Phase to address:** Stage 1 — add index migrations alongside table creation. Stage 2 — profile policies after seeding realistic data before Stage 3 gate.

---

### Pitfall 4: SECURITY DEFINER Views Silently Bypass RLS

**What goes wrong:**
A Supabase database view is created (e.g., `compliance_summary_view`) to simplify the compliance portal query. By default in Postgres, views run as the view creator's role — which is a superuser in Supabase — bypassing all RLS policies on the underlying tables. Any client who can query the view gets every row from every tenant.

**Why it happens:**
This is the Postgres default. Neither the Supabase dashboard UI nor the migration tooling warns you. Most tutorials create views without mentioning this.

**How to avoid:**
- For any view that touches multi-tenant data, explicitly add `WITH (security_invoker = true)` (Postgres 15+, which Supabase runs)
- Treat every view as a potential RLS bypass until proven otherwise
- Run the Supabase Database Advisor linter (it flags `SECURITY DEFINER` views on public schema)
- Prefer materialized views or server-side queries with explicit RLS client over database views when in doubt

**Warning signs:**
- A view is queried through the Supabase JS client and returns more rows than expected
- Supabase Database Advisor flags `security_definer_view` lint warning
- A view was created by a migration and the creator role is `postgres` (superuser)

**Phase to address:** Stage 1 — establish the convention. Flag in PR checklist: "Does this migration create a view? If yes, does it have `security_invoker = true`?"

---

### Pitfall 5: `auth.uid()` Not Available in Postgres Triggers (Audit Logging Fails Silently)

**What goes wrong:**
A Postgres trigger is written to auto-populate `created_by = auth.uid()` or write an audit log row. The trigger fires correctly in Supabase Studio tests. In production via the Next.js app, `auth.uid()` returns `NULL` in the trigger because the JWT context is not propagated into background trigger execution — it only exists in the RLS evaluation context for the original query, not in the trigger's execution context on certain Supabase versions or connection types.

**Why it happens:**
`auth.uid()` is a Supabase helper that reads from `request.jwt.claims`. This is set per-query via connection configuration. Background triggers do not always inherit this context.

**How to avoid:**
- Do not rely on `auth.uid()` inside Postgres triggers for audit logging
- Pass `user_id` explicitly from the application layer as part of the INSERT/UPDATE payload
- Write the `created_by` and `updated_by` columns from the Server Action before the database call, not in a trigger
- If triggers are used, test them by calling from the Supabase JS client with a real auth session, not from the SQL Editor

**Warning signs:**
- `created_by` or audit columns are `NULL` in production rows despite being populated in tests
- Tests pass in the SQL Editor but fail when called from the browser
- A trigger uses `auth.uid()` and there is no test via the Supabase client SDK

**Phase to address:** Stage 1 — establish that audit columns are application-layer responsibility, not trigger-layer.

---

### Pitfall 6: Next.js 16 Caching Silently Serves Stale Compliance Data

**What goes wrong:**
A Server Component fetches compliance status using Supabase. In Next.js 15+, `fetch()` requests are NOT cached by default — correct. But if `unstable_cache` is used around a Supabase JS client call (the common pattern for non-fetch database queries), and `revalidateTag` is not called after a status update, the compliance dashboard shows stale expiry status. Matt's client logs in, their compliance shows green, but the underlying document expired 2 days ago.

A second variant: the Router Cache has a minimum 30-second stale time on the client regardless of server revalidation. If Matt approves a report and immediately navigates to the client portal to verify, the old `draft_ready_for_review` state may still show for up to 30 seconds.

**Why it happens:**
Next.js 16 introduced `use cache` directive as a new caching primitive (behind `cacheComponents` flag). The old `unstable_cache` and the new directive coexist, creating two caching systems with different invalidation paths. Development mode does not cache at all, so the bug is invisible until `npm run build && npm start`.

**How to avoid:**
- Never use `unstable_cache` around compliance status, document expiry, or report state — these must always be dynamic (`export const dynamic = 'force-dynamic'` on those route segments)
- After any Server Action that changes report state or compliance status, call `revalidatePath('/portal/[clientId]')` and `revalidateTag('compliance-<clientId>')`
- Test caching behavior only in production build (`next build && next start`), never in `next dev`
- For the compliance portal specifically: mark all compliance pages as `dynamic = 'force-dynamic'` during Phase 1 and add caching only if a performance problem is measured

**Warning signs:**
- Status changes made by Matt don't appear immediately in the client portal
- `npm run dev` shows correct data but `npm run build && next start` shows old data
- Any component that shows expiry dates or document status uses `unstable_cache` without corresponding `revalidateTag` calls in all mutation paths

**Phase to address:** Stage 2 (Form prerequisites) when data mutation patterns are established. Stage 4 when report status transitions are built.

---

### Pitfall 7: Form Schema Versioning — Retroactive Edits Silently Break Old Submissions

**SAFETY-CRITICAL — A fire risk assessment submitted for a building must always render exactly as it was filled. Retroactive schema drift makes historical records legally unreliable.**

**What goes wrong:**
Matt edits the FRA template post-launch — adds a new required field, renames a section, removes an obsolete question. The form builder saves the new schema as the current version. Historical submissions were stored as `{ field_answers: {...}, schema_id: 'fra-template' }` without a version pin. When an old submission is rendered in the portal, it renders against the current schema — the old answers are orphaned, required fields appear empty, the report looks incomplete or is rendered with wrong structure.

**Why it happens:**
The PROJECT.md calls out "schema versioning from day one" but the natural temptation during Stage 3 is to ship the form builder without the versioning, planning to "add it later." There is no "add it later" for this — every submission created before versioning exists will be unrecoverable.

**How to avoid:**
- The `form_schemas` table must have a `version` column (integer or hash) from the first migration
- Every `submission` row must store `schema_version_id` as a foreign key to the exact schema snapshot at submission time (store the full schema JSON in `form_schema_versions`, not just a version number)
- The form renderer must accept a `schema` prop (the historical snapshot) not a `schema_id` that it resolves at render time
- When Matt publishes a schema change: create a new schema version row, do not UPDATE the existing one
- Before Stage 3 green-light gate: demonstrate that a submission created with v1 renders correctly after v2 is published

**Warning signs:**
- `submissions` table has `form_id` but no `schema_version_id`
- The form renderer fetches the current schema by `form_id` at render time
- Schema updates are UPDATEs to existing rows rather than INSERTs of new version rows

**Phase to address:** Stage 3 — this is the green-light gate requirement. The demo must include rendering a v1 submission after publishing v2.

---

### Pitfall 8: Conditional Logic Creating Infinite Visibility Loops in Coltorapps Builder

**What goes wrong:**
Field A is conditional on Field B's value. Field B is conditional on Field A's value. The interpreter evaluates Field A → checks B → re-evaluates A → infinite loop. The tab freezes or produces a Maximum Call Stack error. This is most likely to happen when Matt builds forms interactively without a constraint on circular references.

A related variant: a field's `required-if` rule depends on a field that itself is hidden, creating a "required but invisible" state that blocks form submission.

**Why it happens:**
Coltorapps builder is headless and puts the conditional logic engine in the hands of the builder consumer (i.e., you). It does not ship a built-in cycle detector. The PROJECT.md notes: "Blocked on Matt's rules" — meaning the conditional logic system will be built before the rules are fully known, creating a window where invalid rule configurations are possible.

**How to avoid:**
- Implement a directed-acyclic-graph (DAG) check on schema publish: before saving a new schema version, walk the conditional dependency graph and reject any cycle with a user-facing error message
- For `required-if` rules: if the target field is currently hidden, treat `required-if` as not applicable (field is hidden → implicitly not required)
- Expose this validation in the builder UI before the Publish button is reachable
- Add a test: "two fields each conditionally showing on the other" should fail gracefully at publish time, not crash the renderer

**Warning signs:**
- The browser tab hangs when filling a form with conditional fields
- A "Maximum call stack size exceeded" error appears in the console
- A form submission fails on a required field the user cannot see

**Phase to address:** Stage 3 — implement DAG validation before Stage 3 green-light demo.

---

### Pitfall 9: Web Speech API Silently Fails on iPad Safari When Installed as PWA

**What goes wrong:**
Matt adds the app to his iPad's home screen (Add to Home Screen). Safari's Web Speech API SpeechRecognition is NOT available when a web app runs in standalone/PWA mode on iOS — it only works in the browser proper. Matt opens the app from his home screen, taps the mic button, nothing happens, no error. He thinks the recording is working (because it worked in the browser last week) and narrates 10 minutes of assessment. Zero text is captured.

Additionally: even in Safari browser (not PWA), Web Speech API sends audio to Apple's servers for processing — it requires an active internet connection. On a construction site or older building with poor signal, this silently fails. The `onerror` event fires but only if the developer has wired it up.

**Why it happens:**
Web Speech API browser support is inconsistent. MDN marks it as "partial support" on iOS Safari. Installed PWA mode on iOS has additional restrictions. The PROJECT.md correctly specifies "Web Speech API with text fallback" but the fallback must be implemented before launch, not as a recovery plan.

**How to avoid:**
- Feature-detect before enabling the mic button: `'SpeechRecognition' in window || 'webkitSpeechRecognition' in window` — if false, show text input immediately, not a broken mic button
- Detect standalone mode: `window.navigator.standalone === true` on iOS → assume STT unreliable → show text input as primary, mic as secondary
- Always wire up `recognition.onerror` and `recognition.onend` — on silent failure (network drop mid-session), auto-fallback to the text field and notify the user
- Show a live transcript preview as words are captured — if the transcript is empty after 3 seconds of "recording", surface an error rather than letting Matt narrate into the void
- Test explicitly: open the app from a home screen icon on an actual iPad, not just in Safari

**Warning signs:**
- No `onerror` handler on the SpeechRecognition instance
- The mic button shows "recording" state but the transcript div stays empty
- The app is tested only in desktop Chrome (where STT works reliably) not on iPad

**Phase to address:** Stage 2 (STT component is a prerequisite for the form). The text fallback must be built alongside the STT feature, not deferred.

---

### Pitfall 10: HEIC Images from iPhone/iPad Breaking the Upload Pipeline

**What goes wrong:**
iPhone and iPad default to HEIC format for photos. HEIC is not supported by any browser natively for display, and Supabase Storage will store whatever you upload. When an assessor uploads a fusebox photo in HEIC, it uploads successfully, but the `<img>` tag in the assessment review renders a broken image. The Supabase Storage URL returns the raw HEIC file; browsers display nothing.

A second issue: HEIC-to-JPEG conversion strips EXIF metadata (including orientation). The converted image may appear rotated 90 degrees. A fusebox photo shot in portrait becomes landscape, making labels unreadable.

A third issue: iOS sometimes converts HEIC to JPEG automatically at upload time, but the resulting JPEG has an EXIF rotation flag set (e.g., Orientation: 6 = 90 degrees clockwise). CSS/HTML `<img>` does not auto-rotate; the image appears sideways.

**Why it happens:**
The PROJECT.md warns explicitly against aggressive compression (800KB target destroys label legibility). The team knows about compression but HEIC format support and EXIF rotation are separate problems that often catch teams on first encounter with iOS uploads.

**How to avoid:**
- On the client, before upload: detect HEIC via `file.type === 'image/heic'` or by reading the first 12 bytes (HEIC magic bytes) — convert to JPEG using `heic2any` or `libheif-js` in the browser
- After any conversion: apply EXIF-based rotation correction using `piexifjs` or a canvas-based approach before uploading the corrected image
- Target 1.2–1.5MB as specified in PROJECT.md — test against the actual fusebox sample photos
- After upload, verify the stored file renders correctly in both `<img>` and the PDF renderer
- Accept files: `accept="image/*"` on the input (not `image/jpeg,image/png` only) so iOS users can pick from their photo library

**Warning signs:**
- Assessment photos show as broken images in the review UI
- Upload of a photo from iPad Camera Roll succeeds but the image appears sideways
- `file.type` is `'image/heic'` and the upload proceeds without conversion

**Phase to address:** Stage 2 — the per-field photo upload component is a prerequisite for Stage 3 form builder integration.

---

### Pitfall 11: AI Report Generation Hallucinating Findings in a Safety-Critical Document

**SAFETY-CRITICAL — A hallucinated fire safety finding in a delivered report could result in a building not being treated for a genuine hazard, or a building being condemned for a non-existent one. This has real-world legal and physical consequences.**

**What goes wrong:**
The AI is given the YELLOW BROOM FRA as a few-shot example. Over time, as Matt narrates shorter or more ambiguous assessments, the model begins to "fill in" findings it inferred from the few-shot example rather than from the actual narration. A building's fire escape is described as "needs checking" in the narration; the AI generates a finding that the escape "was found to be blocked and non-compliant" because that appeared in the few-shot example. Matt is busy, trusts the AI, approves without careful review. The client receives an incorrect assessment.

A second variant: the PDF is generated with a building name from the few-shot example (YELLOW BROOM) appearing in a section because the model copied structure and accidentally included the example's metadata.

**Why it happens:**
Few-shot examples anchor the model's outputs. As prompt templates drift without evaluation, the model's output distribution shifts. Without a structured review gate tied to specific field-level outputs (not just a holistic "does this look right" review), hallucinations accumulate gradually.

**How to avoid:**
- Matt's review gate (draft → approved → delivered) is non-negotiable — this is already in PROJECT.MD as out-of-scope to remove. Do not add any "auto-deliver" path even as an experiment
- In the n8n report workflow: include the raw STT transcript verbatim alongside the generated report in the review view — Matt sees both and can compare what he said vs what the AI wrote
- Use structured output from GPT-4 (JSON schema mode or function calling with field-level outputs) rather than free-form prose generation — this constrains the model to only populate fields it has evidence for
- Implement a "sources" field in the JSON output: for each generated finding, the AI must cite the relevant section of the transcript. If a finding has no source, flag it in the review UI
- Treat the few-shot example as immutable — do not update the YELLOW BROOM example prompt without a deliberate re-evaluation pass across 5+ test inputs
- Log every generated report with its input transcript to an n8n execution log or Supabase table — this creates an audit trail for drift detection

**Warning signs:**
- The generated report references details (building name, owner name, specific compliance codes) that did not appear in the input transcript
- Matt approves reports without reading them carefully (trust has built up but prompt drift has occurred)
- The n8n workflow has been modified but no test generation was run against the YELLOW BROOM transcript before deploying

**Phase to address:** Stage 4 — the AI pipeline is built here. The review view must surface the raw transcript alongside the generated content from day one. Structured output must be the default, not an optimization.

---

### Pitfall 12: n8n Workflow Fails Silently — Matt Calls Asking Why His Report Never Arrived

**What goes wrong:**
An n8n workflow (report generation, expiry alerts, or document upload notification) fails partway through — the OpenAI call times out, the Supabase update fails, the Twilio send hits a rate limit. n8n logs the error internally. But the application has no visibility into the failure; the trigger returned 200 OK when it called the n8n webhook. Matt's client never gets their SMS. The report never appears in the dashboard. No one is alerted.

**Why it happens:**
The ADR correctly splits AI/automation work into n8n and transactional work into code. But the error propagation path from n8n back to the Next.js app and to Matt is not designed by default — it must be explicitly built.

**How to avoid:**
- Every n8n workflow must have an Error Trigger sub-workflow that: (1) writes a failure record to a `workflow_errors` Supabase table, (2) sends Matt an email or Slack message with the workflow name, execution ID, and the failed node
- The `workflow_errors` table is surfaced on the Admin Dashboard (D9) so Matt can see it without checking n8n
- Use n8n's "Respond to Webhook" node at the END of workflows to return a status to the caller — but also accept that the caller (a Server Action) may have already responded to the browser; design for async failure notifications
- For the expiry alert workflow (n8n #3): implement idempotency via the `(document_id, window, recipient)` deduplication key (already specified in PROJECT.MD D7) — but also confirm deduplication works across n8n re-runs
- For critical report delivery: poll the `report_status` column from the Next.js app on a 30-second interval (or use Supabase Realtime subscription) so Matt sees the report appear without refreshing

**Warning signs:**
- n8n execution history shows red (failed) executions that nobody noticed
- The Admin Dashboard has no view of workflow error state
- A test of the report pipeline end-to-end has never been run from trigger to delivered PDF

**Phase to address:** Stage 4 — build the error workflow and `workflow_errors` table alongside the first n8n workflow, not after all four are complete.

---

### Pitfall 13: PayPal Webhook Delivering PAYMENT.CAPTURE.COMPLETED Multiple Times

**What goes wrong:**
PayPal retries webhook delivery up to 25 times over 3 days if the endpoint does not return a 200 within its timeout window. If the Next.js Route Handler does any slow work (writing to Supabase, sending SMS) before returning 200, it may time out. PayPal retries. The `hours_balance` is credited twice. The transaction row is written twice.

A second variant: the PayPal sandbox does not deliver `PAYMENT.CAPTURE.COMPLETED` reliably (a documented PayPal community issue). Tests in sandbox show "payment works" but the webhook never arrives. The team ships to production assuming webhook delivery is reliable.

**Why it happens:**
Webhooks are fire-and-forget from PayPal's side. Without an idempotency key check, any retry creates a duplicate side effect.

**How to avoid:**
- Store a `paypal_event_id` column in the transactions table with a UNIQUE constraint — any retry with the same event ID hits the constraint and returns 200 without processing twice
- The Route Handler must: (1) immediately return 200 to PayPal, (2) process the event asynchronously (use a Supabase background function or queue the work via a simple `setImmediate`/background pattern)
- Verify webhook signature using PayPal's `/v1/notifications/verify-webhook-signature` endpoint — do not trust unsigned webhooks. The raw request body must be preserved unchanged for signature verification
- Test webhook delivery in sandbox using PayPal's Webhook Simulator, not by completing a real sandbox payment (the simulator sends real webhook events)
- Implement a manual reconciliation: a daily cron (or admin button) that calls the PayPal Orders API directly to verify payment status for any `pending` transaction older than 24 hours

**Warning signs:**
- The `hours_balance` credits twice for a single payment
- No `paypal_event_id` uniqueness constraint in the schema
- Webhook signature verification is skipped "for now" in development

**Phase to address:** Stage 5 — PayPal is in the parallelisable final stage. But establish the idempotency pattern during Stage 1 schema design so it is not an afterthought.

---

### Pitfall 14: E-Sign Webhook Race Condition — "Signed But Not Received" State

**What goes wrong:**
Matt's client signs a service agreement. SignWell fires a `document.completed` webhook. The webhook hits the Next.js Route Handler before the SignWell API has finished processing the signature on their end (a race condition documented in e-sign provider APIs). The handler fetches the document PDF from the SignWell API immediately — it gets a 404 or a document still in `processing` state. The system marks the contract as `signed` in the database but no PDF is stored. Matt's admin view shows "signed" but there is no downloadable contract.

A second variant: the webhook fires twice (network retry). The second delivery tries to mark an already-completed contract as completed again, failing on a unique constraint but throwing an unhandled error that returns a non-200 to SignWell, which retries again.

**Why it happens:**
E-sign webhook payloads signal "the signing event happened" not "the document is ready." The provider needs a moment to generate the final PDF.

**How to avoid:**
- On `document.completed` webhook: update the database status to `signed`, but do NOT immediately fetch the PDF — instead, queue a delayed job (n8n webhook or Vercel cron) that fetches the PDF 30 seconds later with a retry loop
- Implement idempotency: store `signwell_event_id` in the contracts table with a UNIQUE constraint; second delivery returns 200 with no processing
- Store the full webhook payload in a `webhook_events` table for debugging — "signed but not received" is much easier to diagnose with the raw payload
- Test this race condition explicitly: trigger a sign event in SignWell sandbox and immediately try to fetch the PDF in the handler before returning 200

**Warning signs:**
- Contract shows "signed" in the DB but the PDF URL is NULL or a 404
- The webhook handler makes a synchronous API call to fetch the PDF in the same request cycle
- No retry logic if the PDF fetch fails

**Phase to address:** Stage 5 — e-sign is in the parallelisable stage. Design the delayed-fetch pattern from the first PR.

---

### Pitfall 15: Twilio UK Compliance — Duplicate Sends and Missing STOP Opt-Out Handling

**What goes wrong:**
The expiry alert n8n workflow (n8n #3) fires daily. If it processes a client whose SMS was already sent today (e.g., because the cron ran twice after an n8n restart), the client receives duplicate messages. They reply STOP. Twilio marks them as opted out. Future critical compliance alerts do not reach them. Matt does not know why.

A second variant: the sender name used in SMS ("888 Safety") does not match a registered UK Sender ID. Under UK Telecommunications (SMS Sender ID Register) Industry Standard 2025, unregistered alphanumeric sender IDs may be blocked by UK networks.

**Why it happens:**
n8n crons can double-fire on restarts or version upgrades. The deduplication key `(document_id, window, recipient)` in PROJECT.MD D7 prevents this IF it is checked before sending — not after.

**How to avoid:**
- Deduplication: before every Twilio send, check the `sms_log` table for `(document_id, alert_window, recipient_phone)` — if a row exists for today, skip the send and log a "skipped-duplicate" event
- Register the Alphanumeric Sender ID "888Safety" (max 11 chars, no spaces) with Twilio for UK — or use a Twilio UK long number that supports two-way messaging (required for STOP to work properly)
- Honour STOP opt-outs: subscribe to Twilio's STOP/UNSTOP webhooks and update a `sms_opt_out` table — check this table before every send
- Include STOP instructions in the first message to a new number: "Reply STOP to unsubscribe"
- Test in UK: send to a UK mobile, verify the sender ID appears as expected, verify STOP reply is received

**Warning signs:**
- The `sms_log` table does not exist or has no unique constraint on `(document_id, window, recipient)`
- The Twilio account has no UK-specific sender ID registration
- There is no webhook handler for inbound Twilio messages (STOP cannot be processed)

**Phase to address:** Stage 4/5 — SMS is implemented across Stages 4 and 5. The dedup table must be part of the Stage 1 schema migration.

---

### Pitfall 16: GDPR — Right to Erasure Conflicts with Immutable Compliance Audit Trail

**What goes wrong:**
A client of Matt's requests deletion of their data under UK GDPR Article 17. The application holds: assessment submissions, generated PDFs, signed contracts, payment transactions, SMS logs, and compliance documents. Some of these are fire safety records that may be legally required to retain for inspection purposes. If the team deletes everything, they may destroy a legally required record. If they delete nothing, they violate the erasure right.

A second variant: the Supabase project is created in the wrong region. By default, Supabase projects in the free tier may default to a US region. Client assessment data (which includes building details, occupancy information, and personal contact data) stored in a US region may not satisfy UK GDPR adequacy requirements.

**Why it happens:**
Greenfield builds rarely design for erasure at the schema level. Region selection happens once at project creation and is not revisitable without a full data migration.

**How to avoid:**
- **Region:** Create the Supabase project in `eu-west-2` (London) or `eu-west-1` (Ireland) — choose at project creation, cannot be changed. Document this decision in the project config
- **Erasure design:** Add a `deleted_at` timestamp column and a `pii_anonymised` boolean to client and assessment tables. On erasure request: anonymise personal identifiers (name → "Deleted User", phone → NULL, email → NULL) but retain the structural compliance record — the fire assessment record must remain for building safety purposes, but the identifiable data on who performed it can be anonymised
- **Retention policy:** Define document retention periods (fire risk assessments in UK are typically retained for the life of the assessment + 5 years minimum) and implement a scheduled purge job
- **Audit of the deletion:** Log every erasure request and its resolution in an append-only `gdpr_erasure_log` table — this is itself a compliance record and must be retained

**Warning signs:**
- Supabase project region is `us-east-1` or not documented
- There is no `deleted_at` or soft-delete pattern in the schema
- Deleting a client row cascades to delete assessment and compliance records without anonymisation

**Phase to address:** Stage 1 — region is selected at project creation. Soft-delete pattern must be in the base schema migration.

---

### Pitfall 17: Personal Account Migration — Secrets Leakage During Handoff to Shared Project Gmail

**What goes wrong:**
Today: Ayman's personal GitHub hosts the repo, Ayman's Vercel hosts the deployment, Ayman's Supabase project holds the data, Amjad has dev access via personal account invites. When the shared project Gmail is provisioned:
- GitHub repo is transferred — existing Vercel integration breaks (Vercel linked to the old repo by path, not by the org). A re-deploy pulls stale environment variables.
- Supabase project is transferred — JWT secret changes if the project is not migrated correctly, invalidating all existing user sessions.
- Old `.env.local` files on both developer machines contain the old Supabase URL and anon key — if these are not deleted and replaced, developers accidentally run against the old project.
- PayPal credentials are currently "pending" — when they arrive, they may be added to Ayman's personal Vercel account and then forgotten during transfer.

**Why it happens:**
The transition is planned to happen "later" and is being managed ad-hoc across a WhatsApp group.

**How to avoid:**
- Before transfer: audit all environment variables in Vercel — list every secret and where it needs to go in the new account
- Use Supabase's official project transfer tool (not "delete + recreate") to preserve the JWT secret and existing user sessions
- After transfer: immediately rotate ALL secrets (Supabase service role, anon key, OpenAI key, PayPal creds, Twilio auth token) — delete old values from personal accounts
- Do not transfer the GitHub repo — instead, let the new org fork or import it fresh, then re-link Vercel to the new repo
- Create a migration runbook now (even if the transfer is weeks away) so the steps are not improvised under pressure

**Warning signs:**
- The handoff plan is "we'll figure it out when the Gmail is ready"
- PayPal credentials have been added to personal Vercel before the shared account exists
- There is no list of all secrets currently in use

**Phase to address:** Stage 1 — document the current secret inventory. Stage 5 (D11 is specifically "PayPal credentials migrated to shared project account").

---

### Pitfall 18: PDF Generation on Vercel Hitting Timeout and Memory Limits

**What goes wrong:**
Report generation (D3) is handled by n8n per the ADR — n8n calls OpenAI, formats the output, and generates a PDF. But if any PDF generation step is implemented on the Next.js/Vercel side (e.g., a route that renders the report as HTML and converts via Puppeteer), Vercel's serverless function constraints apply: Hobby plan has a 10-second timeout, Pro plan has 60 seconds. Puppeteer with Chromium on Vercel is notoriously difficult — the bundled Chromium binary typically exceeds Vercel's 50MB compressed function size limit.

Even with n8n handling generation, if the n8n instance is self-hosted on a resource-constrained VM (e.g., a 1GB DigitalOcean droplet), generating a multi-page PDF report while also running the daily expiry cron will exhaust memory.

**Why it happens:**
PDF generation is memory-intensive. Serverless functions are not designed for it. The ADR correctly moves this to n8n, but the n8n infrastructure spec must be sized accordingly.

**How to avoid:**
- Confirm the ADR holds: ALL PDF generation happens in n8n, never in a Vercel function — document this explicitly in the n8n workflow and add a lint rule or comment warning in the Next.js codebase
- For n8n self-hosted: use at minimum a 2GB RAM instance; separate the n8n process from any Redis/Postgres backing services
- Use n8n's built-in HTTP Request node to call a PDF generation API (e.g., Gotenberg, or an OpenAI-formatted HTML-to-PDF service) rather than running a browser in the n8n container
- Test PDF generation with a full multi-page report (the YELLOW BROOM FRA is multi-section) under n8n before Stage 4 sign-off

**Warning signs:**
- Any Vercel Route Handler imports Puppeteer, Playwright, or `@sparticuz/chromium`
- The n8n instance is on a 512MB or 1GB VM
- PDF generation has only been tested with a short single-section test report

**Phase to address:** Stage 4 — n8n workflows are built here. Infrastructure sizing must be confirmed before the first n8n workflow is deployed.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Skip schema versioning for initial FRA template | Ship Stage 3 faster | Every submission created before versioning is added is unrecoverable for historical rendering | Never — non-negotiable per PROJECT.md |
| Use `service_role` client in Server Actions instead of RLS | Simpler query code | Any auth bypass in Server Actions creates full data exposure; all multi-tenant isolation breaks | Never for client-data mutations |
| Build STT without text fallback | Faster Stage 2 | iPad Safari PWA mode silently drops STT; Matt narrates into the void on-site | Never — fallback must ship with the feature |
| Public Supabase Storage bucket | Simpler upload code | All assessment photos and PDFs are world-readable | Never |
| Skip n8n error workflow | Ship first workflow faster | Silent failures; Matt doesn't know why reports/alerts didn't arrive | Never — error workflow ships with workflow #1 |
| Skip PayPal idempotency check | Simpler webhook handler | Double-crediting hours balance on PayPal retries | Never |
| Use `dynamic = 'auto'` on compliance status pages | No config needed | Stale compliance data served from Next.js cache | Acceptable only if the whole page is data-free (e.g., a static about page) |
| Defer GDPR erasure design | Build faster | Cannot add soft-delete pattern without a migration that touches every table | Never — schema must include `deleted_at` from migration 001 |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Supabase Storage | Assuming table RLS protects files in the bucket | Write explicit `storage.objects` policies; test by fetching a URL while logged out |
| Supabase Auth in Server Actions | Using `getSession()` on the server | Always use `getUser()` — `getSession()` does not validate the cookie server-side |
| Next.js + Supabase SSR | Creating a Supabase server client with the service key inside a `createServerClient` call that also reads cookies | The user's session cookie overrides the service key — use separate client constructors for service-role and user-role contexts |
| PayPal Webhooks | Using the Webhook Simulator for signature verification testing | Simulator events cannot be verified via the verify-webhook-signature endpoint — use real sandbox payments for signature testing |
| PayPal Sandbox | Assuming sandbox webhook delivery is reliable | Sandbox `PAYMENT.CAPTURE.COMPLETED` webhooks are unreliable — use the Simulator for handler testing, verify reconciliation separately |
| n8n Webhooks | Not returning 200 quickly | n8n workflows that do slow work before responding will cause the caller to time out; use "Respond to Webhook" node early, process async |
| Twilio SMS UK | Using a US long code for UK recipients | UK recipients get poor delivery rates from US numbers; use a UK long number or registered Alphanumeric Sender ID |
| SignWell Webhooks | Fetching the signed PDF immediately in the webhook handler | SignWell needs ~30 seconds to finalise the PDF after the signing event — use a delayed fetch |
| Web Speech API | Testing only in Chrome on a laptop | Chrome desktop has reliable STT; iPad Safari PWA does not — always test on the actual device in the actual usage mode |
| HEIC uploads | Accepting `image/*` and storing whatever the browser provides | HEIC is stored but not displayable; convert to JPEG + correct EXIF rotation before upload |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| RLS policy with correlated subquery per row | Compliance dashboard slow when listing many documents | Rewrite policy to use `IN (SELECT ... WHERE user_id = auth.uid())` pattern; index `client_id` and `user_id` | At ~100+ rows per query |
| `unstable_cache` wrapping compliance queries without `revalidateTag` | Stale expiry status shown to clients | Mark compliance routes `force-dynamic` or ensure every mutation calls `revalidateTag` | From day one — compliance data must never be stale |
| n8n self-hosted on 1GB RAM running PDF generation | n8n process OOM-killed; workflows fail silently | Use 2GB+ RAM instance; monitor memory during concurrent workflow runs | When report gen + expiry cron overlap |
| HEIC-to-JPEG conversion in browser without size check | 8MB HEIC → 12MB JPEG uploaded; slow or failed on 4G | Convert then compress to 1.2–1.5MB target before upload; show progress indicator | On any flaky 4G connection |
| Loading all historical submissions from a single client without pagination | Portal list page times out | Paginate submissions list from day one; never `SELECT *` without `LIMIT` | At ~50+ submissions per client |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Service role key in any client-accessible code path | Complete bypass of RLS; all tenant data exposed | `import 'server-only'` on the admin Supabase singleton; audit all imports |
| No `WITH CHECK` clause on RLS INSERT policies | User can insert rows belonging to another client_id | Every INSERT policy needs both `USING` (for existing rows) and `WITH CHECK` (for new rows) |
| SECURITY DEFINER view without `security_invoker = true` | View runs as superuser, returns all tenant rows | Add `WITH (security_invoker = true)` to every view on multi-tenant tables |
| Supabase project in US region | UK personal data stored outside UK/EU adequacy zone | Create project in `eu-west-2` (London) or `eu-west-1` (Ireland) at project creation |
| PayPal webhook without signature verification | Attacker can fake payment events, credit hours balance without paying | Verify every webhook against PayPal's verify-webhook-signature endpoint using the raw request body |
| n8n credentials stored as plain text in node fields | Credentials visible in execution logs | Always use n8n's Credential system; never paste secrets into node parameter fields |
| Secrets committed to git history | Permanent exposure even after removal | `.env*` in `.gitignore` before first commit; use `git-secrets` or similar pre-commit hook |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Mic button shows "recording" but STT is silently failing | Matt narrates 10 minutes of assessment; zero text captured | Show live transcript preview in real-time; if transcript is empty after 3s, show error and fall back to text input |
| Form submission blocked by hidden required field (conditional logic bug) | User cannot submit the form; no clear error | Required-if rules apply only to visible fields; validate this invariant at form render time |
| Image uploads show spinner but fail on flaky 4G with no recovery | Assessment photos lost; no retry option | Implement client-side upload retry with exponential backoff; show clear "failed, tap to retry" per-image |
| Report status requires manual page refresh to update | Matt refreshes repeatedly waiting for AI to finish | Subscribe to `report_status` column via Supabase Realtime; update UI without full page reload |
| Generated PDF contains details from the few-shot example (YELLOW BROOM) | Client receives a report with wrong building name | Show the raw transcript alongside the draft report in Matt's review view so discrepancies are immediately visible |
| Compliance portal shows green status after a document expires (stale cache) | Client believes they are compliant when they are not | Force-dynamic rendering on all compliance status pages; never cache expiry dates |

---

## "Looks Done But Isn't" Checklist

- [ ] **RLS (tables):** Policies exist — verify by logging in as Client A and attempting to read Client B's data via the Supabase JS client (not the SQL Editor)
- [ ] **RLS (storage):** Bucket policies exist AND the bucket is private — verify by fetching a storage URL while logged out and confirming 403
- [ ] **Schema versioning:** Submissions table has `schema_version_id` FK — verify by creating a submission, updating the schema, and confirming the old submission still renders correctly
- [ ] **STT fallback:** Text input is available when STT is unavailable — verify by opening the app in iPad Safari PWA mode (Add to Home Screen)
- [ ] **HEIC upload:** Photos from iPad Camera Roll are converted and display correctly in the assessment review — verify with an actual HEIC file, not a JPEG renamed
- [ ] **PayPal idempotency:** Double-delivering `PAYMENT.CAPTURE.COMPLETED` does not double-credit hours — verify by calling the webhook handler twice with the same event ID
- [ ] **n8n error workflow:** A workflow failure sends a notification AND writes to `workflow_errors` table — verify by triggering a deliberate failure (invalid API key)
- [ ] **Report review gate:** There is no code path that delivers a report PDF without `status = 'approved'` — search codebase for any `storage.getPublicUrl` call that isn't gated on report status
- [ ] **Twilio dedup:** A second run of the expiry cron for the same (document, window, recipient) does not send a second SMS — verify by running the cron twice in quick succession
- [ ] **GDPR region:** Supabase project region is `eu-west-2` or `eu-west-1` — check in the Supabase dashboard Settings > General

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Storage bucket found to be public post-launch | MEDIUM | Change bucket to private immediately; rotate any CDN caches; audit access logs for unauthenticated requests |
| Service role key committed to git | HIGH | Rotate the key immediately in Supabase dashboard; rewrite git history with `git filter-repo`; audit Supabase logs for unexpected access between commit and rotation |
| Schema versioning not implemented before first submissions | HIGH | Write a migration that creates `form_schema_versions` and backfills all existing submissions with a `v0` snapshot; manually verify each backfilled submission renders correctly |
| Double-credited hours balance from PayPal retries | MEDIUM | Query all transactions by `paypal_event_id`; identify duplicates; issue manual credit adjustment and refund; add uniqueness constraint retroactively |
| Supabase project in wrong region | HIGH | No in-place migration exists — must export all data, create a new project in the correct region, import data, update all environment variables, and re-invite all users. Do this before any client data is ingested. |
| n8n workflow errors not visible and alerts missed | MEDIUM | Enable n8n execution history retention; set up email alerts on n8n errors immediately; add `workflow_errors` table and wire up error workflows before the next release |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Storage RLS separate from table RLS | Stage 1 Scaffolding | Fetch storage URL while logged out — expect 403 |
| Service role key leaking | Stage 1 Scaffolding | `grep -r 'service_role'` in client-side code — expect zero results |
| RLS recursive performance | Stage 1 + Stage 2 profiling | `EXPLAIN ANALYZE` with RLS-enabled role on seeded data |
| SECURITY DEFINER view bypass | Stage 1 (convention) | Supabase DB Advisor lint — zero security_definer_view warnings |
| auth.uid() in triggers | Stage 1 | Unit test: insert row via Supabase JS client, verify `created_by` is not NULL |
| Next.js stale compliance data | Stage 2 (mutation patterns) + Stage 4 | Manual test: update status, verify portal reflects it immediately |
| Form schema versioning | Stage 3 (green-light gate) | Demo: fill form v1, publish v2, render v1 submission — must match original |
| Conditional logic infinite loop | Stage 3 | DAG validation test with circular dependency — must fail gracefully at publish |
| Web Speech API silent failure | Stage 2 (STT component) | Test on actual iPad via home screen shortcut |
| HEIC rotation and display | Stage 2 (photo upload component) | Upload HEIC from iPad Camera Roll, verify display and PDF rendering |
| AI hallucination in reports | Stage 4 (n8n report pipeline) | Review gate includes side-by-side transcript + generated content; structured output enforced |
| n8n silent failures | Stage 4 (first n8n workflow) | Trigger deliberate failure, verify notification and DB log |
| PayPal idempotency | Stage 5 (PayPal integration) | Send webhook twice with same event ID, verify single credit |
| E-sign race condition | Stage 5 (e-sign integration) | Verify signed PDF is available before route handler fetches it |
| Twilio duplicate SMS | Stage 4/5 (SMS integration) | Run expiry cron twice, verify single SMS delivered |
| GDPR region and erasure | Stage 1 (project creation) | Check Supabase dashboard region before first data is written |
| Personal account migration | Stage 1 (inventory) + Stage 5 (D11) | Secret inventory documented; all secrets rotated after transfer |
| PDF generation Vercel timeouts | Stage 4 (n8n infrastructure) | Full multi-page PDF generated end-to-end in n8n under load |

---

## Sources

- Supabase Storage Access Control: https://supabase.com/docs/guides/storage/security/access-control
- Supabase RLS Performance and Best Practices: https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv
- Supabase Database Advisors (SECURITY DEFINER lint): https://supabase.com/docs/guides/database/database-advisors
- Postgres RLS Footguns (Bytebase): https://www.bytebase.com/blog/postgres-row-level-security-footguns/
- Next.js 16 Caching (official docs, version 16.2.3, updated 2026-04-10): https://nextjs.org/docs/app/building-your-application/caching
- Next.js + Supabase Production Lessons: https://catjam.fi/articles/next-supabase-what-do-differently
- PayPal Idempotency Guidelines: https://developer.paypal.com/reference/guidelines/idempotency/
- PayPal Webhooks Guide: https://inventivehq.com/blog/paypal-webhooks-guide
- Hookdeck — PayPal Webhook Best Practices: https://hookdeck.com/webhooks/platforms/guide-to-paypal-webhooks-features-and-best-practices
- n8n Error Handling Docs: https://docs.n8n.io/flow-logic/error-handling/
- n8n 2.0 Publish/Save Paradigm: https://blog.n8n.io/introducing-n8n-2-0/
- Web Speech API Deep Dive: https://blog.addpipe.com/a-deep-dive-into-the-web-speech-api/
- WebKit SpeechRecognition PWA Issue: https://github.com/WebKit/Documentation/issues/120
- HEIC Rendering on the Web: https://dev.to/upsidelab/rendering-heic-on-the-web-how-to-make-your-web-app-handle-iphone-photos-pj1
- Sharp JPEG EXIF rotation issue: https://github.com/lovell/sharp/issues/4059
- Twilio UK SMS Guidelines: https://www.twilio.com/en-us/guidelines/gb/sms
- Twilio Sender ID Addendum 2025: https://www.twilio.com/en-us/legal/senderid-addendum
- SignWell UK eSignature Legal Compliance: https://www.signwell.com/resources/electronic-signature-uk/
- SignWell Audit Trail: https://www.signwell.com/resources/electronic-signature-audit-trail/
- ICO UK GDPR Right to Erasure: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/individual-rights/right-to-erasure/
- Right to Erasure vs Audit Trail: https://axiom.co/blog/the-right-to-be-forgotten-vs-audit-trail-mandates
- Supabase GDPR and DPA: https://supabase.com/legal/dpa
- Vercel PDF Generation Limits: https://community.vercel.com/t/how-to-fix-vercel-serverless-function-timeouts-by-increasing-memory-allocation/35888
- Supabase Project Migration Auth: https://supabase.com/docs/guides/troubleshooting/migrating-auth-users-between-projects
- Coltorapps Builder Schema Docs: https://builder.coltorapps.com/docs/schema

---
*Pitfalls research for: 888 Safety & Training Platform — multi-tenant H&S compliance SaaS*
*Researched: 2026-04-15*
