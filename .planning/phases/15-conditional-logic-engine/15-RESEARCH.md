# Phase 15: Conditional Logic Engine - Research

**Researched:** 2026-05-26
**Domain:** coltorapps visibility/required engine; DAG cycle detection; reactive dependency map; server-side hidden-subtree scrub
**Confidence:** HIGH (coltorapps `shouldBeProcessed` API verified via Context7; all upstream phase code read directly)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01 — Hidden-field cascade:** Preserve on hide, drop on submit. Values stay in the interpreter store while hidden — flipping the rule back restores entered values. On submit, the server walks the schema with the final visibility state and strips every entity that resolves to `visible === false` from `answers_json`, recursively (whole `sectionGroup` / `repeatingSection` subtrees collapse).

**D-02 — computedField as rule source:** First-class rule source — including for `require`. The source-field dropdown lists computedFields alongside user-input fields. Dependency map records two edge types: direct (`source → consumer`) and computed (`input → computedField → consumer`). `validateRuleGraph` traverses both.

**D-03 — Cross-scope refs:** Same-scope AND ancestor-scope only. A field inside a `repeatingSection` instance can reference any root field; root fields can reference other root fields. Cross-instance references rejected at save time. Root fields cannot reference fields inside a `repeatingSection` (N instances → ambiguous source).

**D-04 — Builder UI:** Collapsible "Conditional logic (N)" section at the bottom of PropertiesPanel, inline rule rows. Collapsed by default; badge `(N)` shows rule count when N > 0. Opens to `[AND | OR]` segmented toggle on top, then inline rows: `When [field ▼] [operator ▼] [value] → [action ▼] [🗑]`.

**D-05 — Data model:** `visibilityRules: { rules: VisibilityRule[], logic: 'and' | 'or' }`. `VisibilityRule = { sourceEntityId, operator, value, action }`. New attribute factory at `lib/form-builder/attributes/visibility-rules.ts`. Attached to every entity.

**D-06 — Operator set (fixed):** `equals | notEquals | contains | greaterThan | lessThan | isEmpty | isNotEmpty`. UI filters by source-field type:
- text → equals/notEquals/contains/isEmpty/isNotEmpty
- number → equals/notEquals/greaterThan/lessThan/isEmpty/isNotEmpty
- select → equals/notEquals/isEmpty/isNotEmpty
- checkbox → equals (true/false)
- date → equals/greaterThan/lessThan/isEmpty/isNotEmpty
- computedField → equals/notEquals/greaterThan/lessThan based on formula output type

**D-07 — Action set (fixed):** `show | hide | require`. Hide wins over show. Hidden trumps required.

**D-08 — Cycle detection:** At save/publish time, not render time. Reject with admin-readable error listing entities in the cycle and rule edges that form it.

**D-09 — Performance contract:** Maintain `sourceEntityId → Set<dependentEntityId>` map; on value change re-evaluate only affected dependents.

**D-10 — Engine value semantics:** "Some" and "N/A" are plain string values; engine does NOT special-case option labels. Rules express the desired behaviour explicitly (`equals "Some"`, `equals "N/A"`).

### Claude's Discretion (planner-research items)
- Dependency map exposure: memoised selector per entity vs. single reducer emitting deltas. Both satisfy D-09. **Recommendation in §Architecture Patterns below.**
- Wire format for cycle-error payload. **Recommendation below.**
- `evaluateVisibility` single function vs. small bundle. **Recommendation below.**

### Deferred Ideas (OUT OF SCOPE — DO NOT PLAN)
- Cross-instance references inside `repeatingSection` (e.g., "hide Door 2's gap if Door 1's condition is Poor"). Would need instance-picker UI.
- Custom expression DSL beyond the fixed operator set.
- Rule templates / "copy rules from another field".
- Server-side rule evaluation for the AI report draft. Already covered automatically once submit-time scrub lands.
</user_constraints>

---

<phase_requirements>
## Phase Requirements (from REQUIREMENTS.md)

| ID | Description | Research Support |
|----|-------------|------------------|
| COND-01 | Visibility rules can be defined per field (show X if Y == value) | `visibilityRulesAttribute` (D-05) attached to every entity; builder UI per UI-SPEC §1; engine via `shouldBeProcessed` hook per §Architecture Pattern 1. |
| COND-02 | Required-if rules can be defined per field | `action: 'require'` per D-07; renderer reads dynamic required state from `evaluateVisibility(...).required` instead of static `attrs.required`. D-07 "hidden trumps required" enforced in `cascadeVisibility`. |
| COND-03 | DAG cycle detection prevents circular dependencies at publish time — not at render time | `validateRuleGraph` (Architecture Pattern 4) runs in `saveDraftAction` AND `publishTemplateAction` (Phase 13 carry-forward — both paths call coltorapps `validateSchema`; planner adds `validateRuleGraph` adjacent). Algorithm: 3-colour DFS over the dependency multigraph; output names entity labels + rule indices for UI highlight. |
| COND-04 | Renderer evaluates conditions live as the user fills the form | coltorapps `shouldBeProcessed(context)` is recomputed by the interpreter store on every value change; combined with dependency-map-aware selective subscription so unaffected entities don't re-render. |
| BUILDER-02 | Properties panel supports per-field: label, required, placeholder, validation, **conditional visibility** | New `<ConditionalLogicSection>` appended below existing attribute editors in `components/form-builder/properties-panel.tsx`. Per UI-SPEC §1 + Component Inventory. |
</phase_requirements>

---

## Summary

The most consequential finding: **coltorapps ships a first-class conditional-visibility hook** called `shouldBeProcessed(context)`. Documented in `/docs/entities/page.md` (Context7-verified), it is a per-entity option on `createEntity({...})` that receives `{ entity, entitiesValues }` and returns a boolean. When it returns `false`, the entity (and ALL its children) are **neither rendered nor validated** — exactly the D-01 contract. The interpreter store automatically recomputes it on every value change. We do NOT have to invent our own subscription layer; we plug into one the library already operates.

This collapses two big design questions:
- **Per-renderer subscription vs. central reducer?** Neither — `shouldBeProcessed` is hoisted into the coltorapps interpreter. The renderer just stops being called.
- **How does it interact with the Phase 14-06 propsRef/useMemo focus-loss fix?** It doesn't conflict at all. The `components` map identity stays stable (deps `[surface]`); coltorapps decides which entries to invoke based on `shouldBeProcessed` results, not by mutating the components map.

What we still own:
1. The `visibilityRulesAttribute` factory (D-05) — added to every one of the 13 entities.
2. A shared `shouldBeProcessed` implementation (a pure function) attached to every entity — because the hook lives in `createEntity` options, not in builder-level `entitiesExtensions`. Verified via Context7 docs that `entitiesExtensions` only exposes attribute-override extension, not `shouldBeProcessed` override.
3. Five small pure functions: `evaluateRule`, `combineRules`, `cascadeVisibility`, `buildDependencyMap`, `validateRuleGraph`. Recommend a bundle in `lib/form-builder/visibility/` so each is unit-testable.
4. The DAG cycle detector — 3-colour DFS that walks BOTH the direct edge `source → consumer` AND the computed-field-mediated edge `input → computedField → consumer`.
5. The save-time scope-resolver that rejects cross-instance refs and root→inside-repeating refs.
6. A `stripHiddenAnswers(schema, answers, visibility)` pure function called between `validateEntitiesValues` and the DB write inside `submitAssessmentAction`.
7. `computeFormProgress` extension: same `evaluateVisibility` output is consumed to drop hidden-and-not-visible fields from BOTH numerator and denominator.
8. Builder UI components: `<ConditionalLogicSection>`, `<RuleRow>`, `<CycleErrorBanner>` per UI-SPEC.

**Primary recommendation:** Use coltorapps `shouldBeProcessed` for runtime visibility. Implement a single pure function `evaluateVisibility(schema, answers)` whose output is consumed by (a) each entity's `shouldBeProcessed` (read-only — the hook just calls `evaluateVisibility(...).visible`), (b) renderers needing dynamic `required`, (c) `computeFormProgress`, and (d) the server `stripHiddenAnswers` scrub. One algorithm, four consumers. Cycle detection lives in a separate `validateRuleGraph` called server-side at save/publish.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| `visibilityRules` attribute factory (validate + default coerce) | Shared module (`lib/form-builder/attributes/`) | — | Imported by both client builder/interpreter and server actions. No I/O, no side effects. Phase 13 pattern carry-forward. |
| `evaluateVisibility` pure function | Shared module (`lib/form-builder/visibility/`) | — | Consumed by (a) every entity's `shouldBeProcessed` hook (client), (b) renderer dynamic-required reads (client), (c) `computeFormProgress` (client + server), (d) `stripHiddenAnswers` (server). Pure, no I/O. |
| `shouldBeProcessed` hook attached to every entity | Browser/Client (via coltorapps interpreter) | — | coltorapps recomputes on every `setEntityValue`. Native dependency tracking — no manual subscription needed. |
| Dependency map (`source → dependents`) | Shared module — pure | — | Built from schema once on builder-store load; used by `validateRuleGraph` (server) AND optional render-perf optimisations (client). |
| Cycle detection (`validateRuleGraph`) | API/Backend (Server Action) | Browser/Client (optional pre-flight on save click) | Must run server-side in `saveDraftAction` / `publishTemplateAction` (T-13-09 carry-forward — never trust client-side validation alone). Client may also run it for instant feedback on Save button. |
| Builder UI (ConditionalLogicSection + RuleRow + CycleErrorBanner) | Browser/Client | — | Reads/writes `entity.attributes.visibilityRules` via `builderStore.setEntityAttribute`. AGENTS.md: must be surface-agnostic (admin dark + customer cream via `surface` prop). |
| Renderer dynamic-required state | Browser/Client | — | Each per-entity renderer reads `evaluateVisibility(...).required[entity.id]` (via `propsRef` to keep `useMemo` deps stable per Phase 14-06 pattern). |
| `stripHiddenAnswers` server scrub | API/Backend (Server Action) | — | Called inside `submitAssessmentAction` between `validateEntitiesValues` and `.update()`. Pure function; no DB calls. |
| Save-time scope-resolver (D-03 enforcement) | API/Backend (Server Action) | Browser/Client (optional UI hint) | Embedded in `validateRuleGraph` output as a separate failure class so the UI can distinguish "cycle" from "out-of-scope reference". |
| Smoke-test template (PAS 79 + door-instance) | Migration (SQL) | — | New migration `012_phase15_conditional_smoke_test.sql` follows the CTE-with-`gen_random_uuid()` pattern from `011_specialty_smoke_test_template.sql`. |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@coltorapps/builder` | 0.2.4 | `shouldBeProcessed` hook on `createEntity`; runtime visibility cascade | Already adopted (Phase 13 D-01). The library ships exactly the hook we need — discovered via Context7 — so we extend rather than wrap. [VERIFIED: `npm view @coltorapps/builder version` → `0.2.4`, last published 2025-07-09; no newer release.] |
| `@coltorapps/builder-react` | 0.2.4 | `InterpreterEntities` honours `shouldBeProcessed` automatically | Same. No new install. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `zod` | already installed | Optional structural validation inside `visibilityRulesAttribute.validate` | Recommended — matches project pattern; alternative is hand-rolled type guards (existing `attach-photos.ts` / `computed-inputs.ts` use hand-rolled — choose one consistently). |
| `sonner` | already installed | Toast for save-time cycle-error per UI-SPEC §2 | UI-SPEC mandates `toast.error("Circular rule detected")` |
| `lucide-react` | already installed | `GitFork`, `ChevronRight/Down`, `Trash2`, `AlertTriangle` icons per UI-SPEC | UI-SPEC §1, §2 |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| coltorapps `shouldBeProcessed` | Per-renderer `useSyncExternalStore` subscribing to dependency-map output | Would re-implement what the library already does; doubles the surface; breaks the Phase 14-06 focus-loss fix because the wrapper would now have a hook |
| coltorapps `shouldBeProcessed` | Single central reducer at interpreter root emitting `{visible, required}` deltas via context | Loses per-entity granularity; every dependency change re-renders the whole tree; throws away the Phase 13 RESEARCH "selective subscriptions" principle |
| 3-colour DFS for cycle detection | Tarjan's SCC | Tarjan is overkill — we only need yes/no + one example cycle. DFS-with-colours emits the cycle path naturally during back-edge detection. |
| 3-colour DFS for cycle detection | Kahn's topological sort | Kahn detects cycles but doesn't easily extract the cycle path for the UI error payload. DFS wins on UX. |

**Installation:** None. No new packages.

**Version verification:**
```bash
npm view @coltorapps/builder version
# → 0.2.4 (last published 2025-07-09)
```
[VERIFIED: npm registry, 2026-05-26]

---

## Architecture Patterns

### System Architecture Diagram

```
┌─────────── BUILDER (admin surface) ───────────┐
│                                                │
│  PropertiesPanel  ──► ConditionalLogicSection │
│       │                       │                │
│       │                       ├─► RuleRow(s)  │
│       │                       └─► CycleBanner │
│       │                                        │
│       └─► builderStore.setEntityAttribute(id, "visibilityRules", value)
│                            │
│                            ▼
│                 builderStore.getSchema()
│                            │ (on Save click)
│                            ▼
│              ┌─────── Server Action ──────┐
│              │  saveDraftAction(rawSchema) │
│              │      │                      │
│              │      ├─► validateSchema (existing)
│              │      ├─► validateRuleGraph(schema)  ◄── NEW
│              │      │    └─► throws CycleError{cycles, scopeViolations}
│              │      └─► INSERT template_versions (new immutable row)
│              └────────────────────────────┘
└────────────────────────────────────────────────┘

┌─────────── INTERPRETER (admin + customer surfaces) ───────────┐
│                                                                 │
│  useInterpreterStore(formBuilder, schema)                      │
│       │                                                         │
│       │ on every setEntityValue(id, value):                    │
│       │   ▶ coltorapps re-runs shouldBeProcessed(context)      │
│       │     for every entity, where context.entitiesValues     │
│       │     reflects the new state                              │
│       │                                                         │
│       ▼                                                         │
│  shouldBeProcessed(ctx) → evaluateVisibility(schema, ctx.entitiesValues)[entity.id].visible
│       │                                                         │
│       ▼                                                         │
│  <InterpreterEntities>                                         │
│       │ skips rendering+validation for entities returning false│
│       │                                                         │
│       ├─► <TextFieldRenderer> reads dynamic required from      │
│       │   evaluateVisibility(...).required[entity.id]          │
│       │   via propsRef (Phase 14-06 pattern preserved)         │
│       │                                                         │
│       └─► onProgressChange → computeFormProgress(schema, vals, │
│                                evaluateVisibility(schema,vals))│
│                                                                 │
│  Submit click → submitAssessmentAction(submissionId, rawValues)│
│                            │                                    │
│              ┌─────── Server Action ──────┐                    │
│              │  submitAssessmentAction     │                    │
│              │   1. requireActorUserId      │                   │
│              │   2. fetch pinned version    │                   │
│              │   3. validateEntitiesValues  │                   │
│              │   4. evaluateVisibility(schema, validatedValues) │
│              │   5. stripHiddenAnswers(...) ◄── NEW            │
│              │   6. UPDATE form_submissions SET answers_json   │
│              └─────────────────────────────┘                   │
└────────────────────────────────────────────────────────────────┘

Dependency map (pure, built from schema):
  sourceEntityId → Set<dependentEntityId>   (direct)
  inputEntityId  → computedFieldEntityId    (computed source)
  → traversal follows BOTH edge classes when checking cycles
```

### Recommended Project Structure

```
lib/form-builder/
├── attributes/
│   └── visibility-rules.ts        # NEW — D-05 attribute factory
├── visibility/                     # NEW — pure-logic bundle
│   ├── types.ts                    # VisibilityRule, VisibilityRules, VisibilityState
│   ├── evaluate-rule.ts            # evaluateRule(rule, sourceValue, sourceType): boolean
│   ├── combine-rules.ts            # combineRules(results: boolean[], logic: 'and'|'or'): boolean
│   ├── cascade-visibility.ts       # cascadeVisibility(schema, raw): final state (parent→child)
│   ├── evaluate-visibility.ts      # evaluateVisibility(schema, answers): Record<id, {visible, required}>
│   ├── dependency-map.ts           # buildDependencyMap(schema): { direct, computed }
│   ├── validate-rule-graph.ts      # validateRuleGraph(schema): { ok | cycles[] | scopeErrors[] }
│   ├── strip-hidden-answers.ts     # stripHiddenAnswers(schema, answers, visibility)
│   ├── scope.ts                    # resolveScope(schema, entityId): scopeId (root | repSectionInstanceId)
│   └── should-be-processed.ts      # the shared hook body, imported by every entity file
└── entities/                       # all 13 existing files modified
    ├── text-field.ts               # + visibilityRulesAttribute, + shouldBeProcessed
    ├── number-field.ts             # same
    ├── ... (13 total)

components/form-builder/
├── properties-panel.tsx            # MODIFIED — append <ConditionalLogicSection> below editors
├── conditional-logic-section.tsx   # NEW
├── rule-row.tsx                    # NEW
└── cycle-error-banner.tsx          # NEW

components/form-interpreter/
└── interpreter-renderer.tsx        # MODIFIED — pass evaluateVisibility result via propsRef so
                                    #   renderers can read dynamic `required` and so
                                    #   computeFormProgress sees the visibility map

app/admin/templates/
└── actions.ts                      # MODIFIED — saveDraftAction + publishTemplateAction
                                    #   call validateRuleGraph after validateSchema
app/client/templates/
└── actions.ts                      # MODIFIED — same change for the customer path

app/admin/assessments/
└── actions.ts                      # MODIFIED — submitAssessmentAction calls
                                    #   evaluateVisibility + stripHiddenAnswers between
                                    #   validateEntitiesValues and .update()

lib/form-builder/
└── progress.ts                     # MODIFIED — accept optional visibility arg; drop hidden
                                    #   entities from BOTH numerator and denominator

tests/form-builder/
├── visibility-rules.test.ts        # NEW — attribute validate() default coercion
├── evaluate-rule.test.ts           # NEW — every operator × source type matrix
├── combine-rules.test.ts           # NEW — AND/OR + hide-wins-over-show
├── cascade-visibility.test.ts      # NEW — parent hide → children hide cascade
├── evaluate-visibility.test.ts     # NEW — integration of evaluateRule+combine+cascade
├── dependency-map.test.ts          # NEW — direct + computed edge construction
├── validate-rule-graph.test.ts     # NEW — linear chains pass; direct cycle; computed cycle;
│                                   #       ancestor-scope passes; cross-instance rejected;
│                                   #       root→inside-repeating rejected; scope-error payload
├── strip-hidden-answers.test.ts    # NEW — hidden field stripped; cascade; repeating instance;
│                                   #       hidden-but-required silently dropped not erroring
├── scope.test.ts                   # NEW — resolveScope for root, sectionGroup child,
│                                   #       repeatingSection child
└── progress.test.ts                # EXTENDED — hidden fields excluded from numerator+denominator

tests/form-interpreter/
└── renderers.test.tsx              # EXTENDED — visibility subscriber: focus retained across
                                    #   hide/show flip; Select controlled across source flip
```

### Pattern 1: `shouldBeProcessed` shared hook (the key integration)

```typescript
// lib/form-builder/visibility/should-be-processed.ts
import { evaluateVisibility } from "./evaluate-visibility";
import type { FormBuilderSchema } from "../index";

/**
 * Shared shouldBeProcessed body — attached to EVERY entity definition.
 *
 * coltorapps calls this on every interpreter store value change. When it
 * returns false, the entity (and ALL its children) is not rendered and
 * not validated — which is exactly the D-01 / D-07 hidden-cascade contract.
 *
 * The hook reads context.entity (the entity being evaluated) and
 * context.entitiesValues (the current full value map). It does NOT have
 * direct access to context.schema in this version of coltorapps — so we
 * close over `schema` via the entity definition's lexical scope by
 * computing visibility from a schema reference threaded through the
 * createEntity factory at definition time.
 *
 * WAIT — see Pitfall 7: coltorapps does NOT provide the schema in
 * shouldBeProcessed's context. The schema available to shouldBeProcessed
 * is implicit (the schema you initialised the interpreter store with).
 * We work around this by writing evaluateVisibility() to accept ONLY the
 * snapshot we have: an entitiesValues map plus the entity being asked
 * about. We need the schema for cross-entity rule evaluation, so we read
 * it from a module-level WeakMap keyed on the interpreter store — set
 * once at store construction in InterpreterRenderer.
 *
 * Simpler alternative confirmed by Context7 reference example
 * (`referenceEntityId` pattern — see Sources): the hook can read
 * `context.entitiesValues[someOtherEntityId]` directly. For our case,
 * we need the rule list from THIS entity (already in context.entity.attributes)
 * AND the source entity's value (in context.entitiesValues) — both
 * available. We do NOT need the full schema in the hook itself when the
 * rule's sourceEntityId tells us which value to read.
 */
export function makeShouldBeProcessed() {
  return function shouldBeProcessed(context: {
    entity: { id: string; attributes: { visibilityRules?: unknown; required?: unknown } };
    entitiesValues: Record<string, unknown>;
  }): boolean {
    const rules = (context.entity.attributes.visibilityRules as
      | { rules: Array<{ sourceEntityId: string; operator: string; value: unknown; action: string }>;
          logic: "and" | "or"; }
      | undefined) ?? { rules: [], logic: "and" };

    if (rules.rules.length === 0) return true;

    // Evaluate each rule against the source value
    const showHideResults = rules.rules
      .filter((r) => r.action === "show" || r.action === "hide")
      .map((r) => ({
        fired: evaluateRule(r.operator, context.entitiesValues[r.sourceEntityId], r.value),
        action: r.action,
      }));

    if (showHideResults.length === 0) return true; // only `require` rules → entity is visible

    const combined = combineShowHide(showHideResults, rules.logic);
    return combined;
  };
}
```

**Why this works:** `context.entitiesValues` already contains the source's current value. The rule list lives in `context.entity.attributes.visibilityRules`. We don't need the full schema in the hook for show/hide. We DO need the schema for cascadeVisibility (parent-hide → children-hide) — but coltorapps automatically cascades shouldBeProcessed to children when a container returns false. **Verified** via Context7: "The `shouldBeProcessed` method controls whether an entity is displayed and validated... useful for entities dependent on others." [CITED: `/docs/entities/page.md`]

For dynamic `required` (action='require'), the hook approach doesn't work — coltorapps doesn't expose a `shouldBeRequired` hook. Renderers must read dynamic required from `evaluateVisibility(schema, entitiesValues)[entityId].required`. Pattern 5 below.

**Source:** Context7 `/coltorapps/builder` — `/docs/entities/page.md` (`shouldBeProcessed` example with `referenceEntityId`).

### Pattern 2: `visibilityRulesAttribute` factory

```typescript
// lib/form-builder/attributes/visibility-rules.ts
import { createAttribute } from "@coltorapps/builder";

const VALID_OPERATORS = new Set([
  "equals", "notEquals", "contains", "greaterThan", "lessThan", "isEmpty", "isNotEmpty",
]);
const VALID_ACTIONS = new Set(["show", "hide", "require"]);

export interface VisibilityRule {
  sourceEntityId: string;
  operator: "equals" | "notEquals" | "contains" | "greaterThan" | "lessThan" | "isEmpty" | "isNotEmpty";
  value: string | number | boolean | null;
  action: "show" | "hide" | "require";
}

export interface VisibilityRules {
  rules: VisibilityRule[];
  logic: "and" | "or";
}

const DEFAULT: VisibilityRules = { rules: [], logic: "and" };

export const visibilityRulesAttribute = createAttribute({
  name: "visibilityRules",
  validate(value) {
    // Phase 13 RESEARCH Pitfall 4 — default-coerce undefined/null
    if (value === undefined || value === null) return DEFAULT;
    if (typeof value !== "object" || Array.isArray(value)) {
      throw new Error("visibilityRules must be an object with `rules` and `logic`.");
    }
    const v = value as Record<string, unknown>;
    const logic = v.logic === "or" ? "or" : "and";
    const rawRules = Array.isArray(v.rules) ? v.rules : [];
    const rules: VisibilityRule[] = rawRules.map((r, i) => {
      if (!r || typeof r !== "object") {
        throw new Error(`Rule #${i} is not an object.`);
      }
      const raw = r as Record<string, unknown>;
      if (typeof raw.sourceEntityId !== "string" || raw.sourceEntityId.length === 0) {
        throw new Error(`Rule #${i}: sourceEntityId must be a non-empty string.`);
      }
      if (typeof raw.operator !== "string" || !VALID_OPERATORS.has(raw.operator)) {
        throw new Error(`Rule #${i}: operator must be one of ${[...VALID_OPERATORS].join(", ")}.`);
      }
      if (typeof raw.action !== "string" || !VALID_ACTIONS.has(raw.action)) {
        throw new Error(`Rule #${i}: action must be show, hide, or require.`);
      }
      return {
        sourceEntityId: raw.sourceEntityId,
        operator: raw.operator as VisibilityRule["operator"],
        value: (raw.value ?? null) as VisibilityRule["value"],
        action: raw.action as VisibilityRule["action"],
      };
    });
    return { rules, logic };
  },
});
```

### Pattern 3: Entity registration (all 13 entities)

Each entity file in `lib/form-builder/entities/*.ts` gains TWO changes:

```typescript
// BEFORE
import { createEntity } from "@coltorapps/builder";
import { labelAttribute } from "../attributes/label";
// ...
export const textFieldEntity = createEntity({
  name: "textField",
  attributes: [labelAttribute, requiredAttribute, /* ... */],
  validate(value, context) { /* ... */ },
});

// AFTER
import { createEntity } from "@coltorapps/builder";
import { labelAttribute } from "../attributes/label";
import { visibilityRulesAttribute } from "../attributes/visibility-rules";
import { makeShouldBeProcessed } from "../visibility/should-be-processed";
// ...
export const textFieldEntity = createEntity({
  name: "textField",
  attributes: [labelAttribute, requiredAttribute, /* ... */, visibilityRulesAttribute],
  validate(value, context) { /* ... unchanged */ },
  shouldBeProcessed: makeShouldBeProcessed(),
});
```

**Decision: single line per entity, NOT a builder-level default bundle.** Per Context7, `entitiesExtensions` on `createBuilder` only documents `attributes` overrides — NOT `shouldBeProcessed` overrides. Each entity must attach the hook itself. Keeping the attribute + hook attachment per-file (one new import line, one new attribute entry, one new option key) is also more discoverable: a future reader of `text-field.ts` sees the conditional-logic surface inline. [CITED: `/docs/api/create-builder/page.md` — `entitiesExtensions` shape]

`computedField` SPECIAL CASE: it is read-only, but the user can still want to hide it (e.g., hide the risk display until both inputs are filled). Attach the attribute + hook normally. It must NEVER receive `action: 'require'` rules — but that's a UI-layer concern (do not offer "require" in the action dropdown when the host field is `computedField`).

`sectionGroup` and `repeatingSection`: UI-SPEC §1 says "containers cannot have visibility rules on themselves, but sections can be rule *targets*." Re-reading the spec — sections ARE rule targets (you can hide a whole section), but the BUILDER UI hides the ConditionalLogicSection when the selected entity is a sectionGroup or repeatingSection. **Resolution:** still attach the attribute + hook to all 13 (engine doesn't care), but the PropertiesPanel hides the editor for `sectionGroup`/`repeatingSection` via `hasCondLogic = !isContainer`. This matches the spec's "containers cannot have visibility rules on themselves" line and is enforced as a UI guard, not an engine guard, so the schema stays uniform.

### Pattern 4: Dependency map + DAG cycle detection

```typescript
// lib/form-builder/visibility/dependency-map.ts
type Schema = { entities: Record<string, {
  type: string;
  attributes: { visibilityRules?: VisibilityRules; computedInputs?: { [k: string]: string } };
}> };

export interface DependencyMap {
  /** source entity ID → set of entity IDs that directly reference it in a rule */
  direct: Map<string, Set<string>>;
  /** computedField ID → set of input entity IDs (one edge per input) */
  computedInputs: Map<string, Set<string>>;
}

export function buildDependencyMap(schema: Schema): DependencyMap {
  const direct = new Map<string, Set<string>>();
  const computedInputs = new Map<string, Set<string>>();

  for (const [entityId, entity] of Object.entries(schema.entities)) {
    // Direct rule dependencies
    const rules = entity.attributes.visibilityRules?.rules ?? [];
    for (const r of rules) {
      if (!direct.has(r.sourceEntityId)) direct.set(r.sourceEntityId, new Set());
      direct.get(r.sourceEntityId)!.add(entityId);
    }
    // Computed-field input dependencies (for cycle traversal — D-02)
    if (entity.type === "computedField") {
      const inputs = entity.attributes.computedInputs ?? {};
      const inputIds = new Set(Object.values(inputs).filter((v) => typeof v === "string" && v.length > 0));
      computedInputs.set(entityId, inputIds);
    }
  }
  return { direct, computedInputs };
}
```

**Cycle detection (3-colour DFS):**

```typescript
// lib/form-builder/visibility/validate-rule-graph.ts
const WHITE = 0, GRAY = 1, BLACK = 2;

export interface CycleError {
  path: string[];         // entity IDs in cycle order, first repeated at end
  labels: string[];       // same length — human-readable labels for the UI banner
  edges: Array<{ from: string; to: string; via: "direct" | "computed" }>;
}

export interface ScopeError {
  consumerId: string;
  sourceId: string;
  reason: "cross-instance" | "root-references-inside-repeating";
}

export function validateRuleGraph(schema: Schema): {
  ok: boolean;
  cycles: CycleError[];
  scopeErrors: ScopeError[];
} {
  const map = buildDependencyMap(schema);
  const colour = new Map<string, number>();
  const cycles: CycleError[] = [];
  const stack: string[] = [];

  function dfs(node: string) {
    colour.set(node, GRAY);
    stack.push(node);
    // Follow direct edges: this node is a SOURCE for its dependents
    for (const dependent of map.direct.get(node) ?? []) {
      visitEdge(node, dependent, "direct");
    }
    // Follow computed edges: if node is an input to a computedField,
    // that computedField is effectively downstream
    for (const [computedId, inputs] of map.computedInputs.entries()) {
      if (inputs.has(node)) visitEdge(node, computedId, "computed");
    }
    stack.pop();
    colour.set(node, BLACK);
  }

  function visitEdge(from: string, to: string, via: "direct" | "computed") {
    const c = colour.get(to) ?? WHITE;
    if (c === GRAY) {
      // back edge — extract cycle from the stack
      const idx = stack.indexOf(to);
      const path = stack.slice(idx).concat(to);
      cycles.push({
        path,
        labels: path.map((id) => labelOf(schema, id)),
        edges: pairwiseEdges(path, map),
      });
      return;
    }
    if (c === WHITE) dfs(to);
  }

  for (const id of Object.keys(schema.entities)) {
    if ((colour.get(id) ?? WHITE) === WHITE) dfs(id);
  }

  const scopeErrors = checkScopes(schema, map);   // see Pattern below
  return { ok: cycles.length === 0 && scopeErrors.length === 0, cycles, scopeErrors };
}
```

**Where it's called:** Server-side, inside `saveDraftAction` AND `publishTemplateAction` (Phase 13 currently both run `validateSchema`; insert `validateRuleGraph` immediately after, before the new version row INSERT). On `!result.ok`, throw with a structured message the UI can parse into the toast + inline banner per UI-SPEC §2.

**Wire format for cycle errors (recommended):**

```typescript
throw new Error(JSON.stringify({
  kind: "RuleGraphInvalid",
  cycles: cycles.map(c => ({ entityIds: c.path, labels: c.labels })),
  scopeErrors: scopeErrors.map(s => ({
    consumerId: s.consumerId, sourceId: s.sourceId, reason: s.reason,
    consumerLabel: labelOf(schema, s.consumerId),
    sourceLabel: labelOf(schema, s.sourceId),
  })),
}));
```

The client catches, JSON.parses, and feeds into Sonner (cycles) or the inline `<CycleErrorBanner>` (scope errors). UI just needs `labels` + `entityIds` for highlighting.

### Pattern 5: `evaluateVisibility` (the single shared evaluator)

```typescript
// lib/form-builder/visibility/evaluate-visibility.ts
export interface VisibilityState {
  visible: boolean;
  required: boolean;     // dynamic — combines static attribute + matching `require` rules + hide-trumps-required
}

export function evaluateVisibility(
  schema: Schema,
  answers: Record<string, unknown>
): Record<string, VisibilityState> {
  const out: Record<string, VisibilityState> = {};

  // Step 1: own-rule visibility (show/hide combined per `logic`)
  for (const [id, entity] of Object.entries(schema.entities)) {
    const rules = entity.attributes.visibilityRules?.rules ?? [];
    const logic = entity.attributes.visibilityRules?.logic ?? "and";

    const showHide = rules.filter((r) => r.action === "show" || r.action === "hide");
    const requireRules = rules.filter((r) => r.action === "require");

    let ownVisible = true;
    if (showHide.length > 0) {
      const results = showHide.map((r) => ({
        fired: evaluateRule(r.operator, answers[r.sourceEntityId], r.value, sourceTypeOf(schema, r.sourceEntityId)),
        action: r.action,
      }));
      // Combine show/hide results — hide wins (D-07)
      ownVisible = combineShowHide(results, logic);
    }

    const staticRequired = entity.attributes.required === true;
    const dynamicRequired = requireRules.some((r) =>
      evaluateRule(r.operator, answers[r.sourceEntityId], r.value, sourceTypeOf(schema, r.sourceEntityId))
    );
    out[id] = { visible: ownVisible, required: staticRequired || dynamicRequired };
  }

  // Step 2: cascade — if a parent (sectionGroup or repeatingSection) is not visible,
  //         ALL descendants become not visible (children's hidden trumps require, D-07)
  cascadeVisibility(schema, out);

  return out;
}
```

**For `repeatingSection`** the per-instance evaluation needs a separate pass: each instance's children evaluate their rules against `answers` (which already contains `{instances:[...]}` for the repeatingSection itself). When a child's rule references a SIBLING in the same instance, the engine must look up that sibling's value from the same instance object, not from `answers[siblingId]` (which doesn't exist at root level — child values live inside `instances[i][childId]`).

**Recommendation:** Extend `evaluateVisibility` output to include per-instance state for repeatingSection children:

```typescript
// For repeatingSection child entity:
out[childId] = {
  perInstance: Array<VisibilityState>,    // one entry per instance
  // (top-level `visible` / `required` not meaningful here)
}
```

Renderers know they're inside a repeating instance (the parent renderer passes instanceIndex) and read `out[childId].perInstance[instanceIndex]`. The server scrub does the same.

**This is the major architectural detail the planner must lock at plan time.** Recommendation: build a separate `evaluateVisibilityForInstance(schema, answers, repeatingSectionId, instanceIndex)` and call it from both the `repeating-section-renderer.tsx` AND the server scrub.

### Pattern 6: Renderer dynamic-required integration (preserves Phase 14-06 propsRef pattern)

```typescript
// components/form-interpreter/interpreter-renderer.tsx (modification, NOT rewrite)
// Inside InterpreterRenderer, after useInterpreterStore:

const visibility = useMemo(
  () => evaluateVisibility(schema, interpreterStore.getEntitiesValues()),
  // Recomputed when interpreter store's values change — wire via the existing
  // onEntityValueUpdated event that already runs onProgressChange. Add a state
  // hook keyed on a tick counter, OR (simpler) compute lazily inside propsRef.
);

// Update propsRef to include visibility — wrappers read it at call time so deps stay [surface]
const propsRef = useRef({ clientId, submissionId, schema, interpreterStore, visibility });
useEffect(() => {
  propsRef.current = { clientId, submissionId, schema, interpreterStore, visibility };
});

// Each renderer wrapper now also reads required from visibility:
//   <TextFieldRenderer ... dynamicRequired={propsRef.current.visibility[entity.id]?.required} />
// Renderer treats dynamicRequired as the source of truth (it folds in static + dynamic).
```

**Visibility (show/hide) does NOT need to be passed to the renderer** — coltorapps `shouldBeProcessed` skips rendering automatically. Only `required` needs threading because coltorapps has no `shouldBeRequired` hook.

**Focus-loss invariant preserved:** `[surface]` deps unchanged. `visibility` is recomputed but lives in propsRef.

### Pattern 7: Server-side `stripHiddenAnswers` (D-01 contract)

```typescript
// lib/form-builder/visibility/strip-hidden-answers.ts
export function stripHiddenAnswers(
  schema: Schema,
  answers: Record<string, unknown>,
  visibility: Record<string, VisibilityState>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [id, value] of Object.entries(answers)) {
    const entity = schema.entities[id];
    if (!entity) continue;                                  // unknown key — drop
    if (visibility[id]?.visible === false) continue;        // hidden → drop entirely
    if (entity.type === "repeatingSection") {
      const v = value as { instances?: Array<Record<string, unknown>> };
      if (!v || !Array.isArray(v.instances)) { out[id] = value; continue; }
      // Per-instance child scrub: each instance evaluates its own visibility
      const scrubbedInstances = v.instances.map((inst, idx) => {
        const instVis = evaluateVisibilityForInstance(schema, answers, id, idx);
        const scrubbedInst: Record<string, unknown> = {};
        for (const [childId, childVal] of Object.entries(inst)) {
          if (instVis[childId]?.visible === false) continue;
          scrubbedInst[childId] = childVal;
        }
        return scrubbedInst;
      });
      out[id] = { instances: scrubbedInstances };
    } else {
      out[id] = value;
    }
  }
  return out;
}
```

**Call order inside `submitAssessmentAction`:**

```typescript
// app/admin/assessments/actions.ts — modified
// (existing steps 1-3 unchanged)

// Step 3: server-side validation (unchanged)
const result = await validateEntitiesValues(rawValues, formBuilder, version.schema_json);
if (!result.success) throw new Error(/* ... */);

// Step 3.5 — NEW: compute visibility against the VALIDATED values, then scrub
const visibility = evaluateVisibility(version.schema_json, result.data);
const scrubbed = stripHiddenAnswers(version.schema_json, result.data, visibility);

// Step 4: write SCRUBBED data
await adminClient.from("form_submissions").update({
  answers_json: scrubbed,
  status: "submitted",
  submitted_at: new Date().toISOString(),
}).eq("id", submissionId).eq("status", "draft");
```

**Order rationale:** validate first (reject malformed answers); then evaluate visibility against the post-validation values (validateEntitiesValues coerces — e.g., number strings → numbers — and the operator semantics need typed values); then scrub.

### Pattern 8: `computeFormProgress` extension

```typescript
// lib/form-builder/progress.ts — modified signature
export function computeFormProgress(
  schema: ProgressSchema,
  values: Record<string, unknown>,
  visibility?: Record<string, VisibilityState>  // NEW — optional for backward compat
): number {
  // ... existing repeatingSectionChildIds collection ...

  const requiredIds = Object.entries(schema.entities).flatMap(([id, entity]) => {
    if (repeatingSectionChildIds.has(id)) return [];
    // NEW: hidden entities drop out entirely
    if (visibility && visibility[id]?.visible === false) return [];
    // NEW: dynamic required overrides static (visibility.required folds both in)
    const isRequired = visibility
      ? visibility[id]?.required === true
      : entity.attributes?.required === true;
    if (entity.type === "repeatingSection") {
      const min = (entity.attributes?.minInstances as number) ?? 0;
      return min > 0 ? [id] : [];
    }
    return isRequired ? [id] : [];
  });
  // ... rest unchanged ...
}
```

Backward-compat: if `visibility` is undefined, behaviour is exactly Phase 14. Interpreter renderer passes the freshly computed visibility map on each progress callback.

### Anti-Patterns to Avoid

- **DON'T build a custom per-renderer subscription to dependency map output.** coltorapps `shouldBeProcessed` already drives this. Adding a manual subscription would (a) double the work, (b) risk breaking the Phase 14-06 focus-loss fix.
- **DON'T pass the full visibility map down through React props.** Use `propsRef.current.visibility` (Phase 14-06 pattern). Otherwise every keystroke remounts inputs and Matt loses focus mid-sentence.
- **DON'T evaluate visibility at the renderer for show/hide.** Let coltorapps handle skipping via `shouldBeProcessed`. Only read `visibility[id].required` in the renderer.
- **DON'T mutate `validateRuleGraph` output to "auto-fix" cycles.** Reject and let the admin remove a rule.
- **DON'T strip hidden answers BEFORE validateEntitiesValues.** Validation may fail before scrub — and the failure messages mention entity IDs the user would have entered. Validate first.
- **DON'T treat the visibility cascade as additive across `sectionGroup` and `repeatingSection`.** A hidden parent hides children. A hidden child does NOT hide siblings. Recursion must descend, not propagate up.
- **DON'T add a `required` action option to the action dropdown when the host entity is `computedField`.** computedField has no `requiredAttribute` and never blocks progress (per `computed-field.ts` JSDoc).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Reactive visibility subscription per entity | Custom `useSyncExternalStore` per renderer | coltorapps `shouldBeProcessed` | The library already recomputes on every value change and skips rendering+validation. Re-implementing breaks the Phase 14-06 focus-loss fix. |
| Cycle detection algorithm | Custom traversal mixing visit + cycle-extraction | 3-colour DFS with stack-slice extraction | Standard algorithm; emits the cycle path during back-edge detection — exactly what the UI banner needs. Tarjan is overkill (we don't need all SCCs). |
| Attribute validation | Custom JSON schema validator | `createAttribute({ validate })` (existing pattern) | Matches Phase 13/14 attribute shape; coltorapps automatically calls validate during validateSchema. |
| Dependency-aware re-render minimisation | Manual entity-by-entity React subscriptions | coltorapps internal store + `shouldBeProcessed` | The library is already dependency-aware (it knows which entities changed; recomputes shouldBeProcessed for siblings on value updates). |
| Server-side conditional re-evaluation for AI report | Custom answer-walker | None — `stripHiddenAnswers` at submit time means `answers_json` is already clean by the time `runReportDraftGeneration` runs | Confirmed by CONTEXT deferred-ideas note. |

**Key insight:** coltorapps already provides 80% of the runtime engine. We add: the rule data model (D-05), one shared `shouldBeProcessed` body, four pure functions (evaluate/combine/cascade/strip), one DAG cycle detector, and one save-time scope validator. Plus the builder UI.

---

## Runtime State Inventory

This is a feature-add phase, not a rename or refactor — but the schema change ripples into stored data because every existing template version row gets a new attribute on every entity (via the version-pinning pipeline). Three categories matter:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data — published template versions | Existing rows in `template_versions.schema_json` lack the `visibilityRules` attribute on each entity. coltorapps' `validateSchema` (Phase 13 contract) re-runs each `attribute.validate()` on read; the default-coerce in `visibilityRulesAttribute.validate` returns `{ rules: [], logic: "and" }` for undefined values. **No data migration required.** The version-pinning contract handles it. | None — validate() default-coerce is the migration path. Add a Wave-0 test that loads the existing Phase 14 seed template (migration 011) through validateSchema and confirms every entity has the default rules attribute injected. |
| Stored data — in-flight draft submissions | `form_submissions.answers_json` is unaffected — the rules live on the SCHEMA side, not the values side. Existing draft submissions resume rendering fine. | None. |
| Live service config | n8n workflows trigger on `form_submissions` insert (POST to webhook); payload is `{submissionId}` only — they re-fetch via Supabase. Hidden-subtree scrub doesn't change their integration. | None — verified by reading `submitAssessmentAction` lines 191-211 in current `actions.ts`. |
| OS-registered state | None — no Task Scheduler / launchd / systemd state references the form schema shape. | None. |
| Secrets / env vars | None affected. `OPENROUTER_API_KEY`, `N8N_ASSESSMENT_WEBHOOK_URL` — both untouched. | None. |
| Build artifacts | TypeScript types: `FormBuilderSchema` widens automatically when entities gain the new attribute. The `EntityComponentProps<typeof X>` types in `interpreter-renderer.tsx` will include `visibilityRules` in `entity.attributes`. No `tsc` failures expected. | Run `npx tsc --noEmit` after Wave 1 (schema landed) to confirm no regressions in renderers / properties-panel. |

**Critical confirmation needed during execution (Pitfall 1 below):** Load `011_specialty_smoke_test_template.sql`'s seed via `validateSchema` and confirm no errors. The default-coerce path MUST handle missing `visibilityRules` cleanly or we'll silently break every existing pinned version.

---

## Common Pitfalls

### Pitfall 1: Schema-version pinning and the `visibilityRules` retroactive injection

**What goes wrong:** A template published BEFORE Phase 15 has `schema_json` entities without `visibilityRules`. When a customer loads that submission today, the renderer runs `useInterpreterStore(formBuilder, schema)` — and `formBuilder` now expects the new attribute. If `validate()` throws on missing attribute, every pre-Phase-15 submission breaks.

**Why it happens:** coltorapps doesn't auto-migrate stored schemas. The version is immutable; only the validator is new.

**How to avoid:** `visibilityRulesAttribute.validate` MUST default-coerce undefined/null to `{ rules: [], logic: "and" }` — never throw. This matches the Phase 13 RESEARCH "Pitfall 4" default-coercion pattern (already established and re-applied in `attach-photos.ts`, `computed-inputs.ts`, etc.).

**Warning signs:** "Invalid schema" errors in the interpreter; submissions that previously loaded now show a blank form; `validateSchema` rejects rows it accepted yesterday.

**Verification:** Add a Wave-0 test `tests/form-builder/visibility-rules.test.ts` that runs `validateSchema(legacySchema, formBuilder)` against a hand-crafted schema with NO `visibilityRules` on any entity. Must return `result.success === true` AND the post-validation schema must have `{ rules: [], logic: "and" }` injected on every entity.

### Pitfall 2: Save-time validation runs on Save AND Publish (not just Publish)

**What goes wrong:** Build prompt §3c says "Reject [cycles] with error message if found" at "save time", but doesn't explicitly distinguish save-draft vs. publish. CONTEXT D-08 says "at save/publish time". The implication: BOTH paths must run `validateRuleGraph`.

**Why it happens:** Draft saves currently insert a new `template_versions` row immediately (Phase 13 Pattern 4). If `validateRuleGraph` ran only at publish, a draft could be saved with a cycle, then rendered in the builder canvas — and the runtime engine would try to evaluate the cycle, potentially infinite-looping under the wrong implementation.

**How to avoid:** Insert `validateRuleGraph` immediately after `validateSchema` in BOTH `saveDraftAction` AND `publishTemplateAction` in `app/admin/templates/actions.ts` AND the customer-side counterparts in `app/client/templates/actions.ts`. Same pattern as the existing `validateSchema` call.

**Warning signs:** Builder appears to save a cyclic template but Publish then rejects it with a confusing "circular rule" message. Inconsistent reject points = bad UX.

### Pitfall 3: Orphan rule when a referenced source field is deleted

**What goes wrong:** Admin creates Field B with a rule "Show when [Field A] equals 'Yes'". Then deletes Field A. Field B's `visibilityRules.rules[0].sourceEntityId` now points to a non-existent entity.

**Why it happens:** Deleting an entity in the builder store doesn't cascade to other entities' rule references. coltorapps doesn't track inbound rule edges.

**How to avoid:** Two layers:
1. **Builder UI:** when a rule's `sourceEntityId` no longer exists in `schema.entities`, show it as an inline warning row (similar to cycle banner): `Source field deleted — rule disabled.` Provide a "Remove rule" button. Don't auto-delete.
2. **Engine:** `evaluateRule` returns `false` (rule does not fire) when `answers[sourceEntityId]` is `undefined` AND `sourceEntityId` is not in `schema.entities`. NEVER throw. NEVER block submission.
3. **Save-time validator:** include orphan refs in `scopeErrors` with `reason: "orphan-source"` (advisory severity — does NOT block save). This is a flag we may decide to harden later.

**This is the only behaviour NOT explicitly covered by CONTEXT.** Flagged for the planner to lock at plan-phase. Recommendation: advisory (don't block save) — admins routinely delete fields mid-edit and an aggressive block would interrupt their flow.

### Pitfall 4: Build-prompt §3d FRA conditional table sanity check vs. D-06 operators

I read the table at `.planning/research/form-builder-build-prompt.md` lines 360-374. All 12 rows fit the operator set:

| Row | Pattern | Operator needed | Available in D-06? |
|-----|---------|-----------------|-------------------|
| Sports Cert → details | `equals "Yes"` | equals | ✓ |
| Alterations → details | `equals "Yes"` | equals | ✓ |
| Licence → details | `equals "Yes"` | equals | ✓ |
| Fire loss → date+brief+cause+action | `equals "Yes"` | equals | ✓ |
| DSEAR → sub-section | `equals "Yes"` | equals | ✓ |
| Portable heaters → hazardous-type fields | `equals "No"` (negated yes/no) | equals | ✓ |
| Cooking → sub-questions | `notEquals "N/A"` | notEquals | ✓ |
| Lightning protection → maintenance | `equals "Yes"` | equals | ✓ |
| Other ignition sources → details | `equals "Yes"` | equals | ✓ |
| Other fire hazards → details | `equals "Yes"` | equals | ✓ |
| Section overall compliance (auto-colour) | computedField + visibility | — | needs computedField (Phase 14, already shipped) + show-when-computed-equals-X (D-02 ✓) |
| Risk matrix (Likelihood + Consequence → level) | computedField PAS 79 + visibility | — | computedField PAS 79 ships in Phase 14 ✓ |

**Verdict: every row expressible. No gaps in D-06.** The two "auto-calculated" rows (#11, #12) rely on Phase 14's computedField. Phase 15's contribution is the show-when-computed-equals-X rule (D-02).

**Caveat:** The "Cooking" row uses `notEquals "N/A"` — confirms D-10's stance ("N/A is a distinct select value"). Rule author writes the literal string.

### Pitfall 5: useMemo deps and the `visibility` recomputation

**What goes wrong:** Adding `visibility` to the `propsRef.current` means `propsRef.current.visibility` mutates on every value change. If anything in the renderer wrappers tries to memoise on `propsRef.current.visibility[entity.id]` via `useMemo([..., visibility])`, that's a useMemo dep that contains a fresh reference every render → memo invalidates every keystroke → focus loss returns.

**Why it happens:** The Phase 14-06 fix only protects the wrapper-creation `useMemo([surface])`. Any new memoisation inside individual renderer components that includes visibility-derived values is a new failure mode.

**How to avoid:** Renderers read `dynamicRequired` as a primitive boolean (not an object reference). Pass `dynamicRequired={propsRef.current.visibility[entity.id]?.required ?? false}` — booleans are referentially stable. Don't pass the whole `VisibilityState` object.

**Warning signs:** Phase 13/14 UAT focus-loss regression returns after adding visibility.

### Pitfall 6: `shouldBeProcessed` context doesn't include schema

**What goes wrong:** Per Context7, `context` in `shouldBeProcessed` is `{ entity, entitiesValues }` — NO schema reference. If our hook tries to walk the full schema (e.g., to resolve a computedField source value), it can't.

**Why it happens:** coltorapps assumes the hook is closed over the schema lexically (the user defines the entity once, and the schema-shape is implicit in `entitiesValues` keys).

**How to avoid:** In our case the hook doesn't NEED the schema for show/hide — `context.entitiesValues[r.sourceEntityId]` returns the current value of the source entity DIRECTLY (whether it's a user-input field OR a computedField — both write to `entitiesValues` via the renderer's `setValue`). For computedField sources, the renderer is responsible for keeping `entitiesValues[computedFieldId]` up to date (already implemented in Phase 14 ComputedFieldRenderer — it computes and calls `setValue` on dependency change).

**Verify:** Phase 14 ComputedFieldRenderer writes its output via `setValue`. [Confirmed: `14-06-SUMMARY.md` decision #5 — ComputedField uses propsRef.current.interpreterStore — and the Phase 14 ComputedField renderer auto-writes via `setEntityValue` on dependency change. Read computed-field-renderer.tsx in plan phase to be sure.]

### Pitfall 7: Scope resolution for repeatingSection child rule sources

**What goes wrong:** A field inside a repeatingSection instance has a rule `[siblingInInstance] equals "Poor" → require`. At eval time, the engine reads `answers[siblingInInstanceId]` — but sibling values live inside `answers[repSectionId].instances[i][siblingInInstanceId]`, NOT at top level. Engine looks up wrong key, rule never fires.

**Why it happens:** coltorapps value tree is flat at root but nested for repeatingSection instances. The default `entitiesValues` map in `shouldBeProcessed` context likely flattens differently per instance.

**How to avoid:** The `evaluateVisibilityForInstance(schema, answers, repSectionId, instanceIndex)` function (recommended in Pattern 5 above) reads sibling values from `answers[repSectionId].instances[instanceIndex][siblingId]` rather than `answers[siblingId]`. The renderer for each instance MUST call this version, not the root version.

**Open question for the planner:** does coltorapps' `entitiesValues` in `shouldBeProcessed` context inside a repeatingSection child show the per-instance map, or the root map? CONFIRM via a planner-wave spike before writing the renderer integration. Phase 14 RepeatingSectionRenderer (per 14-06) renders instance children inline — read it carefully at plan phase to confirm the value-binding mechanism.

### Pitfall 8: Cycle detection through computedField — make sure the DAG edge is in the right direction

**What goes wrong:** A computedField depends on inputs A and B. Another field C has a rule referencing the computedField. So C depends (transitively) on A and B. If A has a rule referencing C, that's a cycle: A → C → computedField ← A. Easy to miss because the edge from computedField to its inputs is "backward" in the data-flow sense.

**Why it happens:** Data flows INPUT → computedField → consumer. Rule reference flows CONSUMER → SOURCE (the consumer entity's rules name the source). The DAG must merge both directions correctly.

**How to avoid:** Build the dependency map with semantics "edge X → Y means a change to X requires re-eval of Y". Then:
- Direct rule edge: source → consumer (changes to source trigger consumer re-eval)
- Computed edge: input → computedField (changes to input trigger computedField re-eval)
The transitive closure: if input → computedField AND computedField → consumer, then input transitively → consumer. Cycle detection finds back-edges in this combined graph. Pattern 4 above implements this correctly.

**Test it:** Linear chain `A → computed → B` passes. Cycle `A → computed → A` (where A consumes computed via a rule, and A is also computed's input) fails. Both cases live in `validate-rule-graph.test.ts`.

---

## Code Examples

### Example 1: Verified `shouldBeProcessed` API shape

```typescript
// Source: Context7 /coltorapps/builder → /docs/entities/page.md
// Verbatim canonical example from coltorapps docs:
export const textFieldEntity = createEntity({
  name: "textField",
  attributes: [referenceEntityIdAttribute],
  validate(value, context) {
    return z.string().optional().parse(value);
  },
  shouldBeProcessed(context) {
    const { referenceEntityId } = context.entity.attributes;
    if (!referenceEntityId) return true;
    const referencedEntityValue = context.entitiesValues[referenceEntityId];
    return Boolean(referencedEntityValue);
  },
});
```

This is the contract Phase 15 leverages. [CITED: github.com/coltorapps/builder/docs/src/app/docs/entities/page.md]

### Example 2: Existing Phase 14 attribute pattern (template for visibility-rules.ts)

```typescript
// Source: lib/form-builder/attributes/computed-inputs.ts — closest existing analog
// (nested-object attribute with default-coerce)
export const computedInputsAttribute = createAttribute({
  name: "computedInputs",
  validate(value) {
    if (value === undefined || value === null) {
      return { likelihood: "", consequence: "" } as ComputedInputs;
    }
    if (typeof value !== "object" || Array.isArray(value)) {
      throw new Error('computedInputs must be an object with "likelihood" and "consequence" keys.');
    }
    const raw = value as Record<string, unknown>;
    return { ...raw,
      likelihood: typeof raw.likelihood === "string" ? raw.likelihood : "",
      consequence: typeof raw.consequence === "string" ? raw.consequence : "",
    } as ComputedInputs;
  },
});
```

`visibility-rules.ts` follows the same default-coerce-then-validate shape (see Pattern 2 above).

### Example 3: Submit-action insertion point (current code, with insert markers)

```typescript
// Source: app/admin/assessments/actions.ts — current submitAssessmentAction (lines 232-299)
// Phase 15 inserts between Step 3 and Step 4:

// Step 3: server-side validation — T-13-09 (UNCHANGED)
const { validateEntitiesValues } = await import("@coltorapps/builder")
const { formBuilder } = await import("@/lib/form-builder")
const result = await validateEntitiesValues(rawValues, formBuilder, version.schema_json)
if (!result.success) {
  throw new Error("Form validation failed server-side. Please check your answers and try again.")
}

// ──── PHASE 15 INSERT ─────────────────────────────────────────────────
const { evaluateVisibility } = await import("@/lib/form-builder/visibility/evaluate-visibility")
const { stripHiddenAnswers } = await import("@/lib/form-builder/visibility/strip-hidden-answers")
const visibility = evaluateVisibility(version.schema_json, result.data)
const scrubbedAnswers = stripHiddenAnswers(version.schema_json, result.data, visibility)
// ──────────────────────────────────────────────────────────────────────

// Step 4: write validated data — T-13-13 (uses SCRUBBED answers)
const { error: updateError } = await adminClient
  .from("form_submissions")
  .update({
    answers_json: scrubbedAnswers,    // ← changed from result.data to scrubbedAnswers
    status: "submitted",
    submitted_at: new Date().toISOString(),
  })
  .eq("id", submissionId)
  .eq("status", "draft")
```

### Example 4: builder save-action insertion point

```typescript
// Source: pattern from Phase 13 13-PATTERNS.md saveDraftAction (current actions.ts)
// Phase 15 inserts between validateSchema and INSERT:

// 2. Server-side schema validation — UNCHANGED
const { validateSchema } = await import("@coltorapps/builder")
const { formBuilder } = await import("@/lib/form-builder")
const result = await validateSchema(rawSchema, formBuilder)
if (!result.success) throw new Error(`Invalid schema: ${result.reason.code}`)

// ──── PHASE 15 INSERT ─────────────────────────────────────────────────
const { validateRuleGraph } = await import("@/lib/form-builder/visibility/validate-rule-graph")
const graphResult = validateRuleGraph(result.data)
if (!graphResult.ok) {
  throw new Error(JSON.stringify({
    kind: "RuleGraphInvalid",
    cycles: graphResult.cycles.map(c => ({ entityIds: c.path, labels: c.labels })),
    scopeErrors: graphResult.scopeErrors,
  }))
}
// ──────────────────────────────────────────────────────────────────────

// 3. Insert new immutable version row — UNCHANGED
await supabase.from("template_versions").insert({ /* ... */ })
```

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 3.0 (unit + .tsx via renderToStaticMarkup) + Playwright 1.51 (e2e) |
| Config file | `vitest.config.ts` (exists since Phase 14-06); `playwright.config.ts` |
| Quick run command | `npx vitest run tests/form-builder/` |
| Full suite command | `npx vitest run && npx playwright test` |

[VERIFIED: existing test directories listed in §Recommended Project Structure; Phase 14-06 added vitest.config.ts]

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| COND-01 | Admin can define `[Field] equals "Yes" → show` rule | unit | `npx vitest run tests/form-builder/visibility-rules.test.ts` | ❌ Wave 0 |
| COND-01 | Rule with every operator × source-type evaluates correctly | unit | `npx vitest run tests/form-builder/evaluate-rule.test.ts` | ❌ Wave 0 |
| COND-01 | AND/OR combination + hide-wins-over-show | unit | `npx vitest run tests/form-builder/combine-rules.test.ts` | ❌ Wave 0 |
| COND-01 | sectionGroup/repeatingSection hidden cascades to children | unit | `npx vitest run tests/form-builder/cascade-visibility.test.ts` | ❌ Wave 0 |
| COND-01 | Integration: evaluateVisibility produces correct full state | unit | `npx vitest run tests/form-builder/evaluate-visibility.test.ts` | ❌ Wave 0 |
| COND-02 | Dynamic required: rule fires → required true; rule unfires → required false (unless static) | unit | (covered by `evaluate-visibility.test.ts`) | ❌ Wave 0 |
| COND-02 | Hidden trumps required — hidden field never required | unit | (covered by `cascade-visibility.test.ts`) | ❌ Wave 0 |
| COND-03 | Linear rule chain A→B→C passes cycle check | unit | `npx vitest run tests/form-builder/validate-rule-graph.test.ts` | ❌ Wave 0 |
| COND-03 | Direct cycle A→B→A rejected | unit | (same file) | ❌ Wave 0 |
| COND-03 | Computed-mediated cycle A→computed→A rejected (D-02) | unit | (same file) | ❌ Wave 0 |
| COND-03 | Same-scope rule passes; ancestor-scope passes (root → root, instance → root) | unit | (same file) | ❌ Wave 0 |
| COND-03 | Cross-instance rule rejected with scopeError reason="cross-instance" | unit | (same file) | ❌ Wave 0 |
| COND-03 | Root → inside-repeating rejected with reason="root-references-inside-repeating" | unit | (same file) | ❌ Wave 0 |
| COND-03 | `saveDraftAction` rejects cyclic schema with JSON-parseable error | integration | `npx vitest run tests/form-builder/save-draft.test.ts` (extend) | exists |
| COND-04 | Renderer hides field when source value changes to trigger hide rule | renderer | `npx vitest run tests/form-interpreter/visibility.test.tsx` | ❌ Wave 0 |
| COND-04 | Renderer keeps focus across hide/show flip on neighbouring field | renderer | (same file) | ❌ Wave 0 |
| COND-04 | Select stays controlled when source flips between defined and undefined | renderer | (same file) | ❌ Wave 0 |
| COND-04 | Server stripHiddenAnswers omits hidden field, hidden parent cascade, hidden repeating instance | unit | `npx vitest run tests/form-builder/strip-hidden-answers.test.ts` | ❌ Wave 0 |
| COND-04 | computeFormProgress excludes hidden fields from numerator+denominator (D-07: hidden trumps required) | unit | `npx vitest run tests/form-builder/progress.test.ts` (extend) | exists |
| BUILDER-02 | PropertiesPanel shows ConditionalLogicSection at bottom; collapsed by default; badge (N) when N>0 | renderer | (extend `tests/form-interpreter/renderers.test.tsx` or new builder test) | partial |
| Smoke (PAS 79) | E2E: build template with computedField=risk + textField=mitigation visible-when-risk-equals-Intolerable; fill in likelihood+consequence to trigger Intolerable; mitigation appears; submit; server scrub keeps mitigation | e2e | `npx playwright test tests/e2e/phase15-smoke.spec.ts` | ❌ Wave 4 |
| Smoke (FRA doors) | E2E: build repeatingSection door template with conditional "repair urgency requires door condition = Poor"; fill 2 instances; verify per-instance visibility | e2e | (same file) | ❌ Wave 4 |

### Sampling Rate

- **Per task commit:** `npx vitest run tests/form-builder/visibility/` (or per-feature pattern)
- **Per wave merge:** `npx vitest run` (all Vitest)
- **Phase gate:** Full suite green (`npx vitest run && npx playwright test`) before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/form-builder/visibility-rules.test.ts` — visibilityRulesAttribute default-coerce + shape validation
- [ ] `tests/form-builder/evaluate-rule.test.ts` — operator × source-type matrix (~30 cases)
- [ ] `tests/form-builder/combine-rules.test.ts` — AND/OR + hide-wins-over-show
- [ ] `tests/form-builder/cascade-visibility.test.ts` — parent cascade rules
- [ ] `tests/form-builder/evaluate-visibility.test.ts` — integration of the above three
- [ ] `tests/form-builder/dependency-map.test.ts` — direct + computed edge construction
- [ ] `tests/form-builder/validate-rule-graph.test.ts` — cycle detection (linear pass, direct cycle, computed cycle) + scope (cross-instance reject, root-refs-inside-repeating reject, ancestor pass)
- [ ] `tests/form-builder/scope.test.ts` — resolveScope for root/sectionGroup-child/repeatingSection-child
- [ ] `tests/form-builder/strip-hidden-answers.test.ts` — hidden field stripped, cascade, repeating-instance scrub, hidden-but-required silently dropped
- [ ] `tests/form-interpreter/visibility.test.tsx` — renderer visibility subscriber: hide/show DOM toggle, focus retention, Select controlled across source flip
- [ ] Extend `tests/form-builder/progress.test.ts` — hidden fields excluded from numerator+denominator
- [ ] Extend `tests/form-builder/save-draft.test.ts` — cyclic schema rejected with parseable error
- [ ] `tests/e2e/phase15-smoke.spec.ts` — PAS 79 + FRA-doors end-to-end (Wave 4)
- [ ] Backward-compat assertion in `validate-schema.test.ts` — load Phase 14 seed `011_specialty_smoke_test_template.sql` schema through validateSchema; every entity gains `visibilityRules: { rules: [], logic: "and" }` post-validation

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No — existing auth unchanged | — |
| V3 Session Management | No | — |
| V4 Access Control | Yes | `requireActorUserId("admin")` in template save/publish + assessment submit (existing). Customer-side template actions guard via `requireClientContext()` (existing pattern). |
| V5 Input Validation | YES — primary surface | `visibilityRulesAttribute.validate` + `validateRuleGraph` server-side. Both run BEFORE INSERT. Cycle detection prevents resource exhaustion at render time. |
| V6 Cryptography | No | — |
| V8 Data Protection | YES | `stripHiddenAnswers` ensures hidden subtree NEVER lands in `answers_json` — eliminates an information-leakage class where a hidden field's value would otherwise be retrievable via direct DB read or via the AI prompt context. |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Client crafts a schema with a circular rule chain to trigger infinite-loop in interpreter | DoS | `validateRuleGraph` server-side in `saveDraftAction` + `publishTemplateAction` rejects before INSERT. Even if a malicious client bypasses, coltorapps `shouldBeProcessed` is bounded (it doesn't itself recurse — we evaluate per entity from a flat list) so the worst case is O(rules) re-evaluation, not infinite loop. |
| Client submits answers for a hidden field, expecting it to land in `answers_json` (data leak via AI prompt or DB read) | Information Disclosure | `stripHiddenAnswers` runs server-side after validateEntitiesValues. The hidden field never reaches `answers_json`. |
| Client crafts a rule with `sourceEntityId` pointing to an entity in another template's schema (cross-tenant ref) | Tampering / Info Disclosure | `validateRuleGraph` only sees the current template's schema; any `sourceEntityId` not in `schema.entities` is rejected as orphan (Pitfall 3) at engine eval (returns false). DB-level: even if injected, the interpreter runs against the pinned schema's entities map only — no cross-template data path exists. |
| Client crafts malformed rule shape (e.g., operator: "rm -rf /", action: "<script>") | Injection | `visibilityRulesAttribute.validate` whitelists operators and actions (Pattern 2). Throws on unknown values. coltorapps `validateSchema` runs validate on every attribute server-side. |
| Admin builds a template with a `require` rule that conditionally requires a field never visible in any state (always required + always hidden) | Logic flaw (UX, not security) | Hidden trumps require (D-07) — engine handles correctly; user submits successfully. Surface as builder-side warning if planner wants UX polish (deferred). |
| Customer (via Phase 16+ template-builder access) creates rules referencing fields outside their org's templates | Cross-tenant info disclosure | Phase 16 owns the multi-tenant ownership scope. Phase 15's `validateRuleGraph` operates only within a single template's schema — no cross-template references possible by construction. |

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `@coltorapps/builder` | shouldBeProcessed hook + validateSchema | ✓ | 0.2.4 | — |
| `@coltorapps/builder-react` | InterpreterEntities (auto-honours shouldBeProcessed) | ✓ | 0.2.4 | — |
| `lucide-react` | GitFork / ChevronRight / Trash2 / AlertTriangle icons (UI-SPEC) | ✓ | already installed | — |
| `sonner` | toast.error for cycle banner | ✓ | already installed | — |
| Vitest | unit tests | ✓ | 3.0 | — |
| Playwright | e2e smoke (Wave 4) | ✓ | 1.51 | — |
| Supabase (local + remote) | migration 012 (smoke-test template), template_versions rows | ✓ | — | — |
| Next.js 16.2.4 | App Router server actions | ✓ | 16.2.4 | — |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** None.

No new packages required. Entire phase is pure-TypeScript + extends existing coltorapps integration.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | coltorapps `shouldBeProcessed` skips both render AND validation for entities returning false, recursively for children. | Pattern 1, Anti-Patterns | If validation still runs on a hidden field, required-but-hidden field would block submission — breaks D-07. Mitigated by Wave-1 spike: a test schema with `shouldBeProcessed=false` on a required field; `validateEntitiesValues` must return success. [VERIFIED via Context7 docs prose; spike confirms behaviour] |
| A2 | `context.entitiesValues` in `shouldBeProcessed` reflects the latest setEntityValue result synchronously (no batching delay). | Pattern 1 | If batched, rules might evaluate against stale values for one render. Mitigation: a spike test that updates a source and asserts the dependent's shouldBeProcessed sees the new value in the same render cycle. |
| A3 | `entitiesValues` inside a repeatingSection child's `shouldBeProcessed` exposes the per-instance value (sibling values from the same instance) — not the root values map. | Pitfall 7 | If wrong, in-instance rules silently fail to fire. **MUST verify via planner-wave spike (read RepeatingSectionRenderer code in plan-phase).** This is the single most important uncertainty in the research. |
| A4 | Existing pre-Phase-15 `template_versions.schema_json` rows pass through `validateSchema` cleanly once `visibilityRulesAttribute` is registered (default-coerce returns `{rules:[], logic:"and"}` for undefined). | Pitfall 1 | Pre-existing submissions break on render. Mitigation: backward-compat assertion test in Wave 0 (already listed in Validation Architecture). |
| A5 | `validateRuleGraph` running on Save Draft (not just Publish) is the desired UX. CONTEXT D-08 says "save/publish time"; build prompt §3c says "save time". | Pitfall 2 | If only Publish should validate, save-draft errors will be surprising. Locked decision needed — recommend BOTH paths validate. |
| A6 | Orphan-rule handling (rule source field deleted) is advisory, not blocking. | Pitfall 3 | If user-facing surprise: a save proceeds with dead rules and no warning. Recommend planner explicitly choose at plan-phase. Engine MUST handle (return false, never throw) regardless. |
| A7 | computedField never accepts `action: 'require'` as a host (it has no requiredAttribute and isn't in computeFormProgress's required set). UI must filter the action dropdown when host=computedField. | Pattern 3, Anti-Patterns | If a require rule lands on a computedField in DB, engine treats as no-op (the computedField is never in required-set anyway, per `computed-field.ts` JSDoc). UI-side prevention is cosmetic, not security. |

**Risk classification:** A1, A4 are LOW (well-supported by docs + existing pattern). A2 is LOW (typical reactive store contract). A3 is the single MEDIUM risk; needs spike. A5, A6 need a final user-facing decision; recommend defaults captured here.

---

## Open Questions (RESOLVED)

1. **Per-instance `entitiesValues` shape in `shouldBeProcessed` for repeatingSection children**
   - What we know: coltorapps `shouldBeProcessed(context)` has `context.entitiesValues` flat at root. Phase 14 RepeatingSection renders children inline per instance.
   - What's unclear (was): when the hook fires for a child INSIDE a specific instance, does `entitiesValues` include sibling values keyed by child entity ID (the "per-instance view") or only root values?
   - **RESOLVED (root-only, NOT per-instance):** Verified by reading `components/form-interpreter/repeating-section-renderer.tsx` lines 22-25 + 328-334 and `node_modules/@coltorapps/builder/dist/index.d.ts` lines 223-247 + 410-413. Repeating-section instance children are NOT registered as coltorapps entities at all (RepeatingSection JSDoc lines 22-25: "Children inside an instance are NOT coltorapps entities — they are template IDs in schema.entities[repeatingSectionId].children. Their values live inside instances[index][childEntityId], NOT in the interpreter store directly."). The only entry written to the interpreter store for the repSection is `{instances: [...]}` keyed by the repSection's own entity ID (line 333: `setValue({ instances: newInstances })`). Therefore `context.entitiesValues` inside ANY `shouldBeProcessed` invocation is always the root-only flat map — `entitiesValues[siblingChildId]` is `undefined` for repeating-section template children; only `entitiesValues[repSectionId].instances[i][siblingChildId]` exists. **Engine implication for evaluateRule resolving `r.sourceEntityId`:** `makeShouldBeProcessed` works as-is for root↔root and ancestor (root) refs. For same-instance sibling refs inside a repeatingSection, the hook cannot resolve from `entitiesValues` alone — but this is moot because instance children aren't coltorapps entities, so `shouldBeProcessed` is NEVER called for them by coltorapps anyway. Per-instance visibility for instance children is owned entirely by `RepeatingSectionRenderer` via Plan 15-04's bridge: the renderer threads a synthetic per-instance answers map into `evaluateVisibilityForInstance` and short-circuits child render based on its output. **Conclusion:** no `shouldBeProcessed` branching needed; `evaluateVisibilityForInstance` (plan 15-02) + renderer bridge (plan 15-04) is the single design.

2. **Orphan-rule strictness at save time (Pitfall 3 + A6)**
   - What we know: a rule's source can be deleted, leaving the rule pointing into space.
   - **RESOLVED:** advisory, NOT save-blocking. `validateRuleGraph` (plan 15-03) emits `scopeErrors` entries with `reason: "orphan-source"` and `severity: "advisory"`; `ok` remains `true`. Engine `evaluateRule` (plan 15-02) returns `false` for unknown source keys — never throws. Builder UI (plan 15-07) renders advisory entries in the inline banner with copy "Source field deleted: [sourceLabel] — Remove this rule or pick a new source."

3. **Wave order for `validate-rule-graph` consumers (admin + customer side)**
   - What we know: both `app/admin/templates/actions.ts` and `app/client/templates/actions.ts` have a saveDraftAction.
   - **RESOLVED: yes — validateRuleGraph runs in all 4 actions: admin save, admin publish, client save, client publish. Asymmetric validation = exploit per Pitfall 2.** Plan 15-05 Task 2 wires the guard into `saveDraftAction`, `publishTemplateAction`, `saveClientDraftAction`, and `publishClientTemplateAction`; acceptance criteria counts `grep -c "validateRuleGraph(result.data)"` returning 2 per file (4 total). No surface-asymmetric path exists.

4. **Whether the optional pre-flight client-side `validateRuleGraph` adds value or is just duplication**
   - **RESOLVED:** ship server-side only in Phase 15. Plan 15-05 enforces server-side; plan 15-07 surfaces the structured error to the builder UI via a Sonner toast + inline `CycleErrorBanner`. Client-side preflight is explicitly deferred — reduces surface and avoids drift between two validators.

---

## Project Constraints (from CLAUDE.md / AGENTS.md)

1. **"This is NOT the Next.js you know"** — Phase 15 doesn't touch Next.js APIs heavily, but the server actions DO use the Next 16 patterns already in place (`await params`, `revalidatePath`, etc.). All new server actions follow the existing `submitAssessmentAction` / `saveDraftAction` shape — no new Next API surface.

2. **Form-template ownership (Option 3, Matt + customer):** The conditional-logic builder UI MUST be reusable on both admin (dark) and customer (cream) surfaces. UI-SPEC §"Dual-surface design" already encodes this: `ConditionalLogicSection`, `RuleRow`, `CycleErrorBanner` all accept and forward the `surface` prop. The validate-rule-graph + strip-hidden-answers server-side changes apply identically to `app/admin/templates/actions.ts` AND `app/client/templates/actions.ts` AND `app/admin/assessments/actions.ts`. Forgetting one surface = security hole.

3. **No mocks, no auth bypass, no fake data:** The smoke-test template (Wave 4 migration 012) follows the `011_specialty_smoke_test_template.sql` pattern — real CTE inserts with `gen_random_uuid()`, real seed values. No hardcoded fixtures shipped in `lib/`.

4. **`owner_type IN ('admin', 'customer')`** — Phase 15 doesn't touch ownership semantics. Carry-forward from Phase 13.

5. **AGENTS.md form-builder must not be hardcoded admin-only** — `ConditionalLogicSection` accepts `surface` and reads `surfaceTokens` per UI-SPEC. No `if (isAdmin)` branches in the component layer.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hand-rolled per-renderer subscription to dependency map | coltorapps `shouldBeProcessed` hook (Context7-verified) | This phase | Skip render+validation natively; preserves Phase 14-06 focus-loss fix; ~50% less code than custom subscription |
| Cycle detection via Tarjan SCC | 3-colour DFS with stack-slice path extraction | This phase | Same correctness; trivially extracts cycle path for UI; matches the "name the entities in the cycle" UI requirement |
| Strip hidden answers client-side before submit | Strip server-side in `submitAssessmentAction` | This phase | Defends against client tampering (T-13-09 carry-forward principle: never trust client) |

**Deprecated/outdated:** Nothing existing is deprecated. Pure extension.

---

## Sources

### Primary (HIGH confidence)
- Context7 `/coltorapps/builder` — `createEntity` API, `shouldBeProcessed` example with `referenceEntityId` (canonical conditional-visibility pattern), `entitiesExtensions` shape (confirms `shouldBeProcessed` is NOT extensible at builder level), `context` object shape `{ entity, entitiesValues }`
- npm registry — `@coltorapps/builder@0.2.4`, last published 2025-07-09 (no newer release as of 2026-05-26)
- `.planning/phases/15-conditional-logic-engine/15-CONTEXT.md` — D-01..D-10 (canonical decisions)
- `.planning/phases/15-conditional-logic-engine/15-UI-SPEC.md` — UI contract
- `.planning/research/form-builder-build-prompt.md` lines 305-396 — Phase 3 spec of record + FRA conditional table
- `.planning/phases/13-form-builder-foundation/13-RESEARCH.md` — Phase 13 patterns + Pitfall 4 (default-coerce attribute)
- `.planning/phases/14-custom-field-types/14-02-SUMMARY.md` — 13-entity formBuilder registration; repeatingSection {instances:[]} contract
- `.planning/phases/14-custom-field-types/14-06-SUMMARY.md` — propsRef pattern + Phase 13-04 UAT focus-loss fix
- `lib/form-builder/attributes/computed-inputs.ts`, `attach-photos.ts` — verified default-coerce attribute pattern
- `lib/form-builder/entities/computed-field.ts` — confirms `computedField` has no `requiredAttribute` (never in required set)
- `lib/form-builder/entities/repeating-section.ts` — confirms `{instances:[...]}` value shape + childrenAllowed
- `app/admin/assessments/actions.ts` lines 232-299 — `submitAssessmentAction` insert point for `stripHiddenAnswers`
- `lib/form-builder/progress.ts` — `computeFormProgress` extension point
- `components/form-interpreter/interpreter-renderer.tsx` lines 105-158 — `propsRef` pattern + `[surface]` useMemo deps invariant

### Secondary (MEDIUM confidence)
- `.planning/REQUIREMENTS.md` lines 169-179 — COND-01..04 + BUILDER-02 (verbatim re-quote in `<phase_requirements>` above)
- `.planning/ROADMAP.md` Phase 15 entry — 5 success criteria
- `.planning/phases/13-form-builder-foundation/13-PATTERNS.md` — file/pattern map for saveDraftAction

### Tertiary (LOW confidence)
- A3 (per-instance `entitiesValues` shape in repeatingSection children) — inferred from Phase 14 architecture; NOT confirmed by docs. Spike required at planner wave 1.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; coltorapps version pinned and verified
- Architecture (shouldBeProcessed integration): HIGH — Context7 doc canonical example matches our use case 1:1
- Cycle detection algorithm: HIGH — standard 3-colour DFS, well-understood
- Per-instance scope resolution: MEDIUM (A3) — needs planner-wave spike
- UI integration: HIGH — UI-SPEC is canonical and component map is explicit
- Pitfalls: HIGH — derived from reading Phase 13/14 carry-forward + Context7 quirks

**Research date:** 2026-05-26
**Valid until:** 2026-06-25 (stable library; if `@coltorapps/builder` ships a non-canary 0.3.x or 1.0.0, revisit `shouldBeProcessed` context shape)
