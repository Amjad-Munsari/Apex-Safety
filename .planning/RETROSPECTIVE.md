# Project Retrospective — 888 Safety & Training Platform

Living document. One section per milestone, appended at each close.

---

## Milestone: v1.0 — MVP

**Shipped:** 2026-06-07
**Phases:** 17 of 18 (Phase 8 deferred) | **Plans:** 52 | **Commits:** 498 over 48 days

### What Was Built

The full v1 signed scope minus PayPal: on-site FRA capture (STT + per-field photos + autosave), AI report pipeline with review gate, drag-drop form builder (13 entity types, immutable versioning, conditional logic, multi-tenancy, fork-on-fill), client compliance portal, document expiry alerts, assignment scheduling, proposal → e-sign → auto-contract pipeline, and Matt's real FRA Type 3 seeded through the builder itself.

### What Worked

- **Form-builder-first build order.** The builder became the spine; FRA/Site Risk as seed templates (not hardcoded forms) meant Phase 18 was a migration, not a feature.
- **Schema versioning from day one.** Version-pinned submissions absorbed a breaking change mid-project (signatureField deregistration) via sanitizeSchema instead of a data migration.
- **Wave-based plan parallelization** in phases 14–17 — 8-9 plans per phase landed in days.
- **Moving AI report gen from n8n into code** (Phase 7 ADR reversal). Structured output + workflow_errors rows beat debugging n8n visually.

### What Was Inefficient

- **Tracker drift.** REQUIREMENTS.md checkboxes (3/102) and per-phase UAT files were abandoned once E2E UAT sessions started; the close required acknowledging 12 stale artifacts.
- **Phase 13 big-bang cutover** to coltorapps regressed all specialty fields; Phase 14 was re-implementation, not net-new. A strangler approach might have avoided the gap window.
- **UAT raced deployments** — the 2026-06-07 UAT re-found a bug (signatureField submit crash) that was fixed but not yet deployed when the run started.
- **iCloud Desktop repo location** — node_modules/.git eviction caused recurring CPU-starvation and hung builds (.nosync symlink workarounds accumulated).

### Patterns Established

- Polymorphic template ownership (`owner_id` + `owner_type` + `parent_template_id`) — the Option 3 contract in AGENTS.md.
- sanitizeSchema for deregistered entity types — client renders and server validates the same sanitized schema.
- Server actions: pinned-version fetch → sanitize → prune → validate → visibility scrub → atomic write; `after()` callbacks for webhooks.
- Surface-token theming (dark/cream) for shared interpreter renderers.

### Key Lessons

1. When a UAT report names a bug, check the deployment timeline before investigating the code — the fix may already be on main.
2. Coltorapps quirks worth remembering: `validateEntitiesValues` does NOT recurse into `instances[]`; unknown entity types THROW (`Unkown entity type`, upstream typo) rather than skip.
3. Keep per-phase UAT files updated from E2E sessions, or drop the per-phase format — split tracking rots.
4. 33 pre-existing test failures on main at close (stale assertions + vite transform errors under node_modules.nosync) — triage early in v1.1 before they mask regressions.

### Cost Observations

- Sessions: pair-programmed (Ayman + Amjad) with parallel Claude sessions; occasional same-minute pushes from both (race on 2026-06-07 resolved cleanly).
- Notable: external dependencies (Matt, Finley) — not engineering throughput — set the critical path for go-live.

---

## Cross-Milestone Trends

| Metric | v1.0 |
|--------|------|
| Phases | 17/18 |
| Plans | 52 |
| Commits | 498 |
| Duration | 48 days |
| Deferred at close | 12 artifacts + Phase 8 |
