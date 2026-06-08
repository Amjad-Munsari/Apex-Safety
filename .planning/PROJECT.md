# 888 Safety & Training Platform

## What This Is

A custom web application that replaces SiteDocs as the operational platform for Matt Robinson's Health & Safety consulting business (888 Safety & Training, Wakefield, UK). v1.0 (shipped 2026-06-07) delivers mobile-first fire-risk assessment capture with speech-to-text and per-field photos, an AI report pipeline with admin review gate, a client compliance portal with expiry tracking, a proposal-to-contract pipeline, and a full drag-drop form builder with conditional logic, multi-tenancy, and fork-on-fill — so both Matt and his clients can build and own compliance forms.

The product serves two user types: **Matt** (admin: creates forms, runs assessments, issues proposals and contracts) and **Matt's end clients** (portal users: fill assigned forms, fork or build templates, view compliance status).

## Core Value

**Matt narrates an assessment on-site and a client-ready branded PDF report lands in minutes, not days.** The dictaphone → PA → Google Docs → 5-day turnaround loop was the single biggest pain point. v1.0 ships this loop end-to-end; remaining friction is operational (env config, Matt's sign-offs), not architectural.

## Requirements

### Validated

- ✓ D1 — Fire Risk Assessment form (FRA Type 3 seed, STT, per-field photos, version-pinned) — v1.0
- ✓ D3 — AI Report Generation (code-side Vercel AI SDK via OpenRouter, not n8n; review gate; branded PDF) — v1.0
- ✓ D4 — Client Compliance Portal (magic-link, RAG dashboard, RLS-isolated) — v1.0
- ✓ D6 — Document Upload Notifications (code dispatch wired; n8n receiver config pending) — v1.0
- ✓ D7 — Expiry Alert System (30/14/7-day cron, dedup) — v1.0
- ✓ D8 — Proposal + Auto-Contract Pipeline (OpenRouter draft, PDF, SignWell) — v1.0
- ✓ D9 — Admin Dashboard (live data wiring, compliance/expiry/review queue) — v1.0
- ✓ Form builder: drag-drop, 13 entity types, immutable schema versioning — v1.0
- ✓ Conditional logic engine (show/hide/require, cycle detection) — v1.0
- ✓ Multi-tenancy + fork-on-fill + client-built templates (Option 3 ownership model) — v1.0
- ✓ Assignment scheduling + recurrence + reminders — v1.0

### Active (carried into v1.1 scoping)

- [ ] D2 — Site Risk Assessment template — *still blocked on blank + completed example from Matt*
- [ ] D5 — Hours Balance + PayPal Checkout — *deferred from v1.0; blocked on pricing model; manual hours mgmt suffices at current scale*
- [ ] D10/D11 — Walkthrough + handover completion — *n8n env config (Finley), credentials migration*
- [ ] Auth middleware / route-gating hardening (AUDIT-2026-06-05: admin routes ungated at middleware layer)
- [ ] Client assessments portal page — replace hardcoded fixtures with DB queries
- [ ] PAS 79 computed risk level persistence → AI prompt (currently recomputed nowhere server-side)
- [ ] STT proxy route — dead endpoint; either wire or delete (Web Speech API is the live path)

### Out of Scope

- **Auto-deliver generated reports without Matt's review** — trust failure; review gate is load-bearing.
- **Stripe** — PayPal Orders v2 only (Finley, 2026-04-06). Note PayPal itself then deferred with Phase 8.
- **Email/password signup for client portal users** — magic-link invite flow only.
- ~~Form builder UI exposed to end clients~~ — **REMOVED from out-of-scope 2026-04-17**: Option 3 confirmed (customers build and fork); shipped in v1.0 Phase 16.
- **Rebooking / auto-quoting on expiry** — flag + alert only; rebook is v2+.
- **Xero integration** — optional future n8n workflow.
- **Aggressive image compression (<1MB)** — destroys inspection-label legibility; 1.2–1.5MB target validated in v1.0.
- ~~Bespoke report-generation route (code-side)~~ — **INVALIDATED**: Phase 7 shipped report generation code-side (Vercel AI SDK + OpenRouter); n8n kept for notifications/email/expiry only. The "AI iteration without deploys" rationale lost to the operational simplicity of code-side structured output.
- **Offline / PWA (OFFLINE-01..05)** — deferred to its own milestone; large lift, not blocking demo or daily use.

## Context

**Shipped v1.0 (2026-06-07):** 498 commits over 48 days, 18 phases (17 complete), 19 DB migrations, tagged `v1.0`. Production on Vercel (`fire-safety-platform`, team aymans-projects), Supabase eu-west-2.

**Operational state:** Code-complete for v1 signed scope minus Phase 8. Live blockers are external: `OPENROUTER_API_KEY` / `CRON_SECRET` / `N8N_*` env vars in Vercel (Finley), Site Risk template + PAS 79 band sign-off (Matt). E2E UAT in progress (E2E-UAT.md; Workflow 1 Assessment Pipeline 12/12 PASS on 2026-06-07).

**Production readiness audit (AUDIT-2026-06-05.md):** form builder / versioning / conditional logic / portal genuinely live; auth middleware, client assessments page, billing, STT route flagged. Several punch-list items fixed in the 2026-06-06/07 sprint (fork-on-fill redirect, proposal PDF regeneration, client row clicks, photo validation gating, signatureField submit crash).

**Client origin.** Sourced by Finley (aigorilla.co.uk). Signed proposal 2026-03-24. Comms via WhatsApp group "Project | 888 Fire and Safety." Scale: ~7–8 active clients — trust/clarity product, not throughput.

**Infrastructure ownership (interim).** Ayman's personal GitHub/Vercel/Supabase until Finley provisions shared project Gmail.

**Build team.** Ayman (lead) + Amjad (pair programmer).

## Constraints

- **Tech stack (locked):** Next.js 16.1.7 App Router, React 19, Tailwind 4, Supabase (eu-west-2 — locked), Vercel, n8n (notifications/email/expiry), OpenRouter (AI drafts), Twilio (UK sender ID "888Safety"), Web Speech API (STT), @coltorapps/builder 0.2.4 + @base-ui/react.
- **Architecture split (revised in v1.0):** code owns AI report/proposal generation (Vercel AI SDK), transactional work, and crons; n8n owns notification fan-out and email. (Original ADR put AI in n8n — superseded by Phase 7.)
- **Multi-tenant isolation:** RLS on every client-data table, non-negotiable. Customer-side verified; admin-side RLS relies on server-action gating (role claim never set — see audit).
- **Form architecture:** FRA/Site Risk are seed templates in the builder, not hardcoded. Schema versioning from day one; submissions pin to their version. Form template ownership: Option 3 (see AGENTS.md) — `owner_id`/`owner_type` polymorphic, `parent_template_id` for forks; Matt's masters never mutated.
- **Report delivery gate:** drafts land `draft_ready_for_review`; Matt approves before `delivered`.
- **Device priority:** tablet-first assessment forms; desktop-primary admin.
- **Image compression:** 1.2–1.5MB max.
- **Secrets:** `.env.local` dev / Vercel env prod; never committed.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Next.js 16 + React 19 + Tailwind 4 + Supabase + Vercel | Fresh caching model, Turbopack, React 19 Actions | ✓ Good — carried 18 phases without a stack regret |
| PayPal over Stripe | Finley/Matt preference 2026-04-06 | — Pending (Phase 8 deferred; untested) |
| n8n-vs-code split (ADR 2026-04-15) | AI-quality work in n8n for visibility | ⚠️ Revisited — Phase 7 moved AI report gen into code (Vercel AI SDK); n8n kept for notifications only. Right call: structured output + error rows beat n8n debugging |
| Unified-template form architecture | FRA rides the builder; Matt edits without deploys | ✓ Good — FRA Type 3 seeded through the builder itself (Phase 18) |
| Form-builder-first build order | Stage 3 green-light gates everything | ✓ Good — builder became the platform's spine |
| Schema versioning from day one | Submissions pin to filled-against version | ✓ Good — also enabled the signatureField deregistration to be survivable (sanitizeSchema, de85ab9) |
| Customer form ownership: Option 3 (2026-04-17) | Confirmed via Finley → Matt; supersedes Matt-only default | ✓ Good — shipped as Phase 16 fork-on-fill + My Templates |
| Review-before-deliver for reports | Matt reviews every report today | ✓ Good — review queue is the admin's daily surface |
| Magic-link client onboarding | No password at signup | ✓ Good |
| Coltorapps for form builder | MIT, React, zero deps | ✓ Good — survived 13→18 phase build-out; quirks documented (no instances[] recursion, "Unkown entity type" throw) |
| SignWell as e-sign default | Fast integration + cost | ✓ Good |
| Supabase eu-west-2 (London) | UK GDPR + latency | ✅ Locked |
| Twilio UK Sender ID "888Safety" | Branding + deliverability | ⏳ Initiated |
| Defer Phase 8 (PayPal) | Manual hours mgmt covers ~8 clients | ✓ Good — zero demand pressure to date |

## Open Questions (Register)

Blockers marked ⚠️. Chase via Finley.

- [x] Blank FRA template — received 2026-04-15
- [x] Completed FRA example — YELLOW BROOM, received 2026-04-15
- [x] Service list + pricing / proposal template / contract template — received 2026-04-15
- [x] Editable-forms ambiguity — RESOLVED 2026-04-17: Option 3, customers build and fork
- [x] E-signature provider — defaulted to SignWell, shipped
- [x] Conditional logic rules — shipped generic engine (Phase 15); FRA-specific rules seeded (Phase 18)
- [ ] ⚠️ **Blank Site Risk template + completed example** — blocks D2 + site-risk AI exemplar
- [ ] ⚠️ **PAS 79 band boundaries** — Matt sign-off on Trivial/Tolerable/Moderate/Substantial/Intolerable mapping
- [ ] ⚠️ **n8n env config + workflow activation** — Finley (blocks notifications going live)
- [ ] PayPal developer credentials + hours pricing model (if/when Phase 8 revives)
- [ ] Compliance document categories + renewal periods per category
- [ ] Brand assets — logo, hex colours, PDF header/footer (current branding is dev-authored)
- [ ] Notification sign-off — "888 Safety" vs "Matt" personally
- [ ] Shared project Gmail — pending Finley

## Evolution

This document evolves at phase transitions and milestone boundaries.

---
*Last updated: 2026-06-07 after v1.0 milestone close*
