// Phase 16 Plan 08 — assignment status-transition + submit action tests (gap closure §D)
//
// D-08/D-10/D-11 / T-16-05: Verifies the optimistic .eq("status", previous)
// guard prevents backwards transitions.
//
// Plan 16-08 update: submitAssignedFillByIdAction (UPDATE path) replaces
// submitAssignedFillAction (INSERT path). createAssignmentDraftSubmission
// handles the pending → in_progress transition and INSERT of the draft row.

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Spy references (declared outside vi.mock so they are accessible in tests) ─

// form_assignments spy chain (for transitionAssignmentStatus + requireOwnedAssignment)
const updateSpy = vi.fn();
const eqIdSpy = vi.fn();
const eqStatusSpy = vi.fn();
// in_progress transition terminates on .in("status", ["assigned","pending"]).
const inStatusSpy = vi.fn();

// form_submissions spy chain — supports both INSERT (draft-create) and UPDATE (submit)
const insertSpy = vi.fn();
const updateSubmissionSpy = vi.fn();
const eqSubmissionIdSpy = vi.fn();
const eqSubmissionClientSpy = vi.fn();
// UPDATE path now ends on .eq("status","draft").select("assignment_id").maybeSingle()
const eqSubmissionStatusSpy = vi.fn();
const selectAfterUpdateSpy = vi.fn();
const maybeSingleAfterUpdateSpy = vi.fn();

// Draft-reuse SELECT (createAssignmentDraftSubmission) — resolves to {data:null} by
// default so the INSERT path is exercised; a dedicated test overrides it to a row.
const draftReuseMaybeSingleSpy = vi.fn();

// Submission-fetch SELECT in submitAssignedFillByIdAction
// (.select("template_version_id").eq("id").eq("client_id").single())
const submissionFetchSingleSpy = vi.fn();

// Single-row reads for requireOwnedAssignment
const maybeSingleSpy = vi.fn();
const scheduleReportDraftGenerationSpy = vi.fn();

// ── Supabase mock factory ────────────────────────────────────────────────────

function makeAssignmentsChain() {
  // Supports: .update().eq("id", ...).eq("status", ...) for transitionAssignmentStatus
  eqStatusSpy.mockResolvedValue({ error: null });
  inStatusSpy.mockResolvedValue({ error: null });
  // Inline recurrence claim chain: .update().eq("id").not().is().select().maybeSingle()
  // Resolves {data:null} → recurrence_rule is null, so generateNextOccurrence is skipped.
  const recurrenceMaybeSingle = vi.fn().mockResolvedValue({ data: null });
  const recurrenceSelect = vi.fn().mockReturnValue({ maybeSingle: recurrenceMaybeSingle });
  const recurrenceIs = vi.fn().mockReturnValue({ select: recurrenceSelect });
  const recurrenceNot = vi.fn().mockReturnValue({ is: recurrenceIs });
  eqIdSpy.mockReturnValue({ eq: eqStatusSpy, in: inStatusSpy, not: recurrenceNot });
  updateSpy.mockReturnValue({ eq: eqIdSpy });

  // Supports: .select().eq("id", ...).maybeSingle() for requireOwnedAssignment
  // AND: .select(...).eq("id", ...).single() for inline recurrence trigger read (Plan 17-04)
  maybeSingleSpy.mockResolvedValue({
    data: {
      id: "asg-1",
      client_id: "client-org-001",
      template_version_id: "ver-1",
      status: "pending",
      deleted_at: null,
      instructions: null,
      due_date: null,
    },
    error: null,
  });

  // Single spy for the inline trigger SELECT.
  // recurrence_rule: null means the generator is skipped → no extra mocking required.
  const singleForAssignmentSpy = vi.fn().mockResolvedValue({
    data: {
      id: "asg-1",
      client_id: "client-org-001",
      template_id: "tmpl-1",
      assigned_by: null,
      instructions: null,
      due_date: "2026-06-01",
      recurrence_rule: null,
      recurrence_generated_at: null,
    },
    error: null,
  });

  const eqForSelectSpy = vi.fn().mockReturnValue({
    maybeSingle: maybeSingleSpy,
    single: singleForAssignmentSpy,
  });
  const selectSpy = vi.fn().mockReturnValue({ eq: eqForSelectSpy });

  return {
    select: selectSpy,
    update: updateSpy,
  };
}

function makeSubmissionsChain() {
  // INSERT chain (createAssignmentDraftSubmission): .insert(...).select("id").single()
  const singleAfterInsert = vi.fn().mockResolvedValue({ data: { id: "sub-draft-1" }, error: null });
  const selectAfterInsert = vi.fn().mockReturnValue({ single: singleAfterInsert });
  insertSpy.mockReturnValue({ select: selectAfterInsert });

  // UPDATE chain (submitAssignedFillByIdAction):
  //   .update(...).eq("id").eq("client_id").eq("status","draft").select("assignment_id").maybeSingle()
  maybeSingleAfterUpdateSpy.mockResolvedValue({
    data: { assignment_id: "asg-1" },
    error: null,
  });
  selectAfterUpdateSpy.mockReturnValue({ maybeSingle: maybeSingleAfterUpdateSpy });
  eqSubmissionStatusSpy.mockReturnValue({ select: selectAfterUpdateSpy });
  eqSubmissionClientSpy.mockReturnValue({ eq: eqSubmissionStatusSpy });
  eqSubmissionIdSpy.mockReturnValue({ eq: eqSubmissionClientSpy });
  updateSubmissionSpy.mockReturnValue({ eq: eqSubmissionIdSpy });

  // SELECT chain — disambiguated by the SECOND .eq() column so the two read paths
  // resolve independently:
  //   draft-reuse (createAssignmentDraftSubmission):
  //     .select("id, answers_json").eq("assignment_id").eq("client_id").eq("status")
  //       .eq("template_version_id").order().limit().maybeSingle()  → {data:null} default
  //   submission-fetch (submitAssignedFillByIdAction):
  //     .select("template_version_id").eq("id").eq("client_id").single()
  draftReuseMaybeSingleSpy.mockResolvedValue({ data: null });
  submissionFetchSingleSpy.mockResolvedValue({
    data: { template_version_id: "ver-1" },
    error: null,
  });

  const selectSpy = vi.fn().mockImplementation((cols?: string) => {
    if (cols === "template_version_id") {
      // submission-fetch: .eq("id").eq("client_id").single()
      const eqClient = vi.fn().mockReturnValue({ single: submissionFetchSingleSpy });
      const eqId = vi.fn().mockReturnValue({ eq: eqClient });
      return { eq: eqId };
    }
    // draft-reuse chain
    const limit = vi.fn().mockReturnValue({ maybeSingle: draftReuseMaybeSingleSpy });
    const order = vi.fn().mockReturnValue({ limit });
    const eqVersion = vi.fn().mockReturnValue({ order });
    const eqStatus = vi.fn().mockReturnValue({ eq: eqVersion });
    const eqClient = vi.fn().mockReturnValue({ eq: eqStatus });
    const eqAssignment = vi.fn().mockReturnValue({ eq: eqClient });
    return { eq: eqAssignment };
  });

  return {
    select: selectSpy,
    insert: insertSpy,
    update: updateSubmissionSpy,
  };
}

function makeTemplateVersionsChain() {
  // submitAssignedFillByIdAction step 2: .select("schema_json").eq("id").single()
  const single = vi.fn().mockResolvedValue({
    data: { schema_json: { entities: {}, root: [] } },
    error: null,
  });
  const eq = vi.fn().mockReturnValue({ single });
  const select = vi.fn().mockReturnValue({ eq });
  return { select };
}

vi.mock("@/lib/supabase/server", () => {
  const fromSpy = vi.fn().mockImplementation((table: string) => {
    if (table === "form_assignments") return makeAssignmentsChain();
    if (table === "form_submissions") return makeSubmissionsChain();
    if (table === "template_versions") return makeTemplateVersionsChain();
    return {};
  });

  return {
    createClient: vi.fn().mockResolvedValue({
      from: fromSpy,
    }),
  };
});

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
    role: "client",
  }),
  requireActorUserId: vi.fn().mockResolvedValue("user-001"),
  isAdmin: vi.fn().mockResolvedValue(false),
}));

// Mock the recurrence generator so the inline trigger doesn't execute real DB calls
vi.mock("@/lib/scheduler/generate-next-occurrence", () => ({
  generateNextOccurrence: vi.fn().mockResolvedValue({ ok: true, newAssignmentId: "new-asg-1" }),
}));

// n8n dispatch — spy so the double-submit-guard test can assert it never fires.
vi.mock("@/lib/notifications/client-form-events", () => ({
  dispatchClientFormEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/reports/report-draft", () => ({
  scheduleReportDraftGeneration: (...args: unknown[]) =>
    scheduleReportDraftGenerationSpy(...args),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("next/navigation", () => ({
  redirect: vi.fn().mockImplementation(() => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;replace;/test" });
  }),
  notFound: vi.fn(),
}));

// ── Server-side validation pipeline mocks ─────────────────────────────────────
// submitAssignedFillByIdAction dynamically imports these. Make them deterministic:
// validateEntitiesValues echoes the input answers as result.data; the visibility /
// required helpers are identity/no-op so the SCRUBBED answers == the input answers.
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

// ── Import the actions under test ─────────────────────────────────────────────

import {
  transitionAssignmentStatus,
  createAssignmentDraftSubmission,
  submitAssignedFillByIdAction,
} from "@/app/client/assignments/actions";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { dispatchClientFormEvent } from "@/lib/notifications/client-form-events";

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("assignment status transitions — Phase 16 D-08/D-10/D-11 (T-16-05)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-wire spies after clear
    eqStatusSpy.mockResolvedValue({ error: null });
    inStatusSpy.mockResolvedValue({ error: null });
    eqIdSpy.mockReturnValue({ eq: eqStatusSpy, in: inStatusSpy });
    updateSpy.mockReturnValue({ eq: eqIdSpy });

    // Re-wire submissions spies after clear
    const singleAfterInsert = vi.fn().mockResolvedValue({ data: { id: "sub-draft-1" }, error: null });
    const selectAfterInsert = vi.fn().mockReturnValue({ single: singleAfterInsert });
    insertSpy.mockReturnValue({ select: selectAfterInsert });

    maybeSingleAfterUpdateSpy.mockResolvedValue({
      data: { assignment_id: "asg-1" },
      error: null,
    });
    selectAfterUpdateSpy.mockReturnValue({ maybeSingle: maybeSingleAfterUpdateSpy });
    eqSubmissionStatusSpy.mockReturnValue({ select: selectAfterUpdateSpy });
    eqSubmissionClientSpy.mockReturnValue({ eq: eqSubmissionStatusSpy });
    eqSubmissionIdSpy.mockReturnValue({ eq: eqSubmissionClientSpy });
    updateSubmissionSpy.mockReturnValue({ eq: eqSubmissionIdSpy });

    // Draft-reuse SELECT defaults to "no existing draft" → INSERT path exercised.
    draftReuseMaybeSingleSpy.mockResolvedValue({ data: null });
    // Submission-fetch SELECT (submit path) returns the pinned version id.
    submissionFetchSingleSpy.mockResolvedValue({
      data: { template_version_id: "ver-1" },
      error: null,
    });

    maybeSingleSpy.mockResolvedValue({
      data: {
        id: "asg-1",
        client_id: "client-org-001",
        template_version_id: "ver-1",
        status: "pending",
        deleted_at: null,
        instructions: null,
        due_date: null,
      },
      error: null,
    });
    // Re-wire redirect to throw NEXT_REDIRECT after clearAllMocks
    (redirect as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;replace;/test" });
    });
  });

  // ── Test 1: pending → in_progress ──────────────────────────────────────────
  it("pending → in_progress: calls .update({status:'in_progress'}).eq('id', id).in('status', ['assigned','pending'])", async () => {
    const supabase = await createClient();
    await transitionAssignmentStatus(supabase as never, "asg-1", "in_progress");

    expect(updateSpy).toHaveBeenCalledWith({ status: "in_progress" });
    expect(eqIdSpy).toHaveBeenCalledWith("id", "asg-1");
    expect(inStatusSpy).toHaveBeenCalledWith("status", ["assigned", "pending"]);
  });

  // ── Test 2: in_progress → completed ──────────────────────────────────────
  it("in_progress → completed: calls .update({status:'completed'}).eq('id', id).eq('status','in_progress')", async () => {
    const supabase = await createClient();
    await transitionAssignmentStatus(supabase as never, "asg-1", "completed");

    expect(updateSpy).toHaveBeenCalledWith({ status: "completed" });
    expect(eqIdSpy).toHaveBeenCalledWith("id", "asg-1");
    expect(eqStatusSpy).toHaveBeenCalledWith("status", "in_progress");
  });

  // ── Test 3: error does not throw (Pattern 4) ─────────────────────────────
  it("logs but does NOT throw when the DB update returns an error", async () => {
    inStatusSpy.mockResolvedValueOnce({ error: { message: "boom" } });
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    // A recovered-but-degraded path is logged at warning severity, so the
    // structured line lands on console.warn rather than console.error.
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const supabase = await createClient();
    // Should resolve without throwing
    await expect(
      transitionAssignmentStatus(supabase as never, "asg-1", "in_progress")
    ).resolves.toBeUndefined();

    // The failure now goes through the observability logger, which emits one
    // structured line before attempting its durable write. The guarantee under
    // test is unchanged: the failure is recorded and the caller does not throw.
    const emitted = [...warnSpy.mock.calls, ...consoleSpy.mock.calls]
      .map((call) => String(call[0]))
      .join("\n");
    expect(emitted).toContain("assignments.status_transition");
    expect(emitted).toContain("asg-1");
    expect(emitted).toContain("in_progress");

    warnSpy.mockRestore();
    consoleSpy.mockRestore();
  });

  // ── Test 4: createAssignmentDraftSubmission — pending→in_progress + INSERT draft ──
  it("createAssignmentDraftSubmission: INSERTs draft submission + transitions pending→in_progress (T-16-04)", async () => {
    const result = await createAssignmentDraftSubmission("asg-1");

    // Assert the draft was created
    expect(result).toHaveProperty("id");

    // Assert INSERT payload to form_submissions
    expect(insertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        assignment_id: "asg-1",
        client_id: "client-org-001",         // T-16-04: from server ctx, never client payload
        template_version_id: "ver-1",
        status: "draft",
        answers_json: {},
      })
    );

    // Assert assignment was transitioned pending → in_progress
    expect(updateSpy).toHaveBeenCalledWith({ status: "in_progress" });
    expect(inStatusSpy).toHaveBeenCalledWith("status", ["assigned", "pending"]);
  });

  // ── Test 5: submitAssignedFillByIdAction UPDATE shape (B1 coverage) ──────
  it("submitAssignedFillByIdAction: correct UPDATE shape + assignment status → completed + redirect (T-16-04)", async () => {
    const answers = { q1: "answer", q2: 42 };

    try {
      await submitAssignedFillByIdAction("sub-draft-1", answers);
    } catch (err: unknown) {
      // Expected: NEXT_REDIRECT thrown by redirect() — this is normal success path
      const e = err as { digest?: string; message?: string };
      if (!e?.digest?.startsWith("NEXT_REDIRECT") && !e?.message?.includes("NEXT_REDIRECT")) {
        throw err; // Re-throw real errors
      }
    }

    // Assert UPDATE payload to form_submissions — answers_json is now the SCRUBBED
    // answers from the validation pipeline. With stripHiddenAnswers mocked to
    // identity, the scrubbed answers equal the input answers (still a meaningful
    // assertion: the action wrote what the pipeline returned, not raw client input).
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

    // Assert status was transitioned to "completed" AFTER update
    expect(updateSpy).toHaveBeenCalledWith({ status: "completed" });
    expect(eqStatusSpy).toHaveBeenCalledWith("status", "in_progress");

    // n8n event dispatched exactly once on the success path
    expect(dispatchClientFormEvent).toHaveBeenCalledTimes(1);
    expect(scheduleReportDraftGenerationSpy).toHaveBeenCalledWith("sub-draft-1");

    // Assert redirect to assignment landing page
    expect(redirect).toHaveBeenCalledWith("/client/assignments/asg-1");
  });

  // ── Test 6: createAssignmentDraftSubmission reuse path (idempotency) ─────────
  it("createAssignmentDraftSubmission: REUSES an existing draft (returns its id + answersJson) and does NOT insert", async () => {
    // Override the draft-reuse SELECT to return an existing draft row.
    draftReuseMaybeSingleSpy.mockResolvedValueOnce({
      data: { id: "existing-draft-9", answers_json: { q1: "saved" } },
    });

    const result = await createAssignmentDraftSubmission("asg-1");

    // Returns the existing draft's id + rehydration answers — no new row.
    expect(result).toEqual({ id: "existing-draft-9", answersJson: { q1: "saved" } });
    expect(insertSpy).not.toHaveBeenCalled();

    // Still nudges the assignment forward in case it lapsed back.
    expect(updateSpy).toHaveBeenCalledWith({ status: "in_progress" });
  });

  // ── Test 7: double-submit guard ──────────────────────────────────────────────
  it("submitAssignedFillByIdAction: throws 'already been submitted' and does NOT dispatch n8n when the UPDATE matches zero rows", async () => {
    // The draft already flipped to 'submitted' → the status-guarded UPDATE matches
    // zero rows (maybeSingle → {data:null}).
    maybeSingleAfterUpdateSpy.mockResolvedValueOnce({ data: null, error: null });

    await expect(
      submitAssignedFillByIdAction("sub-draft-1", { q1: "answer" })
    ).rejects.toThrow("already been submitted");

    // The webhook must NOT fire for a duplicate submit.
    expect(dispatchClientFormEvent).not.toHaveBeenCalled();
    // And the assignment must NOT be transitioned to completed.
    expect(updateSpy).not.toHaveBeenCalledWith({ status: "completed" });
  });
});
