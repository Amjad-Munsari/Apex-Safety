// Phase 16 Plan 08 — customer self-fill submission tests (gap closure §D)
//
// D-16: customer-built template fill creates a form_submissions draft
//       (assignment_id: null, status: 'draft') before mounting the fill client,
//       then UPDATEs to status='submitted' on final submit.
//       client_id is taken from server context (getClientContext), never
//       from client-supplied input.
//
// Plan 16-08 update: createCustomerTemplateDraftSubmission (INSERT draft) and
// submitCustomerTemplateFillByIdAction (UPDATE path) replace the old INSERT-on-submit
// action (submitCustomerTemplateFillAction).

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Spy references ────────────────────────────────────────────────────────────

// Tracks the payload passed to form_submissions INSERT (createCustomerTemplateDraftSubmission)
const insertSpy = vi.fn();

// Tracks the UPDATE call (submitCustomerTemplateFillByIdAction)
const updateSubmissionSpy = vi.fn();
const eqSubmissionIdSpy = vi.fn();
const eqSubmissionClientSpy = vi.fn();

// Tracks the maybySingle result for template_versions (latest published version)
const versionMaybeSingleSpy = vi.fn();

// Tracks the single result for form_templates (ownership check in requireOwnedTemplate)
const templateSingleSpy = vi.fn();

// ── Supabase mock factory ────────────────────────────────────────────────────

function makeFromMock(table: string) {
  if (table === "form_templates") {
    // requireOwnedTemplate: .select().eq("id", ...).single()
    templateSingleSpy.mockResolvedValue({
      data: {
        id: "tmpl-1",
        owner_type: "customer",
        owner_id: "client-org-001",
        deleted_at: null,
      },
      error: null,
    });
    const eqSpy = vi.fn().mockReturnValue({ single: templateSingleSpy });
    const selectSpy = vi.fn().mockReturnValue({ eq: eqSpy });
    return { select: selectSpy };
  }

  if (table === "template_versions") {
    // createCustomerTemplateDraftSubmission:
    //   .select("id").eq("template_id", ...).not("published_at", "is", null)
    //   .order(...).limit(1).maybeSingle()
    versionMaybeSingleSpy.mockResolvedValue({ data: { id: "ver-1" }, error: null });
    const limitSpy = vi.fn().mockReturnValue({ maybeSingle: versionMaybeSingleSpy });
    const orderSpy = vi.fn().mockReturnValue({ limit: limitSpy });
    const notSpy = vi.fn().mockReturnValue({ order: orderSpy });
    const eqSpy = vi.fn().mockReturnValue({ not: notSpy });
    const selectSpy = vi.fn().mockReturnValue({ eq: eqSpy });
    return { select: selectSpy };
  }

  if (table === "form_submissions") {
    // INSERT (createCustomerTemplateDraftSubmission)
    const singleAfterInsert = vi.fn().mockResolvedValue({ data: { id: "sub-draft-1" }, error: null });
    const selectAfterInsert = vi.fn().mockReturnValue({ single: singleAfterInsert });
    insertSpy.mockReturnValue({ select: selectAfterInsert });

    // UPDATE (submitCustomerTemplateFillByIdAction)
    eqSubmissionClientSpy.mockResolvedValue({ error: null });
    eqSubmissionIdSpy.mockReturnValue({ eq: eqSubmissionClientSpy });
    updateSubmissionSpy.mockReturnValue({ eq: eqSubmissionIdSpy });

    return {
      insert: insertSpy,
      update: updateSubmissionSpy,
    };
  }

  return {};
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    from: vi.fn().mockImplementation(makeFromMock),
  }),
}));

vi.mock("@/lib/auth-helpers", () => ({
  getClientContext: vi.fn().mockResolvedValue({
    client_id: "client-org-001",
    user_id: "user-001",
    role: "client",
  }),
  requireActorUserId: vi.fn().mockResolvedValue("user-001"),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("next/navigation", () => ({
  redirect: vi.fn().mockImplementation(() => {
    throw Object.assign(new Error("NEXT_REDIRECT"), {
      digest: "NEXT_REDIRECT;replace;/client/templates",
    });
  }),
  notFound: vi.fn(),
}));

// ── Import the actions under test ──────────────────────────────────────────────

import {
  createCustomerTemplateDraftSubmission,
  submitCustomerTemplateFillByIdAction,
} from "@/app/client/templates/actions";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

// ── Helper: reset the from mock so each test gets fresh spies ────────────────

function rewireFromMock() {
  const clientMock = (createClient as ReturnType<typeof vi.fn>).mock.results[
    (createClient as ReturnType<typeof vi.fn>).mock.results.length - 1
  ]?.value;
  if (clientMock?.from) {
    (clientMock.from as ReturnType<typeof vi.fn>).mockImplementation(makeFromMock);
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("customer self-fill submission — Phase 16 D-16 (Plan 16-08 UPDATE architecture)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-establish defaults after clearAllMocks
    templateSingleSpy.mockResolvedValue({
      data: {
        id: "tmpl-1",
        owner_type: "customer",
        owner_id: "client-org-001",
        deleted_at: null,
      },
      error: null,
    });
    versionMaybeSingleSpy.mockResolvedValue({ data: { id: "ver-1" }, error: null });

    const singleAfterInsert = vi.fn().mockResolvedValue({ data: { id: "sub-draft-1" }, error: null });
    const selectAfterInsert = vi.fn().mockReturnValue({ single: singleAfterInsert });
    insertSpy.mockReturnValue({ select: selectAfterInsert });

    eqSubmissionClientSpy.mockResolvedValue({ error: null });
    eqSubmissionIdSpy.mockReturnValue({ eq: eqSubmissionClientSpy });
    updateSubmissionSpy.mockReturnValue({ eq: eqSubmissionIdSpy });

    // Re-wire redirect mock after clearAllMocks
    (redirect as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw Object.assign(new Error("NEXT_REDIRECT"), {
        digest: "NEXT_REDIRECT;replace;/client/templates",
      });
    });
  });

  // ── Test (a): createCustomerTemplateDraftSubmission — assignment_id: null ────
  it("createCustomerTemplateDraftSubmission INSERTs form_submissions with assignment_id: null (D-16)", async () => {
    rewireFromMock();

    const result = await createCustomerTemplateDraftSubmission("tmpl-1");

    // Returns the draft id and version id
    expect(result).toHaveProperty("id");
    expect(result).toHaveProperty("versionId");

    // Assert the INSERT into form_submissions has assignment_id: null (D-16)
    expect(insertSpy).toHaveBeenCalledWith(
      expect.objectContaining({ assignment_id: null })
    );
  });

  // ── Test (b): client_id from server context ──────────────────────────────────
  it("createCustomerTemplateDraftSubmission: client_id is taken from server context, not function parameter (T-16-04)", async () => {
    // No client_id parameter in createCustomerTemplateDraftSubmission signature — T-16-04 mitigation
    rewireFromMock();

    await createCustomerTemplateDraftSubmission("tmpl-1");

    // Assert the INSERT payload contains client_id: "client-org-001" from the mocked
    // getClientContext() response. The function signature has no client_id parameter —
    // this verifies T-16-04: client_id always comes from server context.
    expect(insertSpy).toHaveBeenCalledWith(
      expect.objectContaining({ client_id: "client-org-001" })
    );
  });

  // ── Test (c): reads latest published version ──────────────────────────────────
  it("createCustomerTemplateDraftSubmission: reads the latest published version using .not('published_at', 'is', null)", async () => {
    rewireFromMock();

    await createCustomerTemplateDraftSubmission("tmpl-1");

    // The .not("published_at", "is", null) chain resolves through versionMaybeSingleSpy
    expect(versionMaybeSingleSpy).toHaveBeenCalled();
    // The INSERT used the version id returned by maybySingle
    expect(insertSpy).toHaveBeenCalledWith(
      expect.objectContaining({ template_version_id: "ver-1" })
    );
  });

  // ── Test (d): throws when no published version ──────────────────────────────
  it("createCustomerTemplateDraftSubmission throws 'Template has no published version' when no published version exists", async () => {
    rewireFromMock();
    // Override: template_versions maybySingle returns null (no published version)
    versionMaybeSingleSpy.mockResolvedValueOnce({ data: null, error: null });

    await expect(
      createCustomerTemplateDraftSubmission("tmpl-1")
    ).rejects.toThrow("Template has no published version");
  });

  // ── Test (e): submitCustomerTemplateFillByIdAction UPDATE shape ─────────────
  it("submitCustomerTemplateFillByIdAction: UPDATEs draft to status='submitted' with client_id defense-in-depth (T-16-04, T-16-09)", async () => {
    rewireFromMock();
    const answers = { q1: "answer" };

    try {
      await submitCustomerTemplateFillByIdAction("sub-draft-1", answers);
    } catch (err: unknown) {
      // NEXT_REDIRECT is the normal success path — let redirect errors through
      const e = err as { digest?: string; message?: string };
      if (
        !e?.digest?.startsWith("NEXT_REDIRECT") &&
        !e?.message?.includes("NEXT_REDIRECT")
      ) {
        throw err;
      }
    }

    // Assert the UPDATE payload
    expect(updateSubmissionSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        answers_json: answers,
        status: "submitted",
      })
    );

    // Assert client_id defense-in-depth filter (T-16-04, T-16-09)
    expect(eqSubmissionClientSpy).toHaveBeenCalledWith("client_id", "client-org-001");

    // Assert redirect to templates list
    expect(redirect).toHaveBeenCalledWith("/client/templates");
  });
});
