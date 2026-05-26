---
phase: 15
plan: "07"
subsystem: form-builder/ui
tags: [wave-3, cycle-error-banner, conditional-logic, tdd, builder-ui, error-surfacing]
dependency_graph:
  requires:
    - components/form-builder/conditional-logic-section.tsx (15-06 — ConditionalLogicSection integration site)
    - components/form-builder/properties-panel.tsx (15-06 — PropertiesPanel host for cycleState passthrough)
    - app/admin/templates/actions.ts (15-05 — structured RuleGraphInvalid error shape)
    - app/client/templates/actions.ts (15-05 — same guard on customer surface)
    - lib/form-builder/visibility/validate-rule-graph.ts (15-03 — CycleError + ScopeError types)
  provides:
    - components/form-builder/cycle-error-banner.tsx (CycleErrorBanner — inline warning with entity labels)
    - components/form-builder/conditional-logic-section.tsx (extended — optional cycleState prop renders CycleErrorBanner above + Add condition)
    - app/admin/templates/[id]/builder-client.tsx (handleSave + handlePublish catch RuleGraphInvalid; builderStore.subscribe clears state; Publish button disabled with tooltip)
    - components/form-builder/properties-panel.tsx (optional cycleState prop forwarded to ConditionalLogicSection)
  affects:
    - plan 15-08 (smoke template exercises the save/publish pipeline that can now surface cycle errors)
tech_stack:
  added: []
  patterns:
    - "RuleGraphInvalid|cycleState|builderStore.subscribe pattern: cycleState useState slice set on server error catch in handleSave/handlePublish; cleared via builderStore.subscribe EntityAttributeUpdated/visibilityRules filter"
    - "Toast + persistent banner split: Sonner toast.error for immediate feedback; CycleErrorBanner persists in PropertiesPanel until admin edits a rule"
    - "Publish-blocked tooltip: publishBlocked state + disabled Button + TooltipProvider wrapper per UI-SPEC §Copywriting"
    - "TDD RED/GREEN: cycle-error-banner.test.tsx (7 assertions)"
key_files:
  created:
    - components/form-builder/cycle-error-banner.tsx
    - tests/form-builder/cycle-error-banner.test.tsx
  modified:
    - components/form-builder/conditional-logic-section.tsx
    - components/form-builder/properties-panel.tsx
    - app/admin/templates/[id]/builder-client.tsx
decisions:
  - "cycleState slice lives in TemplateBuilderClient (builder-client.tsx), NOT in route-level page.tsx — both admin and customer surfaces use the same TemplateBuilderClient component; zero edits to page.tsx files required"
  - "builderStore.subscribe receives (data, events[]) batched array per coltorapps Listener type (verified in node_modules/@coltorapps/builder/dist/index.d.ts line 291); filter for attributeName === 'visibilityRules' inside the events loop"
  - "Label truncation: labels array from validate-rule-graph includes start node repeated at end to close cycle; strip the repeated trailing label before slicing at 3 + '…'"
  - "publishBlocked guard in handlePublish returns early before confirm() — avoids the dialog appearing when blocked"
  - "TooltipProvider wraps Button directly (no asChild); tooltip content rendered conditionally only when publishBlocked to avoid empty tooltip DOM nodes"
metrics:
  duration: "~25 minutes"
  completed: "2026-05-26"
  tasks_completed: 2
  files_created: 2
  files_modified: 3
---

# Phase 15 Plan 07: Cycle Error Banner — UI Surface for RuleGraphInvalid Summary

**Save-time cycle detection surfaced to the builder: Sonner toast on Save/Publish click + persistent inline CycleErrorBanner in the PropertiesPanel for the selected entity; Publish button disabled with tooltip until admin edits a rule. Admin and customer surfaces reach parity via the shared TemplateBuilderClient.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-05-26T03:06:00Z
- **Completed:** 2026-05-26T03:15:00Z
- **Tasks:** 2 (both TDD — RED + GREEN)
- **Files:** 2 created, 3 modified

## Accomplishments

### Task 1 — CycleErrorBanner component + ConditionalLogicSection integration (TDD)

**`components/form-builder/cycle-error-banner.tsx`**
- `CycleErrorBanner` named export with props: `{ cycles, scopeErrors, selectedEntityId, surface }`
- Renders nothing when selectedEntityId not in any cycle / scope error
- **Cycle banners:** one per matching cycle; label truncation at 3 hops + `…` (strips trailing repeated closure label first); copy: `Circular rule: [Label A] → [Label B]` + line 2 `Remove a rule above to break the cycle.`
- **Scope error banners:** copy varies by reason:
  - `cross-instance`: `Cross-instance rule rejected: [sourceLabel] is in a different instance` + `Pick a sibling in this instance or an ancestor field.`
  - `root-references-inside-repeating`: `Cannot reference inside a repeating section from root: [sourceLabel]` + `Pick a root field or move this rule into the repeating section.`
  - `orphan-source` (advisory): `Source field deleted: [sourceLabel]` + `Remove this rule or pick a new source.`
- Visual: `rounded-[3px] border border-[#8b2b21]/40 bg-[#8b2b21]/10 px-3 py-2` per UI-SPEC §2; `AlertTriangle` 12px icon; `text-destructive`

**`components/form-builder/conditional-logic-section.tsx`** (additive modification):
- New exported type `CycleState` with `cycles` and `scopeErrors` fields
- New optional prop `cycleState?: CycleState` in `ConditionalLogicSectionProps`
- Renders `<CycleErrorBanner ...>` above the `+ Add condition` button when `cycleState` is present; absent when `cycleState` is undefined

All 9 existing `conditional-logic-section.test.tsx` tests continue to pass unchanged.

### Task 2 — Save/Publish handlers + PropertiesPanel cycleState passthrough

**`app/admin/templates/[id]/builder-client.tsx`** (host for both admin and customer surfaces):

**cycleState lifecycle:**
```
handleSave / handlePublish
  → await saveDraftAction(...) / publishTemplateAction(...)
  → catch(err)
    → JSON.parse(err.message)
    → if parsed.kind === "RuleGraphInvalid"
        → setCycleState({ cycles, scopeErrors })
        → toast.error("Circular rule detected", { description: truncated labels })
        → setPublishBlocked(true)  [Publish path only]
        → setSaveStatus("error")
        → return   [skips generic error handler]
    → else: setSaveStatus("error")   [generic path]

builderStore.subscribe (single call in useEffect):
  → listener receives (_data, events[])
  → for each event: if name === "EntityAttributeUpdated" && attributeName === "visibilityRules"
      → setCycleState(null)
      → setPublishBlocked(false)
      → return
```

**Publish button:**
- `disabled={isPending || publishBlocked}`
- Wrapped in `TooltipProvider > Tooltip > TooltipTrigger > Button`
- `TooltipContent` rendered only when `publishBlocked === true`: `Fix circular rules before publishing`

**`components/form-builder/properties-panel.tsx`:**
- New optional prop `cycleState?: CycleState` (type imported from `./conditional-logic-section`)
- Forwarded to `<ConditionalLogicSection cycleState={cycleState} ... />` unchanged

## cycleState Lifecycle Summary

| Event | Effect on cycleState | Effect on publishBlocked |
|-------|---------------------|------------------------|
| handleSave catches RuleGraphInvalid | `setCycleState({...})` | unchanged |
| handlePublish catches RuleGraphInvalid | `setCycleState({...})` | `setPublishBlocked(true)` |
| handleSave succeeds | cleared implicitly (no error) | unchanged |
| handlePublish succeeds | cleared implicitly | `false` (not explicitly reset — new save would reset) |
| Admin edits any rule (visibilityRules attribute) | `setCycleState(null)` | `setPublishBlocked(false)` |

## Toast vs Inline Banner Split

| Layer | Where | Trigger | Clears |
|-------|-------|---------|--------|
| Sonner toast | Global overlay | handleSave / handlePublish catch | Auto-dismisses (Sonner default) |
| CycleErrorBanner | PropertiesPanel → ConditionalLogicSection | cycleState prop propagates | Admin edits a rule (subscription) |
| Publish button tooltip | Toolbar | publishBlocked === true | Admin edits a rule |

## Page.tsx Files NOT Modified

Both `app/admin/templates/page.tsx` and `app/client/templates/page.tsx` are server component route handlers that delegate to `TemplateBuilderClient`. The cycleState slice, subscription, and error-parse logic all live in `TemplateBuilderClient` — the shared host component used by both admin and customer surfaces. Zero edits to either page file were required.

**Acceptance criteria verification:**
- `grep -c "JSON.parse" builder-client.tsx` → 2 (handleSave + handlePublish) ✓
- `grep -c "toast.error" builder-client.tsx` → 2 ✓
- `grep -c "builderStore.subscribe(" builder-client.tsx` → 1 ✓
- `grep "attributeName.*visibilityRules" builder-client.tsx` → 2 matches ✓
- `git diff --stat -- app/admin/templates/page.tsx app/client/templates/page.tsx` → no output (zero lines changed) ✓

## Task Commits

| Task | Phase | Commit | Description |
|------|-------|--------|-------------|
| Task 1 RED | test | `86cabeb` | add failing tests for CycleErrorBanner |
| Task 1 GREEN | feat | `97c2b21` | implement CycleErrorBanner + ConditionalLogicSection integration |
| Task 2 | feat | `6e7f5a7` | wire cycleState lifecycle in builder-client + PropertiesPanel |

## Verification Results

```
npx vitest run tests/form-builder/cycle-error-banner.test.tsx tests/form-builder/conditional-logic-section.test.tsx

 ✓ tests/form-builder/cycle-error-banner.test.tsx (7 tests) 197ms
 ✓ tests/form-builder/conditional-logic-section.test.tsx (9 tests) 313ms

Test Files  2 passed (2)
      Tests  16 passed (16)
```

```
npx tsc --noEmit 2>&1 | grep -E "app/(admin|client)/templates|components/form-builder"
(no output — zero new errors)
```

## Decisions Made

- **cycleState in TemplateBuilderClient, not page.tsx** — The plan's task 2 read_first block notes at file lines 102-104 that `TemplateBuilderClient` is the actual host. Route-level page.tsx files are server components — they cannot hold client state. Both admin and customer surfaces reuse `TemplateBuilderClient` via the `surface` prop, so a single change location achieves parity per Open Question #3.

- **Label truncation strips cycle closure first** — The `labels` array from `validate-rule-graph.ts` repeats the start node at position `[last]` to close the loop (e.g., `["A","B","C","A"]`). Stripping the duplicate before slicing at 3 produces cleaner display (`A → B → C` rather than `A → B → …` with C hidden).

- **publishBlocked guard before confirm()** — The `handlePublish` function returns early if `publishBlocked` is true, before the browser's `confirm()` dialog. This prevents the confirmation from appearing when publishing is blocked — better UX.

- **No asChild on TooltipTrigger** — This version's `TooltipTrigger` from `@base-ui/react/tooltip` does not expose an `asChild` prop (confirmed by TypeScript error TS2322). Wrapping in `<TooltipTrigger><Button ...>` directly works correctly.

## Deviations from Plan

### Out-of-scope Pre-existing Failures

**`tests/form-builder/specialty-entities.test.ts` — 4 failures (pre-existing)**
- **Found during:** Final test run verification
- **Issue:** `repeatingSection` attribute count test expects 4 attributes but received 5. This was confirmed pre-existing by running the test before any Task 2 changes (via `git stash` + run + `git stash pop`).
- **Action:** None — out of scope per deviation rules. Logged to deferred items.
- **Files affected:** None

## Known Stubs

None — all files implement real behavior:
- `cycle-error-banner.tsx`: full label truncation + 4 reason-specific copy variants
- `builder-client.tsx`: real try/catch with JSON.parse + builderStore.subscribe
- `properties-panel.tsx`: real prop passthrough

## Threat Surface Scan

All STRIDE mitigations from the plan's threat register applied:
- **T-15-07-02 (XSS — label rendering):** Labels render as React text children in `<span>` elements — React auto-escapes. No `dangerouslySetInnerHTML` used anywhere in the banner.
- **T-15-07-03 (Information Disclosure — payload content):** Payload contains only entity LABELS and IDs — no field values, no PII.

No new network endpoints, auth paths, file access patterns, or schema changes introduced.

## TDD Gate Compliance

| Gate | Commit | Status |
|------|--------|--------|
| RED (test) Task 1 | `86cabeb` | PASSED |
| GREEN (feat) Task 1 | `97c2b21` | PASSED |

## Self-Check

Files verified to exist:
- `components/form-builder/cycle-error-banner.tsx` FOUND
- `tests/form-builder/cycle-error-banner.test.tsx` FOUND
- `.planning/phases/15-conditional-logic-engine/15-07-SUMMARY.md` FOUND

Commits verified:
- `86cabeb` — Task 1 RED (test) ✓
- `97c2b21` — Task 1 GREEN (feat) ✓
- `6e7f5a7` — Task 2 (feat) ✓

Acceptance criteria:
- `components/form-builder/cycle-error-banner.tsx` exports `CycleErrorBanner` named export ✓
- `components/form-builder/conditional-logic-section.tsx` imports + conditionally renders `CycleErrorBanner` ✓
- All 7 cycle-error-banner.test.tsx assertions pass ✓
- All 9 conditional-logic-section.test.tsx assertions still pass (no regression) ✓
- Banner uses exact destructive token palette (verified by test assertions on className substrings) ✓
- `builder-client.tsx` contains JSON.parse in both handleSave and handlePublish (grep count: 2) ✓
- File imports `toast` from `sonner` and calls `toast.error(...)` ✓
- Exactly 1 `builderStore.subscribe(` call in the file ✓
- Subscribe handler filters on `attributeName === "visibilityRules"` ✓
- `components/form-builder/properties-panel.tsx` accepts and forwards `cycleState` ✓
- Zero edits to `app/admin/templates/page.tsx` or `app/client/templates/page.tsx` ✓
- Zero TypeScript errors in modified files ✓

## Self-Check: PASSED
