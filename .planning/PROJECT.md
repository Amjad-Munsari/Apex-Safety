# 888 Safety & Training Platform

## What This Is

A custom web application that replaces SiteDocs as the operational platform for Matt Robinson's Health & Safety consulting business (888 Safety & Training, Wakefield, UK). It covers mobile-first fire-risk and site-risk assessment forms with speech-to-text, a client-facing compliance portal with expiry tracking, a proposal-to-contract pipeline, and — in Phase 2 — a dynamic form builder so Matt can create his own custom compliance forms.

The product serves two user types: **Matt** (admin: creates forms, runs assessments, issues proposals and contracts) and **Matt's end clients** (portal users: fill assigned forms, view compliance status, buy consulting hours).

## Core Value

**Matt narrates an assessment on-site and a client-ready branded PDF report lands in minutes, not days.** The dictaphone → PA → Google Docs → 5-day turnaround loop is the single biggest pain point. Replacing it is the reason this project exists; everything else is in service of that or follow-on revenue/compliance work it unlocks.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

(None yet — greenfield build. Ship to validate.)

### Active

<!-- Current scope. Building toward these. Phase 1 is signed; Phase 2 is in the original intake but not yet quoted. -->

**Phase 1 — Signed Scope (11 deliverables)**

- [ ] D1 — Fire Risk Assessment form (tablet-first, STT on every text field, per-field photo upload, renders via form renderer against FRA seed template)
- [ ] D2 — Site Risk Assessment form (same infrastructure, different template) — *blocked on template + example from Matt*
- [ ] D3 — AI Report Generation (n8n #1 → OpenAI GPT-4 → branded PDF → Supabase Storage → admin review gate before delivery; YELLOW BROOM FRA as few-shot)
- [ ] D4 — Client Compliance Portal (Supabase Auth magic-link, RLS-isolated dashboard, status badges, mobile-responsive) — *full build blocked on Matt's compliance taxonomy*
- [ ] D5 — Hours Balance + PayPal Checkout (PayPal Orders v2 + webhook; credits `hours_balance`, writes transaction row, triggers receipt) — *blocked on pricing model from Matt*
- [ ] D6 — Document Upload Notifications (Twilio SMS + n8n #2 email on admin upload)
- [ ] D7 — Expiry Alert System (n8n #3 daily 8am UK cron, 30/14/7-day windows, dedup via `(document_id, window, recipient)`)
- [ ] D8 — Proposal + Auto-Contract Pipeline (service selection from Packages.docx + Course List Master.xlsx → OpenAI-drafted proposal PDF matching Blank Proposal template → e-sign → n8n #4 generates Service Agreement → dual-sign)
- [ ] D9 — Admin Dashboard (single-pane view: clients, compliance, expiries, proposals, hours, assessments, uploads)
- [ ] D10 — Walkthrough + Handover (live session, quick-reference guide, 5–10 seed clients from Sample Contacts.xlsx)
- [ ] D11 — Walkthrough seed data + PayPal credentials migrated to shared project account (ops hand-off)

**Phase 2 — Form Builder (in original intake, not yet quoted — re-quote required)**

- [ ] Drag-drop form builder (Coltorapps, field palette, properties panel, publish flow)
- [ ] Custom field types (signature, rating, multi-photo, geolocation, repeating sections)
- [ ] Conditional logic engine (visibility + required-if) — *blocked on Matt's rules*
- [ ] Form assignment + scheduling (recurrence: daily/weekly/monthly/quarterly/annual, n8n cron reminders)
- [ ] Schema versioning (non-negotiable from day one: submissions pin to schema version; historical submissions render against their original schema)
- [ ] Offline / PWA (service worker + IndexedDB queue + sync-when-online indicator)

### Out of Scope

<!-- Explicit boundaries. Reason included to prevent re-adding. -->

- **Auto-deliver generated reports without Matt's review** — Matt reviews every report today; MVP must preserve a `draft_ready_for_review` → Matt approves → `delivered` flow. Auto-deliver can be an opt-in toggle later, not MVP default.
- **Stripe** — Switched to PayPal on 2026-04-06 at Finley's request. Signed proposal still says Stripe in places; that's stale. Build against PayPal Orders v2 only.
- **Email/password signup for client portal users** — Magic-link invite flow only (Matt adds client → system emails sign-up link → customer self-registers). Optional password set later.
- **Form builder UI exposed to end clients (Phase 1)** — Default assumption is Matt-only template editing (possibility #1 of the editable-forms ambiguity). Possibilities #2 and #3 are pending Finley's answer from Matt; any scope assuming those requires explicit re-confirmation.
- **Rebooking / auto-quoting on expiry (MVP)** — Default is flag + alert. Rebook/auto-quote is a Stage 5+ consideration, not MVP.
- **Xero integration** — Optional future n8n workflow; explicitly deferred.
- **Aggressive image compression (<1MB)** — Will destroy inspection-label legibility on fusebox photos. Compress to 1.2–1.5MB max and test against `photo-fusebox-01.jpg` / `-02.jpg` before shipping.
- **Bespoke report-generation route (code-side)** — Lives entirely in n8n per ADR 2026-04-15 (AI prompt is quality-sensitive; team iterates without deploys).

## Context

**Client origin.** Sourced by Finley (aigorilla.co.uk) via arbitrage partnership. Signed proposal 2026-03-24. Go-live target 2026-03-31 has already slipped; new target TBD based on build start. Comms via WhatsApp group "Project | 888 Fire and Safety."

**The dictaphone workflow (why this exists).** Matt walks a site with a Surface Pro / iPad (tablet, not phone), narrates findings into a dictaphone, sometimes writes handwritten notes and dictates them at the end. His PA transcribes into a Google Docs template over ~5 days; Matt adds logos and branding, exports PDF, sends. 1–2 hours of PA work but a 5-day real-world turnaround per report. The 4/11 voice notes (7 samples from 18s to 1:53) are raw training data for the STT + AI report pipeline.

**Per-field image upload is a hard requirement.** Matt decides per field whether to attach a photo. "Notes box + photo gallery at the bottom" is wrong. Short text labels like "Basement" or "No pat testing" tag photos/audio — the form UX must support attaching both images and short text labels to individual fields.

**Client assets received (Drive folder synced 2026-04-15).** Blank FRA (Type 3) template, Blank Service Agreement (20 clauses + 3 schedules), YELLOW BROOM completed FRA example, Blank Proposal One Page Template, Packages.docx, Course List Master.xlsx, Sample Contacts.xlsx. These seed form templates, few-shot AI examples, the contract template, the service catalogue, and the initial portal seed data.

**Scale.** ~7–8 active clients today. This is a trust/clarity product, not a throughput product.

**Infrastructure ownership (interim).** Ayman's personal GitHub/Vercel/Supabase accounts until Finley provisions a shared project Gmail. PayPal developer credentials pending.

**Build team.** Ayman (lead, architecture, client-facing) + Amjad (pair programmer). Dev environment: Zed. Pair-programming rules locked: one drives, one reviews, swap ~45 mins.

**Open questions still blocking scope.** Site Risk template + completed example (blocks D2 entirely and the site-risk half of D3); compliance taxonomy + renewal periods (blocks full D4/D7); hours pricing model (blocks D5 beyond plumbing); editable-forms ambiguity (affects Stage 3 scope only — Stages 1–2 are unblocked); e-sign provider preference; brand assets. See Open Questions register below.

## Constraints

- **Tech stack (locked):** Next.js 14 App Router, Supabase (Postgres + Auth + Storage + RLS), Vercel (hosting + cron), n8n (4 workflows Phase 1, 1 Phase 2, 1 optional future), OpenAI GPT-4 (via OpenRouter for proposal gen), **PayPal Orders API v2** (not Stripe), Twilio (SMS), Web Speech API (browser-native STT with text fallback), @coltorapps/builder (Phase 2 form builder, MIT, React, zero deps). E-signature provider TBD (default SignWell if Matt doesn't specify).
- **Architecture split (ADR 2026-04-15):** n8n owns AI-heavy/multi-step/visible-automation work (report gen, universal email sender, expiry engine, contract gen). Code owns transactional/idempotent/auth-gated work (PayPal webhooks, document upload, SMS send).
- **Multi-tenant isolation:** RLS on every Supabase table with client data, non-negotiable. Verification: log in as Client A, attempt to access Client B's data; if you can, you failed.
- **Form architecture — unified template:** FRA and Site Risk are NOT hardcoded forms. They are seed templates inside the form builder. Matt edits them post-launch without a deploy. Schema versioning is required from day one; submissions pin to the schema version they were filled against.
- **Build order (locked):** Form-builder-first. Stages are 1 Scaffolding → 2 Form prerequisites → 3 Form builder (green-light gate — live demo Matt signs off on) → 4 Assessment + AI pipeline completion → 5 Everything else (parallelisable). Do not start Stage 4/5 before Stage 3 green-light.
- **Device priority:** Tablet (Surface Pro / iPad) is primary for assessment forms; phone is secondary. Admin dashboard is desktop-primary, mobile-responsive.
- **Image compression target:** 1.2–1.5MB max (NOT 800KB). Verify legibility against the received fusebox photos before shipping.
- **Report delivery gate:** Generated PDFs land as `draft_ready_for_review`; Matt must approve before `delivered`. No silent auto-send in MVP.
- **Secrets management:** `.env.local` for dev, Vercel env vars for prod. Never commit secrets. PayPal creds go to shared project email once provisioned.
- **Commit style:** `[module] brief description` (e.g., `[portal] add expiry alert cron`).

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Next.js 14 (App Router) + Supabase + Vercel | Signed stack. Familiar to both devs, fast to build, RLS solves multi-tenant isolation cleanly. | — Pending |
| PayPal (Orders v2) over Stripe | Finley relayed Matt's preference on 2026-04-06. Proposal text is stale on this point. | — Pending |
| n8n-vs-code split (ADR 2026-04-15) | Keep AI-quality-sensitive and multi-step back-and-forth work in n8n for visibility + team iteration; keep auth-gated transactional work in code for correctness. | — Pending |
| Unified-template form architecture | FRA and Site Risk ride on top of the form builder from day one. Shipping the builder first gets D1 "almost for free" once Matt seeds the template. | — Pending |
| Form-builder-first build order | Stage 3 green-light (live demo Matt signs off on) gates Stages 4–5. No other module work starts before that gate. | — Pending |
| Schema versioning from day one | Form-builder pitfall: editing a template must not retroactively change past submissions. Submissions pin to the version they were filled against. | — Pending |
| Matt-only template editing (default) | Working assumption for editable-forms ambiguity until Finley confirms with Matt. Schema supports all three possibilities via `owner_id`/`owner_type`; only Stage 3 scope is affected. | ⚠️ Revisit once Finley answers |
| Review-before-deliver for generated reports | Matt reviews every report today; removing that in MVP is a trust failure. Auto-deliver can be opt-in later. | — Pending |
| Magic-link client onboarding | Matt adds client → email invite → self-register. No password at signup. | — Pending |
| Coltorapps for Phase 2 form builder | MIT license, React, zero deps, drag-drop out of box. | — Pending |
| Default e-sign provider = SignWell | Fast integration + cost. Overridable if Matt specifies a preference. | — Pending |

## Open Questions (Register)

Blockers marked ⚠️. Chase via Finley.

- [x] Blank FRA template — received 2026-04-15
- [x] Completed FRA example — YELLOW BROOM, received 2026-04-15
- [x] Service list + pricing — Packages.docx + Course List Master.xlsx, received 2026-04-15
- [x] Proposal template — Blank Proposal One Page Template, received 2026-04-15
- [x] Contract template — Blank Service Agreement, received 2026-04-15
- [ ] ⚠️ **Blank Site Risk template** — blocks D2
- [ ] ⚠️ **Completed Site Risk example** — blocks site-risk half of D3
- [ ] E-signature provider preference (default SignWell)
- [ ] PayPal developer account credentials
- [ ] Hours pricing model — flat rate / packages / bundles / prepay vs invoice-after / expiry rules / deduction method
- [ ] Client portal lifecycle — day-one view, self-register vs Matt-creates, static snapshot vs living docs
- [ ] Compliance document categories + renewal periods per category
- [ ] On-expiry action — flag-only vs rebook/auto-quote (MVP default: flag + alert)
- [ ] Brand assets — logo, hex colours, PDF header/footer
- [ ] Notification sign-off — "888 Safety" vs "Matt" personally
- [ ] Editable-forms ambiguity — (a) Matt-edits-templates vs customer-edits-own-form vs customer-owns-templates; (b) FRA/Site-Risk editable post-launch?; (c) if customers can edit, scope of permission
- [ ] Conditional logic rules for Phase 2 form builder (draft message prepared, not yet sent)
- [ ] Shared project Gmail — pending Finley

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-15 after initialization*
