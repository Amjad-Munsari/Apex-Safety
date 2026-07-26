# Phase 18: FRA Seed Template — Research

**Researched:** 2026-05-27
**Domain:** Seeding ONE `form_templates` row (admin master) for "Fire Risk Assessment (Type 3) — Single Premises" — a coltorapps `FormBuilderSchema` exercising Phase 14 specialty entities (signature, multi-photo, geolocation, computed PAS 79, repeating action plan) and Phase 15 conditional visibility, wired into the existing admin submit → AI report pipeline.
**Confidence:** HIGH (every architectural claim is grounded in the existing migrations 011/012 precedent or in code under `lib/form-builder/`, `app/admin/assessments/actions.ts`, `components/form-interpreter/`. The only `[ASSUMED]` items are domain-knowledge claims about PAS 79 band boundaries and the FRA Action Plan column convention — already flagged by the Phase 14 PAS 79 risk file itself.)

---

## Summary

Phase 18 is a **pure seed-data phase**. Net-new shippable surface is **one migration file** that inserts a `form_templates` row and its `template_versions` row carrying the coltorapps `{ entities, root }` JSON. Every entity type the FRA needs already exists, every renderer already routes through the existing `InterpreterRenderer`, the existing admin submission path (`submitAssessmentAction` in `app/admin/assessments/actions.ts`) already validates against the pinned `schema_json` and already fires the AI pipeline via `after(runReportDraftGeneration)`. **There is no new code to write for the rendering or submission path** — only a SQL seed and a code-cleanup task to retire `lib/forms/fra-template.ts`.

The migration mirrors the canonical pattern in `supabase/migrations/011_specialty_smoke_test_template.sql` and `012_phase15_conditional_smoke_test.sql` byte-for-byte. The two material differences from those smoke-tests:
1. **`is_published: true`** on the `form_templates` row + `published_at = NOW()` on the `template_versions` row — required so customer surfaces (Phase 16 RLS policy `form_templates_client_published`) can read it.
2. **Idempotency guard** — re-running the migration on a fresh deploy must not duplicate the FRA. Use a fixed UUID literal for both the template and its v1 version, plus `ON CONFLICT (id) DO NOTHING`.

**Primary recommendation:** ship migration `016_phase18_fra_seed.sql` as the canonical seed mechanism. After ship, delete `lib/forms/fra-template.ts` and its sole consumer surface. The AI pipeline integration on submit is **already wired** — Phase 18 inherits it, no new code.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**FRA content source**
- Baseline is `lib/forms/fra-template.ts` (`HARDCODED_FRA_TEMPLATE` — 5 sections, 17 fields).
- Target shape is coltorapps `FormBuilderSchema` (Phase 13/14/15 contract — `{ entities, root }`).
- Authoritative content: Matt's Blank FRA Type 3 doc (received 2026-04-15). Phase 18 v1 uses the hardcoded baseline; material divergence is a follow-up content edit, not an architectural fix.

**Scope — LOCKED to FRA Type 3 only**
- Site Risk template is BLOCKED until Matt provides the blank.
- Phase 18 ships exactly ONE template: "Fire Risk Assessment (Type 3) — Single Premises".

**Specialty fields to wire — LOCKED (consume Phase 14 deliverables)**
- `signatureField` — Responsible-Person signature at the end of the form.
- `multiPhotoField` — Photo evidence on every section where the current `FormSchema` carries `type: "media"` (escape routes; fire protection). Per ROADMAP SC#3.
- `geolocationField` — Capture site lat/lng at start (NEW vs. hardcoded baseline; FRA industry norm).
- `computedField` — PAS 79 risk matrix. Two `numberField` inputs (likelihood + consequence) → matrix produces a risk score. Per ROADMAP SC#4.
- `repeatingSection` — The Action Plan. One row per remedial action with description + responsible owner + target date. Per ROADMAP SC#4.

**Conditional logic to wire — LOCKED (consume Phase 15 deliverables)**
- Per ROADMAP SC#2: "Conditional sub-sections work inside the FRA (Yes/No → show/hide)."
- Make implicit sub-sections (fire-alarm, escape-route details) conditionally visible from parent Yes/No answers using the `visibilityRules` attribute.

**STT — INHERITED FROM PHASES 2 + 14**
- Phase 14 wired per-field photo attachment + STT on text fields. Phase 18 inherits — no new STT plumbing.

**n8n integration — INHERITED FROM PHASE 7 + 17**
- ROADMAP SC#5: "A submission fires the n8n webhook for the AI report pipeline (Module 1 bridge)."
- Phase 7 used Vercel AI SDK direct (no n8n). Open question Q5 resolves this conflict below.

### Claude's Discretion
- PAS 79 risk-matrix exact band boundaries (Q1 below — confirmed against existing Phase 14 `lib/form-builder/risk/pas79.ts`, which already encodes the answer).
- Action Plan column structure (Q2 below).
- Conditional logic granularity — which Yes/No → sub-section mappings (Q3 below).
- Seed mechanism choice — migration vs. runtime script (Q4 below).
- Photo-evidence required/optional shape (Q7 below).

### Deferred Ideas (OUT OF SCOPE)
- Site Risk template (BLOCKED on Matt's blank).
- Other safety templates (Asbestos, Legionella, Working at Height).
- Customer-built templates from scratch — already enabled in Phase 16; Phase 18 does not reopen this.
- Form-builder UX improvements — Phase 13 owns the builder.
- AI report content quality — Phase 7 owns the pipeline.
- Migrating / deleting `lib/forms/fra-template.ts` — in-scope per CONTEXT but flagged as a cleanup, not a blocking task.
</user_constraints>

---

## Project Constraints (from CLAUDE.md / AGENTS.md)

| Constraint | Source | How Phase 18 honours it |
|------------|--------|--------------------------|
| Polymorphic owner_id contract is sacred | AGENTS.md "Form template ownership" | Seed inserts `owner_type='admin'`, `owner_id=<an admin_users.id>` (NOT NULL — `owner_id` was nullable in 003 but smoke-test migrations 010/011/012 always resolve a real admin). |
| Master + fork-on-fill: customers can fork; cascade is forbidden | AGENTS.md decision 2026-04-17, Phase 16 D-08 | Phase 18 makes ZERO changes to the master once seeded. If Matt later edits the master via the builder, customer forks remain pinned to their own snapshot — handled by the existing Phase 16 `forkAssignedTemplate` action; Phase 18 does NOT need to touch this. |
| `parent_template_id` IS NULL for originals | AGENTS.md polymorphic contract | The seed sets `parent_template_id` implicitly NULL (column omitted from the INSERT). |
| "This is NOT the Next.js you know" | AGENTS.md preamble | Phase 18 ships ONLY a migration and a deletion — no Next.js APIs touched. |
| No mocks in shipped code | MEMORY.md `feedback_no_demo_mocks_in_code.md` | Deleting `lib/forms/fra-template.ts` and its consumers is the literal application of this rule: the hardcoded constant was the demo mock; the DB row is the source of truth. |
| DB is source of truth for seed data | MEMORY.md `feedback_db_as_source_of_truth.md` | Migration is the canonical seed mechanism (Q4 below confirms). |

---

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ROADMAP §"Phase 18" SC#1 | "Blank FRA built using the form builder, matching the Yellow Broom FRA structure across all sections." | Q3 below maps the existing 5-section baseline into the coltorapps `{ entities, root }` shape; example seed migration in Code Example 1 below. |
| ROADMAP §"Phase 18" SC#2 | "Conditional sub-sections work inside the FRA (Yes/No → show/hide)." | Q3 below proposes 3 Yes/No → sub-section visibility mappings using the `visibilityRules` attribute (Phase 15 shape). Migration 012 line 198-219 is the exact precedent. |
| ROADMAP §"Phase 18" SC#3 | "Per-field photo attachment and speech-to-text are enabled on all FRA text fields." | STT is automatic on every `textField` / `textareaField` renderer (`components/form-interpreter/text-field-renderer.tsx:65`, `textarea-field-renderer.tsx:53` — `MicButton` is unconditional). No per-field config needed; `attachPhotos` defaults to `false` per Phase 14 D-05 and is opt-in per field. Q6 below. |
| ROADMAP §"Phase 18" SC#4 | "Risk matrix auto-calculates from two input fields; Action Plan uses repeating sections." | Computed field already implements PAS 79 (`lib/form-builder/risk/pas79.ts`); the seed wires two `numberField`s + one `computedField` exactly as `011_specialty_smoke_test_template.sql:194-242` does. Action Plan is a `repeatingSection` with children — Q2 below specifies columns. |
| ROADMAP §"Phase 18" SC#5 | "Submission fires the n8n webhook for the AI report pipeline (Module 1 bridge)." | Q5 below — already wired in `submitAssessmentAction` (`app/admin/assessments/actions.ts:194-212` n8n fire-and-forget + `:302-308` Vercel AI SDK via `after()`). Phase 18 inherits both. |

---

## Open Questions Resolved

### Q1 — PAS 79 risk matrix formula

**Resolution:** Already encoded in `lib/form-builder/risk/pas79.ts`. Phase 18 reuses verbatim — no new code, no new band table.

**The mapping (5×5 matrix, score = likelihood × consequence)** [VERIFIED: `lib/form-builder/risk/pas79.ts:37-72`]:

| Score range | Level         | Band  | Tailwind colour class                                       |
|-------------|---------------|-------|-------------------------------------------------------------|
| 1–2         | Trivial       | GREEN | `bg-green-100 text-green-900 border border-green-300`       |
| 3–4         | Tolerable     | GREEN | `bg-green-100 text-green-900 border border-green-300`       |
| 5–9         | Moderate      | AMBER | `bg-amber-100 text-amber-900 border border-amber-300`       |
| 10–12       | Substantial   | AMBER | `bg-amber-100 text-amber-900 border border-amber-300`       |
| 13–16       | Substantial   | RED   | `bg-red-100 text-red-900 border border-red-300`             |
| 17–25       | Intolerable   | RED   | `bg-red-100 text-red-900 border border-red-300`             |

Input axes:
- **Likelihood:** integer 1–5 (1 = Very Low … 5 = Very High).
- **Consequence:** integer 1–5 (1 = Insignificant … 5 = Catastrophic).
- Non-integer or out-of-range inputs return `null` (renderer shows the "pending" pill).

**Source provenance:** [ASSUMED] for BSI PAS 79-1:2020 exact band boundaries — the standard does not publish the bands in freely available form. The boundaries in `pas79.ts` reflect the most common FRA practitioner convention (see the TODO note at lines 3-6 of that file). The Phase 14 RESEARCH already flagged this as A1; Matt should confirm in UAT. **Risk if wrong:** band cutoffs shift by ±1 score, which changes the colour pill but not the architecture. Reversible in `pas79.ts` only — no schema change.

[CITED: BSI PAS 79-1:2020 — Fire Risk Assessment, BSI catalogue page (boundaries not in free-tier text)] [VERIFIED: `lib/form-builder/risk/pas79.ts:37-72` is the authoritative encoding in repo]

### Q2 — Action Plan column structure

**Resolution:** Four-column `repeatingSection` with the following child entities:

| Column                 | Entity type    | Required | Notes |
|------------------------|----------------|----------|-------|
| Action description     | `textareaField`| true     | STT enabled by default (textarea renderer). Replaces the hardcoded `priority_actions` free-form text dump. |
| Responsible person     | `textField`    | true     | Plain text; Matt's customers don't have user-pickers yet. |
| Target completion date | `dateField`    | true     | Native HTML5 date input. |
| Priority               | `selectField`  | true     | Options: `High`, `Medium`, `Low`. `allowMultiple: false`. |

**Why these four:** these are the UK industry-norm columns for FRA action plans (Regulatory Reform (Fire Safety) Order 2005 — "significant findings and any action taken or to be taken"; PAS 79 §6.3 calls for owner + target). The hardcoded baseline collapses all of this into a single `priority_actions` textarea field (`lib/forms/fra-template.ts:170-176`), which is the kind of "structureless dump" the AI pipeline can't extract hazards from cleanly. Restructuring into 4 columns means `expandRepeatingSections` (`app/admin/assessments/actions.ts:334-371`) labels each row, and the AI prompt sees `[ { instanceIndex: 1, "Action description": "...", "Responsible person": "...", "Target completion date": "...", "Priority": "High" }, ... ]` — much better signal than an opaque paragraph.

**No "Status" column** in v1 — the FRA is a snapshot; tracking action completion over time is Phase 19+ territory.

[VERIFIED: `app/admin/assessments/actions.ts:334-371` `expandRepeatingSections` labels children by their `attributes.label`] [CITED: PAS 79-1:2020 §6.3 — boundaries of action plan content] [ASSUMED] specific 4-column structure is the "standard" — convention varies by assessor. Matt should confirm in UAT.

### Q3 — Conditional logic granularity (Yes/No → sub-section mapping)

**Resolution:** Map three Yes/No questions in the hardcoded baseline to three conditionally-visible sub-sections. Use the `visibilityRules` attribute shape from migration 012 (lines 198-219, 222-246) verbatim.

The hardcoded baseline (`lib/forms/fra-template.ts`) has **no Yes/No fields** in the literal "yes" / "no" sense — every dropdown has 3+ options. The mapping below promotes three of those dropdowns to Yes/No-style triggers for sub-sections, while preserving the original options as the on-the-positive-branch sub-section content:

| Driver field (existing) | Driver values | Sub-section that becomes visible | Sub-section content (new fields) |
|------------------------|---------------|----------------------------------|----------------------------------|
| `policy_in_place` ("Is a written fire safety policy in place?") | `out_of_date` OR `no` | Section "Policy remediation" | `textField` "When was the last review?" + `textareaField` "What needs updating?" |
| `escape_routes_clear` ("Are all escape routes clear?") | `partial` OR `no` | Section "Obstruction details" | `textareaField` "Describe obstructions" + `multiPhotoField` "Obstruction photos" (max 5, required ≥ 1) |
| `detection_type` ("Detection system") | `none` | Section "Detection upgrade plan" | `textareaField` "Recommended detection level" + `selectField` "Recommended grade" (L1/L2/L3/L4) |

**Rule shape (per Phase 15 spec, verified at `lib/form-builder/attributes/visibility-rules.ts:18-29`):**
```ts
{
  rules: [{
    sourceEntityId: "<driver-entity-id>",
    operator: "equals",         // or "notEquals" for inverse
    value: "out_of_date",        // matches the option value
    action: "show"               // section is hidden by default; shown when rule fires
  }],
  logic: "or"                    // when multiple rules — fires if ANY matches
}
```

For multi-value triggers (e.g. `policy_in_place` fires on `out_of_date` OR `no`), use **two `equals` rules with `logic: "or"`** — `contains` is for substring matching against text/array values, not value-disjunction over enums [VERIFIED: `lib/form-builder/visibility/evaluate-rule.ts` operator semantics].

**Why not more aggressive conditional logic:** every additional rule increases UAT surface. Three Yes/No → sub-section mappings is enough to demonstrate SC#2 ("conditional sub-sections work inside the FRA") without making v1 over-engineered. Matt can request more in UAT.

[VERIFIED: `lib/form-builder/attributes/visibility-rules.ts:43-110`] [VERIFIED: `supabase/migrations/012_phase15_conditional_smoke_test.sql:198-246`]

### Q4 — Seed mechanism

**Resolution: option (a) — SQL migration `016_phase18_fra_seed.sql`.** Reject options (b) standalone seed script and (c) runtime fallback constant.

**Rationale:**

| Criterion | Migration (a) | Standalone script (b) | Runtime fallback (c) |
|-----------|---------------|-----------------------|---------------------|
| Idempotent | ✓ — `INSERT ... ON CONFLICT (id) DO NOTHING` with fixed UUID literal | ✗ — manual re-runs duplicate unless author remembers to add guards | ✓ — but invisible to DB queries |
| Dev/prod parity | ✓ — same migration runs everywhere via `supabase db push` | ✗ — script must be re-invoked in every env | ✗ — prod DB diverges from dev DB |
| Auditable | ✓ — git history shows when it was added | ~ — git history shows the script but not the timing of each invocation | ✗ — no DB row to audit |
| Phase 16 fork-on-fill compatible | ✓ — `parent_template_id IS NULL` makes it a master per AGENTS.md contract | ✓ | ✗ — runtime fallback can't be forked (no `form_templates.id` to point at) |
| Precedent in repo | ✓ — migrations 010/011/012 all seed templates this way | ✗ — `scripts/seed-demo-data.mjs` exists but only seeds clients/services, not templates | ✗ — no precedent |
| AGENTS.md "no mocks" rule | ✓ — DB row IS the source of truth | ~ — script could become a mock if forgotten | ✗ — explicitly contradicts the rule |
| Phase 16 D-08 (forks don't cascade) | ✓ — runtime data doesn't affect existing forks | ✓ | N/A — no row, nothing to fork from |

Migration is the only option that satisfies every constraint. Options (b) and (c) lose on at least one critical dimension.

**Filename:** `016_phase18_fra_seed.sql` (next number after 015 — verified by directory listing, see Q8).

**Idempotency mechanism:** declare a fixed UUID literal at the top of the migration for both the template and its v1 version. Use `INSERT ... ON CONFLICT (id) DO NOTHING`. This makes the migration safe to re-run during dev / CI / blue-green deploys without duplicating the seed.

[VERIFIED: `supabase/migrations/011_specialty_smoke_test_template.sql`, `012_phase15_conditional_smoke_test.sql`] [VERIFIED: `scripts/seed-demo-data.mjs` does NOT touch `form_templates`]

### Q5 — n8n webhook vs. Vercel AI SDK

**Resolution: the existing submit path already does BOTH. Phase 18 needs to add NO new integration code.** ROADMAP SC#5 is satisfied as-is.

**What `submitAssessmentAction` already does** [VERIFIED: `app/admin/assessments/actions.ts:232-309`]:

1. **Validates** against pinned `template_versions.schema_json` (line 264-270).
2. **Evaluates Phase 15 visibility** and strips hidden answers (lines 277-280).
3. **Writes** the scrubbed answers + flips status to `submitted` (lines 283-295).
4. **Fires the AI pipeline via Vercel AI SDK** in an `after()` callback (lines 302-308) — calls `runReportDraftGeneration` which uses `generateObject` + OpenRouter `gpt-4o-mini` (lines 380-471).

And separately, the older `submitAssessment` (which still exists at `actions.ts:166-215`) **also POSTs a `{ submissionId }` payload to `N8N_ASSESSMENT_WEBHOOK_URL`** as a fire-and-forget (lines 194-212), logging failures to `workflow_errors`. This is the n8n webhook ROADMAP SC#5 names.

**Both integration points exist today.** The two paths are NOT in conflict — they serve different purposes:

| Path | Purpose | Where wired |
|------|---------|-------------|
| Vercel AI SDK (`after(runReportDraftGeneration)`) | Generate the structured AI report draft Matt reviews on `/admin/assessments/[id]/review`. | `submitAssessmentAction:302-308` — runs in `after()` so the user's redirect isn't blocked on the OpenRouter round-trip. |
| n8n webhook (`N8N_ASSESSMENT_WEBHOOK_URL`) | Module 1 downstream bridge — Matt's existing n8n workflows that fan out to email delivery, customer notifications, or Drive backups. Distinct from the AI draft. | `submitAssessment:194-212` (currently). |

**The two `submit*` server actions are doing duplicate work.** `submitAssessment` is the older path (no validation, no scrub, no after-callback); `submitAssessmentAction` is the Phase 13+ replacement (validates, scrubs, fires AI). The n8n webhook fire in `submitAssessment` is NOT mirrored in `submitAssessmentAction`. **This is the only real action item for Phase 18 SC#5:** verify the n8n webhook fire is also invoked from `submitAssessmentAction` — and if not, port the same fire-and-forget POST (lines 194-212) into `submitAssessmentAction` after the AI `after()` registration.

**Recommendation for the planner:** add a small task "wire `N8N_ASSESSMENT_WEBHOOK_URL` fire-and-forget POST into `submitAssessmentAction`" — DO NOT create a new helper file. Inline the existing pattern from `submitAssessment:194-212` into `submitAssessmentAction` before the `after()` call. ROADMAP SC#5 reads "fires the n8n webhook **for the AI report pipeline (Module 1 bridge)**" — both paths are in scope.

**Do NOT extend `lib/notifications/n8n-dispatch.ts`** for this. That helper carries the typed discriminated union used by Phase 5 (`expiry_alert`) and Phase 17 (`assignment_reminder`) — both of which use the general email workflow. The assessment-submission webhook is a different downstream: it targets the n8n "assessment ingestion" workflow with a `{ submissionId }` body and a different URL (`N8N_ASSESSMENT_WEBHOOK_URL` vs. `N8N_WEBHOOK_URL`). Keep it inline.

[VERIFIED: `app/admin/assessments/actions.ts:166-215, 232-309, 380-471`] [VERIFIED: `lib/notifications/n8n-dispatch.ts` uses `N8N_WEBHOOK_URL` — different env var from `N8N_ASSESSMENT_WEBHOOK_URL`]

### Q6 — STT scope

**Resolution:** No per-field STT configuration is needed for Phase 18. STT is **always-on** for every `textField` and `textareaField` renderer; it is **never-on** for any other entity type. The seed migration sets no STT-related attribute (none exists).

**Mechanism** [VERIFIED:]:
- `components/form-interpreter/text-field-renderer.tsx:65` renders `<MicButton>` unconditionally inside the `<Input>` wrapper.
- `components/form-interpreter/textarea-field-renderer.tsx:53` renders `<MicButton>` unconditionally inside the `<Textarea>` wrapper (positioned bottom-right per UI-SPEC).
- `components/forms/mic-button.tsx:22-50` uses `useSTT()` (which probes `webkitSpeechRecognition` / `SpeechRecognition` in the browser) and shows a toast `"Speech-to-text isn't available in this browser. Try Chrome or Edge on desktop."` when unsupported.
- No `numberField`, `selectField`, `dateField`, `checkboxField`, `signatureField`, `multiPhotoField`, `geolocationField`, `computedField`, `repeatingSection`, or `ratingField` renderer wires `MicButton`. There is nothing to disable.

**Implication for the FRA seed:** Phase 14 already proved STT works on every textField/textareaField — no per-field overrides. The "anything else" free-form `general_observations` field is a `textareaField` and gets STT automatically. The likelihood/consequence inputs are `numberField`s, which do NOT carry STT — exactly the "noise on numeric matrix inputs" concern is already avoided by the entity-type-based wiring.

[VERIFIED: `components/form-interpreter/text-field-renderer.tsx`, `textarea-field-renderer.tsx`, `mic-button.tsx`, `hooks/use-stt`]

### Q7 — Photo evidence requirements

**Resolution:** Two `multiPhotoField` entities in the FRA, both **required ≥ 1 photo**. Detail below.

The hardcoded baseline has `type: "media"` on two sections (`escape_routes` and `fire_protection`). Map these to `multiPhotoField` entities:

| Section in seed | Field label                                | `required` | `maxPhotos` | Conditional? |
|-----------------|--------------------------------------------|------------|-------------|--------------|
| 03 — Means of Escape | "Escape route photos"                  | true (≥1) | 8           | No — always shown |
| 03 — Means of Escape | "Obstruction photos" (inside Q3 sub-section) | true (≥1) | 5         | Yes — Q3 mapping; visible when `escape_routes_clear ∈ {partial, no}` |
| 04 — Fire Protection | "Fire protection photos"               | true (≥1) | 8           | No — always shown |

**Why required:** UK FRA practice expects photographic evidence on findings against specific control measures (escape routes + fire-detection / suppression / doors). The hardcoded baseline's `helpText` already says "Photographic evidence is required wherever a finding is recorded against a control measure" (`lib/forms/fra-template.ts:10`). Promoting this from helpText to `required: true` enforces the existing intent.

**Why `maxPhotos=8` / `5`:** Phase 14 specialty smoke test uses `maxPhotos: 8` (`migrations/011_*:175`). 8 is comfortable for a typical site walkaround; 5 for the conditional sub-section because the user only got there because escape routes are partially obstructed (less likely to want a photo dump).

**On other sections (Premises Details, Fire Safety Management, Findings & Recommended Actions):** no photos in v1. The hardcoded baseline doesn't request them; the FRA industry norm doesn't require them on these sections. Per-field `attachPhotos` affordance (Phase 14 D-05) on text fields is the escape hatch if Matt wants to attach context-photos to specific answers — but Phase 18 keeps `attachPhotos: false` on every non-photo field for v1 (matches `migrations/011_*` defaults).

[VERIFIED: `lib/forms/fra-template.ts:107-111, 145-150`] [VERIFIED: `lib/form-builder/entities/multi-photo-field.ts:32-55` enforces required + max]

### Q8 — Migration number

**Resolution: 016** [VERIFIED: `ls supabase/migrations/`]

Current directory listing (15 files):
```
001_initial_schema.sql
002_phase7_draft_report.sql
003_form_template_customer_ownership.sql
004_form_templates_rls_fixes.sql
005_template_versions_polymorphic_created_by.sql
006_documents_file_size.sql
007_services_columns.sql
008_proposals_audit_columns.sql
009_clients_contact_columns.sql
010_form_builder_foundation_reseed.sql
011_specialty_smoke_test_template.sql
012_phase15_conditional_smoke_test.sql
013_phase16_assignments_instructions.sql
014_phase16_customer_submissions.sql
015_phase17_assignment_recurrence_reminders.sql
```

**Recommended filename:** `016_phase18_fra_seed.sql`.

### Q9 — Pitfalls to flag for the planner

**P1 — Hallucinating a `RiskMatrixField` entity that doesn't exist**

There is NO `riskMatrixField` entity type in `lib/form-builder/entities/`. The PAS 79 risk matrix is implemented as a `computedField` with `formula: 'pas79'` and `computedInputs: { likelihood: <numberField id>, consequence: <numberField id> }`. The Phase 18 seed MUST use this exact pattern (precedent: `011_specialty_smoke_test_template.sql:224-242`).

**Code-level guard:** plan tasks must reference `computedField` with `formula: 'pas79'` — never invent a new entity type. The set of entity types is fixed by `lib/form-builder/index.ts:19-35`.

**P2 — Hallucinating `is_published: false` on the seed (cargo-cult from migrations 011/012)**

Smoke-test templates (`010`/`011`/`012`) set `is_published: false` because they're for UAT only. The Phase 18 FRA is a **real master** — customer surfaces must see it. The seed MUST set:
- `form_templates.is_published = true`
- `template_versions.published_at = NOW()`

Without both, RLS policies `form_templates_client_published` (`migrations/001_initial_schema.sql:263`) and `template_versions_client_published` (`migrations/001_initial_schema.sql:275`) hide the row from `client_users`, breaking the customer assignment flow.

**Code-level guard:** the seed SQL must include `is_published := true` in the `form_templates` INSERT AND `published_at := NOW()` in the `template_versions` INSERT. Add an assertion comment in the migration explaining why this seed diverges from 011/012 here.

**P3 — Owner contract: `owner_type='admin'` + a real `admin_users.id`**

The polymorphic `form_templates.owner_id` is nullable at the schema level (column has no NOT NULL constraint) but every existing master in 010/011/012 resolves a real admin ID via `SELECT id INTO v_admin_id FROM admin_users LIMIT 1`. The Phase 16 RLS policies for admin-master read DO NOT depend on `owner_id` being non-null, but the `idx_form_templates_owner` index is on `(owner_type, owner_id)` and admin tooling joins on it. Keep the precedent: resolve an admin and use their ID.

**Code-level guard:** the migration must include `SELECT id INTO v_admin_id FROM admin_users LIMIT 1;` and INSERT with `owner_id := v_admin_id, owner_type := 'admin'`. Never NULL out `owner_id`.

**P4 — Cascading edits from master to customer forks (forbidden by Phase 16 D-08)**

Phase 16 D-08 forbids cascading updates from a master to any existing customer fork. The Phase 18 SEED phase doesn't trigger this directly (it only inserts a new master), but **the cleanup task** ("delete `lib/forms/fra-template.ts`") can. If anything in the codebase still reads `HARDCODED_FRA_TEMPLATE` after Phase 18 ships, those code paths will diverge from the seeded master and bypass the fork system entirely.

**Code-level guard:** before the cleanup task removes `lib/forms/fra-template.ts`, the planner must include a verification step: `grep -rn "HARDCODED_FRA_TEMPLATE\|@/lib/forms/fra-template" .` returns zero hits (excluding the file being deleted). Phase 18 must not leave dead imports.

**P5 — Hallucinating that `customer_submissions` is a separate table**

It isn't. Customer-side submissions go through `form_submissions` (the same table admin-side uses), gated by RLS — see Phase 16 migration 014. The Phase 18 seed has NOTHING to do with `form_submissions` directly. The seed inserts a TEMPLATE; submissions happen later at fill time.

**Code-level guard:** plan tasks must NOT touch `form_submissions` or any submission-side table. Migration 016 inserts EXACTLY two rows: one in `form_templates`, one in `template_versions`.

**P6 — Hallucinating Yes/No widgets**

There is no `yesNoField` entity. "Yes/No" in the FRA is encoded as `selectField` with two-or-more options (the baseline uses 3-option dropdowns). `visibilityRules` operators compare on the option **value** string (e.g. `value: "no"`), not on a boolean.

**Code-level guard:** every "Yes/No" question in the seed is a `selectField`. The rule shape uses `operator: "equals", value: "<the option value string>"`. Cross-reference `lib/form-builder/attributes/options.ts` for the option-shape contract.

**P7 — Customer-side submit does NOT trigger the AI pipeline**

[VERIFIED: `app/client/assignments/actions.ts:158-220` `submitAssignedFillByIdAction`] The customer's fill flow updates `form_submissions.status='submitted'` but does NOT call `runReportDraftGeneration` or the n8n webhook. Only the **admin** `submitAssessmentAction` does. This is correct for current scope (admins do the FRA on Matt's behalf), but the planner MUST NOT assume customer submissions also fire the AI pipeline. If Matt eventually wants customer-completed FRAs to also generate AI drafts, that's a separate phase. Phase 18 inherits this asymmetry.

### Q10 — Code examples

See the **Code Examples** section below for the seed migration template and the n8n-port snippet.

---

## Patterns to Follow

### Pattern 1: Mirror migration 011 / 012 byte-for-byte

The canonical pattern is `supabase/migrations/011_specialty_smoke_test_template.sql`. Specifically:
- `DO $$ DECLARE v_admin_id UUID; v_template_id UUID; e_<entity> UUID := gen_random_uuid(); ... v_schema JSONB; BEGIN ... END $$ LANGUAGE plpgsql;` wrapping.
- Resolve admin via `SELECT id INTO v_admin_id FROM admin_users LIMIT 1`.
- Build `v_schema := jsonb_build_object('entities', jsonb_build_object(...), 'root', jsonb_build_array(...))`.
- Insert `form_templates` first, capture `v_template_id` via `RETURNING id INTO v_template_id`.
- Insert `template_versions` row referencing `v_template_id`, `version_number=1`, `schema_json=v_schema`, `created_by=v_admin_id`, `published_at=NOW()`.
- End with `RAISE NOTICE` for the deploy log.

**Two divergences from 011/012 for Phase 18:**
1. `is_published: true` on `form_templates` AND `published_at: NOW()` on `template_versions` (Pitfall P2).
2. **Fixed UUID literal** for both `form_templates.id` and `template_versions.id` instead of `gen_random_uuid()`, with `ON CONFLICT (id) DO NOTHING` — for idempotency. The smoke-tests don't need this because they're never deployed to prod; Phase 18 will be.

### Pattern 2: coltorapps EntityParentMismatch rule

Every container entity (`sectionGroup`, `repeatingSection`) MUST satisfy both:
- Container carries `children: [<childId1>, <childId2>, ...]` in its definition.
- Each child carries `parentId: <containerId>` in its own definition.

Neither alone is sufficient — both must be present. Migration 011 documents this explicitly at lines 245-262 + 267-278. Migration 012 lines 246-270 are the canonical sectionGroup → repeatingSection → child nesting precedent.

The Phase 18 FRA uses this nesting heavily:
- 5 top-level `sectionGroup`s (one per FRA section).
- One `repeatingSection` for the Action Plan inside section 5.
- Up to 3 `sectionGroup` children inside parent sections for the Yes/No conditional sub-sections (Q3 mapping).

### Pattern 3: Computed field with PAS 79

`computedField` declarations follow `migrations/011_specialty_smoke_test_template.sql:224-242`:
```json
{
  "type": "computedField",
  "attributes": {
    "label": "PAS 79 risk level",
    "formula": "pas79",
    "computedInputs": { "likelihood": "<likelihood-entity-id>", "consequence": "<consequence-entity-id>" },
    "attachPhotos": false
  }
}
```

Both input fields MUST be `numberField` with `min: 1, max: 5, required: true`. The renderer (`components/form-interpreter/computed-field-renderer.tsx`) reads via `useInterpreterEntitiesValues` and renders the badge live.

### Pattern 4: `repeatingSection` children inheritance

Children of a `repeatingSection` get rendered N times (one per instance). Their `parentId` is the `repeatingSection` id; they are NOT in the schema's `root` array. The Action Plan's 4 children (description / responsible / date / priority) appear ONCE in `schema.entities` but render once per instance. Migration 011 lines 267-313 are the canonical pattern.

### Pattern 5: AI pipeline is auto-wired

`submitAssessmentAction` already calls `runReportDraftGeneration` in an `after()` callback. The function:
1. Re-fetches the pinned `schema_json` via two-step query (never FK join — Phase 13 Pitfall 2).
2. Runs `expandRepeatingSections` to label every Action Plan row.
3. Calls `generateObject({ model: openai('openai/gpt-4o-mini'), schema: reportSchema, prompt: ... })`.
4. Writes the result to `form_submissions.draft_report_json`.

**Phase 18 must not modify `runReportDraftGeneration` or `expandRepeatingSections`.** The PAS 79 computedField's value will appear in `answers_json` as the badge level string (the renderer's `setValue` may or may not write it back — D-10 marks it "advisory text only" for the AI prompt). The AI prompt doesn't need PAS-specific changes — the existing prompt ("Act as a Fire Risk Assessor...") already covers this domain.

---

## Pitfalls to Avoid

(Already enumerated in Q9 above — pitfalls P1–P7. Repeated here as a checklist for the planner:)

- [ ] **P1.** Don't invent a `RiskMatrixField`. Use `computedField` with `formula: 'pas79'`.
- [ ] **P2.** Set `is_published=true` AND `published_at=NOW()` — diverge from smoke-test seeds.
- [ ] **P3.** Resolve a real admin via `SELECT id FROM admin_users LIMIT 1` and use it as `owner_id`. `owner_type='admin'`.
- [ ] **P4.** Verify zero remaining references to `HARDCODED_FRA_TEMPLATE` or `@/lib/forms/fra-template` BEFORE deleting the file.
- [ ] **P5.** Don't touch `form_submissions` or any submission table — Phase 18 is template-seed only.
- [ ] **P6.** Yes/No questions are `selectField` with options; visibility rules compare option VALUE strings.
- [ ] **P7.** Customer-side submits don't fire AI — that's a permanent invariant, not a bug to "fix".

---

## Code Examples

### Example 1 — Phase 18 seed migration (`supabase/migrations/016_phase18_fra_seed.sql`, excerpt)

Full file is structurally identical to migrations 011 + 012 — this is the load-bearing excerpt showing the divergences. About 20 lines of the critical header, the computedField wiring, and the repeating Action Plan.

```sql
-- 016_phase18_fra_seed.sql — Phase 18: FRA Type 3 admin master seed.
-- Idempotent: fixed UUID literals + ON CONFLICT (id) DO NOTHING.

DO $$
DECLARE
  v_admin_id    UUID;
  -- Fixed UUIDs for idempotency (Pitfall P2 — re-runnable on prod blue-green deploys)
  v_template_id UUID := '00000000-0000-4000-a000-000000000018'::uuid;  -- '18' = phase 18
  v_version_id  UUID := '00000000-0000-4000-a000-000000000118'::uuid;

  -- Entity UUIDs (truncated — full FRA has ~25-30 entities including conditional sub-sections)
  e_site_geolocation UUID := gen_random_uuid();   -- Section 01 NEW per CONTEXT
  e_responsible_p    UUID := gen_random_uuid();
  e_policy_in_place  UUID := gen_random_uuid();   -- Yes/No driver for sub-section 02a (Q3)
  e_section_02a      UUID := gen_random_uuid();   -- Conditional sub-section
  e_likelihood       UUID := gen_random_uuid();   -- PAS 79 input
  e_consequence      UUID := gen_random_uuid();   -- PAS 79 input
  e_pas79            UUID := gen_random_uuid();   -- computedField
  e_action_plan      UUID := gen_random_uuid();   -- repeatingSection
  e_action_desc      UUID := gen_random_uuid();   -- child
  e_action_owner     UUID := gen_random_uuid();   -- child
  e_action_due       UUID := gen_random_uuid();   -- child
  e_action_priority  UUID := gen_random_uuid();   -- child
  e_signature        UUID := gen_random_uuid();   -- responsible-person signature

  v_schema JSONB;
BEGIN
  SELECT id INTO v_admin_id FROM admin_users LIMIT 1;
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Phase 18 seed requires at least one admin_users row. Seed admin first.';
  END IF;

  v_schema := jsonb_build_object(
    'entities', jsonb_build_object(

      -- ── Section 1 example: geolocationField (Capture site lat/lng — NEW per CONTEXT) ──
      e_site_geolocation::text, jsonb_build_object(
        'type', 'geolocationField',
        'attributes', jsonb_build_object(
          'label',        'Site location (GPS)',
          'required',     true,
          'helpText',     'Click Refresh to capture current GPS position',
          'attachPhotos', false,
          'visibilityRules', jsonb_build_object('rules', jsonb_build_array(), 'logic', 'and')
        )
      ),

      -- ── PAS 79 computed field (mirror of migration 011 lines 224-242) ──
      e_pas79::text, jsonb_build_object(
        'type', 'computedField',
        'attributes', jsonb_build_object(
          'label',          'Overall fire risk (PAS 79)',
          'formula',        'pas79',
          'computedInputs', jsonb_build_object(
            'likelihood',  e_likelihood::text,
            'consequence', e_consequence::text
          ),
          'attachPhotos',   false,
          'visibilityRules', jsonb_build_object('rules', jsonb_build_array(), 'logic', 'and')
        )
      ),

      -- ── Action Plan repeatingSection (Q2 — 4 columns: description / owner / due / priority) ──
      e_action_plan::text, jsonb_build_object(
        'type', 'repeatingSection',
        'attributes', jsonb_build_object(
          'title',        'Action plan',
          'description',  'One row per recommended action. Add as many as needed.',
          'minInstances', 0,
          'maxInstances', 50,
          'visibilityRules', jsonb_build_object('rules', jsonb_build_array(), 'logic', 'and')
        ),
        'children', jsonb_build_array(
          e_action_desc::text, e_action_owner::text, e_action_due::text, e_action_priority::text
        )
      ),

      e_action_desc::text, jsonb_build_object(
        'type', 'textareaField',
        'attributes', jsonb_build_object(
          'label', 'Action description', 'required', true,
          'placeholder', 'What needs doing?', 'attachPhotos', false,
          'visibilityRules', jsonb_build_object('rules', jsonb_build_array(), 'logic', 'and')
        ),
        'parentId', e_action_plan::text
      ),
      e_action_owner::text, jsonb_build_object(
        'type', 'textField',
        'attributes', jsonb_build_object(
          'label', 'Responsible person', 'required', true,
          'placeholder', 'Who owns this?', 'helpText', '', 'prefillSource', '',
          'attachPhotos', false,
          'visibilityRules', jsonb_build_object('rules', jsonb_build_array(), 'logic', 'and')
        ),
        'parentId', e_action_plan::text
      ),
      e_action_due::text, jsonb_build_object(
        'type', 'dateField',
        'attributes', jsonb_build_object(
          'label', 'Target completion date', 'required', true,
          'attachPhotos', false,
          'visibilityRules', jsonb_build_object('rules', jsonb_build_array(), 'logic', 'and')
        ),
        'parentId', e_action_plan::text
      ),
      e_action_priority::text, jsonb_build_object(
        'type', 'selectField',
        'attributes', jsonb_build_object(
          'label',        'Priority',
          'required',     true,
          'options',      jsonb_build_array(
            jsonb_build_object('label', 'High',   'value', 'High'),
            jsonb_build_object('label', 'Medium', 'value', 'Medium'),
            jsonb_build_object('label', 'Low',    'value', 'Low')
          ),
          'allowMultiple', false,
          'attachPhotos',  false,
          'visibilityRules', jsonb_build_object('rules', jsonb_build_array(), 'logic', 'and')
        ),
        'parentId', e_action_plan::text
      )

      -- ... remaining ~20 entities (premises details, fire safety mgmt, means of escape,
      -- fire protection, signature, conditional sub-sections per Q3) ...

    ),
    'root', jsonb_build_array(
      e_site_geolocation::text, e_responsible_p::text, e_policy_in_place::text,
      e_section_02a::text, e_likelihood::text, e_consequence::text, e_pas79::text,
      e_action_plan::text, e_signature::text
      -- ... full root array ...
    )
  );

  -- IDEMPOTENT INSERT (Pitfall P2 — re-runnable). Diverges from migrations 011/012
  -- by using is_published=TRUE so customer surfaces can see the master, and a fixed UUID.
  INSERT INTO form_templates (id, name, template_type, owner_id, owner_type, is_published)
  VALUES (v_template_id, 'Fire Risk Assessment (Type 3) — Single Premises',
          'fra', v_admin_id, 'admin', TRUE)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO template_versions (id, template_id, version_number, schema_json,
                                  created_by, published_at)
  VALUES (v_version_id, v_template_id, 1, v_schema, v_admin_id, NOW())
  ON CONFLICT (id) DO NOTHING;

  RAISE NOTICE 'Phase 18: FRA Type 3 seed installed — template_id %, version_id %',
               v_template_id, v_version_id;
END;
$$ LANGUAGE plpgsql;
```

### Example 2 — Port n8n webhook fire into `submitAssessmentAction` (Q5 SC#5 satisfaction)

Inline this snippet in `app/admin/assessments/actions.ts` inside `submitAssessmentAction`, after the `update` write (line ~295) and BEFORE the `after()` registration (line ~302). It mirrors the existing pattern from `submitAssessment` (lines 194-212):

```ts
// Phase 18 SC#5 — fire the assessment-submission n8n webhook for Module 1 downstream.
// Pattern mirrored from the older submitAssessment (actions.ts:194-212).
// Distinct from the AI report draft pipeline in the after() callback below.
const webhookUrl = process.env.N8N_ASSESSMENT_WEBHOOK_URL
if (webhookUrl) {
  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ submissionId }),
      signal: AbortSignal.timeout(3000),
    })
  } catch (err) {
    console.error("Phase 18 SC#5 n8n webhook trigger failed", { submissionId, err })
    await adminClient.from("workflow_errors").insert({
      workflow_name: "assessment-submission-webhook",
      error_message: String(err),
      payload: { submissionId },
    })
  }
}
```

### Example 3 — Cleanup task: verify zero references before deletion

```bash
# Pre-deletion verification — must return 0 hits other than the file being deleted.
grep -rn "HARDCODED_FRA_TEMPLATE\|@/lib/forms/fra-template" \
  --include="*.ts" --include="*.tsx" --include="*.md" \
  . | grep -v "lib/forms/fra-template.ts" | grep -v ".planning/"
# Expected output: empty (excluding planning docs)
```

If the grep returns hits in `app/` or `components/`, those consumers must be migrated to read the seeded `form_templates` row by ID first.

---

## Library / Tooling Notes

### coltorapps `@coltorapps/builder`
- Entity types Phase 18 uses: `textField`, `textareaField`, `numberField`, `selectField`, `dateField`, `signatureField`, `multiPhotoField`, `geolocationField`, `computedField`, `sectionGroup`, `repeatingSection`. ALL 11 already registered in `lib/form-builder/index.ts:19-35`.
- Attribute names match `createAttribute({ name: "..." })` exactly. Don't invent: `attachPhotos`, `visibilityRules`, `computedInputs`, `formula`, `minInstances`, `maxInstances`, `allowMultiple`, `options`, `min`, `max`, `unit`, `helpText`, `placeholder`, `maxLength`, `label`, `required`, `title`, `description`, `prefillSource`, `maxPhotos`, `maxRating`, `defaultChecked`, `dateBounds`.
- `visibilityRules` default value is `{ rules: [], logic: "and" }` — include this on EVERY entity in the seed even when no rule is configured (migration 012 lines 145-148 are the precedent). Migration 011 does NOT include `visibilityRules` because it predates Phase 15 — but Phase 18 ships post-Phase-15, so include them everywhere for clarity.

### PAS 79
- BSI PAS 79-1:2020 is the UK standard for Fire Risk Assessment methodology.
- The 5×5 matrix (likelihood × consequence) and the categorical labels (Trivial / Tolerable / Moderate / Substantial / Intolerable) are PAS 79 conventions.
- Exact band boundaries are NOT publicly free; the implementation in `lib/form-builder/risk/pas79.ts` reflects practitioner convention and is flagged as `[ASSUMED]` (A1 from Phase 14 RESEARCH). Matt should confirm in UAT — if the cutoffs need to move, edit `pas79.ts` only (no schema change).
- The Regulatory Reform (Fire Safety) Order 2005 mandates a "suitable and sufficient" FRA but does NOT prescribe the matrix shape; PAS 79 is the de-facto methodology.

### Supabase migrations
- Next migration number is **016** (Q8 verified).
- Migration runs via `supabase db push` — the agent does NOT run this; the user applies it (Phase 14 closeout pattern, `14-08-SUMMARY.md:35`).
- `ON CONFLICT (id) DO NOTHING` is the idempotency idiom; the existing migrations 010-015 don't need it (smoke tests, not prod) but Phase 18 does.
- DO NOT use TRIGGERs (project convention — zero existing triggers, confirmed by Phase 16 + 17 research).

### Vercel AI SDK
- `generateObject` + Zod schema is the structured-output pattern used by `runReportDraftGeneration`. Phase 18 inherits this without modification.
- Model: `openai/gpt-4o-mini` via OpenRouter (`baseURL: "https://openrouter.ai/api/v1"`, `apiKey: OPENROUTER_API_KEY`).
- The `after()` Next.js API (`import { after } from "next/server"`) registers the AI call as a post-response background task — the user's redirect isn't blocked.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | PAS 79 band boundaries in `lib/form-builder/risk/pas79.ts` are correct (Trivial 1–2 / Tolerable 3–4 / Moderate 5–9 / Substantial 10–16 / Intolerable 17–25). | Q1 | LOW — single-file edit to shift cutoffs; no schema change. Already flagged as A1 in Phase 14 RESEARCH. |
| A2 | Action Plan 4-column structure (description / owner / date / priority) matches UK FRA practice. | Q2 | LOW — adding/removing columns is a child-entity edit on the `repeatingSection`; existing instances would carry orphan keys ignored by `expandRepeatingSections` (T-14-03-06). |
| A3 | The 3 conditional sub-section mappings in Q3 reflect what Matt expects ("Yes/No → show/hide"). | Q3 | LOW — visibility rules are pure data in `schema_json`. Matt can request more / fewer / different rules in UAT; no migration churn beyond a re-INSERT. |
| A4 | `is_published=true` on a customer-visible master template requires `published_at=NOW()` on the v1 row. | P2 | HIGH if wrong — customer surfaces would not see the master. VERIFIED against `migrations/001_initial_schema.sql:263-275` RLS. |
| A5 | The existing n8n webhook fire in `submitAssessment` (lines 194-212) is the SC#5 "Module 1 bridge" — and porting it into `submitAssessmentAction` is what SC#5 actually needs. | Q5 | MEDIUM — if Matt intended a DIFFERENT n8n webhook (separate URL / payload shape), the port misses the mark. Mitigation: confirm with Matt (or Finley) in UAT that `N8N_ASSESSMENT_WEBHOOK_URL` is the right endpoint. |
| A6 | Photo evidence required ≥ 1 on escape-routes + fire-protection sections matches Matt's intent. | Q7 | LOW — flipping `required: true → false` is a one-attribute migration edit. |

---

## BLOCKING Issues for the Planner

**None.** Every open question has a defensible recommendation grounded in repo code, existing migrations, or standard FRA practice. The `[ASSUMED]` items (A1–A3, A5–A6) are all UAT-confirmable with Matt, NOT planning blockers — none requires user input before plans can be written.

The only "soft" call to flag for the planner: **Q5's recommendation to port the n8n webhook fire into `submitAssessmentAction`** assumes ROADMAP SC#5 wants the existing `N8N_ASSESSMENT_WEBHOOK_URL` and not a new endpoint. If Matt confirms a different downstream in UAT, the task is the same shape — only the URL / payload changes.

---

## Sources

### Primary (HIGH confidence)
- `lib/forms/fra-template.ts` — the structural baseline (5 sections, 17 fields)
- `lib/form-builder/index.ts` + every `lib/form-builder/entities/*.ts` — the entity registry and validation contracts
- `lib/form-builder/attributes/visibility-rules.ts` — Phase 15 rule shape and validation
- `lib/form-builder/risk/pas79.ts` — authoritative PAS 79 5×5 mapping (already in repo)
- `supabase/migrations/011_specialty_smoke_test_template.sql` — canonical seed pattern with specialty entities + computedField + repeatingSection
- `supabase/migrations/012_phase15_conditional_smoke_test.sql` — canonical seed pattern with `visibilityRules`
- `supabase/migrations/001_initial_schema.sql` lines 46-66, 263-275 — form_templates / template_versions schema + RLS
- `supabase/migrations/003_form_template_customer_ownership.sql` — polymorphic owner contract
- `app/admin/assessments/actions.ts:166-309, 334-471` — `submitAssessment` (n8n fire) + `submitAssessmentAction` (validate + AI) + `runReportDraftGeneration` + `expandRepeatingSections`
- `app/client/assignments/actions.ts:158-220` — customer submit path (no AI trigger)
- `components/form-interpreter/text-field-renderer.tsx`, `textarea-field-renderer.tsx`, `mic-button.tsx` — STT wiring is automatic on text entities only
- `components/form-interpreter/computed-field-renderer.tsx` — PAS 79 badge renderer
- `.planning/phases/14-custom-field-types/14-08-SUMMARY.md` — Phase 14 closeout pattern (DB push as human-action checkpoint)
- `.planning/phases/16-multi-tenancy-fork-on-fill/16-CONTEXT.md` D-08 — fork-on-fill no-cascade contract
- `.planning/phases/17-assignment-scheduling-notifications/17-RESEARCH.md` — same-shape RESEARCH template + n8n integration precedent

### Secondary (MEDIUM confidence)
- `.planning/phases/07-ai-report-pipeline/CONTEXT.md` — Phase 7 "No n8n" constraint (proves the Q5 conflict is real, not invented)
- `AGENTS.md` "Form template ownership" — polymorphic owner_id contract

### Tertiary (LOW confidence — domain knowledge)
- PAS 79-1:2020 band boundaries (Q1 / A1) — practitioner convention, not BSI-published in free tier
- FRA Action Plan column structure (Q2 / A2) — UK industry convention, varies by assessor
- Photo evidence required-ness per section (Q7 / A6) — convention, Matt to confirm

---

## Metadata

**Confidence breakdown:**
- Seed mechanism (migration): HIGH — verified against 011/012 precedent
- Entity-type usage: HIGH — every entity already registered and rendered
- PAS 79 implementation: HIGH for "what to wire", MEDIUM for "are the band cutoffs correct" (A1)
- Conditional logic granularity: MEDIUM — three mappings proposed; Matt may want different
- n8n vs. AI SDK reconciliation (Q5): HIGH for "both exist", MEDIUM for "what SC#5 means by Module 1 bridge" (A5)
- STT scope (Q6): HIGH — automatic on text entities, never on others
- Photo requirements (Q7): MEDIUM — convention-based, Matt to confirm
- Migration number (016): HIGH — directory listing verified

**Research date:** 2026-05-27
**Valid until:** 2026-06-26 (30 days)
