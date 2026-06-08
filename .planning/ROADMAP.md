# Roadmap: 888 Safety & Training Platform

**Core Value reminder:** Matt narrates an assessment on-site and a client-ready branded PDF report lands in minutes, not days.

---

## Milestones

- ✅ **v1.0 MVP** — Phases 1–18 (shipped 2026-06-07) — [archive](milestones/v1.0-ROADMAP.md)
- 📋 **v1.1** — not yet scoped (run `/gsd:new-milestone`)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1–18) — SHIPPED 2026-06-07</summary>

- [x] Phase 1: Scaffolding + Security Foundation (1/1 plans) — 2026-04-29
- [x] Phase 2: Form Prerequisites (1/1) — 2026-04-29
- [x] Phase 3: Template System + Schema Versioning (1/1) — 2026-04-29
- [x] Phase 4: Client Compliance Portal (1/1) — 2026-04-29
- [x] Phase 5: Document Upload + Expiry Alerts (2/2) — 2026-04-29
- [x] Phase 6: Assessment Workflow (1/1) — 2026-04-30
- [x] Phase 7: AI Report Pipeline (10/10) — 2026-05-29
- [ ] Phase 8: Hours Balance + PayPal Checkout — DEFERRED to backlog (manual hours mgmt suffices)
- [x] Phase 9: Proposal + Auto-Contract Pipeline (1/1) — 2026-05-01
- [x] Phase 10: Admin Dashboard Logic (1/1) — 2026-05-01
- [x] Phase 11: Demo Readiness & Polish (1/1) — 2026-05-02
- [x] Phase 12: Admin Dashboard UI Fixes (out-of-flow, commit f2c7cce) — 2026-05-01
- [x] Phase 13: Form Builder Foundation (4/4) — 2026-05-25
- [x] Phase 14: Custom Field Types (8/8) — 2026-05-25
- [x] Phase 15: Conditional Logic Engine (9/9) — 2026-05-29
- [x] Phase 16: Multi-Tenancy + Fork-on-Fill (8/8) — 2026-05-26
- [x] Phase 17: Assignment Scheduling + Notifications (6/6) — 2026-05-27
- [x] Phase 18: FRA Seed Template (3/3) — 2026-05-27

Full phase details, success criteria, and coverage audit: [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)

</details>

### 📋 v1.1 (Planned — scope via /gsd:new-milestone)

Candidate inputs:
- AUDIT-2026-06-05.md punch list (auth middleware, client assessments fixtures, STT route, PAS 79 → AI persistence, fork-on-fill polish)
- Deferred items from v1.0 close (STATE.md Deferred Items)
- Backlog below

## Backlog

**Deferred from v1.0:**
- **PAY-01 to PAY-08**: Hours Balance + PayPal Checkout (former Phase 8) — blocked on pricing model from Matt; manual hours management covers current scale.

**v2 requirement clusters (never scheduled):**
- **OFFLINE-01 to OFFLINE-05**: PWA / service worker / IndexedDB offline sync — separate milestone, large lift.

**External-dependency work (not schedulable until unblocked):**
- Site Risk template (D2) + site-risk half of the AI pipeline — blocked on Matt's blank + completed example.
- PAS 79 band boundaries vs BSI PAS 79-1:2020 — blocked on Matt sign-off.
- n8n workflow env config + shared project Gmail — blocked on Finley.

---

*Roadmap created: 2026-04-15*
*v1.0 closed and archived: 2026-06-07*
