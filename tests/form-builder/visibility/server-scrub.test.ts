/**
 * tests/form-builder/visibility/server-scrub.test.ts
 *
 * Server-side submission scrub tests for submitAssessmentAction.
 *
 * Asserts the Step 3.5 D-01 contract:
 *   hidden-subtree entity values NEVER reach answers_json regardless of client behaviour.
 *
 * Mocking strategy: same vi.mock pattern as expand-repeating-sections.test.ts.
 *   - All server-only transitive deps mocked (supabase/server, auth-helpers, next/*).
 *   - adminClient.from() chain is controlled per-test via module-level refs.
 *   - @coltorapps/builder validateEntitiesValues is mocked to return controlled data.
 *   - evaluateVisibility + stripHiddenAnswers are the REAL implementations from 15-02.
 *
 * Phase 15 Plan 15-05 — COND-01 server enforcement (D-01 contract).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock all transitive server-only dependencies ──────────────────────────────

vi.mock("@/lib/auth-helpers", () => ({
  requireActorUserId: vi.fn().mockResolvedValue("admin-user-001"),
  getActorUserId: vi.fn().mockResolvedValue("admin-user-001"),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("next/server", () => ({ after: vi.fn() }));
vi.mock("ai", () => ({ generateObject: vi.fn() }));
vi.mock("@ai-sdk/openai", () => ({ createOpenAI: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: "admin-user-001" } } }),
    },
  }),
}));

// ── Controlled adminClient mock ───────────────────────────────────────────────
// capturedUpdate is set when .update() is called on form_submissions.
// mockSubmission and mockSchema are set per-test.

let capturedUpdate: Record<string, unknown> | null = null;
let mockSchema: unknown = null;

vi.mock("@/lib/supabase/admin", () => ({
  adminClient: {
    from: (table: string) => {
      if (table === "form_submissions") {
        return {
          select: () => ({
            eq: () => ({
              single: () =>
                Promise.resolve({ data: { template_version_id: "ver-001" }, error: null }),
            }),
          }),
          update: (payload: Record<string, unknown>) => {
            capturedUpdate = payload;
            return {
              eq: () => ({
                eq: () => ({
                  eq: () => ({
                    select: () =>
                      Promise.resolve({ data: [{ id: "sub-id" }], error: null }),
                  }),
                }),
              }),
            };
          },
        };
      }
      if (table === "template_versions") {
        return {
          select: () => ({
            eq: () => ({
              single: () =>
                Promise.resolve({ data: { schema_json: mockSchema }, error: null }),
            }),
          }),
        };
      }
      // Fallback for other tables (e.g., field_media inserts not expected here)
      return {
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: null, error: null }),
          }),
        }),
        insert: () => Promise.resolve({ error: null }),
      };
    },
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn(),
        remove: vi.fn(),
        createSignedUrl: vi.fn(),
      })),
    },
  },
}));

// ── Mock @coltorapps/builder validateEntitiesValues ───────────────────────────
// Returns success:true with controlled mockValidatedData so we can control
// exactly what reaches the Step 3.5 scrub.

let mockValidatedData: Record<string, unknown> = {};

vi.mock("@coltorapps/builder", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@coltorapps/builder")>();
  return {
    ...actual,
    validateEntitiesValues: vi.fn().mockImplementation(() =>
      Promise.resolve({ success: true, data: mockValidatedData })
    ),
  };
});

// ── Import under test AFTER all mocks are declared ───────────────────────────

import { submitAssessmentAction } from "@/app/admin/assessments/actions";

// ── Helper: build a minimal ProgressSchema for testing ────────────────────────

function buildSchema(entities: Record<string, {
  type: string;
  children?: string[];
  attributes?: Record<string, unknown>;
}>) {
  return { entities, root: Object.keys(entities) };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("submitAssessmentAction — Step 3.5 server-side visibility scrub (D-01, COND-01)", () => {
  beforeEach(() => {
    capturedUpdate = null;
    mockSchema = null;
    mockValidatedData = {};
  });

  it("(a) writes answers_json WITHOUT the hidden field key when rule fires", async () => {
    // Schema: field-a triggers hide on field-b when equals "yes"
    mockSchema = buildSchema({
      "field-a": {
        type: "textField",
        attributes: { label: "Trigger", required: false },
      },
      "field-b": {
        type: "textField",
        attributes: {
          label: "Hidden Target",
          required: false,
          visibilityRules: {
            rules: [
              {
                sourceEntityId: "field-a",
                operator: "equals",
                value: "yes",
                action: "hide",
              },
            ],
            logic: "and",
          },
        },
      },
    });

    // Validated input has both fields: field-a = "yes" → field-b hidden
    mockValidatedData = {
      "field-a": "yes",
      "field-b": "secret value that must not reach DB",
    };

    await submitAssessmentAction("sub-001", mockValidatedData);

    expect(capturedUpdate).not.toBeNull();
    const written = capturedUpdate!.answers_json as Record<string, unknown>;
    expect(written).toHaveProperty("field-a", "yes");
    // D-01: hidden field MUST be absent from the written payload
    expect(written).not.toHaveProperty("field-b");
  });

  it("(b) writes answers_json IDENTICAL to validated input when all fields are visible", async () => {
    // Same schema but field-a = "no" — rule does NOT fire, field-b remains visible
    mockSchema = buildSchema({
      "field-a": {
        type: "textField",
        attributes: { label: "Trigger", required: false },
      },
      "field-b": {
        type: "textField",
        attributes: {
          label: "Visible Target",
          required: false,
          visibilityRules: {
            rules: [
              {
                sourceEntityId: "field-a",
                operator: "equals",
                value: "yes",
                action: "hide",
              },
            ],
            logic: "and",
          },
        },
      },
    });

    mockValidatedData = {
      "field-a": "no",
      "field-b": "should be retained",
    };

    await submitAssessmentAction("sub-002", mockValidatedData);

    expect(capturedUpdate).not.toBeNull();
    const written = capturedUpdate!.answers_json as Record<string, unknown>;
    expect(written).toHaveProperty("field-a", "no");
    expect(written).toHaveProperty("field-b", "should be retained");
  });

  it("(c) repeatingSection: per-instance scrub removes hidden child from every instance", async () => {
    // Root trigger field + repeatingSection children; trigger = "hide" → child-conditional hidden
    mockSchema = buildSchema({
      "trigger-field": {
        type: "textField",
        attributes: { label: "Root Trigger", required: false },
      },
      "rep-section": {
        type: "repeatingSection",
        children: ["child-visible", "child-conditional"],
        attributes: { label: "Doors", required: false },
      },
      "child-visible": {
        type: "textField",
        attributes: { label: "Always visible", required: false },
      },
      "child-conditional": {
        type: "textField",
        attributes: {
          label: "Conditionally hidden",
          required: false,
          visibilityRules: {
            rules: [
              {
                sourceEntityId: "trigger-field",
                operator: "equals",
                value: "hide",
                action: "hide",
              },
            ],
            logic: "and",
          },
        },
      },
    });

    mockValidatedData = {
      "trigger-field": "hide",
      "rep-section": {
        instances: [
          { "child-visible": "door 1 label", "child-conditional": "per-instance secret 1" },
          { "child-visible": "door 2 label", "child-conditional": "per-instance secret 2" },
        ],
      },
    };

    await submitAssessmentAction("sub-003", mockValidatedData);

    expect(capturedUpdate).not.toBeNull();
    const written = capturedUpdate!.answers_json as Record<string, unknown>;
    expect(written).toHaveProperty("trigger-field", "hide");

    const repSection = written["rep-section"] as { instances: Array<Record<string, unknown>> };
    expect(repSection).toBeDefined();
    expect(repSection.instances).toHaveLength(2);

    // Each instance: child-visible present, child-conditional absent
    for (const instance of repSection.instances) {
      expect(instance).toHaveProperty("child-visible");
      expect(instance).not.toHaveProperty("child-conditional");
    }
  });
});
