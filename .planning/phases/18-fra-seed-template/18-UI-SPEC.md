---
phase: 18
slug: fra-seed-template
status: draft
shadcn_initialized: true
preset: base-mira / mist
created: 2026-05-27
---

# Phase 18 — UI Design Contract: FRA Seed Template

> Scope-of-this-document: Phase 18 is **content + integration**, not new UI primitives. This contract is primarily a *specification-of-what-not-to-change* — it locks the FRA template to the existing Phase 14 specialty renderers and Phase 15 conditional behaviour, and only specifies UI deltas where the FRA content forces one.

---

## Design System

Inherited unchanged from Phases 13 / 14 / 15 / 16. No new tokens, no new components, no preset change.

| Property | Value | Source |
|---|---|---|
| Tool | shadcn (base-mira, mist) | `components.json` |
| Fonts | Inter (sans), Newsreader (serif), JetBrains Mono | `app/layout.tsx` |
| Surface for fill | `data-surface="client"` (cream) on `/client/assignments/[id]/fill`; `data-surface="admin"` (dark) on `/admin/assessments/[id]` | Phase 16 UI-SPEC |
| Interpreter renderer | `<InterpreterRenderer>` — same component, same layout | `components/form-interpreter/interpreter-renderer.tsx` |

The FRA template renders through the existing InterpreterRenderer like every other template. **No new renderer is introduced in Phase 18.**

---

## What the existing renderers already handle (DO NOT re-implement)

This is the load-bearing section. Phase 18's planner must NOT re-specify any of the following — the Phase 14 / 15 renderers already ship the visual and interaction contracts the FRA needs.

### Action Plan repeating section → `RepeatingSectionRenderer` (Phase 14)
- Section heading: Newsreader 18px + horizontal divider + teal mono instance-count badge — already implemented (`repeating-section-renderer.tsx` lines 367-382).
- Per-instance card: cream `bg-white border-[#e5e1d8] rounded-sm`, header row with `#N` mono index + collapse / remove buttons (28px touch targets) — already implemented (lines 397-438).
- Add-row button: full-width dashed-border button with `Plus` icon, label = `Add {section title}` — already implemented (lines 491-503).
- `maxInstances` cap message + `minInstances` violation message — already implemented (lines 505-518).
- Child input rendering for `textField` / `numberField` / `dateField` / `selectField` / `textareaField` / `checkboxField` — already implemented (lines 121-259).
- **Phase 18 must accept the constraint** (Phase 14 §RepeatingSectionRenderer JSDoc lines 36-43): specialty fields (signature, multiPhoto, rating, geolocation, computed, nested repeatingSection) are NOT supported inside instances. The Action Plan must use only the supported child types listed above.

### PAS 79 risk matrix → `ComputedFieldRenderer` + `lib/form-builder/risk/pas79.ts` (Phase 14)
- Read-only badge rendering with three colour bands — already implemented:
  - GREEN (score 1–4): `bg-green-100 text-green-900 border border-green-300` — labels Trivial / Tolerable.
  - AMBER (score 5–12): `bg-amber-100 text-amber-900 border border-amber-300` — labels Moderate / Substantial.
  - RED (score 13–25): `bg-red-100 text-red-900 border border-red-300` — labels Substantial / Intolerable.
- Pending pill (one input empty) + configuration-error pill — already implemented.
- `role="status" aria-live="polite"` for screen reader announcements — already implemented.
- Badge text format: `{level} — Score: {score}` — already locked (`computed-field-renderer.tsx` line 141).
- No animation on band transition — colour change is the signal (Phase 14 UI-SPEC §Reactivity, line 30 of renderer).

### Signature field → `SignatureFieldRenderer` (Phase 14)
- Canvas + Redraw / Remove controls + post-upload pill — already implemented.
- Upload via `uploadMediaAction(..., "signature")` — already wired.

### Photo evidence → `MultiPhotoFieldRenderer` (Phase 14)
- 2-col mobile / 3-col desktop grid, in-flight cells with spinner overlay, error cells with `AlertCircle` — already implemented.
- HEIC→JPEG + EXIF + compression via `useMediaProcessor` — already wired.
- `{count} / {maxPhotos}` counter pill — already implemented.

### Geolocation → `GeolocationFieldRenderer` (Phase 14)
- Auto-capture on mount, Leaflet map preview (200px height), click-to-pin, desktop accuracy badge — already implemented.

### Conditional reveal → Phase 15 visibility engine (already wired into InterpreterRenderer)
- Hidden fields are **unmounted from the DOM** (not opacity-faded). Form reflows naturally via `flex flex-col gap-4`.
- **No transition animation on show/hide** — locked by Phase 15 UI-SPEC line 192: "abrupt removal to avoid confusing motion on a professional assessment form."
- `sectionGroup` containers (e.g., the fire-alarm sub-section) recursively unmount when their visibility rule hides them — Phase 15 UI-SPEC line 195-197.
- Required-if asterisks appear/disappear on rule fire — already implemented in all renderers via the `dynamicRequired` prop threaded through `InterpreterRenderer.tsx` lines 152-180.

### Section + signature placement
The signature is positioned by being the **last field in the last section** of the template — there is no special "footer signature" affordance. Use Section 06 (Sign-Off) with one `signatureField` and one optional `textareaField` for declarations. Newsreader 18px section heading from `SectionGroupRenderer` is the visual treatment.

---

## Phase 18 UI Deltas (the only places Phase 18 changes anything)

### Delta 1 — Section-level photo evidence affordance

**Constraint:** `sectionGroup` does NOT carry an `attachPhotos` attribute (verified — `grep attachPhotos components/form-interpreter/section-group-renderer.tsx` returns no matches). The Phase 14 `attachPhotos` affordance is **per non-section field** only.

**Resolution for Phase 18 content:** the FRA template models per-section photo evidence as a dedicated `multiPhotoField` placed as the **last field of each evidence-requiring section** (matching the existing `lib/forms/fra-template.ts` shape — `escape_route_photos`, `fire_protection_photos`). Label: `Photographic evidence — {section topic}`. `maxPhotos: 10`. `required: false` (per default; Matt can flip per-section in the builder later).

This is purely a **content decision**, not a new renderer. No visual delta.

### Delta 2 — PAS 79 input field labelling

The two numeric inputs that feed the computed field must be **named explicitly** so practitioners recognise PAS 79 vocabulary. These are `numberField` entities (existing Phase 14 renderer — no change), but the labels and help text are content-locked here:

| Field | Label | Help text | Validation |
|---|---|---|---|
| `risk_likelihood` | `Likelihood (1–5)` | `1 = Very Low, 2 = Low, 3 = Medium, 4 = High, 5 = Very High` | min: 1, max: 5, integer |
| `risk_consequence` | `Consequence (1–5)` | `1 = Insignificant, 2 = Minor, 3 = Moderate, 4 = Major, 5 = Catastrophic` | min: 1, max: 5, integer |

The `computedField` entity's `computedInputs.likelihood` / `computedInputs.consequence` must point at these entity IDs.

### Delta 3 — Risk matrix field label

The `computedField` entity's `attributes.label` is content-locked: `Risk score (PAS 79)`. This is the label rendered above the colour badge by `ComputedFieldRenderer` (line 129 of renderer).

---

## Copywriting Contract (FRA-specific, locked)

All labels not listed here are inherited from the existing `lib/forms/fra-template.ts` baseline — see that file as the structural reference. Phase 18-specific copy:

| Element | Copy | Source |
|---|---|---|
| Template title | `Fire Risk Assessment (Type 3) — Single Premises` | Existing baseline `lib/forms/fra-template.ts:8` |
| Template description | `Complete each section in order. Photographic evidence is required wherever a finding is recorded against a control measure.` | Existing baseline |
| Section 06 title (new) | `06 — Sign-Off` | New for Phase 18; matches existing `01 — ` … `05 — ` numbering |
| Section 06 description | `Confirm completion. Your signature certifies the findings and actions recorded above.` | New |
| Signature field label | `Responsible Person signature` | Matt's blank FRA convention |
| Signature help text | `Sign to certify this assessment is complete and accurate.` | New |
| Geolocation field label | `Site location` | Industry FRA norm |
| Geolocation help text | `Captured automatically when you start the assessment. Tap the map to correct the pin if needed.` | Matches Phase 14 click-to-pin instruction |
| Geolocation placement | First field of Section 01 — Premises Details | Per CONTEXT §Specialty Fields |
| Action Plan section title | `Action Plan` | PAS 79 / FRA convention |
| Action Plan section description | `One row per remedial action. Add as many as required.` | New |
| Action Plan add-row button label | Rendered as `Add Action Plan` by `RepeatingSectionRenderer` (line 502 — `Add {section title}`) — no override needed | Existing |
| Action Plan child: action description | `Action description` (`textareaField`, required) | PAS 79 convention |
| Action Plan child: responsible person | `Responsible person` (`textField`, required) | PAS 79 convention |
| Action Plan child: target completion date | `Target completion date` (`dateField`, required) | PAS 79 convention |
| Action Plan child: priority | `Priority` (`selectField`, options: `High` / `Medium` / `Low`, required) | PAS 79 convention — Q2 of CONTEXT resolved |
| Action Plan `minInstances` | `0` (no min) | Action plans may be empty if no remediation needed |
| Action Plan `maxInstances` | `50` | Practical cap; user will hit the empty-state message at zero, the limit-reached at 50 |
| Risk score label | `Risk score (PAS 79)` | Delta 3 |
| Risk score help text | `Auto-calculated from Likelihood × Consequence above.` | New |
| Likelihood label / help | See Delta 2 | New |
| Consequence label / help | See Delta 2 | New |
| Empty-state for unattached Action Plan (zero rows) | None — the dashed "Add Action Plan" button is the affordance. No "no actions yet" copy needed. | Existing renderer behaviour |
| Submit-blocked toast | `Please fill in all required fields before submitting.` | Existing — `interpreter-renderer.tsx:204` (do NOT override) |

### Destructive actions

| Action | Confirmation? | Reason |
|---|---|---|
| Remove Action Plan row | None | Phase 14 UI-SPEC §Destructive Actions locked this — "no confirmation dialog" for repeating-section remove. Phase 18 inherits. |
| Clear signature | None | Phase 14 SignatureField in-component Redraw control. Inherits. |
| Remove photo | None | Phase 14 MultiPhotoField hover-X. Inherits. |
| Resubmit a completed FRA | n/a in Phase 18 | Out of scope. |

---

## Conditional Logic Coverage (content-only — no UI change)

The hardcoded baseline has implicit sub-sections; Phase 18 wires Phase 15 visibility rules to them. The visual behaviour (abrupt unmount, no animation) is locked by Phase 15. Phase 18 only specifies *which* fields drive *which* reveals; this is content for the planner, not a UI delta.

Recommended mappings (planner may refine):
- `policy_in_place === "no"` OR `=== "out_of_date"` → reveal `policy_action_required` (textarea, required-if).
- `escape_routes_clear === "no"` OR `=== "partial"` → reveal `escape_obstruction_details` (textarea, required-if) + `escape_route_photos` becomes required.
- `detection_type === "none"` → reveal `detection_upgrade_recommendation` (textarea, required-if).
- `overall_risk_rating === "substantial"` OR `=== "high"` → require at least one Action Plan row (enforced via `minInstances: 1` set conditionally — *if* Phase 15 supports conditional `minInstances` at fill time; if not, planner falls back to a static `minInstances: 0` and the AI report flags the gap downstream).

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|---|---|---|
| shadcn official | none new | n/a — Phase 18 introduces no new shadcn components |
| Third-party | none | n/a |

---

## BLOCKING issues for the planner

**None.** Phase 14's specialty renderers already cover every visual primitive the FRA needs. Phase 15's conditional engine already covers the reveal behaviour. Phase 16's surface tokens already cover the fill route.

Phase 18 is content + entity wiring + a single new sub-section (Sign-Off). The planner should NOT spawn UI tasks; all work is template-builder construction + a seed migration + an integration test against the existing fill flow.

The only *open content question* (Matt-blocking, NOT planner-blocking):
- Per CONTEXT Q1, PAS 79 band boundaries are practitioner convention (see `lib/form-builder/risk/pas79.ts` TODO). If Matt's review materially shifts the boundaries, that's a one-line edit to `pas79.ts` — not a UI-SPEC change. Phase 18 ships with the current bands as-is.

---

## Pre-Population Sources

| Source | Decisions Used |
|---|---|
| `18-CONTEXT.md` | All locked decisions (specialty entities, conditional logic scope, RP signature placement) |
| `lib/forms/fra-template.ts` | Structural baseline (5 sections, 17 fields, photo evidence pattern) |
| `.planning/phases/14-custom-field-types/14-UI-SPEC.md` | Renderer visual contracts (PAS 79 colour bands, repeating section card, signature canvas, multi-photo grid, geolocation panel) |
| `.planning/phases/15-conditional-logic-engine/15-UI-SPEC.md` | Hidden-field unmount behaviour, no-animation lock, required-if asterisk |
| `.planning/phases/16-multi-tenancy-fork-on-fill/16-UI-SPEC.md` | Client surface tokens, cream surface inheritance |
| `components/form-interpreter/*.tsx` | Verified all referenced renderer behaviour matches the spec above |
| `lib/form-builder/risk/pas79.ts` | Risk band thresholds + Tailwind colour classes |
| User input this session | 0 — all answered by upstream artifacts |

## Revision Log

| Date | Change | Reason |
|---|---|---|
| 2026-05-27 | Initial draft | gsd-ui-researcher run for Phase 18 |
