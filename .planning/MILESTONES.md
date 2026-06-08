# Milestones

## v1.0 MVP — 888 Safety Platform (Shipped: 2026-06-07)

**Phases completed:** 17 of 18 (Phase 8 deferred), 52 plans, 84 tasks
**Timeline:** 2026-04-20 → 2026-06-07 (48 days, 498 commits)
**Stack:** Next.js 16 / React 19 / Tailwind 4 / Supabase (eu-west-2) / Vercel / n8n / OpenRouter

**Delivered:** Matt narrates an assessment on-site and a client-ready branded PDF report lands in his review queue in minutes — on top of a customer-forkable form builder, compliance portal, and proposal-to-contract pipeline.

**Key accomplishments:**

1. **Full on-site capture loop** — tablet-first FRA fill with speech-to-text, per-field photo attach (1.2–1.5MB compression), draft autosave/rehydration, and version-pinned submissions.
2. **AI report pipeline** — submission → OpenRouter structured draft (YELLOW BROOM few-shot, injection-hardened) → branded PDF to Storage → admin review gate (approve/regenerate/edit) with workflow-error surfacing. Built code-side with Vercel AI SDK, superseding the original n8n ADR.
3. **Drag-drop form builder** — @coltorapps/builder with 13 entity types (7 basic + signature, rating, multi-photo, geolocation, repeating sections, PAS 79 computed field), immutable schema versioning, three-panel dnd-kit UI.
4. **Conditional logic engine** — visibilityRules with show/hide/require, AND/OR combination, cascade, save-time cycle detection (3-colour DFS), server-side hidden-answer scrubbing.
5. **Multi-tenancy + fork-on-fill** — admin assigns templates to clients; clients fork masters or build from scratch (`owner_type` polymorphic ownership, migration 003 contract); cross-org RLS verified.
6. **Compliance portal + ops** — magic-link client portal with RAG compliance dashboard, document expiry alerts (30/14/7-day cron), assignment scheduling with recurrence + reminder dedup, proposal → SignWell e-sign → auto-contract pipeline.
7. **FRA Type 3 seed template** — Matt's real Fire Risk Assessment (6 sections, 40 entities, conditional sub-sections, PAS 79 matrix, Action Plan repeating section) built through the builder itself, wired to the report webhook.

### Known Gaps (accepted as tech debt at close)

- **PAY-01..08** (Phase 8, PayPal checkout) — deferred; manual hours management covers current scale (~8 clients).
- **OPS-01..04** (Phase 11 handover items) — partially complete; external dependencies on Finley (n8n env config) and Matt (Site Risk template, PAS 79 band sign-off).
- **REQUIREMENTS.md tracker drift** — only 3/102 checkboxes maintained; roadmap progress table is the source of truth (17/18 phases shipped).
- **AUDIT-2026-06-05.md punch list** — auth middleware hardening, client assessments page (fixtures), STT proxy route, PAS 79 → AI prompt persistence. v1.1 candidates.
- Known deferred items at close: **12** (see STATE.md Deferred Items — 9 UAT files unclosed, 1 verification gap, 2 stale context-question sets).

---
