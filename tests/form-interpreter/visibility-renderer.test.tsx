/**
 * tests/form-interpreter/visibility-renderer.test.tsx
 *
 * Phase 15 Plan 15-04 — Task 1: Visibility integration tests for the interpreter renderer.
 *
 * Guards:
 *   (a) evaluateVisibility + shouldBeProcessed interaction (hide rule fires → entity excluded)
 *   (b) show rule — default-hidden entity becomes visible when rule fires
 *   (c) Focus retention invariant: `components` useMemo deps in interpreter-renderer.tsx
 *       MUST remain `[surface]` (Phase 14-06 focus-loss invariant / Pitfall 5)
 *   (d) dynamicRequired — a require rule that fires results in `required: true` in the visibility map
 *
 * Test strategy: The coltorapps interpreter store is too complex to instantiate in a
 * pure unit test. Instead:
 *   - Tests (a)(b)(d): exercise `evaluateVisibility` directly — the source-of-truth for
 *     the visibility state that interpreter-renderer threads into wrappers.
 *   - Test (c): statically inspect the built interpreter-renderer module to assert
 *     the `[surface]` dep array literal is present (the focus-loss invariant).
 *
 * This mirrors the approach taken in renderers.test.tsx for the Phase 14-06 smoke tests.
 */

import { describe, it, expect } from "vitest"

// ── Test data ─────────────────────────────────────────────────────────────────

const SOURCE_ID = "a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5"
const TARGET_ID = "b2c3d4e5-f6a7-4b8c-9d0e-f1a2b3c4d5e6"
const SIBLING_TEXT_ID = "c3d4e5f6-a7b8-4c9d-0e1f-a2b3c4d5e6f7"

/** Minimal schema: SOURCE_ID is a selectField; TARGET_ID has a hide rule when source equals "Yes" */
const schemaHideOnYes = {
  entities: {
    [SOURCE_ID]: {
      type: "selectField",
      attributes: { label: "Include section?", required: false },
    },
    [TARGET_ID]: {
      type: "textField",
      attributes: {
        label: "Extra details",
        required: false,
        visibilityRules: {
          rules: [{ sourceEntityId: SOURCE_ID, operator: "equals", value: "Yes", action: "hide" }],
          logic: "and" as const,
        },
      },
    },
    [SIBLING_TEXT_ID]: {
      type: "textField",
      attributes: { label: "Notes", required: false },
    },
  },
}

/** Schema: TARGET_ID has a SHOW rule (default-hidden: only visible when source equals "Commercial") */
const schemaShowOnCommercial = {
  entities: {
    [SOURCE_ID]: {
      type: "selectField",
      attributes: { label: "Site type", required: false },
    },
    [TARGET_ID]: {
      type: "textField",
      attributes: {
        label: "Commercial details",
        required: false,
        visibilityRules: {
          rules: [{ sourceEntityId: SOURCE_ID, operator: "equals", value: "Commercial", action: "show" }],
          logic: "and" as const,
        },
      },
    },
  },
}

/** Schema: TARGET_ID has a REQUIRE rule when source equals "Poor" */
const schemaRequireOnPoor = {
  entities: {
    [SOURCE_ID]: {
      type: "selectField",
      attributes: { label: "Condition", required: false },
    },
    [TARGET_ID]: {
      type: "textField",
      attributes: {
        label: "Repair reason",
        required: false,
        visibilityRules: {
          rules: [{ sourceEntityId: SOURCE_ID, operator: "equals", value: "Poor", action: "require" }],
          logic: "and" as const,
        },
      },
    },
  },
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("visibility-renderer — entity hide/show integration", () => {
  it("entity with hide rule: evaluateVisibility returns visible=false when rule fires (shouldBeProcessed=false path)", async () => {
    const { evaluateVisibility } = await import("@/lib/form-builder/visibility/evaluate-visibility")

    // Source value "Yes" → hide rule fires → TARGET_ID should be invisible
    const visibility = evaluateVisibility(schemaHideOnYes, { [SOURCE_ID]: "Yes" })

    expect(visibility[TARGET_ID].visible).toBe(false)
    expect(visibility[TARGET_ID].required).toBe(false) // D-07: hidden trumps required

    // Sibling is NOT affected by the rule — it should remain visible
    expect(visibility[SIBLING_TEXT_ID].visible).toBe(true)

    // When rule does NOT fire (source is "No"), entity is visible again
    const visibility2 = evaluateVisibility(schemaHideOnYes, { [SOURCE_ID]: "No" })
    expect(visibility2[TARGET_ID].visible).toBe(true)
  })

  it("entity with show rule (default-hidden): visible only when rule fires", async () => {
    const { evaluateVisibility } = await import("@/lib/form-builder/visibility/evaluate-visibility")

    // When source is NOT "Commercial" → show rule does NOT fire → entity is hidden by default
    const visibilityNoMatch = evaluateVisibility(schemaShowOnCommercial, { [SOURCE_ID]: "Residential" })
    expect(visibilityNoMatch[TARGET_ID].visible).toBe(false)

    // When source IS "Commercial" → show rule fires → entity is visible
    const visibilityMatch = evaluateVisibility(schemaShowOnCommercial, { [SOURCE_ID]: "Commercial" })
    expect(visibilityMatch[TARGET_ID].visible).toBe(true)

    // No source value → show rule does not fire → entity hidden
    const visibilityEmpty = evaluateVisibility(schemaShowOnCommercial, {})
    expect(visibilityEmpty[TARGET_ID].visible).toBe(false)
  })

  it("focus on a neighbouring text input is RETAINED across a hide/show flip (Phase 14-06 focus-loss invariant: components useMemo deps MUST stay [surface])", async () => {
    // This test asserts the critical structural invariant: the `components` useMemo dep array
    // in interpreter-renderer.tsx must stay `[surface]` (not include `visibility`).
    // Adding `visibility` to deps causes coltorapps to remount all entities on every value
    // change, which steals focus from the active text input (Phase 14-06 / RESEARCH Pitfall 5).
    //
    // Strategy: read the source file and assert the literal string `}), [surface])` is present.
    // This is the same assertion documented in the plan acceptance criteria:
    //   grep -Fc "}), [surface])" components/form-interpreter/interpreter-renderer.tsx >= 1
    const { readFileSync } = await import("fs")
    const { resolve } = await import("path")
    const rendererSource = readFileSync(
      resolve("components/form-interpreter/interpreter-renderer.tsx"),
      "utf-8"
    )

    // The memoised components map must close with `}), [surface])` — visibility NOT in deps
    expect(rendererSource).toContain("}), [surface])")

    // The `visibility` key must be present in propsRef (threaded via ref, not deps)
    expect(rendererSource).toContain("visibility")

    // Safety: verify `evaluateVisibility` is imported
    expect(rendererSource).toContain("evaluateVisibility")
  })

  it("onEntityValueUpdated guards validateEntityValue against coltorapps cascade-clear events (E4 regression)", async () => {
    // Coltorapps fires EntityValueUpdated for every entity transitioning to unprocessable
    // when a container hide rule flips — sectionGroup, repeatingSection, computedField, and
    // cascaded descendants all emit one each with value=undefined. validateEntityValue's
    // eligibility precondition rejects non-input + just-hidden entities and THROWS.
    //
    // Critical subtlety: coltorapps' validateEntityValue is `async`. The throw becomes a
    // rejected Promise — a synchronous `try/catch` will NOT catch it. The guard MUST be
    // `.catch(() => {})` on the returned promise (or equivalent `.then(null, ...)`).
    //
    // This test exists because the first fix attempt used a sync `try { ... } catch {}`
    // wrapper that was structurally present but semantically a no-op. The error then
    // resurfaced walking E5 (hide Mitigation by lowering risk). Lock the real pattern.
    const { readFileSync } = await import("fs")
    const { resolve } = await import("path")
    const rendererSource = readFileSync(
      resolve("components/form-interpreter/interpreter-renderer.tsx"),
      "utf-8"
    )

    // Must be `.catch(...)` on the returned promise — sync try/catch is insufficient.
    expect(rendererSource).toMatch(
      /interpreterStore\.validateEntityValue\(payload\.entityId\)\.catch\s*\(/
    )

    // Explicit anti-pattern guard: reject sync try/catch wrapping around the call.
    expect(rendererSource).not.toMatch(
      /try\s*\{\s*void\s+interpreterStore\.validateEntityValue\(payload\.entityId\)\s*\}\s*catch/
    )
  })

  it("dynamicRequired (require rule fired) sets required=true in visibility map; visible=false overrides to required=false (D-07)", async () => {
    const { evaluateVisibility } = await import("@/lib/form-builder/visibility/evaluate-visibility")

    // When source equals "Poor" → require rule fires → TARGET_ID required=true, visible=true
    const visibilityRequired = evaluateVisibility(schemaRequireOnPoor, { [SOURCE_ID]: "Poor" })
    expect(visibilityRequired[TARGET_ID].visible).toBe(true)
    expect(visibilityRequired[TARGET_ID].required).toBe(true)

    // When source is NOT "Poor" → require rule does NOT fire → required=false
    const visibilityNotRequired = evaluateVisibility(schemaRequireOnPoor, { [SOURCE_ID]: "Good" })
    expect(visibilityNotRequired[TARGET_ID].visible).toBe(true)
    expect(visibilityNotRequired[TARGET_ID].required).toBe(false)

    // D-07: If a hide rule also fires, required must be false even if require rule fires
    const mixedSchema = {
      entities: {
        [SOURCE_ID]: {
          type: "selectField",
          attributes: { label: "Trigger", required: false },
        },
        [TARGET_ID]: {
          type: "textField",
          attributes: {
            label: "Target",
            required: false,
            visibilityRules: {
              rules: [
                { sourceEntityId: SOURCE_ID, operator: "equals", value: "trigger", action: "hide" },
                { sourceEntityId: SOURCE_ID, operator: "equals", value: "trigger", action: "require" },
              ],
              logic: "and" as const,
            },
          },
        },
      },
    }
    const visibilityHideWins = evaluateVisibility(mixedSchema, { [SOURCE_ID]: "trigger" })
    expect(visibilityHideWins[TARGET_ID].visible).toBe(false)
    expect(visibilityHideWins[TARGET_ID].required).toBe(false) // D-07: hidden trumps required
  })
})
