/**
 * Tests for expandRepeatingSections (app/admin/assessments/actions.ts)
 *
 * Pure-function tests — no Supabase, no mocking needed.
 *
 * Contract (RESEARCH Pattern 10):
 * - Input: (schema, answers) where schema has entities map and answers is a
 *   flat Record<entityId, value>
 * - Output: shallow clone of answers where each repeatingSection key is
 *   replaced by an array of {instanceIndex, [childLabel1]: value, ...}
 * - Non-repeatingSection keys pass through unchanged
 * - If a repeatingSection exists in schema but has no answer value, leave
 *   the key as-is
 * - Pure / non-mutating
 */

import { describe, it, expect, vi } from "vitest";

// ── Mock server-only dependencies so actions.ts can be imported in jsdom ─────
// (Same pattern as upload-media-action.test.ts — Phase 13 13-02 SUMMARY deviation #4)
vi.mock("@/lib/auth-helpers", () => ({
  requireActorUserId: vi.fn().mockResolvedValue("mock-admin-user-id"),
  getActorUserId: vi.fn().mockResolvedValue("mock-admin-user-id"),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/server", () => ({ after: vi.fn((fn: () => unknown) => fn()) }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("ai", () => ({ generateObject: vi.fn() }));
vi.mock("@ai-sdk/openai", () => ({ createOpenAI: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u1" } } }) },
  }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  adminClient: {
    storage: { from: vi.fn(() => ({ upload: vi.fn(), remove: vi.fn(), createSignedUrl: vi.fn() })) },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      update: vi.fn().mockReturnThis(),
      insert: vi.fn().mockResolvedValue({ error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      delete: vi.fn().mockReturnThis(),
    })),
  },
}));

import { expandRepeatingSections } from "@/app/admin/assessments/actions";

// Use real RFC-4122-style UUIDs for entity IDs
const REP_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
const CHILD_ID_1 = "b2c3d4e5-f6a7-8901-bcde-f12345678901";
const CHILD_ID_2 = "c3d4e5f6-a7b8-9012-cdef-123456789012";
const TEXT_ID = "d4e5f6a7-b8c9-0123-defa-234567890123";
const SELECT_ID = "e5f6a7b8-c9d0-1234-efab-345678901234";

// ── Minimal schema factories ─────────────────────────────────────────────────

function makeTextEntity(label: string) {
  return { type: "textField", attributes: { label } };
}

function makeSelectEntity(label: string) {
  return { type: "selectField", attributes: { label } };
}

function makeRepeatingSectionEntity(childIds: string[], sectionTitle = "Doors") {
  return {
    type: "repeatingSection",
    children: childIds,
    attributes: { sectionTitle },
  };
}

function makeChildEntity(label: string) {
  return {
    type: "textField",
    attributes: { label },
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("expandRepeatingSections — empty inputs", () => {
  it("empty schema + empty answers returns {}", () => {
    const result = expandRepeatingSections({ entities: {} }, {});
    expect(result).toEqual({});
  });

  it("schema with entities + empty answers returns {}", () => {
    const schema = {
      entities: {
        [TEXT_ID]: makeTextEntity("Name"),
      },
    };
    const result = expandRepeatingSections(schema, {});
    expect(result).toEqual({});
  });
});

describe("expandRepeatingSections — non-repeatingSection passthrough", () => {
  it("textField answer passes through unchanged", () => {
    const schema = {
      entities: {
        [TEXT_ID]: makeTextEntity("Description"),
      },
    };
    const answers = { [TEXT_ID]: "hello world" };
    const result = expandRepeatingSections(schema, answers);
    expect(result).toEqual({ [TEXT_ID]: "hello world" });
  });

  it("multiple non-repeating fields pass through unchanged", () => {
    const schema = {
      entities: {
        [TEXT_ID]: makeTextEntity("Name"),
        [SELECT_ID]: makeSelectEntity("Risk Level"),
      },
    };
    const answers = { [TEXT_ID]: "John", [SELECT_ID]: "High" };
    const result = expandRepeatingSections(schema, answers);
    expect(result).toEqual(answers);
  });
});

describe("expandRepeatingSections — single repeatingSection", () => {
  const schema = {
    entities: {
      [REP_ID]: makeRepeatingSectionEntity([CHILD_ID_1, CHILD_ID_2]),
      [CHILD_ID_1]: makeChildEntity("Location"),
      [CHILD_ID_2]: makeChildEntity("Condition"),
    },
  };

  it("expands two instances with labelled objects and instanceIndex", () => {
    const answers = {
      [REP_ID]: {
        instances: [
          { [CHILD_ID_1]: "door 1", [CHILD_ID_2]: "good" },
          { [CHILD_ID_1]: "door 2", [CHILD_ID_2]: "poor" },
        ],
      },
    };
    const result = expandRepeatingSections(schema, answers);
    expect(result[REP_ID]).toEqual([
      { instanceIndex: 1, Location: "door 1", Condition: "good" },
      { instanceIndex: 2, Location: "door 2", Condition: "poor" },
    ]);
  });

  it("instanceIndex is 1-based", () => {
    const answers = {
      [REP_ID]: {
        instances: [{ [CHILD_ID_1]: "door A", [CHILD_ID_2]: "marginal" }],
      },
    };
    const result = expandRepeatingSections(schema, answers);
    const expanded = result[REP_ID] as Array<Record<string, unknown>>;
    expect(expanded[0].instanceIndex).toBe(1);
  });

  it("uses child entity attributes.label as the key", () => {
    const answers = {
      [REP_ID]: {
        instances: [{ [CHILD_ID_1]: "loc A", [CHILD_ID_2]: "good" }],
      },
    };
    const result = expandRepeatingSections(schema, answers);
    const expanded = result[REP_ID] as Array<Record<string, unknown>>;
    expect(Object.keys(expanded[0])).toContain("Location");
    expect(Object.keys(expanded[0])).toContain("Condition");
    // Entity IDs should NOT appear as keys
    expect(Object.keys(expanded[0])).not.toContain(CHILD_ID_1);
    expect(Object.keys(expanded[0])).not.toContain(CHILD_ID_2);
  });
});

describe("expandRepeatingSections — missing child label fallback", () => {
  it("falls back to entity ID when child has no attributes.label", () => {
    const UNLABELLED_CHILD = "f6a7b8c9-d0e1-2345-fabc-456789012345";
    const schema = {
      entities: {
        [REP_ID]: makeRepeatingSectionEntity([UNLABELLED_CHILD]),
        [UNLABELLED_CHILD]: {
          // No label attribute
          type: "textField",
          attributes: {},
        },
      },
    };
    const answers = {
      [REP_ID]: {
        instances: [{ [UNLABELLED_CHILD]: "some value" }],
      },
    };
    const result = expandRepeatingSections(schema, answers);
    const expanded = result[REP_ID] as Array<Record<string, unknown>>;
    // Falls back to entity ID as the key
    expect(expanded[0][UNLABELLED_CHILD]).toBe("some value");
  });

  it("falls back to entity ID when child entity is not in schema", () => {
    // Child is referenced in children[] but not in schema.entities
    const GHOST_CHILD = "a7b8c9d0-e1f2-3456-abcd-567890123456";
    const schema = {
      entities: {
        [REP_ID]: makeRepeatingSectionEntity([GHOST_CHILD]),
        // GHOST_CHILD is NOT in schema.entities
      },
    };
    const answers = {
      [REP_ID]: {
        instances: [{ [GHOST_CHILD]: "ghost value" }],
      },
    };
    const result = expandRepeatingSections(schema, answers);
    const expanded = result[REP_ID] as Array<Record<string, unknown>>;
    expect(expanded[0][GHOST_CHILD]).toBe("ghost value");
  });
});

describe("expandRepeatingSections — missing answer for repeatingSection", () => {
  it("leaves the key as-is when repeatingSection has no answer entry", () => {
    const schema = {
      entities: {
        [REP_ID]: makeRepeatingSectionEntity([CHILD_ID_1]),
        [CHILD_ID_1]: makeChildEntity("Location"),
      },
    };
    // No entry for REP_ID in answers
    const answers = { [TEXT_ID]: "hello" };
    const result = expandRepeatingSections(schema, answers);
    // REP_ID should NOT have been injected as []
    expect(result[REP_ID]).toBeUndefined();
    expect(result[TEXT_ID]).toBe("hello");
  });

  it("leaves the key as-is when instances array is missing", () => {
    const schema = {
      entities: {
        [REP_ID]: makeRepeatingSectionEntity([CHILD_ID_1]),
        [CHILD_ID_1]: makeChildEntity("Location"),
      },
    };
    // Entry exists but no instances
    const answers = { [REP_ID]: {} };
    const result = expandRepeatingSections(schema, answers);
    // Original value is preserved (shallow copy)
    expect(result[REP_ID]).toEqual({});
  });
});

describe("expandRepeatingSections — mixed schema", () => {
  it("only expands repeatingSection; text + select pass through unchanged", () => {
    const schema = {
      entities: {
        [TEXT_ID]: makeTextEntity("Site Name"),
        [REP_ID]: makeRepeatingSectionEntity([CHILD_ID_1, CHILD_ID_2]),
        [CHILD_ID_1]: makeChildEntity("Location"),
        [CHILD_ID_2]: makeChildEntity("Condition"),
        [SELECT_ID]: makeSelectEntity("Overall Risk"),
      },
    };
    const answers = {
      [TEXT_ID]: "Acme HQ",
      [REP_ID]: {
        instances: [
          { [CHILD_ID_1]: "Main entrance", [CHILD_ID_2]: "good" },
          { [CHILD_ID_1]: "Fire exit B", [CHILD_ID_2]: "poor" },
        ],
      },
      [SELECT_ID]: "High",
    };
    const result = expandRepeatingSections(schema, answers);

    // Non-repeating fields unchanged
    expect(result[TEXT_ID]).toBe("Acme HQ");
    expect(result[SELECT_ID]).toBe("High");

    // RepeatingSectionfield expanded
    const expanded = result[REP_ID] as Array<Record<string, unknown>>;
    expect(expanded).toHaveLength(2);
    expect(expanded[0]).toEqual({
      instanceIndex: 1,
      Location: "Main entrance",
      Condition: "good",
    });
    expect(expanded[1]).toEqual({
      instanceIndex: 2,
      Location: "Fire exit B",
      Condition: "poor",
    });
  });
});

describe("expandRepeatingSections — purity and non-mutation", () => {
  it("does not mutate the input answers object", () => {
    const schema = {
      entities: {
        [REP_ID]: makeRepeatingSectionEntity([CHILD_ID_1]),
        [CHILD_ID_1]: makeChildEntity("Location"),
      },
    };
    const originalInstances = [{ [CHILD_ID_1]: "door A" }];
    const answers = { [REP_ID]: { instances: originalInstances } };
    const answersBefore = JSON.stringify(answers);

    expandRepeatingSections(schema, answers);

    // Input must not be mutated
    expect(JSON.stringify(answers)).toBe(answersBefore);
  });

  it("calling twice with same input produces deeply equal output", () => {
    const schema = {
      entities: {
        [REP_ID]: makeRepeatingSectionEntity([CHILD_ID_1, CHILD_ID_2]),
        [CHILD_ID_1]: makeChildEntity("Location"),
        [CHILD_ID_2]: makeChildEntity("Condition"),
      },
    };
    const answers = {
      [REP_ID]: {
        instances: [
          { [CHILD_ID_1]: "door 1", [CHILD_ID_2]: "good" },
          { [CHILD_ID_1]: "door 2", [CHILD_ID_2]: "poor" },
        ],
      },
    };
    const result1 = expandRepeatingSections(schema, answers);
    const result2 = expandRepeatingSections(schema, answers);
    expect(result1).toEqual(result2);
  });

  it("threat T-14-03-06: extra child keys NOT in schema.children are excluded", () => {
    // User crafted an extra key in the instance that isn't in the pinned children list
    const EXTRA_KEY = "99999999-9999-9999-9999-999999999999";
    const schema = {
      entities: {
        [REP_ID]: makeRepeatingSectionEntity([CHILD_ID_1]), // only CHILD_ID_1 is in children
        [CHILD_ID_1]: makeChildEntity("Location"),
        // EXTRA_KEY not in children list
      },
    };
    const answers = {
      [REP_ID]: {
        instances: [
          {
            [CHILD_ID_1]: "door A",
            [EXTRA_KEY]: "crafted injection", // attacker key
          },
        ],
      },
    };
    const result = expandRepeatingSections(schema, answers);
    const expanded = result[REP_ID] as Array<Record<string, unknown>>;

    // Only CHILD_ID_1's label and instanceIndex should appear
    expect(Object.keys(expanded[0])).toEqual(["instanceIndex", "Location"]);
    // Attacker-supplied key is excluded
    expect(expanded[0][EXTRA_KEY]).toBeUndefined();
  });
});
