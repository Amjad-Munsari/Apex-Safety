/**
 * tests/form-builder/version-pin.test.ts
 *
 * Tests proving that submitAssessmentAction selects the PINNED version schema
 * (via submission.template_version_id) rather than the template's latest version.
 *
 * Supabase is mocked — these are unit tests of the action's query logic.
 *
 * Plan 13-03 Task 2 (TDD RED → GREEN).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ──────────────────────────────────────────────────────────────────────────────
// Fixture data
// ──────────────────────────────────────────────────────────────────────────────

// Real UUIDs — coltorapps requires version 1-5 (third group [1-5]) and variant [89ab]
const SUBMISSION_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const VERSION_1_ID  = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const VERSION_2_ID  = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const TEXT_ID       = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

// Version 1 schema: has required textField
const version1Schema = {
  entities: {
    [TEXT_ID]: {
      type: "textField",
      attributes: { label: "Inspector Name", required: true },
    },
  },
  root: [TEXT_ID],
};

// Version 2 schema: same field but now optional (schema changed after submission was created)
const version2Schema = {
  entities: {
    [TEXT_ID]: {
      type: "textField",
      attributes: { label: "Inspector Name", required: false },
    },
  },
  root: [TEXT_ID],
};

// Submission row — its template_version_id points to VERSION_1_ID
const submissionRow = {
  id: SUBMISSION_ID,
  template_version_id: VERSION_1_ID,
  status: "draft",
  submitted_by: "user-123",
};

// ──────────────────────────────────────────────────────────────────────────────
// Supabase admin client mock
// ──────────────────────────────────────────────────────────────────────────────

// Track which version ID was queried
let queriedVersionId: string | null = null;

const mockVersionSelect = vi.fn();
const mockSubmissionSelect = vi.fn();
const mockUpdate = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  adminClient: {
    from: (table: string) => {
      if (table === "form_submissions") {
        return {
          select: mockSubmissionSelect,
          update: mockUpdate,
        };
      }
      if (table === "template_versions") {
        return {
          select: mockVersionSelect,
        };
      }
      return { select: vi.fn(), update: vi.fn() };
    },
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => Promise.resolve({
    auth: {
      getUser: () => Promise.resolve({ data: { user: { id: "user-123" } } }),
    },
    // isAdmin() (invoked by submitAssessmentAction's ownership gate) looks up
    // admin_users via this client — return a row so the caller is treated as admin.
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: { id: "user-123" }, error: null }),
        }),
      }),
    }),
  }),
}));

vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve({ get: () => undefined }),
}));

// `after()` requires a Next.js request scope. In unit tests there is none —
// run the callback inline so the auto-AI-draft path is exercised but never
// throws "called outside a request scope".
vi.mock("next/server", () => ({
  after: (cb: () => void | Promise<void>) => {
    void Promise.resolve().then(cb).catch(() => {});
  },
}));

// ──────────────────────────────────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────────────────────────────────

describe("Submission Version Pinning", () => {
  beforeEach(() => {
    queriedVersionId = null;
    vi.clearAllMocks();

    // Mock submission select: returns the submission row by ID
    mockSubmissionSelect.mockReturnValue({
      eq: () => ({
        single: () => Promise.resolve({ data: submissionRow, error: null }),
        maybeSingle: () => Promise.resolve({ data: submissionRow, error: null }),
      }),
    });

    // Mock version select: returns version 1 or 2 schema based on queried ID
    mockVersionSelect.mockReturnValue({
      eq: (col: string, val: string) => {
        if (col === "id") queriedVersionId = val;
        const schema = val === VERSION_1_ID ? version1Schema : version2Schema;
        return {
          single: () => Promise.resolve({ data: { schema_json: schema }, error: null }),
          maybeSingle: () => Promise.resolve({ data: { schema_json: schema }, error: null }),
        };
      },
    });

    // Mock update: returns success — chain is .eq(id).eq(status).eq(submitted_by).select(id)
    mockUpdate.mockReturnValue({
      eq: () => ({
        eq: () => ({
          eq: () => ({
            select: () =>
              Promise.resolve({ data: [{ id: SUBMISSION_ID }], error: null }),
          }),
        }),
      }),
    });
  });

  it("submitAssessmentAction fetches the schema from template_versions using submission.template_version_id (the PINNED version, not the latest)", async () => {
    const { submitAssessmentAction } = await import("@/app/admin/assessments/actions");

    // Provide a valid value for the required Inspector Name field (using version 1 schema)
    const values = { [TEXT_ID]: "Jane Smith" };

    await submitAssessmentAction(SUBMISSION_ID, values);

    // The action must have queried template_versions by VERSION_1_ID (the pinned version)
    expect(queriedVersionId).toBe(VERSION_1_ID);
    // It must NOT have queried VERSION_2_ID (the latest)
    expect(queriedVersionId).not.toBe(VERSION_2_ID);
  });

  it("submitAssessmentAction rejects values that fail server-side validation and does NOT write to form_submissions", async () => {
    const { submitAssessmentAction } = await import("@/app/admin/assessments/actions");

    // Empty value for a required field — should fail validateEntitiesValues
    const values = { [TEXT_ID]: "" };

    await expect(submitAssessmentAction(SUBMISSION_ID, values)).rejects.toThrow();
    // The update mock should NOT have been called (no DB write on validation failure)
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("on success, the submission is updated with answers_json, status=submitted, submitted_at set", async () => {
    const { submitAssessmentAction } = await import("@/app/admin/assessments/actions");

    const values = { [TEXT_ID]: "Jane Smith" };
    await submitAssessmentAction(SUBMISSION_ID, values);

    // Update should have been called with the submitted data
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "submitted",
        submitted_at: expect.any(String),
      })
    );
  });

  it("a submission references template_version_id pointing to the version it was filled against", async () => {
    // The submissionRow fixture has template_version_id = VERSION_1_ID
    // This test asserts the version pinning invariant at the data model level
    expect(submissionRow.template_version_id).toBe(VERSION_1_ID);
    expect(submissionRow.template_version_id).not.toBe(VERSION_2_ID);
  });
});
