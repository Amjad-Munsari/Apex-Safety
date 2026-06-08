# Phase 13: Form Builder Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-20
**Phase:** 13-form-builder-foundation
**Areas discussed:** Builder engine, Cutover strategy, Existing data, Field scope

---

## Builder Engine

Pre-question raised after codebase scout revealed a custom dnd-kit builder already exists (built outside the formal GSD phases, iterated on recent Finley-feedback commits) — conflicting with the build prompt's greenfield "integrate coltorapps" premise.

| Option | Description | Selected |
|--------|-------------|----------|
| Audit-first, then decide | Phase 13's first deliverable is a gap audit, then lock coltorapps-vs-custom per-area with evidence | |
| Keep custom builder, harden it | Drop coltorapps; Phase 13 hardens the existing builder; Phases 14–18 retarget the existing FormField/FormSchema model | |
| Adopt coltorapps, rebuild | Install @coltorapps/builder, rebuild on its model, migrate the schema — matches the build prompt literally | ✓ |

**User's choice:** Adopt coltorapps, rebuild.
**Notes:** Re-aligns with PROJECT.md's documented "Coltorapps for Phase 2 form builder" Key Decision — the hand-rolled Phase 3 builder was the drift.

---

## Cutover Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Parallel behind a flag | Keep custom builder + renderer live; build coltorapps in parallel; cut over after Phase 14 parity | |
| Big-bang in Phase 13 | Replace custom builder + renderer with coltorapps now; assessment flow switches to the coltorapps interpreter immediately | ✓ |
| Builder parallel, renderer shared | Builder in parallel but renderer cut over immediately | |

**User's choice:** Big-bang in Phase 13.
**Notes:** Accepts that signature/rating/photo/geo/repeating field types regress until Phase 14, and the Phase 6 assessment fill flow moves to the coltorapps interpreter within Phase 13 scope.

---

## Existing Data

| Option | Description | Selected |
|--------|-------------|----------|
| Drop & reseed | Treat existing templates/submissions/assessments as disposable dev/demo data; wipe and reseed the FRA fresh in coltorapps shape | ✓ |
| Convert existing rows | Write a FormSchema → coltorapps converter so existing version rows + submissions stay renderable | |

**User's choice:** Drop & reseed.
**Notes:** Planner/executor must confirm there is no production assessment data before wiping (~7–8 clients, pre-launch — expected safe, verify). Phase 13 reseeds only a basic-types smoke-test template; the real FRA reseed is Phase 18.

---

## Field Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Strict 7 basic types | Phase 13 ships only the 7 basic entity types per the build prompt; custom field types return in Phase 14 | ✓ |
| Carry all field types into 13 | Port every field type onto coltorapps in Phase 13 so nothing regresses | |

**User's choice:** Strict 7 basic types.
**Notes:** Clean phase boundary. The FRA template and custom-field forms are unavailable between Phases 13 and 14 — accepted.

---

## Claude's Discretion

- **Field-component reuse** — wrap existing `components/forms/*-field.tsx` as coltorapps entity renderers vs write fresh. Default lean: reuse where clean.
- **Builder route** — keep `/admin/templates/[id]` vs adopt the build prompt's `/admin/form-builder/[templateId]`. Default lean: keep existing routes.
- coltorapps React 19.2.4 compatibility verification — researcher task; a hard blocker if incompatible.

## Deferred Ideas

- Custom field types on coltorapps, per-field photo attach, speech-to-text — Phase 14.
- Conditional logic / `visibilityRules` — Phase 15.
- Fork-on-fill, template assignment, client-built-from-scratch — Phase 16.
- Recurrence / scheduling / reminders — Phase 17.
- Full FRA template reseed — Phase 18.
