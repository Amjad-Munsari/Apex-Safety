---
phase: 19
slug: client-portal-productionization
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-07
---

# Phase 19 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm run build` (catches hallucinated/broken imports — primary fast signal) |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~30–60 seconds (build); test suite per existing project |

---

## Sampling Rate

- **After every task commit:** Run `npm run build` — catches broken imports (executor agents hallucinate `@/components/...` paths)
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** `npm run build && npm test` must be green
- **Max feedback latency:** ~60 seconds

---

## Per-Task Verification Map

| Item | Surface | Behavior | Test Type | Automated Command | File Exists | Status |
|------|---------|----------|-----------|-------------------|-------------|--------|
| D-01/D-02 | Identity | `getClientContextWithIdentity()` returns org name + user name + role; demo path still works | unit | `npm test -- lib/auth-helpers` | ❌ W0 | ⬜ pending |
| D-02 | Identity | Display name fallback: `name \|\| email` when name is empty | unit | `npm test -- lib/auth-helpers` | ❌ W0 | ⬜ pending |
| D-01 | Layout | Server/client split: mobile Sheet + active-link state still work | manual | navigate portal, toggle mobile nav | N/A | ⬜ pending |
| D-04 | Nav | `/client/assessments` returns 404 after deletion (no broken imports) | build | `npm run build` | ✅ | ⬜ pending |
| D-08 | Nav/viewer | Completed tab links to `/client/assignments/${id}/submission`; no `TODO(plan-future)` left | source | `grep "TODO(plan-future)" app/client/assignments/page.tsx` returns nothing | ✅ | ⬜ pending |
| D-07 | Viewer | Submission viewer renders `InterpreterRenderer` with submission `initialValues` against pinned `version_id` | smoke | `npm run dev` → open completed assignment → `/submission` | Manual | ⬜ pending |
| D-07 | Viewer | `pointer-events-none` wrapper prevents form input (read-only affordance) | manual | attempt to edit a field on viewer | Manual | ⬜ pending |
| D-08 | Viewer (authz) | Submission scoped by `client_id` + `status="submitted"` — other clients' submissions 404 | manual | request a foreign `assignment_id` → 404/empty | Manual | ⬜ pending |
| D-09/D-11 | Contracts | Contracts query uses `status="Contract Issued"` + non-null `contract_pdf_path` via `adminClient` scoped by `client_id` | integration | Manual (no contract rows in test DB) — verify honest empty state otherwise | Manual | ⬜ pending |
| D-10 | Contracts | Contract PDF downloads via short-lived signed Storage URL (`proposals` bucket) | manual | click download on a counter-signed contract | Manual | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/auth-helpers/client-context-with-identity.test.ts` — unit tests for `getClientContextWithIdentity()` covering: real user path, demo path (picks first row), name → email fallback, org name from `clients.name` join, null return on missing session.

*Build (`npm run build`) is the primary automated gate for the UI-wiring tasks — broken imports and deleted-route fallout surface there.*

---

## Manual-Only Verifications

| Behavior | Item | Why Manual | Test Instructions |
|----------|------|------------|-------------------|
| Contracts list renders real counter-signed contracts | D-09/D-11 | No contract rows in test DB; pipeline may be unexercised in prod | With a `proposals` row at `status="Contract Issued"` + `contract_pdf_path`, load `/client/contracts`; confirm row appears and downloads |
| Read-only submission render fidelity | D-07 | Visual fidelity (every field/photo/signature) not unit-assertable | Open a completed assignment's `/submission`; compare against the filled form |
| Cross-client IDOR protection | D-08 | Requires two client sessions | As client A, request client B's `assignment_id` submission route → must 404/empty, never render |
| Mobile nav not regressed | D-01 | Interaction/responsive behavior | Resize to mobile; open Sheet; confirm active-link highlight |

*Build-level checks (route deletion, link repoint) are automated; data-dependent and visual checks are manual.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
