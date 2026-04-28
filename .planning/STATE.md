# Project State: 888 Safety & Training Platform

**Last updated:** 2026-04-15
**Session:** Roadmap creation

---

## Project Reference

**Core Value:** Matt narrates an assessment on-site and a client-ready branded PDF report lands in minutes, not days.

**Milestone:** Phase 1 (v1 — signed scope, 11 deliverables)

**Current Focus:** Phase 1 — Scaffolding + Security Foundation

---

## Current Position

**Current Phase:** 1 — Scaffolding + Security Foundation
**Current Plan:** None started
**Phase Status:** Not started
**Milestone Status:** Not started

```
Progress: [░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░] 0/11 phases
```

---

## Phase Sequence

| # | Phase | Status |
|---|-------|--------|
| 1 | Scaffolding + Security Foundation | Not started |
| 2 | Form Prerequisites | Not started |
| 3 | Template System + Schema Versioning | Not started |
| 4 | Assessment Workflow [GREEN-LIGHT GATE] | Not started |
| 5 | AI Report Pipeline | Not started |
| 6 | Client Compliance Portal | Not started |
| 7 | Document Upload, Notifications + Expiry Alerts | Not started |
| 8 | Hours Balance + PayPal Checkout | Not started |
| 9 | Proposal + Auto-Contract Pipeline | Not started |
| 10 | Admin Dashboard | Not started |
| 11 | Ops, Seed Data + Handover | Not started |

---

## Performance Metrics

**Requirements mapped:** 102/102 (100%)
**Phases planned:** 11
**Phases complete:** 0
**Plans complete:** 0

---

## Key Decisions (Active)

| Decision | Status | Note |
|----------|--------|------|
| Next.js 16.1.7 + React 19 + Tailwind 4 + Supabase + Vercel | Locked | Stack verified against official docs |
| PayPal Orders v2 (not Stripe) | Locked | Finley relayed Matt's preference 2026-04-06 |
| n8n / code ADR 2026-04-15 | Locked | AI-heavy + multi-step in n8n; transactional/auth-gated in code |
| Unified-template form architecture | Locked | FRA + Site Risk are seed templates in the form builder |
| Form-builder-first build order | Locked | Stage 3 green-light gate before Stage 4/5 |
| Schema versioning from day one | Locked | Submissions pin to template_version_id; no retroactive fix |
| Matt-only template editing (default) | Working assumption | Revisit on editable-forms answer from Finley |
| Review-before-deliver for reports | Locked | Legal requirement under RRO (Fire Safety) 2005 |
| Magic-link client onboarding | Locked | No password at signup; optional password after first sign-in |
| Default e-sign provider = SignWell | Working assumption | Override if Matt specifies preference |
| Image compression 1.2–1.5MB (not 800KB) | Locked | Fusebox photo legibility is the test |
| Supabase region: eu-west-2 (London) | Locked | UK GDPR; one-time decision at project creation |

---

## Open Blockers

| ID | Blocker | Phases Affected | Action |
|----|---------|-----------------|--------|
| B1 | Blank Site Risk template missing | TMPL-05, REPORT-04, Phase 3/5 | Chase Matt via Finley |
| B2 | Completed Site Risk example missing | REPORT-04 | Chase Matt via Finley |
| B3 | Compliance document categories + renewal periods | PORTAL-03, EXPIRY-01–07 | Chase Matt via Finley |
| B4 | Hours pricing model | PAY-07, PAY-08 | Chase Matt via Finley |
| B5 | Brand assets (logo, hex colours, PDF header/footer) | REPORT-05 | Chase Matt via Finley |
| B6 | PayPal developer credentials | PAY-02 | Pending shared Gmail |
| B7 | Shared project Gmail | OPS-04 + all credential migration | Pending Finley |
| B8 | E-sign provider confirmation | PROP-05, CONTRACT-01–06 | Default SignWell; chase confirmation |
| B9 | Notification sign-off name | DOCS-05 | Chase Matt via Finley |
| B10 | Editable-forms ambiguity | TMPL-06 scope | Chase Finley for Matt's answer |
| B11 | Twilio UK sender ID registration | DOCS-03, EXPIRY-05 | Initiated Phase 1; track lead time |

---

## Accumulated Context

### Architecture Constraints
- `lib/supabase/admin.ts` must have `import 'server-only'` — build fails if leaked to client
- All Storage buckets are private from day one; Storage RLS is separate from table RLS
- `proxy.ts` replaces `middleware.ts` in Next.js 16; all request APIs are async
- Never use `getSession()` server-side — always `getUser()`
- Never use `@supabase/auth-helpers-nextjs` — deprecated for App Router; use `@supabase/ssr`
- Never use Jest; use Vitest 4.x + Playwright 1.51+
- PDF generation: `@react-pdf/renderer` for proposals (code-side); n8n HTML-to-PDF for AI reports
- Report review gate is a legal requirement under RRO (Fire Safety) 2005 — no auto-deliver

### Critical Tests to Wire
- "Client A attempts Client B's Storage URL → returns 403" (integration test, Phase 1)
- "Logged-out request for any Storage URL → returns 403" (integration test, Phase 1)
- "Import admin.ts from client component → build error" (build-time check, Phase 1)
- "Submit against v1, publish v2, re-open v1 submission → renders v1 schema" (Phase 3 gate demo)
- "Replay same PayPal event twice → balance credited once" (idempotency test, Phase 8)

### Assets Received (2026-04-15)
- Blank FRA (Type 3) template — seeds TMPL-04
- YELLOW BROOM completed FRA — few-shot for REPORT-03
- Blank Service Agreement (20 clauses + 3 schedules) — seeds CONTRACT-02
- Blank Proposal One Page Template — seeds PROP-04
- Packages.docx — seeds PROP-01 service catalogue
- Course List Master.xlsx — seeds PROP-01 service catalogue
- Sample Contacts.xlsx — seeds OPS-01 client import

### Roadmap Evolution
- Phase 12 added: Admin Dashboard UI Fixes — wire up non-functional buttons, navigation arrows, interactive elements (2026-04-29)

### Stage 5 Parallelisation Note
Phases 6, 7, 8, 9, and 10 share almost no code. They can be built in parallel if two developers are available (Ayman + Amjad). The only shared dependency is Phase 1 (auth + schema) and Phase 5 (n8n error workflow pattern). Phase 10 (Admin Dashboard) depends on all other Stage 5 phases to aggregate their data panels.

---

## Session Continuity

### Last Action
Roadmap created and files written (ROADMAP.md, STATE.md, REQUIREMENTS.md traceability).

### Next Action
`/gsd-plan-phase 1` — plan Phase 1: Scaffolding + Security Foundation.

### Phase 1 Starting Checklist
Before writing any feature code in Phase 1:
1. Create Supabase project in eu-west-2 — document region in PROJECT.md
2. Add `.env*` to `.gitignore` on the very first commit
3. Run Next.js 16 codemod (rename middleware.ts → proxy.ts, async APIs, revalidateTag)
4. Write `lib/supabase/admin.ts` with `import 'server-only'` as the first file
5. Submit Twilio UK sender ID registration ("888Safety", max 11 chars)
6. Write migration 001 with all tables + soft-delete columns + indexes + RLS
7. Write Storage bucket policies (all private, path-prefix = client_id)
8. Wire auth flows (admin email/password, client magic-link invite, optional password set)
9. Integration test: Client A cannot read Client B's data; logged-out request returns 403

---

*State initialised: 2026-04-15 during roadmap creation*
