/**
 * Tests for CycleErrorBanner component (Phase 15 Plan 07).
 *
 * Uses renderToStaticMarkup (react-dom/server) — same pattern as renderers.test.tsx.
 * String-grepping rendered HTML for key affordances.
 *
 * Test cases (5):
 *   1. Renders nothing when selectedEntityId is not in any cycle or scope error.
 *   2. Renders cycle banner with truncated labels for a 4-hop cycle (≥4 labels → truncate at 3 + "…").
 *   3. Renders cross-instance scope error banner with correct copy.
 *   4. Renders root-references-inside-repeating banner with correct copy.
 *   5. Renders orphan-source advisory banner with the advisory copy.
 */

import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect, vi } from "vitest";
import React from "react";

// ── Fixture helpers ────────────────────────────────────────────────────────────

const ENTITY_A = "entity-a";
const ENTITY_B = "entity-b";
const ENTITY_C = "entity-c";
const ENTITY_D = "entity-d";
const ENTITY_E = "entity-e"; // not part of any cycle

// ── Test 1: Renders nothing when entity not in any cycle/scope ─────────────────

describe("CycleErrorBanner — no match", () => {
  it("renders nothing when selectedEntityId is not in any cycle or scope error", async () => {
    const { CycleErrorBanner } = await import(
      "@/components/form-builder/cycle-error-banner"
    );

    const html = renderToStaticMarkup(
      React.createElement(CycleErrorBanner, {
        cycles: [
          {
            entityIds: [ENTITY_A, ENTITY_B, ENTITY_A],
            labels: ["Field A", "Field B", "Field A"],
          },
        ],
        scopeErrors: [],
        selectedEntityId: ENTITY_E, // not in the cycle
        surface: "dark",
      })
    );

    // Nothing rendered for an entity not in the cycle
    expect(html).toBe("");
  });

  it("renders nothing when cycles and scopeErrors are both empty", async () => {
    vi.resetModules();
    const { CycleErrorBanner } = await import(
      "@/components/form-builder/cycle-error-banner"
    );

    const html = renderToStaticMarkup(
      React.createElement(CycleErrorBanner, {
        cycles: [],
        scopeErrors: [],
        selectedEntityId: ENTITY_A,
        surface: "dark",
      })
    );

    expect(html).toBe("");
  });
});

// ── Test 2: Cycle banner with truncated labels for a 4-hop cycle ───────────────

describe("CycleErrorBanner — cycle banner", () => {
  it("renders cycle banner with truncated labels for a 4-hop cycle (≥4 hops → join first 3 + '…')", async () => {
    vi.resetModules();
    const { CycleErrorBanner } = await import(
      "@/components/form-builder/cycle-error-banner"
    );

    // 4-hop cycle: A → B → C → D → A (labels repeated at end to close loop)
    const html = renderToStaticMarkup(
      React.createElement(CycleErrorBanner, {
        cycles: [
          {
            entityIds: [ENTITY_A, ENTITY_B, ENTITY_C, ENTITY_D, ENTITY_A],
            labels: ["Field A", "Field B", "Field C", "Field D", "Field A"],
          },
        ],
        scopeErrors: [],
        selectedEntityId: ENTITY_A,
        surface: "dark",
      })
    );

    // Should render the banner
    expect(html).not.toBe("");
    // Truncated at 3 hops + "…"
    expect(html).toContain("Field A");
    expect(html).toContain("Field B");
    expect(html).toContain("Field C");
    expect(html).toContain("…");
    // Field D is the 4th label, should be truncated (not present after "…")
    // (It may appear before the ellipsis but we check the truncation string)
    expect(html).toContain("Circular rule:");
    // Second line instruction
    expect(html).toContain("Remove a rule above to break the cycle.");
    // Destructive palette — check className substring per UI-SPEC §2
    expect(html).toContain("border-[#8b2b21]/40");
    expect(html).toContain("bg-[#8b2b21]/10");
  });

  it("renders cycle banner with 3-hop cycle (no truncation needed)", async () => {
    vi.resetModules();
    const { CycleErrorBanner } = await import(
      "@/components/form-builder/cycle-error-banner"
    );

    const html = renderToStaticMarkup(
      React.createElement(CycleErrorBanner, {
        cycles: [
          {
            entityIds: [ENTITY_A, ENTITY_B, ENTITY_A],
            labels: ["Field A", "Field B", "Field A"],
          },
        ],
        scopeErrors: [],
        selectedEntityId: ENTITY_B,
        surface: "dark",
      })
    );

    expect(html).not.toBe("");
    expect(html).toContain("Circular rule:");
    expect(html).toContain("Field A");
    expect(html).toContain("Field B");
    // No ellipsis for ≤3 unique labels
    expect(html).not.toContain("…");
    expect(html).toContain("Remove a rule above to break the cycle.");
  });
});

// ── Test 3: Cross-instance scope error ───────────────────────────────────────

describe("CycleErrorBanner — scope error: cross-instance", () => {
  it("renders cross-instance scope banner with correct copy", async () => {
    vi.resetModules();
    const { CycleErrorBanner } = await import(
      "@/components/form-builder/cycle-error-banner"
    );

    const html = renderToStaticMarkup(
      React.createElement(CycleErrorBanner, {
        cycles: [],
        scopeErrors: [
          {
            consumerId: ENTITY_A,
            sourceId: ENTITY_B,
            consumerLabel: "Field A",
            sourceLabel: "Field B",
            reason: "cross-instance" as const,
          },
        ],
        selectedEntityId: ENTITY_A,
        surface: "dark",
      })
    );

    expect(html).not.toBe("");
    expect(html).toContain("Cross-instance rule rejected:");
    expect(html).toContain("Field B");
    expect(html).toContain("is in a different instance");
    expect(html).toContain("Pick a sibling in this instance or an ancestor field.");
    // Destructive palette
    expect(html).toContain("border-[#8b2b21]/40");
  });
});

// ── Test 4: Root-references-inside-repeating scope error ──────────────────────

describe("CycleErrorBanner — scope error: root-references-inside-repeating", () => {
  it("renders root-references-inside-repeating banner with correct copy", async () => {
    vi.resetModules();
    const { CycleErrorBanner } = await import(
      "@/components/form-builder/cycle-error-banner"
    );

    const html = renderToStaticMarkup(
      React.createElement(CycleErrorBanner, {
        cycles: [],
        scopeErrors: [
          {
            consumerId: ENTITY_C,
            sourceId: ENTITY_D,
            consumerLabel: "Root Field",
            sourceLabel: "Inside Repeating",
            reason: "root-references-inside-repeating" as const,
          },
        ],
        selectedEntityId: ENTITY_C,
        surface: "dark",
      })
    );

    expect(html).not.toBe("");
    expect(html).toContain("Cannot reference inside a repeating section from root:");
    expect(html).toContain("Inside Repeating");
    expect(html).toContain("Pick a root field or move this rule into the repeating section.");
  });
});

// ── Test 5: Orphan-source advisory banner ─────────────────────────────────────

describe("CycleErrorBanner — scope error: orphan-source (advisory)", () => {
  it("renders orphan-source advisory banner with advisory copy", async () => {
    vi.resetModules();
    const { CycleErrorBanner } = await import(
      "@/components/form-builder/cycle-error-banner"
    );

    const html = renderToStaticMarkup(
      React.createElement(CycleErrorBanner, {
        cycles: [],
        scopeErrors: [
          {
            consumerId: ENTITY_A,
            sourceId: "deleted-entity-id",
            consumerLabel: "Field A",
            sourceLabel: "Deleted Field",
            reason: "orphan-source" as const,
            severity: "advisory" as const,
          },
        ],
        selectedEntityId: ENTITY_A,
        surface: "dark",
      })
    );

    expect(html).not.toBe("");
    expect(html).toContain("Source field deleted:");
    expect(html).toContain("Deleted Field");
    expect(html).toContain("Remove this rule or pick a new source.");
  });
});
