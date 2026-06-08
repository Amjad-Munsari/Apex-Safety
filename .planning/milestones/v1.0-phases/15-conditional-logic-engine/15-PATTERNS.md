# Phase 15: Conditional Logic Engine — Pattern Map

**Mapped:** 2026-05-26
**Files analyzed:** ~35 new/modified
**Analogs found:** 32 / 35 (3 with no direct analog — flagged in §No Analog Found)

Inputs read: `15-CONTEXT.md`, `15-RESEARCH.md` (all 1235 lines), `15-UI-SPEC.md`, `13-PATTERNS.md`, `14-CONTEXT.md`; source files: `lib/form-builder/index.ts`, `lib/form-builder/progress.ts`, all 13 entity files (text-field, section-group, repeating-section, computed-field representatively), `lib/form-builder/attributes/{computed-inputs,attach-photos}.ts`, `components/form-builder/properties-panel.tsx` (head + structure), `components/form-interpreter/interpreter-renderer.tsx` (full), `app/admin/templates/actions.ts` (full), `app/client/templates/actions.ts` (full), `app/admin/assessments/actions.ts` (submit slice), three test files for the test pattern, migration 011 head.

---

## File Classification

### NEW Files (16)

| File | Role | Data Flow | Closest Analog | Match |
|------|------|-----------|----------------|-------|
| `lib/form-builder/attributes/visibility-rules.ts` | attribute (factory) | transform (pure validate) | `lib/form-builder/attributes/computed-inputs.ts` | exact (nested-object attr with default-coerce) |
| `lib/form-builder/visibility/types.ts` | util (types) | transform | none — pure type defs | n/a |
| `lib/form-builder/visibility/evaluate-rule.ts` | util (pure logic) | transform | `lib/form-builder/risk/pas79.ts` (pure formula module) | role-match |
| `lib/form-builder/visibility/combine-rules.ts` | util (pure logic) | transform | `lib/form-builder/risk/pas79.ts` | role-match |
| `lib/form-builder/visibility/cascade-visibility.ts` | util (pure logic, schema walker) | transform | `lib/form-builder/progress.ts` `computeFormProgress` (schema walker) | role-match |
| `lib/form-builder/visibility/evaluate-visibility.ts` | util (orchestrator) | transform | `lib/form-builder/progress.ts` | role-match |
| `lib/form-builder/visibility/dependency-map.ts` | util (graph build) | transform | none — first graph-building utility in repo | partial (progress.ts iterates schema.entities the same way) |
| `lib/form-builder/visibility/validate-rule-graph.ts` | util (DAG validator) | transform | none — first DAG validator | partial |
| `lib/form-builder/visibility/scope.ts` | util (schema walker) | transform | `lib/form-builder/progress.ts` `repeatingSectionChildIds` traversal | role-match |
| `lib/form-builder/visibility/strip-hidden-answers.ts` | server-side scrub (pure) | transform | none — first answer-tree scrubber | partial |
| `lib/form-builder/visibility/should-be-processed.ts` | renderer integration hook (shared body) | transform | none — first `shouldBeProcessed` body in repo (verified via Context7) | partial |
| `components/form-builder/conditional-logic-section.tsx` | builder UI (collapsible block) | event-driven | `components/form-builder/properties-panel.tsx` `OptionsEditor` + entity-attribute wiring | role-match (same surface tokens, same setEntityAttribute path) |
| `components/form-builder/rule-row.tsx` | builder UI (sub-component) | event-driven | `OptionsEditor` row pattern (`properties-panel.tsx` lines 165–211) | role-match |
| `components/form-builder/cycle-error-banner.tsx` | builder UI (warning block) | request-response | none — first inline banner of this kind | partial (lucide `AlertTriangle` + surface tokens shared with rest of properties-panel) |
| `supabase/migrations/012_phase15_conditional_smoke_test.sql` | migration / smoke-template SQL | batch | `supabase/migrations/011_specialty_smoke_test_template.sql` | exact (DO block + `gen_random_uuid()` CTE pattern) |
| Tests (12 — see §Test Files below) | test (Vitest unit + tsx) | transform | `tests/form-builder/attributes.test.ts`, `tests/form-builder/save-draft.test.ts`, `tests/form-interpreter/renderers.test.tsx` | exact |

### MODIFIED Files (16)

| File | Role | Modification | Analog for the Mod |
|------|------|--------------|--------------------|
| `lib/form-builder/entities/text-field.ts` | entity config | + `visibilityRulesAttribute` in attrs[]; + `shouldBeProcessed: makeShouldBeProcessed()` | self — pattern Phase 14 used to add `attachPhotosAttribute` |
| `lib/form-builder/entities/number-field.ts` | entity config | same | same |
| `lib/form-builder/entities/date-field.ts` | entity config | same | same |
| `lib/form-builder/entities/select-field.ts` | entity config | same | same |
| `lib/form-builder/entities/textarea-field.ts` | entity config | same | same |
| `lib/form-builder/entities/checkbox-field.ts` | entity config | same | same |
| `lib/form-builder/entities/section-group.ts` | entity config (container) | same — engine-uniform; UI hides editor for containers | same |
| `lib/form-builder/entities/signature-field.ts` | entity config | same | same |
| `lib/form-builder/entities/rating-field.ts` | entity config | same | same |
| `lib/form-builder/entities/multi-photo-field.ts` | entity config | same | same |
| `lib/form-builder/entities/geolocation-field.ts` | entity config | same | same |
| `lib/form-builder/entities/computed-field.ts` | entity config (read-only) | same — UI filters `require` from action dropdown when host is `computedField` | same |
| `lib/form-builder/entities/repeating-section.ts` | entity config (container) | same — engine-uniform; UI hides editor | same |
| `lib/form-builder/progress.ts` | util | + optional `visibility` param; drop hidden ids from required set; prefer dynamic `visibility[id].required` over static `attrs.required` | self (extension contract documented in RESEARCH Pattern 8) |
| `components/form-builder/properties-panel.tsx` | builder UI host | append `<ConditionalLogicSection />` after existing editors; hide for `sectionGroup` / `repeatingSection` | self |
| `components/form-interpreter/interpreter-renderer.tsx` | renderer integration | extend `propsRef` to include `visibility`; thread primitive `dynamicRequired` into each renderer wrapper; **keep `useMemo` deps = `[surface]`** | self (lines 105–158 — Phase 14-06 propsRef pattern) |
| `app/admin/templates/actions.ts` | server action | call `validateRuleGraph(result.data)` after `validateSchema` in both `saveDraftAction` and `publishTemplateAction` | self (lines 41–80, 85–132) |
| `app/client/templates/actions.ts` | server action | mirror change in `saveClientDraftAction` and `publishClientTemplateAction` | self (lines 67–108, 112–158) |
| `app/admin/assessments/actions.ts` | server action | insert `evaluateVisibility` + `stripHiddenAnswers` between Step 3 validation and Step 4 update; write `scrubbedAnswers` instead of `result.data` | self (lines 232–299 — `submitAssessmentAction`) |

`lib/form-builder/index.ts` — **likely NO change required.** Entities self-register their `shouldBeProcessed` hook and new attribute via their own files; the `createBuilder({ entities: [...] })` call only needs the entity refs (already present). Confirmed by reading lines 1–38: `formBuilder` simply lists the entity exports. Confirm at plan-phase that no separate "shared attribute registration" call is needed (Phase 14 added attributes the same way).

---

## Pattern Assignments

### `lib/form-builder/attributes/visibility-rules.ts` (NEW — attribute factory)

**Analog:** `lib/form-builder/attributes/computed-inputs.ts` — verified above as the closest existing nested-object attribute with default-coerce.

**Default-coerce shape — copy this exact structure** (`lib/form-builder/attributes/computed-inputs.ts` lines 14–32):
```typescript
export const computedInputsAttribute = createAttribute({
  name: "computedInputs",
  validate(value) {
    if (value === undefined || value === null) {
      return { likelihood: "", consequence: "" } as ComputedInputs;   // ← default
    }
    if (typeof value !== "object" || Array.isArray(value)) {
      throw new Error('computedInputs must be an object with "likelihood" and "consequence" keys.');
    }
    const raw = value as Record<string, unknown>;
    return {
      ...raw,
      likelihood: typeof raw.likelihood === "string" ? raw.likelihood : "",
      consequence: typeof raw.consequence === "string" ? raw.consequence : "",
    } as ComputedInputs;
  },
});
```

**Apply to visibility-rules:**
- `name: "visibilityRules"`
- Default shape: `{ rules: [], logic: "and" }` (D-05)
- Throw on non-object / array root (matches `computed-inputs.ts` line 20–22)
- Per-rule validation: whitelist `operator` against the 7 D-06 values; whitelist `action` against the 3 D-07 values; require `sourceEntityId` is a non-empty string. Throw with `Rule #${i}: …` for indexed clarity.
- Full code skeleton in `15-RESEARCH.md` §Pattern 2 lines 358–414 — verbatim baseline.

**Pitfall enforcement (RESEARCH Pitfall 1):** `undefined` → default. NEVER throw on missing — pre-Phase-15 `template_versions.schema_json` rows must validate cleanly through this attribute.

---

### `lib/form-builder/visibility/should-be-processed.ts` (NEW — shared renderer-integration hook body)

**Analog:** None in repo. Closest reference is Context7's canonical `referenceEntityId` example (RESEARCH §Code Examples lines 910–928) — verbatim coltorapps `shouldBeProcessed` shape.

**Contract:**
- Returns a function that coltorapps calls with `{ entity, entitiesValues }` on every interpreter store value change.
- Reads `entity.attributes.visibilityRules` (which is always present and default-coerced thanks to the attribute factory).
- For show/hide rules: evaluate each, combine per `logic`, hide wins (D-07).
- For `require`-only rules: return `true` (visibility unaffected; required handled separately via `evaluateVisibility().required`).
- NEVER throws. NEVER recurses into schema. Schema-wide eval lives in `evaluate-visibility.ts`.

**Reference body:** `15-RESEARCH.md` §Pattern 1 lines 321–346.

**Pitfall 6 (`shouldBeProcessed` has no schema):** the hook only needs `entitiesValues[r.sourceEntityId]` — computedField sources write to `entitiesValues` via Phase 14's `ComputedFieldRenderer` `setValue`. Confirmed by reading `interpreter-renderer.tsx` line 151–152 (computedField wrapper) + RESEARCH Assumption A1.

**Pitfall 7 (per-instance scope inside repeatingSection):** open question A3. Plan-phase spike required. Pattern 5 of RESEARCH recommends a separate `evaluateVisibilityForInstance` helper consumed by `repeating-section-renderer.tsx` and `strip-hidden-answers.ts`.

---

### `lib/form-builder/visibility/evaluate-rule.ts` + `combine-rules.ts` + `cascade-visibility.ts` + `evaluate-visibility.ts` (NEW — pure logic bundle)

**Analog:** `lib/form-builder/risk/pas79.ts` (pure-function module, no I/O, tested in isolation) and `lib/form-builder/progress.ts` (schema walker iterating `Object.entries(schema.entities)`).

**Schema-walking pattern to copy** (`lib/form-builder/progress.ts` lines 130–137):
```typescript
const repeatingSectionChildIds = new Set<string>();
for (const entity of Object.values(schema.entities)) {
  if (entity.type === "repeatingSection" && Array.isArray(entity.children)) {
    for (const childId of entity.children) {
      repeatingSectionChildIds.add(childId);
    }
  }
}
```
This is the exact iteration shape `cascade-visibility.ts` will use to walk parents → children.

**`ProgressSchema` minimal-shape pattern** (`lib/form-builder/progress.ts` lines 23–33) — copy verbatim for the visibility module's schema type:
```typescript
type ProgressSchema = {
  entities: Record<
    string,
    {
      type?: string;
      attributes?: Record<string, unknown>;
      children?: string[];
    }
  >;
};
```
Use the SAME minimal shape (not `FormBuilderSchema`) so the module stays trivially testable with hand-built schemas.

**Operator evaluation:** RESEARCH §Pattern 5 lines 580–622 has the full skeleton. The seven operators per D-06; "isEmpty" / "isNotEmpty" must handle `undefined`, `null`, `""`, `[]`, `{instances:[]}` (empty repeating-section value).

**Pitfall 4 sanity check:** `notEquals "N/A"` is a real FRA pattern — confirmed against build-prompt table by RESEARCH Pitfall 4. The engine must treat operator values as literal strings (no special-casing).

---

### `lib/form-builder/visibility/dependency-map.ts` + `validate-rule-graph.ts` (NEW — DAG graph + cycle detector)

**Analog:** None directly. Closest is `lib/form-builder/progress.ts` for the entity-iteration pattern. Algorithm is the standard 3-colour DFS.

**Full reference algorithm:** `15-RESEARCH.md` §Pattern 4 lines 454–576.

**Two edge classes (D-02, Pitfall 8):**
- `direct`: `Map<sourceEntityId, Set<dependentEntityId>>` — built from each entity's `visibilityRules.rules[].sourceEntityId`.
- `computedInputs`: `Map<computedFieldId, Set<inputEntityId>>` — built from each `computedField` entity's `attributes.computedInputs`. Direction matters: "edge X→Y means a change to X requires re-eval of Y", so the traversal must follow `input → computedField` (not the reverse).

**Scope-error contract (D-03):**
- `cross-instance` — consumer is inside repeating-section instance N, source is inside same repeating-section instance M (M≠N) or instance-bound at all when consumer is at root.
- `root-references-inside-repeating` — root field's rule names a sourceEntityId that lives inside any `repeatingSection`.
- `orphan-source` (Pitfall 3) — advisory, NOT save-blocking. Engine returns `false` for orphaned rules at runtime; validator emits a warning entry.

**Wire-format for errors** — JSON.stringify the structured payload exactly as RESEARCH §Pattern 4 lines 563–572. Builder UI (`cycle-error-banner.tsx`) JSON.parses; Sonner toast title is `"Circular rule detected"` per UI-SPEC.

---

### `lib/form-builder/visibility/strip-hidden-answers.ts` (NEW — server-side scrub)

**Analog:** None. Closest is the existing `expandRepeatingSections` (referenced by `app/admin/assessments/actions.ts` lines 306–410 — same nested-instance traversal style).

**Reference implementation:** `15-RESEARCH.md` §Pattern 7 lines 672–702.

**Critical contract (D-01):**
- Input: `(schema, answers, visibility)` — all three from already-validated server-side data.
- Walk top-level `answers`; drop entire key if `visibility[id].visible === false`.
- For `repeatingSection`: per-instance scrub. Each instance gets its own visibility eval (`evaluateVisibilityForInstance`) before its children are scrubbed.
- Never throws. Unknown keys (orphaned from old schemas) silently drop — Phase 14 already has the same pattern for unknown answer keys.

---

### `lib/form-builder/entities/*.ts` (MODIFY — all 13 entities)

**Analog:** Self — Phase 14 added `attachPhotosAttribute` to every non-section entity using exactly this two-step pattern.

**Pattern to apply** (compare `lib/form-builder/entities/text-field.ts` lines 1–32 — BEFORE Phase 14 vs AFTER):
```typescript
// BEFORE Phase 15:
import { createEntity } from "@coltorapps/builder";
import { labelAttribute } from "../attributes/label";
// ... other attribute imports ...
import { attachPhotosAttribute } from "../attributes/attach-photos";

export const textFieldEntity = createEntity({
  name: "textField",
  attributes: [
    labelAttribute, requiredAttribute, placeholderAttribute,
    maxLengthAttribute, helpTextAttribute, prefillSourceAttribute,
    attachPhotosAttribute,
  ],
  validate(value, context) { /* unchanged */ },
});

// AFTER Phase 15:
import { createEntity } from "@coltorapps/builder";
// ... existing imports ...
import { attachPhotosAttribute } from "../attributes/attach-photos";
import { visibilityRulesAttribute } from "../attributes/visibility-rules";          // ← NEW
import { makeShouldBeProcessed } from "../visibility/should-be-processed";          // ← NEW

export const textFieldEntity = createEntity({
  name: "textField",
  attributes: [
    labelAttribute, requiredAttribute, placeholderAttribute,
    maxLengthAttribute, helpTextAttribute, prefillSourceAttribute,
    attachPhotosAttribute,
    visibilityRulesAttribute,                                                       // ← NEW
  ],
  validate(value, context) { /* unchanged */ },
  shouldBeProcessed: makeShouldBeProcessed(),                                       // ← NEW
});
```

**Container entities (`section-group.ts`, `repeating-section.ts`) get the SAME mod** — engine uniformity (RESEARCH §Pattern 3 lines 446–450). The UI hides the conditional-logic editor for containers; the schema stays uniform.

**`computed-field.ts` special case** — gets the same mod. UI filters `require` from the action dropdown when the host entity is `computedField` (because it has no `requiredAttribute`; see lines 11–13 of `computed-field.ts`).

**Caution (Pitfall 1):** confirm via Wave-0 test that every Phase 14 entity's `validate()` STILL works — adding an attribute does not change the entity's value-validation path, but the wave-0 backward-compat test (`validate-schema.test.ts` extension) must load migration 011's seed schema and assert `result.success === true`.

---

### `lib/form-builder/progress.ts` (MODIFY — accept visibility)

**Analog:** Self — `computeFormProgress` signature extension.

**Current signature** (`lib/form-builder/progress.ts` line 123):
```typescript
export function computeFormProgress(
  schema: ProgressSchema,
  values: Record<string, unknown>
): number {
```

**New signature** (RESEARCH §Pattern 8 lines 733–757):
```typescript
export function computeFormProgress(
  schema: ProgressSchema,
  values: Record<string, unknown>,
  visibility?: Record<string, VisibilityState>   // ← NEW, optional for backward-compat
): number {
```

**Two changes in the `flatMap`** (current lines 143–152):
1. If `visibility && visibility[id]?.visible === false` → skip entirely (return `[]`).
2. If `visibility` provided → use `visibility[id]?.required === true` instead of `entity.attributes?.required === true`.

**Backward compat:** when `visibility === undefined`, behaviour is byte-identical to today. The interpreter renderer will start passing `visibility` once Wave 1 lands.

**Caller update (`interpreter-renderer.tsx` line 78):**
```typescript
// BEFORE:
onProgressChange?.(computeFormProgress(schema, interpreterStore.getEntitiesValues()))
// AFTER:
const values = interpreterStore.getEntitiesValues()
const visibility = evaluateVisibility(schema, values)
onProgressChange?.(computeFormProgress(schema, values, visibility))
```

---

### `components/form-interpreter/interpreter-renderer.tsx` (MODIFY — renderer integration)

**Analog:** Self — lines 105–158, the propsRef + `useMemo([surface])` pattern is the load-bearing invariant.

**Current propsRef** (`components/form-interpreter/interpreter-renderer.tsx` lines 105–108):
```typescript
const propsRef = useRef({ clientId, submissionId, schema, interpreterStore })
useEffect(() => {
  propsRef.current = { clientId, submissionId, schema, interpreterStore }
})
```

**Extended propsRef** (Phase 15):
```typescript
const propsRef = useRef({ clientId, submissionId, schema, interpreterStore, visibility })
useEffect(() => {
  const values = interpreterStore.getEntitiesValues()
  propsRef.current = {
    clientId, submissionId, schema, interpreterStore,
    visibility: evaluateVisibility(schema, values),
  }
})
```

**Per-renderer thread** — pass `dynamicRequired` as a PRIMITIVE boolean (RESEARCH Pitfall 5 — passing the whole `VisibilityState` reference reintroduces focus loss):
```typescript
// inside the components useMemo, for each renderer that needs dynamic required:
textField: ({ entity, ...props }) =>
  <TextFieldRenderer
    {...props}
    entity={entity}
    surface={surface}
    dynamicRequired={propsRef.current.visibility[entity.id]?.required ?? false}
  />,
```

**HARD INVARIANT (Phase 14-06 carry-forward — lines 156–158):**
```typescript
// deps stay [surface] — see propsRef JSDoc above for why this is correct.
// eslint-disable-next-line react-hooks/exhaustive-deps
}), [surface])
```
**Do not add `visibility` to this dep array.** Doing so guarantees focus loss on every keystroke.

**Show/hide is NOT threaded** — coltorapps `shouldBeProcessed` handles render-skipping natively (RESEARCH §Pattern 1 + Anti-Patterns).

---

### `app/admin/templates/actions.ts` + `app/client/templates/actions.ts` (MODIFY — save/publish actions)

**Analog:** Self — both files share the identical `validateSchema → insert version` shape.

**Insertion point** (`app/admin/templates/actions.ts` lines 55–62 in `saveDraftAction`; lines 99–105 in `publishTemplateAction`; mirror in `app/client/templates/actions.ts` lines 83–88 and 127–133):
```typescript
// EXISTING (unchanged):
const { validateSchema } = await import("@coltorapps/builder");
const { formBuilder } = await import("@/lib/form-builder");
const result = await validateSchema(rawSchema, formBuilder);
if (!result.success) {
  throw new Error(`Invalid schema: ${result.reason.code}`);
}

// ── PHASE 15 INSERT — between validateSchema and the INSERT ────────────
const { validateRuleGraph } = await import("@/lib/form-builder/visibility/validate-rule-graph");
const graphResult = validateRuleGraph(result.data);
if (!graphResult.ok) {
  throw new Error(JSON.stringify({
    kind: "RuleGraphInvalid",
    cycles: graphResult.cycles.map(c => ({ entityIds: c.path, labels: c.labels })),
    scopeErrors: graphResult.scopeErrors,
  }));
}
// ────────────────────────────────────────────────────────────────────────
```

**Apply to all FOUR call sites** (Pitfall 2): `saveDraftAction`, `publishTemplateAction`, `saveClientDraftAction`, `publishClientTemplateAction`. Asymmetric validation between surfaces = exploit class (RESEARCH §Project Constraints).

---

### `app/admin/assessments/actions.ts` (MODIFY — server-side scrub)

**Analog:** Self — lines 232–299, `submitAssessmentAction`.

**Current Step 3→4 boundary** (lines 263–281):
```typescript
const result = await validateEntitiesValues(rawValues, formBuilder, version.schema_json)
if (!result.success) {
  throw new Error("Form validation failed server-side. ...")
}

// Step 4: write validated data — T-13-13 (audit trail)
const { error: updateError } = await adminClient
  .from("form_submissions")
  .update({
    answers_json: result.data,
    status: "submitted",
    submitted_at: new Date().toISOString(),
  })
  ...
```

**Phase 15 — insert between Step 3 and Step 4** (RESEARCH §Code Examples lines 957–988):
```typescript
const result = await validateEntitiesValues(rawValues, formBuilder, version.schema_json)
if (!result.success) {
  throw new Error("Form validation failed server-side. ...")
}

// ── PHASE 15 INSERT ─────────────────────────────────────────────────────
const { evaluateVisibility } = await import("@/lib/form-builder/visibility/evaluate-visibility")
const { stripHiddenAnswers } = await import("@/lib/form-builder/visibility/strip-hidden-answers")
const visibility = evaluateVisibility(version.schema_json, result.data as Record<string, unknown>)
const scrubbedAnswers = stripHiddenAnswers(version.schema_json, result.data as Record<string, unknown>, visibility)
// ────────────────────────────────────────────────────────────────────────

const { error: updateError } = await adminClient
  .from("form_submissions")
  .update({
    answers_json: scrubbedAnswers,    // ← was result.data
    status: "submitted",
    submitted_at: new Date().toISOString(),
  })
  ...
```

**Order is load-bearing** (RESEARCH §Pattern 7 lines 706–727): validate FIRST (so coerced types — number strings → numbers — feed the operator semantics correctly), THEN evaluate visibility against the validated data, THEN scrub.

**Side effect:** `runReportDraftGeneration` (`after()` callback at line 292) automatically benefits — it reads `answers_json`, which is now the scrubbed payload. No AI-pipeline change needed (RESEARCH §Deferred Ideas line 140).

---

### `components/form-builder/properties-panel.tsx` (MODIFY — host site)

**Analog:** Self — the existing structure already has all the pieces.

**Surface tokens to extend** (`components/form-builder/properties-panel.tsx` lines 37–78):
The existing dark/cream maps include `toggleOn` (`#3b8273` dark / `#1a1a1a` cream), `optionInput`, `addOptionInput`, `addOptionBtn`, `select`, `helpHint`, `label`. The AND/OR segmented toggle (UI-SPEC §1) reuses `toggleOn` for the active chip and `bg-white/10` (dark) / `bg-[#e5e1d8]` (cream) for the inactive chip — both already in the file.

**Container guard pattern to copy** (`components/form-builder/properties-panel.tsx` line 234):
```typescript
const isSectionGroup = entity.type === "sectionGroup";
const isRepeatingSection = entity.type === "repeatingSection";
```
Use these EXISTING flags. Conditional-logic section renders only when `!isSectionGroup && !isRepeatingSection` (UI-SPEC §1: "containers cannot have visibility rules on themselves").

**Append point:** after the existing per-type editor blocks, before the type footer at the bottom of the rendered output. UI-SPEC §"Component Inventory" mandates this position.

**`setEntityAttribute` wiring** — use the existing `setAttr` helper at lines 230–232:
```typescript
function setAttr(name: string, value: unknown) {
  builderStore.setEntityAttribute(selectedId!, name as ..., value as ...);
}
// Used as: setAttr("visibilityRules", { rules, logic })
```

---

### `components/form-builder/conditional-logic-section.tsx` + `rule-row.tsx` + `cycle-error-banner.tsx` (NEW — builder UI components)

**Analog:** `OptionsEditor` in `components/form-builder/properties-panel.tsx` lines 131–212 — same surface-token consumption, same "rows + add button" pattern, same `builderStore.setEntityAttribute` write path.

**Row pattern to copy** (`properties-panel.tsx` lines 170–211):
```tsx
<div className="flex flex-col gap-1">
  {options.map((opt) => (
    <div key={opt.value} className="flex items-center gap-2">
      <input
        type="text"
        value={opt.label}
        onChange={(e) => updateOptionLabel(opt.value, e.target.value)}
        className={cn(
          "flex-1 border rounded-[3px] px-2.5 py-1.5 text-xs outline-none transition-colors",
          t.optionInput
        )}
      />
      <button
        onClick={() => removeOption(opt.value)}
        className={cn("w-5 h-5 flex items-center justify-center transition-colors", t.optionRemove)}
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  ))}
</div>
<div className="flex items-center gap-2">
  <input ... onKeyDown={(e) => e.key === "Enter" && addOption()} ... />
  <button onClick={addOption}>...</button>
</div>
```

**Apply to `RuleRow`:**
- Flex row with `gap-1.5 items-center` (UI-SPEC §1 rule-row layout).
- Source-field dropdown (`flex-1 min-w-0`, native `<select>` styled per `t.select`).
- Operator dropdown (`w-28`, options filtered by source type per D-06 — see UI-SPEC §"Operator Display Labels" table for the filter map).
- Value input (`flex-1 min-w-0`); when operator is `isEmpty`/`isNotEmpty` render `w-0 overflow-hidden p-0 border-0` so the row doesn't reflow (UI-SPEC §1 explicit).
- Arrow separator `→` (`text-xs px-0.5 text-white/20`).
- Action dropdown (`w-24`).
- Trash button (`Trash2` 14px) — copy the existing `optionRemove` token + size from the OptionsEditor remove-button.

**Apply to `ConditionalLogicSection`:**
- Outer collapsible — UI-SPEC §1 specifies header `[GitFork 14px] CONDITIONAL LOGIC (N) [ChevronRight/Down]`.
- Uses the same `font-mono text-[10px] uppercase tracking-widest` as the section labels used elsewhere in the panel (`AttributeRow` lines 121–124).
- AND/OR segmented toggle — `w-full grid grid-cols-2 h-7 rounded-[3px]`. Active chip uses `t.toggleOn`; inactive uses `bg-white/10 text-white/40` (dark) or the cream equivalent.
- "+ Add condition" button — `h-7 w-full border-dashed`. Reuse the `addOptionInput` / `addOptionBtn` colour tokens.

**Apply to `CycleErrorBanner`:**
- UI-SPEC §2 specifies the box: `rounded-[3px] border border-[#8b2b21]/40 bg-[#8b2b21]/10 px-3 py-2`.
- Uses `AlertTriangle` lucide icon (12px) and `text-destructive` token (already in globals.css per UI-SPEC).
- Receives parsed cycle payload (`{ entityIds, labels }[]`) via props from the parent that ran a client-side `validateRuleGraph` preflight (or from a server-error catch in the save handler).

**Source-field-dropdown content (scope-aware, D-03):** when the selected entity is inside a `repeatingSection`, list (a) its instance-siblings (via `entity.parentId === repSectionId` lookup), and (b) all root-level entities. Exclude fields inside OTHER repeating sections AND exclude fields in other instances of the same section (no instance-picker UI). When the candidate set is empty, render the disabled `— no eligible fields —` option per UI-SPEC §1.

---

### `supabase/migrations/012_phase15_conditional_smoke_test.sql` (NEW — smoke template)

**Analog:** `supabase/migrations/011_specialty_smoke_test_template.sql` — exact pattern.

**Header convention** (`supabase/migrations/011_specialty_smoke_test_template.sql` lines 1–47): file-top comment block documenting purpose, entity layout, test scenarios, and any FK/parent-child invariants. Copy this style.

**CTE / DO-block pattern** (`011_specialty_smoke_test_template.sql` lines 49–60):
```sql
DO $$
DECLARE
  v_admin_id    UUID;
  v_template_id UUID;

  -- Root-level entity IDs
  e_site_name      UUID := gen_random_uuid();
  ...
```
Use the SAME `DO $$ DECLARE ... gen_random_uuid()` pattern. Never hardcode UUIDs. coltorapps parent/child invariant: container `children` array AND child `parentId` MUST agree (lines 43–46 of migration 011).

**Phase 15 entities (from CONTEXT §specifics):**
1. PAS 79 smoke: two `numberField` (likelihood + consequence), one `computedField` (formula=`pas79`, inputs map to the two numbers), one `textField` "Mitigation" with `visibilityRules: { rules: [{ sourceEntityId: <computed-id>, operator: "equals", value: "Intolerable", action: "show" }], logic: "and" }`.
2. FRA-doors smoke: `repeatingSection` "Fire doors register" with children `Door condition` (selectField) and `Repair urgency` (selectField). `Repair urgency` carries `visibilityRules: { rules: [{ sourceEntityId: <door-condition-child-id>, operator: "equals", value: "Poor", action: "require" }], logic: "and" }`.
3. Root scope smoke: a `selectField` "Site type" at root; a `sectionGroup` "Fire doors register section" whose `visibilityRules` has `{ sourceEntityId: <site-type-id>, operator: "equals", value: "Commercial", action: "show" }`.

Schema JSON literal goes inline in the migration the same way migration 011 does — a `jsonb` value composed with `format()` / string interpolation of the declared UUIDs.

---

### Test Files (NEW + EXTENDED — 12 total)

**Analog patterns:**
- Pure-logic tests: `tests/form-builder/attributes.test.ts` lines 8–47 — describe/it blocks, dynamic `await import()` of the module under test, assertions on `validate(...)` return.
- Server-action tests: `tests/form-builder/save-draft.test.ts` lines 1–50 — `vi.mock` Supabase + import the action; pattern reusable for the new "save with cycle → rejects" extension.
- Renderer tests: `tests/form-interpreter/renderers.test.tsx` (exists) — Phase 14-06 added this for focus retention testing; extend with hide/show / focus-after-toggle / Select-controlled-across-flip cases.

**Files to create (RESEARCH §Recommended Project Structure lines 262–281):**

| File | Tests | Analog |
|------|-------|--------|
| `tests/form-builder/visibility/visibility-rules-attribute.test.ts` | default-coerce undefined/null/wrong-shape → `{rules:[],logic:"and"}`; reject bad operator/action/sourceEntityId | `tests/form-builder/attributes.test.ts` |
| `tests/form-builder/visibility/evaluate-rule.test.ts` | 7 operators × 5 source types matrix (~30 cases) | `tests/form-builder/pas79.test.ts` (pure-logic table) |
| `tests/form-builder/visibility/combine-rules.test.ts` | AND/OR truth-table + hide-wins-over-show (D-07) | `tests/form-builder/pas79.test.ts` |
| `tests/form-builder/visibility/cascade-visibility.test.ts` | hidden parent → children hidden; repeating-section cascade | `tests/form-builder/progress.test.ts` |
| `tests/form-builder/visibility/evaluate-visibility.test.ts` | integration: evaluate+combine+cascade end-to-end | `tests/form-builder/progress.test.ts` |
| `tests/form-builder/visibility/dependency-map.test.ts` | direct + computed edge construction | new pattern |
| `tests/form-builder/visibility/validate-rule-graph.test.ts` | linear-chain pass; direct cycle; computed-mediated cycle (Pitfall 8); ancestor-scope pass; cross-instance reject; root→inside-repeating reject; orphan advisory | new pattern |
| `tests/form-builder/visibility/scope.test.ts` | resolveScope for root, sectionGroup-child, repeating-section-child | new pattern |
| `tests/form-builder/visibility/strip-hidden-answers.test.ts` | hidden field stripped; cascade; repeating-instance per-instance scrub; hidden-but-required silently dropped without error | `tests/form-builder/expand-repeating-sections.test.ts` |
| `tests/form-builder/visibility/backcompat.test.ts` | load migration 011 seed schema → validate cleanly → `visibilityRules: { rules: [], logic: "and" }` injected on every entity (Pitfall 1 backward-compat) | `tests/form-builder/save-draft.test.ts` |
| `tests/form-builder/visibility/server-scrub.test.ts` | submitAssessmentAction with hidden field strips key from answers_json; full-visible passes through; per-instance scrub | `tests/form-builder/save-draft.test.ts` |
| `tests/form-builder/progress-with-visibility.test.ts` | visibility=undefined backcompat; hidden excluded from denominator; dynamic-required counted when visible | `tests/form-builder/progress.test.ts` |
| `tests/form-interpreter/visibility-renderer.test.tsx` | renderer hides/shows DOM; focus retention across hide/show; Select stays controlled across source flip | `tests/form-interpreter/renderers.test.tsx` |
| `tests/form-builder/conditional-logic-section.test.tsx` | collapsed default, expanded toggle/add/delete, D-03 source filter, A7 action filter | `tests/form-interpreter/renderers.test.tsx` |
| `tests/form-builder/cycle-error-banner.test.tsx` | cycle banner truncated labels; scope-error reasons; orphan advisory copy | new pattern |
| `tests/form-builder/progress.test.ts` (EXTEND) | hidden fields excluded from numerator + denominator | self |
| `tests/form-builder/save-draft.test.ts` (EXTEND) | cyclic schema → action throws parseable JSON error; client save with cross-instance scope error | self |
| `tests/e2e/phase15-smoke.spec.ts` (Wave 4, Playwright) | PAS 79 mitigation show-on-Intolerable; FRA-doors per-instance require-on-Poor | none — first conditional E2E |

**Naming convention:** All Phase 15 visibility-module unit tests live under the nested `tests/form-builder/visibility/` directory (matches the production module layout under `lib/form-builder/visibility/`). Renderer + progress + builder-UI tests live one level up at `tests/form-builder/` or `tests/form-interpreter/` per existing repo convention. The 9 PLAN.md files in this phase ALL reference the nested paths verbatim in their `files_modified` and `<automated>` verify blocks.

**Test framework invariants** (`tests/form-builder/attributes.test.ts` lines 1–14):
```typescript
import { describe, it, expect } from "vitest";
// Always use dynamic await import("@/lib/...") inside the test — keeps the
// module out of the test module's static import graph so vitest can isolate.
```
Use `await import()` for production modules; static `import` for test framework only.

---

## Shared Patterns

### Default-coerce attribute validate()
**Source:** `lib/form-builder/attributes/computed-inputs.ts` lines 17–22 + `lib/form-builder/attributes/attach-photos.ts` lines 9–14
**Apply to:** `visibility-rules.ts`
```typescript
validate(value) {
  if (value === undefined || value === null) return DEFAULT;   // ← never throw
  if (typeof value !== "object" || Array.isArray(value)) throw new Error(...);
  // ... per-field coercion, throw on invalid shape ...
  return coercedValue;
}
```
**Why:** RESEARCH Pitfall 1 — pre-Phase-15 `template_versions.schema_json` rows have no `visibilityRules` on their entities. The attribute is registered against all 13 entities; on first `validateSchema(legacy)` call, every entity's `validate()` runs. Throwing breaks every existing pinned version.

### `propsRef` for per-render values inside memoised `components` map
**Source:** `components/form-interpreter/interpreter-renderer.tsx` lines 84–108
**Apply to:** Phase 15 `visibility` threading
```typescript
const propsRef = useRef({ ..., visibility });
useEffect(() => { propsRef.current = { ..., visibility }; });

const components = useMemo(() => ({
  textField: (p) => <Renderer ... dynamicRequired={propsRef.current.visibility[entity.id]?.required ?? false} />,
}), [surface]);   // ← deps stay [surface] — adding visibility = focus loss
```
**Why:** Phase 13-04 UAT focus-loss bug regresses if `visibility` enters the `useMemo` deps. Always pass primitive booleans, never object references, to renderer wrappers.

### Server-side `validateRuleGraph` call site
**Source:** `app/admin/templates/actions.ts` lines 55–62 (existing `validateSchema` call) + RESEARCH §Code Examples lines 992–1016
**Apply to:** all four save/publish actions (admin + client) — see Pitfall 2 in RESEARCH for why both Save AND Publish run it. Asymmetry between surfaces = exploit class.

### Smoke-test migration shape
**Source:** `supabase/migrations/011_specialty_smoke_test_template.sql` lines 1–60
**Apply to:** `012_phase15_conditional_smoke_test.sql`
- File-top comment block: purpose / entity layout / scenarios / parent-child invariant note
- `DO $$ DECLARE ... gen_random_uuid()` block
- coltorapps parent/child invariant (container `children` AND child `parentId` BOTH set)

### Surface-tokens dual-surface pattern
**Source:** `components/form-builder/properties-panel.tsx` lines 37–78
**Apply to:** `conditional-logic-section.tsx`, `rule-row.tsx`, `cycle-error-banner.tsx` — all three must accept `surface?: "dark" | "cream"` and read from the same shape (AGENTS.md form-template-ownership: form-builder must NOT be hardcoded admin-only).

### Test pattern: dynamic `await import()` of production modules
**Source:** `tests/form-builder/attributes.test.ts` lines 1–14
**Apply to:** all 11 new Phase 15 test files. Vitest isolation breaks if production modules are statically imported into the test module's import graph.

---

## No Analog Found

| File | Role | Reason |
|------|------|--------|
| `lib/form-builder/visibility/should-be-processed.ts` | renderer-integration hook body | First `shouldBeProcessed` body in the repo. Reference is Context7's verbatim coltorapps doc example (RESEARCH §Code Examples lines 910–928), NOT a sibling file. Plan-phase spike confirms `entitiesValues` shape inside repeatingSection children (RESEARCH Assumption A3 / Open Question #1). |
| `lib/form-builder/visibility/dependency-map.ts` + `validate-rule-graph.ts` | graph build + DAG validator | First graph algorithm in the codebase. Standard 3-colour DFS — reference is RESEARCH §Pattern 4 lines 454–576; no in-repo analog. |
| `components/form-builder/cycle-error-banner.tsx` | inline warning block | First save-time validation banner. No existing pattern; UI-SPEC §2 has the exact visual + copy contract. |
| `tests/e2e/phase15-smoke.spec.ts` | Playwright E2E | First conditional-logic E2E. Playwright config exists (`playwright.config.ts`) but no Phase 14 spec to copy verbatim; plan-phase to scaffold using Playwright defaults. |

---

## Metadata

**Analog search scope:** `lib/form-builder/`, `components/form-builder/`, `components/form-interpreter/`, `app/admin/templates/`, `app/client/templates/`, `app/admin/assessments/`, `tests/form-builder/`, `tests/form-interpreter/`, `supabase/migrations/`
**Files scanned:** 30+
**Pattern extraction date:** 2026-05-26
**Cross-reference:** All inline file:line refs verified by direct Read (no inferred lines).

## PATTERN MAPPING COMPLETE
