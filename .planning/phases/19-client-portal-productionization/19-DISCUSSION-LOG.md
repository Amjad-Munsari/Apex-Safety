# Phase 19: Client Portal Productionization - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-07
**Phase:** 19-client-portal-productionization
**Areas discussed:** Identity rendering, Assessments→Assignments, Submission viewer, Contracts surface

---

## Identity rendering

| Option | Description | Selected |
|--------|-------------|----------|
| Server layout → props | Make layout.tsx a server component; fetch identity via extended getClientContext; pass as props to a client nav subcomponent. Matches existing force-dynamic pattern. | ✓ |
| Client provider + API/action | Keep layout client-side; fetch identity via server action/route handler into a context provider. | |

**User's choice:** Server layout → props
**Notes:** getClientContext currently returns only `{client_id, role}` and must be extended to also return org name (`clients.name`) and the signed-in person's name/role. Footer consultant block decided static (Matt is sole consultant) — Claude's discretion, accepted.

---

## Assessments → Assignments consolidation

| Option | Description | Selected |
|--------|-------------|----------|
| Drop page+route, Assignments in nav | Delete app/client/assessments entirely; remove Assessments nav item; add Assignments → /client/assignments. Completed reports already in Reports tab. | ✓ |
| Keep route as redirect | Replace assessments body with redirect to /client/assignments; relabel nav. | |

**User's choice:** Drop page+route, Assignments in nav
**Notes:** /client/assessments is 100% mock (hardcoded ASSESSMENTS array incl. fake completed reports). No real bookmarks to preserve. Completed AI reports live in the real Reports tab — no overlap.

---

## Completed-submission viewer

| Option | Description | Selected |
|--------|-------------|----------|
| Full read-only InterpreterRenderer | Render submission against pinned version_id via existing InterpreterRenderer in read-only mode — full fidelity (fields, photos, signatures). | ✓ |
| Lightweight answers summary | Simpler label→value list rather than full form chrome. | |

**User's choice:** Full read-only InterpreterRenderer
**Notes:** Route `/client/assignments/[id]/submission` (TODO already stubbed in assignments page). Completed tab link repoints here from the current fallback.

---

## Contracts surface

| Option | Description | Selected |
|--------|-------------|----------|
| contract_signed only + signed-URL download | Show only counter-signed contracts (status contract_signed + contract_pdf_path); download via short-lived signed Storage URL. | ✓ |
| contract_sent + contract_signed | Also surface sent-but-not-yet-signed contracts (awaiting-signature). | |

**User's choice:** contract_signed only + signed-URL download
**Notes:** No separate contracts table — derived from `proposals`. ⚠ Status-casing mismatch flagged (migration 001 lowercase vs proposals page title-case) — reconcile before writing the query.

---

## Claude's Discretion

- Footer consultant block kept static (Matt Robinson — sole consultant).
- Person's display-name source: auth user, falling back to email if no name stored; role from `client_users.role`.
- Billing nav item + page left untouched (out of scope).
- Nav `id` numbering after the swap; Contracts empty-state copy; exact identity-helper signature; read-only affordance details for InterpreterRenderer.

## Deferred Ideas

- Billing / PayPal productionization (Phase 8 — excluded).
- Real per-client reference code (CL-8889 style) in the header — small follow-up.
- Full proposal status-taxonomy cleanup across surfaces — this phase only needs the Contracts query to read correct stored values.
