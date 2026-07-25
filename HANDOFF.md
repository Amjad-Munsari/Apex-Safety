# Session Handoff — 2026-07-25

Working state for the next session. Everything below is verified against prod/repo at the time of writing. Repo: `/Users/aymanbaig/dev/fire-safety-platform`. Prod: `https://www.merlinsafetysystem.com` (Vercel project `fire-safety-platform`, `prj_NEX03VTgkZmD4SIfxXf7BPhNi569`). System name **Merlin**; public brand **888 Safety & Training** (Matt's UK fire-safety consultancy).

Git: `main` clean, all pushed. HEAD `2e58cee`. All migrations applied and **verified in-schema** (see §3).

---

## 1. What shipped this session (done, deployed, verified)

### a. deleteClient FK-ordering fix — commit `03217a8`
`deleteClient` (`app/admin/clients/actions.ts`) died on `form_submissions.template_version_id` (an FK with **no** cascade) for any client that had ever submitted their own template: it deleted the customer's `form_templates` first, whose `template_versions` cascade-delete, while the client's submissions still referenced those versions → FK violation, leaving the org half-deleted (storage already purged, DB rows present). Reproduced live during the handover walkthrough.
Fix: delete the **client row first** (migration 021's cascade removes `form_submissions`), then templates (best-effort), then purge the org's portal users from `auth.users` (previously orphaned on every delete). Tests updated — they had been asserting the buggy order.

### b. Credits pricing model — commit `359f115` + migration 026 (applied to prod)
**Requirement** (Finley, Jul 20, confirmed scope): retained balance denominated in **credits** not hours, `1 hour = 4 credits` default with an **admin-editable rate**, manual assignment to any client, no proposal/contract coupling. PayPal purchase stays.

**Design (binding — do not re-litigate; survived 3 plan-review + 3 implementation-review rounds):**
- Credits are the **stored unit**. `clients.hours_balance` / `hours_transactions.hours_amount` are **reinterpreted** as integer credits — **no column renames** (churn with zero value; documented via `COMMENT ON COLUMN`).
- Balances are **not** derived from hours×rate — a rate change must never retroactively move balances.
- New `app_settings.credits_per_hour` int (default 4, `CHECK >= 1`), exposed as `AppSettings.creditsPerHour`, editable in admin Settings. It's a **reference rate** for display + the adjust-dialog conversion only.
- Packages → credit packs at **unchanged prices**: `20c`/£495, `40c`/£950 (popular), `80c`/£1800. `getPackage()` also resolves legacy ids `5h`/`10h`/`20h` → the equivalent new pack, so a checkout whose PayPal popup opened pre-deploy still captures. **Aliases marked for removal after handover settles.**
- RPC `credit_hours_from_paypal` name unchanged (`p_hours` now carries credits) — renaming a SECURITY DEFINER fn in prod for cosmetics is risk with no benefit.
- `hoursToCredits(hours, rate)` (`lib/billing/credits.ts`): round positive magnitude, then apply sign (keeps ±1.5h symmetric at odd rates).

**Migration 026 (`supabase/migrations/026_credits_model.sql`, APPLIED to prod):**
- Adds `credits_per_hour` + `COMMENT ON COLUMN`.
- **Locked emptiness guard**: a leading `DO` block that `LOCK`s `clients` + `hours_transactions` `IN EXCLUSIVE MODE`, then `RAISE`s if any `hours_transactions` rows exist or any `clients.hours_balance <> 0` — so it can never silently reinterpret existing hours as credits. Header documents the **operational cutover contract**: apply migration + deploy the credits build back-to-back with no admin balance writes between (the post-commit/pre-deploy window is closed operationally, not by SQL).
- Atomic **`adjust_client_credits(p_client_id uuid, p_adjustment numeric, p_description text)`** SECURITY DEFINER, `SET search_path = ''`, schema-qualified: one transaction does `SELECT ... FOR UPDATE` (reads balance **and** `active`), rejects non-integer / zero / not-found / overdraft / **inactive** with distinct `RAISE` tokens (`credits_not_integer` / `credits_zero` / `client_not_found` / `credits_overdraft` / `client_inactive`), applies a **relative** `hours_balance = hours_balance + p_adjustment`, and inserts the `hours_transactions` ledger row. Grants revoked from public/anon/authenticated, granted to `service_role` only (mirrors migration 025).

**App wiring:** `updateClientHours` (`app/admin/clients/actions.ts`) delegates to the RPC and returns a **typed `{ ok:true; balance } | { ok:false; error }` union** (expected errors as values per Next docs, not throws), mapping the RPC tokens. The adjust dialog (`components/clients/adjust-hours-dialog.tsx`) has a credits/hours unit toggle (credits default `step=1`; hours `step=0.5` with a live "1.5h → 8 credits" preview), rejects non-integer/negative typed input, submits integer credits only, validates **derived credits** vs balance, wraps submit in try/catch/finally, and surfaces server errors in the UI. Dashboards rescaled ×4 (client low `<20`; admin `<12`/`<40` + `/80` progress scale). Full hours→credits copy sweep. `supabase/seed.sql` + test fixtures converted to integers.

**Verified live on prod** (test client created + deleted): `adjust_client_credits` gave +40 then −10 → balance 30 with two correct `manual_adjustment` ledger rows; all guards (overdraft/non-integer/zero) rejected with their tokens and left **no** ledger row (atomic); client delete cascaded the ledger. 622 tests green, build clean, deploy READY.

### c. Earlier this session (already deployed before credits work)
- `e479342` — pre-handover review fixes: email links use `getSiteUrl()` (prod fallback is the real domain, never localhost/vercel.app); expiry cron now sends an admin digest; `deleteClient` also purges `client-documents` bucket; New Client dialog no longer claims "invite emailed" on failure.
- Fixed prod env `NEXT_PUBLIC_SITE_URL` (was the stale `fire-safety-platform.vercel.app`, now `https://www.merlinsafetysystem.com`).
- Auth/invite + role-gate chain verified working on prod via HTTP (invite→confirm→set-password→login→gates; single-use links; `/login/forgot`→Resend delivered).

---

## 1b. Client-handover readiness (checked against prod 2026-07-25)

### FIXED: `app_settings` was empty on prod → Settings page silently discarded every save (commit `4cd3b1f`)
Zero rows in `app_settings` despite migration 023 seeding `id=1`; `credits_per_hour` (from 026) was present, so both migrations applied and the row was deleted afterwards — collateral from this session's test-data cleanup. All writes were `.update().eq("id",1)`, and an UPDATE matching no rows isn't an error, so saves returned `ok:true` and persisted nothing while `getAppSettings()` masked it with `DEFAULT_APP_SETTINGS`. Sign-off name, sender name, both toggles and the credits rate were all unsaveable.
Fix: all three writes upsert on `id=1` (self-heals), migration **028** restores the seed row, and the row was **restored on prod directly** (verified: defaults `Matt Robinson` / `888 Safety & Training` / both toggles true / `credits_per_hour 4`). Test mock now exposes only `upsert` so a regression to `update` fails loudly. **Migration 028 applied to prod** by the user and verified a clean no-op: one row, values untouched, `updated_at` unchanged from the pre-028 state (so `ON CONFLICT DO NOTHING` did not overwrite the live row).
**Verified end-to-end on prod through the admin UI** (user signed in, Claude drove): changed Sign-off Name → "Settings saved" toast → hard reload → value persisted → confirmed in DB with a fresh `updated_at` → reverted through the same path. Final state is the original values.

### CAVEAT (by design, but Matt will misread it): brand colours are localStorage-only
Settings → Branding primary/secondary colours are persisted by `saveBranding()` to **`localStorage`** and re-applied per-browser by `<BrandingProvider>` — `app_settings` has no colour columns. `lib/branding.ts` documents this as intentional and server-rendered PDFs keep the static `BRAND` defaults. The consequence is that Matt's colour choice does **not** follow him to another device, does **not** reach his customers' portal (their browsers have their own localStorage, so they see the defaults), and does **not** reach PDFs — while the save toast says "Brand colours and notification defaults applied." Not a bug against the current design; flagging it because "change our brand colours" almost certainly means "everywhere" to Matt. Making it real means colour columns on `app_settings` + server-side application — a feature call, not a fix.

### Prod is an empty shell — Matt can't do a job on day one
Verified counts: `form_templates` **0**, `clients` 0, `services` **0**, `contractors` 0, `proposals` 0. Only real row is Matt in `admin_users`.
- **No FRA / site-risk master template** — the core loop (assign → client fills → report) has nothing to assign. `seed.sql` does NOT seed templates at all. Needs Matt's real FRA questions: either a session with him or he builds them in the builder.
- **No services price list** — proposals have no line items to draw from. `seed.sql` DOES contain Matt's full catalogue (25 training courses + 10 services, real prices incl. Class 1 £3900, PAT £1/item) with an idempotent `ON CONFLICT DO UPDATE`. **Deliberately NOT loaded into prod:** those are customer-facing quoted prices, so Matt must confirm they're current first. Once he does, that block runs as-is.

### Also raise with Matt/Finley
Checkout UI displays "VAT included" but nothing emails a receipt or invoice — for a UK business taking real money that's more than the LOW it was filed as in §2B.

---

## 1c. Hole-hunt 2026-07-25 (post-handover sweep)

> **Status after the fix pass:** everything found in this sweep is fixed and pushed except the password-reset rate limit (below), which needs a rate-limiting approach chosen rather than a code tweak. **Migration 029 needs applying to prod** — it is the only outstanding operational step. 647 tests green, build clean. HEAD `2e58cee`.

**Security surface came back clean** — probed live, not just read: anon key against prod REST is denied on every write (`42501` RLS) and on both money RPCs (`permission denied for function credit_hours_from_paypal` / `adjust_client_credits`, so migration 025 holds); `app_settings` is `42501` (grants revoked); both cron endpoints 401 unauthenticated and reject a wrong `?secret=`; `/api/admin/search` 401s and sanitises PostgREST filter metacharacters; `/api/sign/<bogus>` returns 410 without leaking existence. Every client-facing `createSignedUrl` derives its path from a row already scoped by `.eq("client_id", ctx.client_id)` — no IDOR. Soft-delete filtering on the three tables that actually use it (`form_assignments`, `contractors`, `services`) is enforced, including `requireOwnedAssignment`. Only definer function lacking `search_path` was the one 027 fixed. `auth.users` holds Matt alone — no leftover test users (audit blocker 9).

### FIXED — Month-Summary "Assessments" tile rendered no number (commit `39ff311`)
Root cause found: the tiles built their colour class by interpolation, `text-${stat.color}`. Tailwind scans source *text* for class candidates, so an interpolated name is never seen by the compiler — it only renders when an unrelated file happens to use the same literal. Assessments' colour was `"white"` → `text-white`, which IS generated (billing uses it), so the count drew white-on-white. Now static class strings, Assessments on `text-foreground` (theme-correct both modes). This closes the walkthrough "nit" as an actual defect.
**Now also fixed (commit `4902cfd`) — all 7 sibling interpolation sites** (`app/admin/clients/_components/client-row.tsx`, `app/admin/compliance/compliance-doc-row.tsx`, `app/admin/compliance/page.tsx`, `app/admin/hours/page.tsx`). Some need classes with **zero** static occurrences anywhere — `bg-teal/5` and `text-gold/60` are not in the generated CSS at all, so those badges silently lose their tint. There is no Tailwind safelist (v4, CSS-first config), so the whole pattern is one unrelated deletion away from more breakage. Fixing it is a visual-regression pass of its own.

### FIXED — the AI prompt-injection sentinel was escapable by a customer answer (commit `20aee86`)
`buildReportPrompt` wraps answers in `<user_provided_answers>` and instructs the model to treat that block as data. That wrapper was the only boundary, and `JSON.stringify` escapes quotes and backslashes but **not angle brackets** — so a customer typing `</user_provided_answers>` into any free-text field closed the block early and landed in instruction context, right before the tail-anchored rule, in a report Matt signs off as the competent person. The file's own header called this hardening "the precondition" for customer-typed strings reaching the prompt, and that path is live (Phase 16 customer fills), so the assessor is no longer the sole author of the answers. Both tags in either direction are now neutralised before wrapping (whitespace/case tolerant), with the text preserved as inert data rather than deleted so nothing vanishes from a report. Three regression tests, **verified red without the fix**; assertions scope to the real answers block because `INJECTION_GUARD` names both tags literally.
Note this is a boundary fix, not a claim that the model is now injection-proof — it removes the trivial escape, and Matt reviewing every draft remains the real control.

### FIXED (commit `2e58cee`, migration 029) — the e-signature document hash was unverifiable: the attested PDF was overwritten in place
This is audit **blocker 6** ("repair e-signature immutability and transactional evidence"), still live. The mechanics around it are actually strong — `generateSigningToken` uses 32 random bytes base64url, only the SHA-256 is stored in `proposals.signing_token`, single-use and expiry are enforced, and consumption is a proper claim-first atomic update (`.eq("signing_token_used", false).select().maybeSingle()` → 409 if the claim loses) with rollback on downstream failure. The gap is the artifact:
- `proposal_signatures.document_hash` records the SHA-256 of the **pre-stamp** PDF (`consumed.signing_document_hash`, captured at send time).
- Step 8 then re-uploads the **stamped** PDF to `consumed.proposal_pdf_path` with `upsert: true` — **overwriting the very file the hash attests to**. No copy of the original survives.
- So re-hashing the stored PDF will *always* mismatch the recorded hash. The hash cannot distinguish "stamped as designed" from "someone swapped the document" — both look identical. The evidence is unverifiable, which defeats the purpose of storing it.
- Worse for evidential value: step 8 is best-effort inside `try/catch` and only `console.error`s on failure, so whether the stored file matches its recorded hash depends on whether an unlogged step happened to succeed. A mismatch is therefore ambiguous rather than meaningful.
**Fix direction (needs a decision, not a quiet edit — it changes storage layout and evidence semantics for a legal artifact):** write the stamped PDF to a **new** path (e.g. `<id>-signed.pdf`), leave the original immutable, and store both hashes so verification has something to compare against. Worth raising with Matt/Finley since it bears on whether first-party signing is acceptable at all (an open client decision in the audit).

### STILL OPEN (LOW) — no rate limit on the public password-reset action
`requestPasswordReset` (`app/login/forgot/actions.ts`) is correctly enumeration-safe in its *response* — always `{ ok: true }`, never discloses account existence, and it records dispatch failures to `workflow_errors`. But there is no rate limiting, so a caller can trigger unlimited reset emails to a known address (inbox flooding, Resend quota burn), and the unknown-account path returns early without a `generateLink` round-trip or an email send, leaving a timing side channel that leaks existence despite the identical response body.

### FIXED (commit `49c1f57`) — MIME allowlists were skipped when the browser sent no content type
`lib/documents/actions.ts` and `app/admin/settings/actions.ts` both guard with `if (file.type && !ALLOWED.has(file.type))`, so a request whose file part carries no `Content-Type` bypasses the allowlist entirely; the stored extension also comes from `file.name` unvalidated. Both paths are admin-gated (`isAdmin()`), buckets are private and served via short-lived signed URLs on the Supabase origin rather than the app's, so this is defence-in-depth rather than a live exposure — but the allowlist should be fail-closed.

### FIXED (commit `49c1f57`) — expiry alerts had no catch-up, and nothing fired when a document actually expired
`app/api/cron/expiry/route.ts` matches `.in("expiry_date", [day30, day14, day7])` — exact calendar days, once daily at 06:00 UTC. Consequences:
- A document uploaded **less than 7 days** before it expires never equals any window, so it gets **zero** alerts and expires silently.
- One missed run (Vercel crons are best-effort, a failed deploy, a function error) loses that window **permanently** — the `notifications_sent` table is consulted only to prevent duplicates, never to catch up.
- Toggling "Send expiry reminders" off returns before any dedup write, so every window crossed while it's off is lost forever.
- There is **no alert at all once a document is past its expiry date** — the assignment scheduler has an `overdue` catch-all branch (`due_date < today`), expiry has no equivalent.
Mitigating: the dashboard *does* count expired/expiring documents (`lib/supabase/dashboard.ts`), so it's visible in-app — it just never emails. Fix is cheap and safe: match a range instead of exact dates and let the existing `UNIQUE (document_id, alert_window, notification_type)` constraint do the deduping — that makes it self-healing. For a compliance product where the alert *is* the product, worth doing before Matt's first real client.

### FIXED (commit `49c1f57`) — client form-event dispatch failures were invisible to the app
`lib/notifications/client-form-events.ts` logs a failed dispatch to `console.error` and nothing else — no `workflow_errors` row, unlike every other dispatch caller (`sendAssignmentReminder`'s cron caller does record and retry correctly). These are exactly the `client_form_created` / `client_form_submitted` / `client_template_cloned` events already known broken downstream (§2C). So there are two stacked blind spots: n8n-internal failures don't fail the POST, and a POST that *does* fail is never recorded. Matt's Workflow Errors page reads "ALL CLEAR" either way.

### FIXED (commit `49c1f57`) — outbound n8n webhook had no timeout while awaited on the client's submit path
`dispatchToN8n` calls `fetch` with no `AbortSignal`/timeout, and `dispatchClientFormEvent` is `await`ed inline in `app/client/assignments/actions.ts` and `app/client/templates/actions.ts`. An n8n endpoint that accepts the connection but never responds stalls the client's submit action until the platform function timeout. No data loss — the submission is committed before dispatch and the wrapper never throws — but the customer watches a spinner for a third party.

### FIXED (commit `49c1f57`) — month-summary month boundary was local-time
`new Date(now.getFullYear(), now.getMonth(), 1).toISOString()` builds local midnight then serialises as UTC, so during BST the window starts 23:00 on the last day of the previous month and counts an hour of it. Cosmetic on a monthly tile; the crons already use explicit UTC helpers.

---

## 2. Open items — NOT done yet

### A. PayPal credentials are BROKEN in prod (blocker for any purchase)
The stored `PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET` fail PayPal OAuth (`invalid_client`) against **both** live and sandbox endpoints — so no checkout (sandbox or live) can complete today. Diagnosis:
- `PAYPAL_CLIENT_ID` has a **stray trailing `#`** — a chat line-wrap artifact from Finley's 29-Jun message (real PayPal client ids are 80 chars, alphanumeric; stripping `#` → exactly 80).
- Even with `#` removed it still 401s → the **secret** is also mistyped, or (likely, given the age) the app's secret was **regenerated** since 29 Jun, which kills the old one.
- Current prod `PAYPAL_MODE = sandbox`, `PAYPAL_ENABLED = true`.

**User decision captured:** target is **Live (real money)**. **Do NOT re-key a secret from the screenshot** (OCR of credentials is unreliable — this was an explicit call). Need the **Live app's** Client ID + a freshly regenerated Secret from whoever owns the PayPal app (Matt/Finley — user has no PayPal access). Then: set both in Vercel prod, flip `PAYPAL_MODE=live`, lower one pack to ~£1 for the test, user buys, then **revert** price (and consider whether to keep live). To determine which environment a given credential pair belongs to: `curl -u "CID:SEC" -d grant_type=client_credentials` against `https://api-m.paypal.com/v1/oauth2/token` (live) and `.../api-m.sandbox.paypal.com/...` — whichever returns 200 is its environment.

### B. Checkout review fixes — MEDIUM + LOW APPLIED (commits `9ace04e`, `08e3ff2`); migration 027 still needs applying to prod

**Applied 2026-07-25 on user go-ahead:**
- MEDIUM — `billing-client.tsx` `captureOrder` no longer clears `?token=` in a `finally`. The URL is cleaned only on a settled order (credited / already credited) or cancel; a **failed** capture keeps its token so a reload re-drives the idempotent capture, and the error toast is persistent with a **Retry** action. The server-side idempotency this leans on is already covered by `tests/paypal/capture-order-route.test.ts` (ORDER_ALREADY_CAPTURED recovery + `credit_failed` 500 — the money-taken-but-uncredited case).
  - **No unit test added for the component:** the repo has no `@testing-library/react` / effect-level client test infra (component tests use `renderToStaticMarkup` only), so this control-flow change is unverified by tests. Verified by reading + build/test gates.
- LOW — `supabase/migrations/027_credit_hours_from_paypal_search_path.sql`: `CREATE OR REPLACE` of `credit_hours_from_paypal` with `set search_path = ''` and schema-qualified references, plus a re-assert of 025's REVOKE/GRANT. Behaviour unchanged.
  - **User reports 027 applied to prod** via the dashboard SQL editor. Unverified from here — no DDL/catalog access (see §3), so `pg_proc.proconfig` was never read back. To confirm: `select proname, proconfig from pg_proc where proname = 'credit_hours_from_paypal';` should show `{search_path=}`. Nothing in the app depends on it either way.

622 tests green, `npm run build` clean, **pushed and deployed to prod** (`b11ad37` → `dpl_7xnar…`, READY).

The LOW/product items below remain open for Matt/Finley.

<details><summary>Original review verdict (kept for context)</summary>
End-to-end checkout review verdict: **fundamentally sound, no critical/high.** Authorization is correct (a client cannot capture another's order — `custom_id`/`ctx.client_id` checked at two points; `paypal_order_id TEXT UNIQUE` confirmed; amount re-derived server-side). UI/UX complete (loading, double-submit lockout, success/cancel/error, `PAYPAL_ENABLED=false` degrades cleanly). Findings to optionally fix:
- **MEDIUM (recommended):** `billing-client.tsx` `captureOrder` `finally` clears the `?token=` on **every** outcome incl. failure, defeating the idempotent retry the server was built for. Worst case: PayPal captured (money taken) but RPC failed → no client-side recovery, only "contact consultant" toast (recoverable only via manual `adjust_client_credits`). Fix: clear token on success/cancel only; leave it on failed capture so a refresh re-drives the idempotent capture.
- **LOW:** `credit_hours_from_paypal` (migration 001) is SECURITY DEFINER without `set search_path = ''` (the newer `adjust_client_credits` does set it). Fold into a small **migration 027** for consistency. Already service-role-only, so not exploitable — hygiene.
- **LOW / product decisions (leave for Matt/Finley):** no `active`-client gate on purchase/crediting (`getClientContext` + `credit_hours_from_paypal` don't check `active`, unlike `adjust_client_credits`); no emailed purchase **receipt** (confirmation is toast + ledger only); `PENDING` captures (rare eCheck) treated as failure with no later reconciliation.

**Next action if approved:** apply the MEDIUM (`billing-client.tsx`) + the LOW `search_path` (new migration 027, needs applying to prod same as 026).

</details>

### C. Other known items (from earlier walkthrough, for Matt/Finley — not code-blocking)
- **Brand split:** emails say "Merlin Safety System", but PDFs (proposal/report/contract), login pages, and client footer say "888 Safety & Training" / `888FST@proton.me`, plus two mismatched phone numbers (PDF `0114 555 0188` vs footer `0161 552 0918`). Needs a brand decision, then align.
- **n8n "Email Notifications" workflow** errors on `client_form_*` events — the app sends only `client_id` (by design; `dispatch.ts` documents "n8n resolves name/email downstream") and the workflow never does that lookup → empty recipient. Finley's n8n work. These failures are invisible to the app's Workflow-Errors page (the webhook POST succeeds; n8n-internal error).
- Scope still unbuilt per original proposal: **speech-to-text** (parked by user), **SMS/Twilio**, **PWA/offline**, seeded **site-risk master** template.
- Quality nits from walkthrough: AI report draft hallucinates content from sparse forms (needs grounding); admin greets "Matt" regardless of who's signed in; Month-Summary "Assessments" tile renders no number.

---

## 3. Environment gotchas (bit us this session)
- **Service-role key:** the repo `.env.local` `SUPABASE_SERVICE_ROLE_KEY` decodes to the correct ref `lksxdpgkbiuorjdvebdz` and **is right**. The **shell env** exports a STALE one for a different project (`nnbitdzjyijhxyzlabwz`) that lksx rejects. Always `set -a && source .env.local && set +a` so the repo value wins. `vercel env pull` returns the service key **empty** (sensitive-type var).
- **DDL access (CHANGED 2026-07-25):** the `sbp_` management token now lives in `.env.local` as `SUPABASE_ACCESS_TOKEN` (gitignored). `POST https://api.supabase.com/v1/projects/lksxdpgkbiuorjdvebdz/database/query` with `{"query": "..."}` connects as **postgres superuser** and runs DDL — migrations no longer need the user. The service-role key is NOT a substitute: it only reaches PostgREST, which is DML-only (verified — two RPCs total, no `exec_sql`, and the service key 401s against the Management API), and the local `supabase` CLI is authed to a different account that cannot see this project.
- **`supabase_migrations.schema_migrations` is stale — do not trust it.** 14 rows ending at `app_settings` (023, June) while 024–029 are demonstrably applied; migrations here are hand-run SQL and the on-disk filenames aren't CLI timestamp format. Verify by inspecting the schema (`information_schema.columns`, `pg_policies`, `pg_proc.proconfig`/`proacl`), never the ledger. **Verified applied 2026-07-25:** every structural migration through 029 — incl. 027 (`credit_hours_from_paypal` now has `search_path=""`), 025 (`proacl` = `postgres=X service_role=X`, no PUBLIC/anon/authenticated), 029 (both columns present), 005 (FK dropped), 0231 (policy on `public.field_media`). The seed-data migrations (010/011/012/016) are **unconfirmable** — their rows were deleted in the wipe. Ledger deliberately left unrepaired rather than fabricating rows for migrations that cannot be confirmed.
- **Vercel deploy polling:** hitting `merlinsafetysystem.com` in a rapid curl loop trips Vercel's bot-challenge (`x-vercel-mitigated: challenge`, HTTP 403) — not a site problem. Use `mcp__vercel__get_deployment` on the domain instead; the default `list_deployments` MCP call points at the wrong project (`hexos`).
- **Codex peer-review runtime:** `codex:codex-rescue` subagent, or directly `node ~/.claude/plugins/cache/openai-codex/codex/1.0.6/scripts/codex-companion.mjs task [--fresh|--resume] "..."`. Was 503-ing (ChatGPT `biscuit_baker circuit_open` outage) at end of session — retry later.
- **cliproxy (CLIProxyAPI):** running on `127.0.0.1:8317`, inbound key in `/opt/homebrew/etc/cliproxyapi.conf` under `api-keys:`. OpenAI-compatible `/v1/chat/completions` + `/v1/models`. Serves gpt-5.x + grok models. At session end **both** paths were down: Codex-family → same ChatGPT 503; Grok/xAI → expired credentials (needs xAI CLI re-auth). Checkout review was done by a Claude subagent instead.

---

## 4. How to resume
1. If continuing PayPal: get valid **Live** creds (§2A), set in Vercel, flip mode, lower a pack price, hand to user to test, revert. Verify creds first with the `oauth2/token` curl before flipping.
2. Checkout fixes are **applied and committed** (§2B). Remaining: user applies **migration 027** in the Supabase SQL editor, then push `main` to deploy.
3. Prod currently has **zero clients** (all test data cleaned up; only `mathew.robinson@888safetyandtraining.com` in `admin_users`). Matt's first real client will be the first persistent data.
4. Verification gates used all session: `npm run build` + `npm test` must both be green before any deploy; migrations applied to prod before the code that needs them.

Project memory (`~/.claude/projects/-Users-aymanbaig-dev-fire-safety-platform/memory/`) has the durable facts (Supabase access, brand direction, walkthrough findings). This file is the session-specific detail.
