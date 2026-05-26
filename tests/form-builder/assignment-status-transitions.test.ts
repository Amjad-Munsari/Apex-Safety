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

// form_submissions spy chain — supports both INSERT (draft-create) and UPDATE (submit)
const insertSpy = vi.fn();
const updateSubmissionSpy = vi.fn();
const eqSubmissionIdSpy = vi.fn();
const eqSubmissionClientSpy = vi.fn();
const selectAfterUpdateSpy = vi.fn();
const singleAfterUpdateSpy = vi.fn();

// Single-row reads for requireOwnedAssignment
const maybeSingleSpy = vi.fn();

// ── Supabase mock factory ────────────────────────────────────────────────────

function makeAssignmentsChain() {
  // Supports: .update().eq("id", ...).eq("status", ...) for transitionAssignmentStatus
  eqStatusSpy.mockResolvedValue({ error: null });
  eqIdSpy.mockReturnValue({ eq: eqStatusSpy });
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
  // INSERT chain (createAssignmentDraftSubmission)
  const singleAfterInsert = vi.fn().mockResolvedValue({ data: { id: "sub-draft-1" }, error: null });
  const selectAfterInsert = vi.fn().mockReturnValue({ single: singleAfterInsert });
  insertSpy.mockReturnValue({ select: selectAfterInsert });

  // UPDATE chain (submitAssignedFillByIdAction)
  singleAfterUpdateSpy.mockResolvedValue({
    data: { assignment_id: "asg-1" },
    error: null,
  });
  selectAfterUpdateSpy.mockReturnValue({ single: singleAfterUpdateSpy });
  eqSubmissionClientSpy.mockReturnValue({ select: selectAfterUpdateSpy });
  eqSubmissionIdSpy.mockReturnValue({ eq: eqSubmissionClientSpy });
  updateSubmissionSpy.mockReturnValue({ eq: eqSubmissionIdSpy });

  return {
    insert: insertSpy,
    update: updateSubmissionSpy,
  };
}

vi.mock("@/lib/supabase/server", () => {
  const fromSpy = vi.fn().mockImplementation((table: string) => {
    if (table === "form_assignments") return makeAssignmentsChain();
    if (table === "form_submissions") return makeSubmissionsChain();
    return {};
  });

  return {
    createClient: vi.fn().mockResolvedValue({
      from: fromSpy,
    }),
  };
});

vi.mock("@/lib/auth-helpers", () => ({
  getClientContext: vi.fn().mockResolvedValue({
    client_id: "client-org-001",
    role: "client",
  }),
  requireActorUserId: vi.fn().mockResolvedValue("user-001"),
}));

// Mock the recurrence generator so the inline trigger doesn't execute real DB calls
vi.mock("@/lib/scheduler/generate-next-occurrence", () => ({
  generateNextOccurrence: vi.fn().mockResolvedValue({ ok: true, newAssignmentId: "new-asg-1" }),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("next/navigation", () => ({
  redirect: vi.fn().mockImplementation(() => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;replace;/test" });
  }),
  notFound: vi.fn(),
}));

// ── Import the actions under test ─────────────────────────────────────────────

import {
  transitionAssignmentStatus,
  createAssignmentDraftSubmission,
  submitAssignedFillByIdAction,
} from "@/app/client/assignments/actions";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

// ── Helper: get a fresh supabase mock ────────────────────────────────────────

async function getSupabase() {
  return (createClient as ReturnType<typeof vi.fn>).mock.results[
    (createClient as ReturnType<typeof vi.fn>).mock.results.length - 1
  ]?.value ?? await createClient();
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("assignment status transitions — Phase 16 D-08/D-10/D-11 (T-16-05)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-wire spies after clear
    eqStatusSpy.mockResolvedValue({ error: null });
    eqIdSpy.mockReturnValue({ eq: eqStatusSpy });
    updateSpy.mockReturnValue({ eq: eqIdSpy });

    // Re-wire submissions spies after clear
    const singleAfterInsert = vi.fn().mockResolvedValue({ data: { id: "sub-draft-1" }, error: null });
    const selectAfterInsert = vi.fn().mockReturnValue({ single: singleAfterInsert });
    insertSpy.mockReturnValue({ select: selectAfterInsert });

    singleAfterUpdateSpy.mockResolvedValue({
      data: { assignment_id: "asg-1" },
      error: null,
    });
    selectAfterUpdateSpy.mockReturnValue({ single: singleAfterUpdateSpy });
    eqSubmissionClientSpy.mockReturnValue({ select: selectAfterUpdateSpy });
    eqSubmissionIdSpy.mockReturnValue({ eq: eqSubmissionClientSpy });
    updateSubmissionSpy.mockReturnValue({ eq: eqSubmissionIdSpy });

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
  it("pending → in_progress: calls .update({status:'in_progress'}).eq('id', id).eq('status','pending')", async () => {
    const supabase = await createClient();
    await transitionAssignmentStatus(supabase as never, "asg-1", "in_progress");

    expect(updateSpy).toHaveBeenCalledWith({ status: "in_progress" });
    expect(eqIdSpy).toHaveBeenCalledWith("id", "asg-1");
    expect(eqStatusSpy).toHaveBeenCalledWith("status", "pending");
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
    eqStatusSpy.mockResolvedValueOnce({ error: { message: "boom" } });
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const supabase = await createClient();
    // Should resolve without throwing
    await expect(
      transitionAssignmentStatus(supabase as never, "asg-1", "in_progress")
    ).resolves.toBeUndefined();

    expect(consoleSpy).toHaveBeenCalledWith(
      "Status transition failed",
      expect.objectContaining({ assignmentId: "asg-1", next: "in_progress" })
    );

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
    expect(eqStatusSpy).toHaveBeenCalledWith("status", "pending");
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

    // Assert UPDATE payload to form_submissions
    expect(updateSubmissionSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        answers_json: answers,
        status: "submitted",
      })
    );

    // Assert client_id defense-in-depth filter (T-16-04, T-16-09)
    expect(eqSubmissionClientSpy).toHaveBeenCalledWith("client_id", "client-org-001");

    // Assert status was transitioned to "completed" AFTER update
    expect(updateSpy).toHaveBeenCalledWith({ status: "completed" });
    expect(eqStatusSpy).toHaveBeenCalledWith("status", "in_progress");

    // Assert redirect to assignment landing page
    expect(redirect).toHaveBeenCalledWith("/client/assignments/asg-1");
  });
});
