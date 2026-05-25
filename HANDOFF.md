# Session handoff — 2026-05-13 (Milestone 2 sign-off)

Repo: `C:\dev\Antigravity\888 Safety\`. Single canonical clone, branch `main`. User is Amjad; client is Matt Robinson at 888 Safety & Training.

---

## Where we are

**Milestone 2 (Modules 2 + 4 production push) is complete and audited against the original spec.** Every item in the spec is shipped, every open item from the previous handoff is closed.

Most recent commits (newest first):
```
69519a4  fix(proposals): enforce AI key in prod + rebrand consultant to Matt Robinson
14d33f3  chore(scripts): add cleanup-orphan-pdfs for storage GC
7c02258  fix(assessments): switch autosave + submit to adminClient
4d6189d  feat(services): add the 3 monthly packages
35e26ff  fix(proposals): don't throw in draftProposalScope when AI key missing
fa3e8fb  fix(clients): switch /admin/clients/[id] to adminClient + drop dead pdfUrl
```

### Closed today
- **Assessment autosave silently failing** — `autosaveAnswers` and `submitAssessment` were going through the SSR-auth Supabase client. The `form_submissions` admin RLS policy gates on `app_metadata.role = 'admin'`. Matt's auth user doesn't carry that claim, so every UPDATE matched zero rows but returned no error. The UI flashed "Saving…" → "Saved" while nothing persisted. Fix: write through `adminClient`, keep the SSR client for the auth gate, throw on zero-row matches so future regressions surface. `7c02258`
- **Storage orphans** — 8 PDFs (7 in `proposals/`, 1 in `reports/`) deleted via `scripts/cleanup-orphan-pdfs.mjs`. Script is idempotent; re-run anytime test/demo wipes leave residue. Direct `DELETE FROM storage.objects` is blocked by Supabase's `protect_delete` trigger — the script uses the Storage API. `14d33f3`
- **Production AI key gate** — Re-added the prod throw in `draftProposalScope`. Spec required it; the prior removal was a stopgap before `OPENROUTER_API_KEY` was provisioned in Vercel. Dev/preview still get the canned fallback. `69519a4`
- **"Matt Hollis" placeholder** — Rebranded to Matt Robinson across proposal builder, PDF, and assessment builder. Every PDF Matt had been sending carried the wrong consultant name. Avatar initials MH → MR. `69519a4`
- **Server Components render error** (yesterday's Item 1) — couldn't reproduce; presumed resolved by a subsequent deploy. Not chased further.

### Verified shipped (from full spec audit)
All Pre-sprint + Phase 1 + Phase 2 done-criteria checked against actual code/DB:
- Dineen branding cleaned from user-facing code (planning docs still mention it — out of scope)
- Sidebar hover, dropdown theming
- Client portal compliance reads from Supabase (RLS-gated)
- `vercel.json` schedules `/api/cron/expiry` daily at 06:00 UTC
- n8n notification dispatcher replaces `mock-dispatch.ts`
- `notifications_sent` dedup is wired
- Document upload modal lives on **both** `/admin/clients/[id]` and `/admin/compliance`
- Actionable compliance rows + manual reminder dispatch
- `tests/security.spec.ts` is a real Playwright test for cross-tenant RLS isolation
- Services table: 3 Monthly Packages, 10 Services, 25 Training courses
- Proposal builder reads from `services`, signed-URL downloads, override prices, save-as-draft, delete
- `proposals` audit columns (`sent_at`, `viewed_at`, `updated_at` trigger via migration 008)
- `markProposalViewed` fires once on the client's first view (idempotent)

---

## What's NOT touched (deferred, per the deferred-work memory)

These remain explicitly out of scope until prerequisites land:

- **Module 1 (AI Reports)** — blocked on Module 5 form-builder conditional logic
- **Module 3 (Hours/Billing)** — blocked on PayPal account details from client
- **Module 5 (Form Builder)** — conditional logic engine, user-level assignment, due-date alerts (3–4 week effort, separate milestone)
- **E-signature** (Signwell/DocuSign) — canvas-only stub remains
- **Twilio/Resend direct integration** — n8n bridge handles email/SMS instead
- **Mobile responsiveness pass** — separate milestone
- **Template editor writer bug** (`/admin/templates/[id]`) — produces malformed `{ fields: [...] }` schemas without a `sections` wrapper. The reader-side normalizer in `types/forms.ts` tolerates it; the writer is unfixed. Address as part of the Module 5 form-builder work.

---

## Prod database state (Supabase project `lksxdpgkbiuorjdvebdz`)

- **Schema:** migrations `001`–`009`. `007` services columns, `008` proposals audit columns, `009` clients contact columns. `001`–`006` are not registered in `list_migrations` (pre-dated MCP workflow).
- **`services`** — 38 rows (3 Monthly Packages, 25 Training courses, 10 Services)
- **`clients`** — 8 Sheffield demo clients, all `contact_email = team@hexonasystems.com`, `contact_name` and `contact_phone` NULL
- **`proposals`** — populated only by what Matt creates from now on
- **`form_submissions` / `form_assignments`** — empty
- **`hours_transactions`** — empty
- **`notifications_sent`** — will populate as the daily cron runs
- **Storage buckets:**
  - `proposals` — private, signed URLs end-to-end (empty post-cleanup)
  - `reports` — public (empty post-cleanup)
  - `documents` — empty

## Vercel env vars

- `OPENROUTER_API_KEY` — **set in prod, working** (Matt confirmed). If it gets rotated or unset, `draftProposalScope` now throws a clear actionable error in prod instead of silently shipping canned text.
- `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, etc. — set
- `N8N_ASSESSMENT_WEBHOOK_URL` — used by `submitAssessment` fire-and-forget POST; failures log to `workflow_errors`

---

## Architectural conventions (do not relitigate)

These are locked. Don't reshape without checking with the user first.

- **Admin pages use `adminClient`** (service-role, bypasses RLS). Never mix the SSR-auth `createClient` from `lib/supabase/server` on admin pages — it caused the autosave silent failure and was the original Server Components crash in `/admin/clients/[id]`.
- **Auth gate via SSR client, write via `adminClient`** — pattern used in `autosaveAnswers` and `submitAssessment`. Get the user from SSR to confirm they're authenticated, then do the DB write through admin to bypass RLS.
- **Client portal pages use `getClientContext()`** from `lib/auth-helpers` and constrain queries with `.eq("client_id", ctx.client_id)` on top of RLS for defense-in-depth.
- **Signed URLs only** for `proposals` bucket — `adminClient.storage.from("proposals").createSignedUrl(path, 3600)`.
- **No mock data in shipped code paths.** Mock contracts in `lib/mock-client-docs.ts` are the only survivor and exist because e-sig is deferred.
- **`total_price` on `proposals` is VAT-inclusive.** `createProposal` accepts a `subtotal` and computes VAT/total internally.
- **`unit_price` on `services` can be NULL** = "quote on request". The proposal builder collects the override per line item.
- **Hard delete** for proposals and assessments; soft delete (`deleted_at`) for services and clients.
- **No e-sig writes.** `proposals.contract_pdf_path` and `signwell_*` columns exist but no code touches them.
- **Customers can build/fork form templates** — see migration `003_form_template_customer_ownership.sql` and `AGENTS.md`. Form builder must stay reusable; do not hardcode it admin-only.

---

## Form-template ownership contract (re-stated for emphasis)

`form_templates` is polymorphic:
- `owner_id UUID` references `admin_users.id` when `owner_type = 'admin'`, `clients.id` when `owner_type = 'customer'`. **No DB FK** — the discriminator is `owner_type`.
- `parent_template_id UUID NULL` set on forked rows, NULL on originals and customer-from-scratch.
- RLS scopes customers to their own templates + read access to published admin masters.

**Still to build** (deferred): fork-on-fill UI ("you've changed the structure → saving as your version") and a customer "My Templates" surface. The schema + RLS are ready.

---

## Quick-start commands

```powershell
cd "C:\dev\Antigravity\888 Safety"
npm run dev               # Dev server (reads .env.local)
npx tsc --noEmit          # Typecheck (clean as of 69519a4)
npm run lint              # ~428 pre-existing any-type warnings, non-blocking
node scripts/cleanup-orphan-pdfs.mjs   # Storage GC, idempotent
```

Vercel deploys auto-trigger on `git push origin main`.

---

## Recovery from "I broke prod"

- **Migration regret** — 007/008/009 are additive only (`ADD COLUMN IF NOT EXISTS`). Rollback is a `DROP COLUMN`.
- **Bucket privacy flip** — `UPDATE storage.buckets SET public = true WHERE name = 'proposals'`. Signed-URL code still works on a public bucket.
- **Bad deploy** — Vercel dashboard → Deployments → previous successful one → "Promote to Production".
- **Storage rebuilding** — direct `DELETE FROM storage.objects` is blocked by `protect_delete`. Use the cleanup script or the Storage API. The dashboard works for one-offs.

---

## Files worth starting with if you're cold-loaded

1. `components/proposals/advanced-proposal-builder.tsx` — 4-step proposal wizard (~700 lines)
2. `components/assessments/advanced-assessment-builder.tsx` — 3-step assessment wizard
3. `app/admin/assessments/[id]/assessment-client.tsx` — form-fill page with autosave
4. `app/admin/proposals/actions.ts` — proposal server actions (now with prod AI gate)
5. `app/admin/assessments/actions.ts` — assessment server actions (autosave/submit now use `adminClient`)
6. `lib/data/services-server.ts` — service catalog data layer
7. `lib/auth-helpers.ts` — auth + client context helpers
8. `types/forms.ts` — `normalizeFormSchema` defensive coercion
9. `tests/security.spec.ts` — RLS cross-tenant Playwright test

---

## Where to look next

Two reasonable directions when the next session starts:

1. **Pick up deferred work** — e-sig (Signwell/DocuSign) would unlock the proposal → contract handoff and is the smallest unblocked module remaining. Module 5 (form builder polish) is bigger but unblocks Module 1.
2. **Wait for client signal** — Matt's been using the platform for real proposals now. Whatever first feedback he sends is likely worth more than self-directed deferred work.

If the user opens with a bug report, suspect:
- Anything touching `form_submissions` writes — same RLS pattern as the autosave bug could exist on other admin actions that still use the SSR client (see `app/admin/templates/actions.ts` — flagged but explicitly out of scope as part of the Module 5 deferral).
- Anything PDF-related — `react-pdf` rendering is finicky; the contrast/styling bug in `fee320e` was characteristic.

Good luck. Velocity-preferring user; default to "do it, propose alternatives only when there's a real fork."
