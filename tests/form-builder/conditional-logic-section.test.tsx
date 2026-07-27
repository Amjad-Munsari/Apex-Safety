/**
 * Tests for ConditionalLogicSection + RuleRow components.
 *
 * Uses renderToStaticMarkup (react-dom/server) — same pattern as renderers.test.tsx.
 * Avoids @testing-library/react; string-grepping rendered HTML for key affordances.
 *
 * Test cases (7):
 *   1. Collapsed by default with no "(N)" badge when rules is empty.
 *   2. Header shows "(2)" when 2 rules present.
 *   3. Expanded view shows AND/OR toggle + rule rows + add-condition button.
 *   4. add-condition click appends a default-shape rule.
 *   5. Action dropdown for `computedField` host does NOT include "require".
 *   6. Source-field dropdown excludes self (hostEntityId).
 *   7. Source-field dropdown INCLUDES same-instance siblings AND root fields AND EXCLUDES cross-instance.
 */

import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect, vi } from "vitest";
import React from "react";

// ---------------------------------------------------------------------------
// Schema fixture helpers
// ---------------------------------------------------------------------------

function makeUUID(n: number): string {
  // Format: 00000000-0000-4000-8000-0000000000XX (pseudo-v4 safe for test strings)
  return `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
}

const ROOT_FIELD_A = makeUUID(1);
const ROOT_FIELD_B = makeUUID(2);
const REP_SECTION  = makeUUID(3);
const SIBLING_A    = makeUUID(4); // child of REP_SECTION
const SIBLING_B    = makeUUID(5); // child of REP_SECTION — this is the "host"
const OTHER_REP    = makeUUID(6);
const CROSS_INST   = makeUUID(7); // child of OTHER_REP — cross-instance, EXCLUDED

/** Full schema for scope tests */
const testSchema = {
  entities: {
    [ROOT_FIELD_A]: { type: "textField", attributes: { label: "Root A" } },
    [ROOT_FIELD_B]: { type: "selectField", attributes: { label: "Root B" } },
    [REP_SECTION]: {
      type: "repeatingSection",
      attributes: {},
      children: [SIBLING_A, SIBLING_B],
    },
    [SIBLING_A]: {
      type: "selectField",
      attributes: { label: "Door condition" },
    },
    [SIBLING_B]: {
      type: "selectField",
      attributes: { label: "Repair urgency" },
    },
    [OTHER_REP]: {
      type: "repeatingSection",
      attributes: {},
      children: [CROSS_INST],
    },
    [CROSS_INST]: {
      type: "textField",
      attributes: { label: "Cross-instance field" },
    },
  },
};

// ---------------------------------------------------------------------------
// Test 1 + 2: Collapsed state + badge
// ---------------------------------------------------------------------------

describe("ConditionalLogicSection — collapsed state", () => {
  it("is collapsed by default with no (N) badge when rules is empty", async () => {
    const { ConditionalLogicSection } = await import(
      "@/components/form-builder/conditional-logic-section"
    );

    const entity = {
      id: ROOT_FIELD_A,
      type: "textField",
      attributes: { label: "Root A", visibilityRules: { rules: [], logic: "and" } },
    };

    const html = renderToStaticMarkup(
      React.createElement(ConditionalLogicSection, {
        entity,
        schema: testSchema,
        surface: "dark",
        onChange: vi.fn(),
      })
    );

    // Section header present
    expect(html).toContain("CONDITIONAL LOGIC");
    // No badge when rules is empty
    expect(html).not.toMatch(/CONDITIONAL LOGIC \(\d+\)/);
    // AND/OR toggle NOT visible in collapsed state
    expect(html).not.toContain("AND");
  });

  it("header shows (2) when 2 rules present", async () => {
    vi.resetModules();
    const { ConditionalLogicSection } = await import(
      "@/components/form-builder/conditional-logic-section"
    );

    const entity = {
      id: ROOT_FIELD_A,
      type: "textField",
      attributes: {
        label: "Root A",
        visibilityRules: {
          logic: "and",
          rules: [
            { sourceEntityId: ROOT_FIELD_B, operator: "equals", value: "x", action: "show" },
            { sourceEntityId: ROOT_FIELD_B, operator: "equals", value: "y", action: "hide" },
          ],
        },
      },
    };

    const html = renderToStaticMarkup(
      React.createElement(ConditionalLogicSection, {
        entity,
        schema: testSchema,
        surface: "dark",
        onChange: vi.fn(),
      })
    );

    expect(html).toContain("CONDITIONAL LOGIC (2)");
  });
});

// ---------------------------------------------------------------------------
// Test 3: Expanded view renders toggle + rows + add-condition button
// ---------------------------------------------------------------------------

describe("ConditionalLogicSection — expanded state", () => {
  it("expanded view shows AND/OR toggle + rule rows + add-condition button", async () => {
    vi.resetModules();

    // We can't click in renderToStaticMarkup; we need a wrapper that starts expanded.
    const { ConditionalLogicSection } = await import(
      "@/components/form-builder/conditional-logic-section"
    );

    const entity = {
      id: ROOT_FIELD_A,
      type: "textField",
      attributes: {
        label: "Root A",
        visibilityRules: {
          logic: "and",
          rules: [
            { sourceEntityId: ROOT_FIELD_B, operator: "equals", value: "x", action: "show" },
          ],
        },
      },
    };

    // Render with defaultExpanded=true prop (component accepts this for test-only forced expansion)
    const html = renderToStaticMarkup(
      React.createElement(ConditionalLogicSection, {
        entity,
        schema: testSchema,
        surface: "dark",
        onChange: vi.fn(),
        defaultExpanded: true,
      })
    );

    // AND/OR toggle
    expect(html).toContain("AND");
    expect(html).toContain("OR");
    // Add-condition button
    expect(html).toContain("+ Add condition");
    // Rule row — at least one
    expect(html).toMatch(/— field —/);
  });
});

// ---------------------------------------------------------------------------
// Test 4: add-condition click appends a default-shape rule
// ---------------------------------------------------------------------------

describe("ConditionalLogicSection — add-condition behaviour", () => {
  it("onChange is called with a new default rule appended when add-condition is invoked", async () => {
    vi.resetModules();

    // Since we can't simulate clicks with renderToStaticMarkup, we test the onChange logic
    // by importing the component and inspecting its default rule factory directly.
    // We do this by rendering a wrapper that tracks onChange calls.

    // Import the component module and look for the exported DEFAULT_NEW_RULE or equivalent
    const mod = await import("@/components/form-builder/conditional-logic-section");

    // The component must export a DEFAULT_NEW_RULE constant or the factory must produce:
    // { sourceEntityId: "", operator: "equals", value: null, action: "show" }
    expect(mod.DEFAULT_NEW_RULE).toBeDefined();
    expect(mod.DEFAULT_NEW_RULE).toMatchObject({
      sourceEntityId: "",
      operator: "equals",
      value: null,
      action: "show",
    });
  });
});

// ---------------------------------------------------------------------------
// Test 5: Action dropdown excludes "require" for computedField host
// ---------------------------------------------------------------------------

describe("RuleRow — action dropdown A7 filter", () => {
  it("action dropdown for computedField host does NOT include 'require'", async () => {
    vi.resetModules();
    const { RuleRow } = await import("@/components/form-builder/rule-row");

    const rule = {
      sourceEntityId: ROOT_FIELD_A,
      operator: "equals" as const,
      value: "test",
      action: "show" as const,
    };

    const html = renderToStaticMarkup(
      React.createElement(RuleRow, {
        rule,
        index: 0,
        hostEntityId: SIBLING_B,
        hostEntityType: "computedField",
        schema: testSchema,
        surface: "dark",
        onChange: vi.fn(),
        onDelete: vi.fn(),
      })
    );

    // "require" must NOT appear in action options
    // We check value= attributes in the options
    expect(html).not.toContain('value="require"');
    // "show" and "hide" must appear
    expect(html).toContain('value="show"');
    expect(html).toContain('value="hide"');
  });

  it("action dropdown for textField host includes 'require'", async () => {
    vi.resetModules();
    const { RuleRow } = await import("@/components/form-builder/rule-row");

    const rule = {
      sourceEntityId: ROOT_FIELD_A,
      operator: "equals" as const,
      value: "test",
      action: "show" as const,
    };

    const html = renderToStaticMarkup(
      React.createElement(RuleRow, {
        rule,
        index: 0,
        hostEntityId: SIBLING_B,
        hostEntityType: "textField",
        schema: testSchema,
        surface: "dark",
        onChange: vi.fn(),
        onDelete: vi.fn(),
      })
    );

    expect(html).toContain('value="require"');
    expect(html).toContain('value="show"');
    expect(html).toContain('value="hide"');
  });
});

// ---------------------------------------------------------------------------
// Test 6: Source-field dropdown excludes self (hostEntityId)
// ---------------------------------------------------------------------------

describe("RuleRow — source-field dropdown scope D-03", () => {
  it("source-field dropdown excludes the host entity itself", async () => {
    vi.resetModules();
    const { RuleRow } = await import("@/components/form-builder/rule-row");

    const rule = {
      sourceEntityId: "",
      operator: "equals" as const,
      value: null,
      action: "show" as const,
    };

    // Host is SIBLING_B — should appear in schema but not in its own dropdown
    const html = renderToStaticMarkup(
      React.createElement(RuleRow, {
        rule,
        index: 0,
        hostEntityId: SIBLING_B,
        hostEntityType: "selectField",
        schema: testSchema,
        surface: "dark",
        onChange: vi.fn(),
        onDelete: vi.fn(),
      })
    );

    // SIBLING_B's label "Repair urgency" should NOT be in the source dropdown options
    // (It may appear in action area or other elements, but not as an <option value={SIBLING_B}>)
    expect(html).not.toContain(`value="${SIBLING_B}"`);
  });

  it("source-field dropdown INCLUDES same-scope sibling (SIBLING_A shares REP_SECTION with SIBLING_B)", async () => {
    vi.resetModules();
    const { RuleRow } = await import("@/components/form-builder/rule-row");

    const rule = {
      sourceEntityId: "",
      operator: "equals" as const,
      value: null,
      action: "show" as const,
    };

    const html = renderToStaticMarkup(
      React.createElement(RuleRow, {
        rule,
        index: 0,
        hostEntityId: SIBLING_B,
        hostEntityType: "selectField",
        schema: testSchema,
        surface: "dark",
        onChange: vi.fn(),
        onDelete: vi.fn(),
      })
    );

    // SIBLING_A (Door condition) shares REP_SECTION with SIBLING_B — MUST appear
    expect(html).toContain(`value="${SIBLING_A}"`);
    // Root fields should also appear (ancestor scope)
    expect(html).toContain(`value="${ROOT_FIELD_A}"`);
    expect(html).toContain(`value="${ROOT_FIELD_B}"`);
  });

  it("source-field dropdown EXCLUDES cross-instance fields from OTHER_REP", async () => {
    vi.resetModules();
    const { RuleRow } = await import("@/components/form-builder/rule-row");

    const rule = {
      sourceEntityId: "",
      operator: "equals" as const,
      value: null,
      action: "show" as const,
    };

    const html = renderToStaticMarkup(
      React.createElement(RuleRow, {
        rule,
        index: 0,
        hostEntityId: SIBLING_B,
        hostEntityType: "selectField",
        schema: testSchema,
        surface: "dark",
        onChange: vi.fn(),
        onDelete: vi.fn(),
      })
    );

    // CROSS_INST is inside OTHER_REP — cross-instance, MUST be excluded
    expect(html).not.toContain(`value="${CROSS_INST}"`);
    // The OTHER_REP itself is a repeatingSection — also excluded
    expect(html).not.toContain(`value="${OTHER_REP}"`);
    // REP_SECTION is the parent container — excluded from source dropdown
    expect(html).not.toContain(`value="${REP_SECTION}"`);
  });
});
