# Phase 18 — FRA Seed Template — CONTEXT

**Authored:** 2026-05-27 (skipping discuss-phase Q&A; context derived from ROADMAP success criteria + repo memory + existing `lib/forms/fra-template.ts` baseline)
**Depends on:** Phase 14 (custom field types) + Phase 15 (conditional logic) — both code-complete, UAT pending

---

## Locked decisions (treat as inputs, not open questions)

### FRA content source — LOCKED
- **Baseline:** the existing `lib/forms/fra-template.ts` (`HARDCODED_FRA_TEMPLATE` — 5 sections, 17 fields, pre-builder `FormSchema` shape). This is the structural baseline.
- **Target shape:** coltorapps `FormBuilderSchema` (the Phase 13/14/15 contract).
- **Authoritative content:** Matt's Blank FRA Type 3 doc (received 2026-04-15, in his Drive folder). Phase 18 v1 uses the hardcoded baseline; if Matt's blank diverges materially, that's a follow-up content edit, not a Phase 18 architectural fix.

### Scope — LOCKED to FRA Type 3 only
- **Site Risk template is BLOCKED** until Matt provides the blank (per TMPL-05 and ROADMAP §"Phase 18"). Do NOT build Site Risk in this phase.
- Phase 18 ships ONE template: "Fire Risk Assessment (Type 3) — Single Premises".

### Specialty fields to wire — LOCKED (consume Phase 14 deliverables)
- **`signatureField`** — Responsible-Person signature at the end of the form.
- **`multiPhotoField`** — Photo evidence on every section where the current `FormSchema` carries `type: "media"`. Per ROADMAP §"Phase 18" SC#3: "Per-field photo attachment and speech-to-text are enabled on all FRA text fields."
- **`geolocationField`** — Capture site lat/lng at start (the current hardcoded version does not have this — ADD per industry FRA norm).
- **`computedField`** — The PAS 79 risk matrix. Two input fields (likelihood + consequence) → matrix produces a risk score. Per ROADMAP §"Phase 18" SC#4: "The risk matrix auto-calculates from the two input fields, and the Action Plan uses repeating sections."
- **`repeatingSection`** — The Action Plan (per ROADMAP SC#4) — one row per remedial action with description + responsible owner + target date.

### Conditional logic to wire — LOCKED (consume Phase 15 deliverables)
- Per ROADMAP §"Phase 18" SC#2: "Conditional sub-sections work inside the FRA (Yes/No → show/hide)."
- The hardcoded template has implicit sub-sections (e.g., fire-alarm questions). Phase 18 makes them conditionally visible based on parent Yes/No answers.

### STT — INHERITED FROM PHASES 2 + 14
- Phase 14 wired per-field photo attachment + STT on text fields (per PROJECT.md memory and Phase 14 summary). Phase 18 inherits — no new STT plumbing.

### n8n integration — INHERITED FROM PHASE 7 + 17
- Per ROADMAP §"Phase 18" SC#5: "A submission fires the n8n webhook for the AI report pipeline (Module 1 bridge)."
- The Phase 7 AI report pipeline already exists (per PROJECT.md "Phase 7 — Built 2026-05-02 — Vercel AI SDK, no n8n"). Phase 7 used Vercel AI SDK direct, NOT n8n. **Open question for the researcher (Q5 below):** confirm whether SC#5 still wants an n8n webhook, or whether the existing Vercel-AI-SDK submission path is the correct integration.

---

## Open questions for the researcher / planner (use repo + web research, NOT user Q&A)

1. **PAS 79 risk matrix formula** — exact mapping of (Likelihood × Consequence) → Risk Score. Standard PAS 79 uses a 5×5 matrix with categorical labels (Trivial / Tolerable / Moderate / Substantial / Intolerable). Researcher must confirm and document the exact mapping the `computedField` will encode.
2. **Action Plan column structure** — what columns does the repeating section need? Standard FRA action plans have: Action Description, Responsible Person, Target Completion Date, Priority. Confirm against the hardcoded template + UK industry norm.
3. **Conditional logic granularity** — which Yes/No questions in the hardcoded template should drive sub-section visibility? Researcher should read `lib/forms/fra-template.ts` fully and propose a mapping.
4. **Seed mechanism** — should the FRA be (a) a migration that INSERTs the form_templates + template_versions rows, (b) a runtime seed script invoked manually, or (c) a TypeScript constant loaded at runtime if no DB row exists? Phase 14 / 15 / 16 / 17 used migrations for schema only; seed data has been ad-hoc. Researcher must recommend.
5. **n8n webhook OR Vercel AI SDK direct** — per the SC#5 note above. The existing Phase 7 pipeline is Vercel AI SDK (no n8n). Either (a) ROADMAP SC#5 is stale and should track Phase 7's path, or (b) Phase 18 introduces an additional n8n webhook for a different downstream. Researcher to clarify by reading Phase 7 SUMMARY + the existing submission path.
6. **STT scope** — Phase 14 enabled STT on text fields generally. Confirm whether Phase 18 needs any per-field overrides (e.g., disabling STT on numeric matrix inputs, enabling on the "anything else" free-form section).
7. **Photo evidence requirements** — the current hardcoded version has `type: "media"` on every section. Confirm whether each section needs ≥1 photo or whether they're optional. The Phase 14 `multiPhotoField` supports both shapes.
8. **Migration number** — next is 016. Confirm via `ls supabase/migrations/`.

---

## Scope boundaries

### IN SCOPE for Phase 18
- One `form_templates` row + one published `template_versions` row for "Fire Risk Assessment (Type 3) — Single Premises".
- Conversion of the hardcoded template structure to coltorapps `FormBuilderSchema`.
- Wiring of Phase 14 specialty entities (signature, multi-photo, geolocation, computed risk matrix, repeating action plan).
- Wiring of Phase 15 conditional logic for sub-sections.
- Seed mechanism (migration OR runtime) per Q4 resolution.
- Integration test that the seeded template renders end-to-end through fill → submit → AI report pipeline (success criterion SC#5).
- Migration / cleanup of the legacy `lib/forms/fra-template.ts` once the DB-backed version is canonical (deprecate or delete after Phase 18 ships).

### OUT OF SCOPE for Phase 18 (push to later phase or backlog)
- **Site Risk template** — BLOCKED until Matt provides the blank.
- Other safety templates (Asbestos, Legionella, Working at Height) — not in v1.
- Customer-built templates from scratch — already enabled in Phase 16 D-16; Phase 18 doesn't reopen that.
- Form-builder UX improvements — Phase 13 owns the builder.
- AI report content quality — Phase 7 owns the pipeline.

---

## Success Criteria (from ROADMAP — verbatim)

1. The Blank FRA is built using the form builder, matching the Yellow Broom FRA structure across all sections.
2. Conditional sub-sections work inside the FRA (Yes/No → show/hide).
3. Per-field photo attachment and speech-to-text are enabled on all FRA text fields.
4. The risk matrix auto-calculates from the two input fields, and the Action Plan uses repeating sections.
5. A submission fires the n8n webhook for the AI report pipeline (Module 1 bridge). Site Risk template stays BLOCKED until Matt provides the blank.

---

## Multi-tenancy invariants — INHERITED FROM PHASE 16
- The seeded FRA template is an **admin master** (`owner_type='admin'`, `owner_id=NULL` or a designated admin user). Customers can fork it via Phase 16 fork-on-fill.
- RLS allows all client_users to READ admin masters; only admin can WRITE.
- The phase MUST NOT touch RLS policies — Phase 16 RLS is the trust gate.

---

## Reference points the planner should read

- `lib/forms/fra-template.ts` — the structural baseline (5 sections, 17 fields).
- `.planning/phases/3-template-system-schema-versioning/` — original Phase 3 template-system summary (FRA seed precedent).
- `.planning/phases/14-custom-field-types/14-08-PLAN.md` (or last plan summary) — specialty entity wiring patterns to mirror.
- `.planning/phases/15-conditional-logic-engine/15-04-PLAN.md` (or visibility-rules summary) — conditional logic shape.
- `.planning/phases/16-multi-tenancy-fork-on-fill/16-CONTEXT.md` — admin master vs. customer fork contract.
- `.planning/phases/7-ai-report-pipeline/` — AI report pipeline integration point (SC#5).
- `app/admin/templates/[id]/builder-client.tsx` — the builder UI (verify what shapes it can produce).
- `lib/form-builder/` — coltorapps entity definitions + visibility-rules engine.
- `supabase/migrations/` — confirm next migration number is 016.

---

## Threat-model anchors (for the planner to extend)

| Trust boundary | Note |
|----------------|------|
| Seeded template → live DB | Seed migration runs once at deploy. If re-applied, must be idempotent (`INSERT ... ON CONFLICT DO NOTHING` or version_number check). |
| Form fill → AI report pipeline | Submission triggers downstream AI processing. Must preserve Phase 16 multi-tenancy invariants (client_id never client-supplied). |
| Admin master mutability | The seeded FRA is editable by admin in the builder. Any customer fork (Phase 16 D-08) snapshots the version at fork time — no cascade from master edits. |
