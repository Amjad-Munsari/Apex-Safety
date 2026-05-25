# Phase 15: Conditional Logic Engine - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-26
**Phase:** 15-conditional-logic-engine
**Areas discussed:** Hidden-field cascade behaviour, Computed fields as rule sources, Cross-scope rule references, Builder UI placement + rule-editor affordance

---

## Hidden-field cascade behaviour

| Option | Description | Selected |
|--------|-------------|----------|
| Preserve on hide, drop on submit | Children's values stay in interpreter state while hidden — user can flip the condition back without losing work. On submit, server drops hidden-subtree values from `answers_json`. Best UX for the toggle-then-untoggle case; matches build prompt's "hidden = not in submission" rule. | ✓ |
| Clear immediately on hide | When a parent hides, recursively clear children's values from interpreter state. Toggling the rule back gives a blank subtree. Simpler implementation, but punishes the user who toggled by mistake. | |
| Preserve everywhere (snapshot) | Hidden values are kept in `answers_json` too — the schema records what was entered even if not shown to the AI report. Cleanest history, but pollutes submission data and conflicts with build prompt spec. | |

**User's choice:** Preserve on hide, drop on submit
**Notes:** Locked as D-01. Server-side `stripHiddenAnswers` runs in `submitAssessmentAction` between coltorapps validation and the DB write.

---

## Computed fields as rule sources

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — first-class rule source | computedField appears in the source-field dropdown like any other field. Engine subscribes rules to computed outputs; cycle detection traverses computed dependency edges (input → computed → dependent rule). Required to make the FRA risk matrix → mitigation flow work without a workaround. | ✓ |
| Yes, but only show/hide — no required-if | computedField can drive visibility, but cannot drive `require` (a computed value flipping a field from optional to required mid-fill is jarring). Slightly less expressive but reduces surprise. | |
| No — only user-input fields can be sources | Rules can only reference fields the user typed/picked. Risk-matrix flows have to be done as two-level rules (Likelihood + Consequence both as sources), bypassing the computed field. Simpler engine, more verbose rules. | |

**User's choice:** Yes — first-class rule source
**Notes:** Locked as D-02. The dependency map carries two edge types — direct (`source → consumer`) and computed (`input → computedField → consumer`). `validateRuleGraph` walks both when checking for cycles. `require` is allowed in this mode — the canonical use case is "show + require Mitigation when Risk = Intolerable".

---

## Cross-scope rule references

| Option | Description | Selected |
|--------|-------------|----------|
| Same scope + ancestor scopes only | A field's rule can reference: (a) fields in its OWN scope (sibling root ↔ sibling root, same-instance ↔ same-instance), and (b) fields in any ANCESTOR scope (a field inside a repeatingSection instance can reference a root field). Cannot reference fields inside a DIFFERENT instance. Matches every realistic FRA pattern; avoids "which instance?" ambiguity. | ✓ |
| Root-only sources — simplest | All rule sources MUST be root-scope fields. No field inside a repeatingSection can be a rule source. Simpler engine + UI; loses the case of "if this door's condition is Poor, require its photo" inside an instance. | |
| Anything goes — cross-instance allowed | Rules can reference any field anywhere, including fields in other instances. Requires a 'pick instance' UI for cross-instance refs (instance N, or 'any instance', or 'all instances'). Most expressive but adds significant UX complexity and is overkill for FRA. | |

**User's choice:** Same scope + ancestor scopes only
**Notes:** Locked as D-03. Cross-instance refs rejected at save time. Root fields cannot reference fields inside a repeatingSection (N instances → ambiguous source).

---

## Builder UI placement + rule-editor affordance

| Option | Description | Selected |
|--------|-------------|----------|
| Collapsible "Conditional logic" section at bottom, inline rows | Below the existing attribute editors, a collapsed-by-default "Conditional logic (0)" disclosure section. Opens to: AND/OR toggle at top, then inline rows `When [field] [operator] [value] → [action]` with a trash icon per row. Matches build prompt sketch; keeps the panel scannable; admins who never use rules don't see them. | ✓ |
| Dedicated tab in PropertiesPanel | Two-tab panel: "Attributes" (default) and "Conditional logic (N)". Cleaner separation but doubles the click cost to set a rule, and admins forget the tab exists. Worse for the FRA use case where most fields will eventually have rules. | |
| Card-per-rule with explicit AND/OR badges | Each rule renders as a card (3-line layout: source / operator+value / action). Better for complex multi-rule scenarios with explicit AND/OR badges between cards. Heavier visual weight; overkill for 1-2 simple rules per field (the FRA average). | |

**User's choice:** Collapsible "Conditional logic" section at bottom, inline rows
**Notes:** Locked as D-04. Badge `(N)` shows rule count when N > 0. Inline row layout per build-prompt sketch.

---

## Claude's Discretion

- Whether to expose the dependency map as a memoised store selector (per-entity) or a single reducer that emits visibility deltas — implementation detail, planner-research item. Both paths satisfy D-09's performance contract.
- Exact wire format for the save-time cycle-error payload (UI just needs entity labels + rule indices to highlight). Planner can choose.
- Whether `evaluateVisibility` is a single pure function or a small bundle (`evaluateRule` + `combineRules` + `cascadeVisibility`). No external contract impact.

## Deferred Ideas

- Cross-instance references inside `repeatingSection` (excluded by D-03; would need an instance-picker UI).
- Custom expression DSL beyond the fixed operator set in D-06.
- Rule templates / "copy rules from another field" quality-of-life feature.
- Server-side rule evaluation for the AI report draft (covered automatically once the submit-time scrub lands).
