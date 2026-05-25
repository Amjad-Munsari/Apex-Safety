# Phase 15: Conditional Logic Engine - Context

**Gathered:** 2026-05-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Add a conditional-logic layer to the form-builder so admins can declare per-field rules that fire at fill time. Each rule references a source field, evaluates an operator against a literal value, and applies an action — `show`, `hide`, or `require` — to the host field. Multiple rules per field combine with AND or OR. Rules are stored as a new `visibilityRules: { rules, logic }` attribute on every entity in the coltorapps schema and travel through the existing version-pinning pipeline unchanged. Save-time DAG validation rejects circular rule chains before they can ship.

**In scope:**
- New `visibilityRules` attribute factory + attach it to all 13 registered entity types (7 basic + 6 specialty)
- `evaluateVisibility(schema, answers, entityId)` pure utility — returns `{ visible, required }` for any entity given the current interpreter store snapshot
- Save-time cycle detection (`validateRuleGraph`) that traverses both direct field refs AND `computedField` input edges, rejecting cycles before publish with admin-readable error
- Builder UI: collapsible "Conditional logic" section at the bottom of the PropertiesPanel, inline rule rows per the build-prompt sketch
- Interpreter integration: subscribe each entity's renderer to the dependency-mapped subset of value changes; recompute `visible` / `required` on dependency change; skip rendering when `visible === false`
- Server-side submission scrub: strip hidden-subtree values from `answers_json` at submit time (build prompt §3c contract)
- "Some" treated as Yes for show/hide; "N/A" hides dependent sub-questions — built into the operator semantics, not into the engine

**Out of scope (deferred to other phases):**
- Multi-tenancy / fork-on-fill / template assignment — Phase 16
- Recurring assignments / scheduled reminders — Phase 17
- FRA seed template that exercises every conditional pattern — Phase 18
- Cross-instance references inside `repeatingSection` (e.g., "Door 2's photo if Door 1's condition was Poor") — explicitly excluded per D-03
- Custom expression DSL or computed predicates beyond the fixed operator list — future phase

</domain>

<decisions>
## Implementation Decisions

### Hidden-field cascade (D-01)
- **D-01:** **Preserve on hide, drop on submit.** When a rule hides a field (or a hidden parent container cascades onto its children), the values stay in the interpreter store — flipping the rule back restores the entered values. On submit, the server walks the schema with the final visibility state and strips every entity that resolves to `visible === false` from `answers_json`, recursively (whole `sectionGroup` / `repeatingSection` subtrees collapse). UX wins for accidental toggles; submission stays clean per build prompt §3c contract.

### Computed fields as rule sources (D-02)
- **D-02:** **`computedField` is a first-class rule source — including for `require`.** The source-field dropdown in the rule editor lists computedFields alongside user-input fields. The dependency map records two edge types — direct (`source → consumer`) and computed (`input → computedField → consumer`) — and `validateRuleGraph` traverses both when checking for cycles. Required to make the canonical PAS 79 risk-matrix flow work without two-level rule duplication ("show Mitigation when Risk = Intolerable").

### Cross-scope rule references (D-03)
- **D-03:** **Same-scope and ancestor-scope only.** A field's rule may reference: (a) sibling fields in its own scope (root ↔ root, same `repeatingSection` instance ↔ same instance), and (b) any field in an *ancestor* scope (a field inside a `repeatingSection` instance can reference any root field; root fields can reference any other root field). Cross-instance references ("hide Door 2's gap if Door 1's condition is Poor") are **rejected at save time** because they require an instance-picker UI that isn't worth its complexity for the FRA use case. Root fields cannot reference fields inside a `repeatingSection` (N instances → ambiguous source).

### Builder UI placement (D-04)
- **D-04:** **Collapsible "Conditional logic (N)" section at the bottom of PropertiesPanel, inline rule rows.** Below the existing attribute editors. Collapsed by default; the badge `(N)` shows rule count when N > 0. Opens to an `[AND | OR]` segmented toggle at the top, then inline rows: `When [field ▼] [operator ▼] [value] → [action ▼]  [🗑]`. Matches the build-prompt sketch. Keeps the panel scannable for the majority of fields that have zero rules; doesn't double the click cost like a tabbed layout would for the FRA use case (where most fields eventually get a rule).

### Locked by build prompt (not gray — captured for downstream agents)
- **D-05:** Data model is exactly `visibilityRules: { rules: VisibilityRule[], logic: 'and' | 'or' }`, attached as a new attribute to every entity. `VisibilityRule = { sourceEntityId, operator, value, action }`. New attribute factory at `lib/form-builder/attributes/visibility-rules.ts`.
- **D-06:** Operator set is fixed: `equals | notEquals | contains | greaterThan | lessThan | isEmpty | isNotEmpty`. The available operators in the rule editor's UI are filtered by source-field type (text → equals/notEquals/contains/isEmpty/isNotEmpty; number → equals/notEquals/greaterThan/lessThan/isEmpty/isNotEmpty; select → equals/notEquals/isEmpty/isNotEmpty; checkbox → equals; date → equals/greaterThan/lessThan/isEmpty/isNotEmpty; computedField → equals/notEquals/greaterThan/lessThan based on the formula's output type).
- **D-07:** Action set is fixed: `show | hide | require`. When both `show` and `hide` rules fire for the same field, **hide wins**. When a field is hidden AND has a fired `require` rule, **hidden trumps required-if** (per build prompt §3c).
- **D-08:** Cycle detection runs at save/publish time, not render time. Reject with an admin-readable error listing the entities in the cycle and the rule edges that form it.
- **D-09:** Performance contract: maintain a `sourceEntityId → Set<dependentEntityId>` map; on any value change, only re-evaluate the affected dependents (not the whole schema).
- **D-10:** "Some" treated as Yes for show/hide via operator semantics (the rule writes `equals "Some"` or `equals "Yes"` separately; nothing special at the engine level). "N/A" is a distinct select value — rules wanting to hide on N/A use `equals "N/A"` with `action = hide`. The engine does NOT special-case option labels.

### Claude's Discretion
- Whether to expose the dependency map as a memoised store selector (per-entity) or a single reducer that emits visibility deltas — implementation detail, planner-research item. Both paths satisfy D-09's performance contract.
- Exact wire format for the save-time cycle-error payload (UI just needs entity labels + rule indices to highlight). Planner can choose.
- Whether `evaluateVisibility` is a single pure function or a small bundle (`evaluateRule` + `combineRules` + `cascadeVisibility`). No external contract impact.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Build spec (read first)
- `.planning/research/form-builder-build-prompt.md` §"Phase 3 — Conditional Logic Engine" — full data model, builder UI sketch, runtime evaluation rules, FRA-extracted conditional patterns, risk matrix table. The spec of record for this phase.

### Requirements & Roadmap
- `.planning/ROADMAP.md` §"Phase 15: Conditional Logic Engine" — goal + 5 success criteria
- `.planning/REQUIREMENTS.md` §COND-01..04 — formal requirements (v2 cluster, re-quote pending)
- `.planning/REQUIREMENTS.md` §BUILDER-02 — "conditional visibility" is part of the properties-panel scope

### Prior phase context (carry-forward)
- `.planning/phases/13-form-builder-foundation/13-CONTEXT.md` — coltorapps integration decisions (D-01 builder engine, D-07 schema contract, D-08 `{entities, root}` shape). The new `visibilityRules` attribute slots into this schema additively.
- `.planning/phases/13-form-builder-foundation/13-RESEARCH.md` — coltorapps API surface (createAttribute, validate() coercion, store subscription model). Mandatory before writing the new attribute or the dependency-map subscriber.
- `.planning/phases/13-form-builder-foundation/13-PATTERNS.md` — file/pattern map (attribute factory location, entity registration in `lib/form-builder/index.ts`, interpreter renderer pattern).
- `.planning/phases/14-custom-field-types/14-CONTEXT.md` — `computedField` reactivity (D-07/D-08/D-10) and `repeatingSection` scope/instance model (D-01..D-04). Both are load-bearing for D-02 and D-03 above.
- `.planning/phases/14-custom-field-types/14-02-SUMMARY.md` — `repeatingSection` validate() contract (value shape `{ instances: [...] }`) and `formBuilder` entity registration (current 13 entities).
- `.planning/phases/14-custom-field-types/14-06-SUMMARY.md` — interpreter `components` useMemo map + `propsRef` pattern (where the per-renderer visibility subscription will live).

### Code paths (planner reads these)
- `lib/form-builder/index.ts` — registers all 13 entities; each entity file needs `visibilityRulesAttribute` added (or the attribute is auto-included via builder defaults — confirm in coltorapps docs).
- `lib/form-builder/entities/*.ts` — 13 files; every one gains the new attribute. Pattern lives in `text-field.ts` + `signature-field.ts`.
- `lib/form-builder/attributes/*.ts` — pattern for the new `visibility-rules.ts` factory (see `attach-photos.ts` for the shape of a non-trivial boolean attribute and `computed-inputs.ts` for the shape of an attribute with a nested-object validate()).
- `lib/form-builder/progress.ts` — `computeFormProgress` must learn that hidden fields don't count toward required totals; extend it once the runtime evaluator exists.
- `components/form-builder/properties-panel.tsx` — host site for the new collapsible "Conditional logic" section (sits below the per-type editors).
- `components/form-interpreter/interpreter-renderer.tsx` — host site for the visibility subscriber. Each renderer in the `components` useMemo map wraps its body in a `visible ? <Renderer /> : null` and reads `required` from the resolved state instead of the static attribute.
- `app/admin/assessments/actions.ts` — `submitAssessmentAction` is where the server-side hidden-subtree scrub lands (after `validateEntitiesValues`, before the DB write).

### Migrations & data contract
- No migration required for Phase 15 — `visibilityRules` is a JSON attribute living inside `template_versions.schema_json`. The version-pinning contract (Phase 13 D-08) handles it automatically.
- `supabase/migrations/010_form_builder_foundation_reseed.sql` + `011_specialty_smoke_test_template.sql` — reference migrations; if Phase 15 wants a smoke-test template that exercises rules, follow this CTE pattern.

### Architecture
- `AGENTS.md` — form-template ownership (Option 3, Matt-edits + customer-forks). Confirms the rule editor must be reusable across admin + client surfaces.
- `.planning/PROJECT.md` "Form architecture — unified template" — schema versioning constraint. Rules are part of the pinned schema; existing submissions evaluate against their version's rules, not the latest.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`createAttribute` factory pattern** (`lib/form-builder/attributes/*.ts`): `visibilityRulesAttribute` follows the established shape — `name`, `validate(value)` that coerces undefined → `{ rules: [], logic: 'and' }` and throws on malformed shapes. `computed-inputs.ts` is the closest existing analog (nested-object attribute with default-shape coercion).
- **Properties-panel collapsible section pattern** (`components/form-builder/properties-panel.tsx`): the panel already uses disclosure-style per-type editors (e.g., the PAS 79 inputs block for `computedField`). The new "Conditional logic" section reuses that pattern.
- **Interpreter renderer wrapper pattern** (`components/form-interpreter/interpreter-renderer.tsx` post-14-06): the `components` useMemo map already wraps each entity's renderer with prop-threading (`clientId`, `submissionId`, `interpreterStore`, `schema`). The visibility subscriber slots into the same wrapper.
- **Server-side answer post-processing** (`app/admin/assessments/actions.ts`): `submitAssessmentAction` already runs `validateEntitiesValues` against the pinned schema before the DB write. The hidden-subtree scrub is a new pure function called between validation and the `.update()`.
- **`computeFormProgress`** (`lib/form-builder/progress.ts`): already iterates the schema counting required fields. Once visibility evaluation is available, hidden fields are excluded from the denominator.

### Established Patterns
- **All attributes are factories that return `validate()` with default-coercion** — `visibilityRulesAttribute` MUST coerce undefined / null / wrong-shape → `{ rules: [], logic: 'and' }` (Phase 13 RESEARCH "Pitfall 4"). Throw on `rules` not being an array, or `logic` not being "and"/"or".
- **`coltorapps` subscription model uses selective subscriptions** (Phase 13 RESEARCH). The dependency map → per-entity subscription pattern aligns with how `computedField` already subscribes only to its inputs (Phase 14 D-10).
- **Save-time validation runs in the server action `saveTemplateVersion` / publish path** (Phase 13). `validateRuleGraph` plugs in there — same place where the existing coltorapps `validateSchema` already runs.
- **Tests live in `tests/form-builder/` (.ts pure logic) and `tests/form-interpreter/` (.tsx renderer tests)** — `npm test` picks up both since Phase 14 (commit `8a2a9cd` broadened the script). Cycle-detection and `evaluateVisibility` are pure-logic tests; the renderer-wrapping visibility subscriber needs a `.tsx` test.

### Integration Points
- **Schema attribute registration:** the new attribute attaches to every entity definition in `lib/form-builder/entities/*.ts`. Simplest path is a single line per file; alternative is a helper that returns the standard attribute bundle.
- **Builder properties panel:** the new collapsible section reads `entity.attributes.visibilityRules` and writes back via the existing `builderStore.setEntityAttribute(entityId, "visibilityRules", value)` path.
- **Interpreter visibility evaluator:** sits adjacent to `interpreter-renderer.tsx`. Two consumers — the renderer (hides DOM) and `computeFormProgress` (excludes from required count) — share one pure `evaluateVisibility(schema, answers)` function returning `Record<entityId, { visible, required }>`.
- **Server-side submit scrub:** new pure `stripHiddenAnswers(schema, answers, visibility)` called in `submitAssessmentAction` between `validateEntitiesValues` and the DB write. Output replaces `result.data` going into `answers_json`.
- **`computedField` reactive cascade:** the dependency map needs two edge types — `sourceEntityId → dependent` (direct rules) and `inputEntityId → computedFieldEntityId → dependent` (rules whose source is a computedField). `validateRuleGraph` walks both.

</code_context>

<specifics>
## Specific Ideas

- **PAS 79 risk matrix is the canonical end-to-end test for D-02.** Phase 14 ships `computedField` with `formula="pas79"` reading two `numberField` inputs (likelihood + consequence). Phase 15's smoke test should add a Mitigation `textField` whose visibility rule is `[computedField:risk] equals "Intolerable" → show`. If that flow works fill-time, D-02 is proven.
- **FRA-doors `repeatingSection` is the canonical test for D-03 ancestor-scope refs.** A door-instance child like `Repair urgency` should be require-iff its sibling-in-instance `Door condition` equals `Poor`. A separate root-scope check: `Show Fire-doors register section if Site type equals Commercial`.
- **Build prompt §3d FRA conditional table is the acceptance corpus.** Every row in that table (Sports Certificate → details, Alterations Notice → details, Fire-loss → date+brief+cause+action, DSEAR → sub-section, etc.) must be expressible with the operator set in D-06. Planner should sanity-check against this list before locking the rule editor UX.
- **Build-prompt sketch syntax is the rule-row baseline.** `When [field ▼] [operator ▼] [value] → [action ▼]` inline row layout, AND/OR segmented toggle, trash icon per row. Do not redesign without reason.

</specifics>

<deferred>
## Deferred Ideas

- **Cross-instance references inside `repeatingSection`** — "hide Door 2's gap if Door 1's condition is Poor". Excluded by D-03; would need an instance-picker UI (instance N / any / all) that isn't worth its complexity for the FRA use case. Future phase if a real need arises.
- **Custom expression DSL** — beyond the fixed operator set in D-06 (e.g., regex match, arithmetic predicates, `between` ranges). The current operators cover every FRA pattern; defer until a real need surfaces.
- **Rule templates / "copy rules from another field"** — quality-of-life feature for forms with many similar rules. Defer; one-time cost of clicking through the rule editor is small at FRA scale.
- **Server-side rule evaluation for the AI report draft** — currently `runReportDraftGeneration` reads the full `answers_json`; once hidden-subtree scrub is in place at submit time, the AI prompt only ever sees visible answers, so no extra work needed in Phase 15. Revisit if we ever surface conditional-aware draft regeneration.

</deferred>

---

*Phase: 15-conditional-logic-engine*
*Context gathered: 2026-05-26*
