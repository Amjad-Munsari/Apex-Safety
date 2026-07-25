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

// Tracks the UPDATE call (submitCustomerTemplateFillByIdAction):
//   .update(...).eq("id").eq("client_id").eq("status","draft").select("id").maybeSingle()
const updateSubmissionSpy = vi.fn();
const eqSubmissionIdSpy = vi.fn();
const eqSubmissionClientSpy = vi.fn();
const eqSubmissionStatusSpy = vi.fn();
const selectAfterUpdateSpy = vi.fn();
const maybeSingleAfterUpdateSpy = vi.fn();

// Draft-reuse SELECT (createCustomerTemplateDraftSubmission) — {data:null} default so
// the INSERT path is exercised; a dedicated test overrides it to a row.
const draftReuseMaybeSingleSpy = vi.fn();

// Submission-fetch SELECT in submitCustomerTemplateFillByIdAction
// (.select("template_version_id").eq("id").eq("client_id").single())
const submissionFetchSingleSpy = vi.fn();

// schema_json fetch in the submit path (.select("schema_json").eq("id").single())
const versionSchemaSingleSpy = vi.fn();

// Tracks the maybySingle result for template_versions (latest published version)
const versionMaybeSingleSpy = vi.fn();

// Tracks the single result for form_templates (ownership check in requireOwnedTemplate)
const templateSingleSpy = vi.fn();
const scheduleReportDraftGenerationSpy = vi.fn();

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
    const isSpy = vi.fn().mockReturnValue({ single: templateSingleSpy });
    const eqSpy = vi.fn().mockReturnValue({ is: isSpy });
    const selectSpy = vi.fn().mockReturnValue({ eq: eqSpy });
    return { select: selectSpy };
  }

  if (table === "template_versions") {
    versionMaybeSingleSpy.mockResolvedValue({ data: { id: "ver-1" }, error: null });
    versionSchemaSingleSpy.mockResolvedValue({
      data: { schema_json: { entities: {}, root: [] } },
      error: null,
    });
    const selectSpy = vi.fn().mockImplementation((cols?: string) => {
      if (cols === "schema_json") {
        // submit path: .select("schema_json").eq("id").single()
        const eq = vi.fn().mockReturnValue({ single: versionSchemaSingleSpy });
        return { eq };
      }
      // latest-published-version path:
      //   .select("id").eq("template_id").not("published_at","is",null)
      //   .order().limit(1).maybeSingle()
      const limitSpy = vi.fn().mockReturnValue({ maybeSingle: versionMaybeSingleSpy });
      const orderSpy = vi.fn().mockReturnValue({ limit: limitSpy });
      const notSpy = vi.fn().mockReturnValue({ order: orderSpy });
      const eqSpy = vi.fn().mockReturnValue({ not: notSpy });
      return { eq: eqSpy };
    });
    return { select: selectSpy };
  }

  if (table === "form_submissions") {
    // INSERT (createCustomerTemplateDraftSubmission): .insert(...).select("id").single()
    const singleAfterInsert = vi.fn().mockResolvedValue({ data: { id: "sub-draft-1" }, error: null });
    const selectAfterInsert = vi.fn().mockReturnValue({ single: singleAfterInsert });
    insertSpy.mockReturnValue({ select: selectAfterInsert });

    // UPDATE (submitCustomerTemplateFillByIdAction):
    //   .update(...).eq("id").eq("client_id").eq("status","draft").select("id").maybeSingle()
    maybeSingleAfterUpdateSpy.mockResolvedValue({ data: { id: "sub-draft-1" }, error: null });
    selectAfterUpdateSpy.mockReturnValue({ maybeSingle: maybeSingleAfterUpdateSpy });
    eqSubmissionStatusSpy.mockReturnValue({ select: selectAfterUpdateSpy });
    eqSubmissionClientSpy.mockReturnValue({ eq: eqSubmissionStatusSpy });
    eqSubmissionIdSpy.mockReturnValue({ eq: eqSubmissionClientSpy });
    updateSubmissionSpy.mockReturnValue({ eq: eqSubmissionIdSpy });

    // SELECT — disambiguated by selected columns:
    //   draft-reuse (create): .select("id, answers_json").eq("client_id").eq("template_version_id")
    //     .eq("status").is("assignment_id",null).order().limit().maybeSingle() → {data:null}
    //   submission-fetch (submit): .select("template_version_id").eq("id").eq("client_id").single()
    draftReuseMaybeSingleSpy.mockResolvedValue({ data: null });
    submissionFetchSingleSpy.mockResolvedValue({
      data: { template_version_id: "ver-1" },
      error: null,
    });
    const selectSpy = vi.fn().mockImplementation((cols?: string) => {
      if (cols === "template_version_id") {
        const eqClient = vi.fn().mockReturnValue({ single: submissionFetchSingleSpy });
        const eqId = vi.fn().mockReturnValue({ eq: eqClient });
        return { eq: eqId };
      }
      // draft-reuse chain
      const limit = vi.fn().mockReturnValue({ maybeSingle: draftReuseMaybeSingleSpy });
      const order = vi.fn().mockReturnValue({ limit });
      const isAssignment = vi.fn().mockReturnValue({ order });
      const eqStatus = vi.fn().mockReturnValue({ is: isAssignment });
      const eqVersion = vi.fn().mockReturnValue({ eq: eqStatus });
      const eqClient = vi.fn().mockReturnValue({ eq: eqVersion });
      return { eq: eqClient };
    });

    return {
      select: selectSpy,
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

// Freeze guard (lib/clients/require-active) reads clients.active via adminClient.
vi.mock("@/lib/supabase/admin", () => ({
  adminClient: {
    from: (table: string) =>
      table === "clients"
        ? { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { active: true }, error: null }) }) }) }
        : {},
  },
}));

vi.mock("@/lib/auth-helpers", () => ({
  getClientContext: vi.fn().mockResolvedValue({
    client_id: "client-org-001",
    client_name: "Hallam House Care Home",
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

// n8n dispatch — spy so the double-submit-guard test can assert it never fires.
vi.mock("@/lib/notifications/client-form-events", () => ({
  dispatchClientFormEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/reports/report-draft", () => ({
  scheduleReportDraftGeneration: (...args: unknown[]) =>
    scheduleReportDraftGenerationSpy(...args),
}));

// ── Server-side validation pipeline mocks ─────────────────────────────────────
// submitCustomerTemplateFillByIdAction dynamically imports these. validateEntitiesValues
// echoes the input answers as result.data; the visibility / required helpers are
// identity/no-op so the SCRUBBED answers == the input answers.
vi.mock("@coltorapps/builder", () => ({
  validateEntitiesValues: vi.fn(async (answers: unknown) => ({ success: true, data: answers })),
}));
vi.mock("@/lib/form-builder", () => ({ formBuilder: {} }));
vi.mock("@/lib/form-builder/sanitize-schema", () => ({
  sanitizeSchema: vi.fn((schema: unknown) => schema),
}));
vi.mock("@/lib/form-builder/prune-schema-for-validation", () => ({
  pruneSchemaForValidation: vi.fn((schema: unknown) => schema),
}));
vi.mock("@/lib/form-builder/visibility/compute-computed-values", () => ({
  setCurrentFormSchema: vi.fn(),
}));
vi.mock("@/lib/form-builder/validate-instance-required", () => ({
  validateInstanceRequired: vi.fn(() => []),
  validateRootRequired: vi.fn(() => []),
}));
vi.mock("@/lib/form-builder/visibility/evaluate-visibility", () => ({
  evaluateVisibility: vi.fn(() => ({})),
}));
vi.mock("@/lib/form-builder/visibility/strip-hidden-answers", () => ({
  stripHiddenAnswers: vi.fn((_schema: unknown, answers: unknown) => answers),
}));

// ── Import the actions under test ──────────────────────────────────────────────

import {
  createCustomerTemplateDraftSubmission,
  submitCustomerTemplateFillByIdAction,
} from "@/app/client/templates/actions";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { dispatchClientFormEvent } from "@/lib/notifications/client-form-events";

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
    versionSchemaSingleSpy.mockResolvedValue({
      data: { schema_json: { entities: {}, root: [] } },
      error: null,
    });
    draftReuseMaybeSingleSpy.mockResolvedValue({ data: null });
    submissionFetchSingleSpy.mockResolvedValue({
      data: { template_version_id: "ver-1" },
      error: null,
    });

    const singleAfterInsert = vi.fn().mockResolvedValue({ data: { id: "sub-draft-1" }, error: null });
    const selectAfterInsert = vi.fn().mockReturnValue({ single: singleAfterInsert });
    insertSpy.mockReturnValue({ select: selectAfterInsert });

    maybeSingleAfterUpdateSpy.mockResolvedValue({ data: { id: "sub-draft-1" }, error: null });
    selectAfterUpdateSpy.mockReturnValue({ maybeSingle: maybeSingleAfterUpdateSpy });
    eqSubmissionStatusSpy.mockReturnValue({ select: selectAfterUpdateSpy });
    eqSubmissionClientSpy.mockReturnValue({ eq: eqSubmissionStatusSpy });
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

    // Assert the UPDATE payload — answers_json is now the SCRUBBED answers from the
    // validation pipeline. With stripHiddenAnswers mocked to identity, the scrubbed
    // answers equal the input answers (still meaningful: the action wrote what the
    // pipeline returned, not raw client input).
    expect(updateSubmissionSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        answers_json: answers,
        status: "submitted",
      })
    );

    // Assert client_id defense-in-depth filter (T-16-04, T-16-09)
    expect(eqSubmissionClientSpy).toHaveBeenCalledWith("client_id", "client-org-001");

    // Assert the double-submit guard filter on the UPDATE (.eq("status","draft"))
    expect(eqSubmissionStatusSpy).toHaveBeenCalledWith("status", "draft");

    // n8n event dispatched exactly once on the success path
    expect(dispatchClientFormEvent).toHaveBeenCalledTimes(1);
    expect(scheduleReportDraftGenerationSpy).toHaveBeenCalledWith("sub-draft-1");

    // Assert redirect to templates list
    expect(redirect).toHaveBeenCalledWith("/client/templates");
  });

  // ── Test (f): draft-reuse idempotency ────────────────────────────────────────
  it("createCustomerTemplateDraftSubmission: REUSES an existing self-fill draft (returns its id, versionId, answersJson) and does NOT insert", async () => {
    rewireFromMock();
    // Override the draft-reuse SELECT to return an existing draft row.
    draftReuseMaybeSingleSpy.mockResolvedValueOnce({
      data: { id: "existing-draft-9", answers_json: { q1: "saved" } },
    });

    const result = await createCustomerTemplateDraftSubmission("tmpl-1");

    expect(result).toEqual({
      id: "existing-draft-9",
      versionId: "ver-1",
      answersJson: { q1: "saved" },
    });
    expect(insertSpy).not.toHaveBeenCalled();
  });

  // ── Test (g): double-submit guard ────────────────────────────────────────────
  it("submitCustomerTemplateFillByIdAction: throws 'already been submitted' and does NOT dispatch n8n when the UPDATE matches zero rows", async () => {
    rewireFromMock();
    // The draft already flipped to 'submitted' → the status-guarded UPDATE matches
    // zero rows (maybeSingle → {data:null}).
    maybeSingleAfterUpdateSpy.mockResolvedValueOnce({ data: null, error: null });

    await expect(
      submitCustomerTemplateFillByIdAction("sub-draft-1", { q1: "answer" })
    ).rejects.toThrow("already been submitted");

    // The webhook must NOT fire for a duplicate submit.
    expect(dispatchClientFormEvent).not.toHaveBeenCalled();
    // And no redirect on the failure path.
    expect(redirect).not.toHaveBeenCalled();
  });
});
