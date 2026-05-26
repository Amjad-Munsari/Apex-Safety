// Phase 16 Plan 04 — assignment status-transition + submitAssignedFillAction tests
//
// D-08/D-10/D-11 / T-16-05: Verifies the optimistic .eq("status", previous)
// guard prevents backwards transitions, and that submitAssignedFillAction
// writes the correct INSERT shape and triggers the completed transition.

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Spy references (declared outside vi.mock so they are accessible in tests) ─

// form_assignments spy chain
const updateSpy = vi.fn();
const eqIdSpy = vi.fn();
const eqStatusSpy = vi.fn();

// form_submissions insert spy
const insertSpy = vi.fn();

// Single-row reads for requireOwnedAssignment
const maybeSingleSpy = vi.fn();

// ── Supabase mock factory ────────────────────────────────────────────────────

function makeAssignmentsChain() {
  // Supports: .update().eq("id", ...).eq("status", ...)
  eqStatusSpy.mockResolvedValue({ error: null });
  eqIdSpy.mockReturnValue({ eq: eqStatusSpy });
  updateSpy.mockReturnValue({ eq: eqIdSpy });

  // Supports: .select().eq("id", ...).maybeSingle() for requireOwnedAssignment
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

  const eqForSelectSpy = vi.fn().mockReturnValue({ maybeSingle: maybeSingleSpy });
  const selectSpy = vi.fn().mockReturnValue({ eq: eqForSelectSpy });

  return {
    select: selectSpy,
    update: updateSpy,
  };
}

function makeSubmissionsChain() {
  insertSpy.mockResolvedValue({ error: null });
  return { insert: insertSpy };
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
  submitAssignedFillAction,
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
    insertSpy.mockResolvedValue({ error: null });
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

  // ── Test 4: submitAssignedFillAction INSERT shape (B1 coverage) ──────────
  it("submitAssignedFillAction: correct INSERT shape + status transition + redirect (T-16-04)", async () => {
    const answers = { q1: "answer", q2: 42 };

    try {
      await submitAssignedFillAction("asg-1", answers);
    } catch (err: unknown) {
      // Expected: NEXT_REDIRECT thrown by redirect() — this is normal success path
      const e = err as { digest?: string; message?: string };
      if (!e?.digest?.startsWith("NEXT_REDIRECT") && !e?.message?.includes("NEXT_REDIRECT")) {
        throw err; // Re-throw real errors
      }
    }

    // Assert INSERT payload to form_submissions
    expect(insertSpy).toHaveBeenCalledWith({
      assignment_id: "asg-1",
      client_id: "client-org-001",         // T-16-04: from server ctx, never client payload
      template_version_id: "ver-1",
      status: "submitted",
      answers_json: answers,
    });

    // Assert status was transitioned to "completed" AFTER insert
    expect(updateSpy).toHaveBeenCalledWith({ status: "completed" });
    expect(eqIdSpy).toHaveBeenCalledWith("id", "asg-1");
    expect(eqStatusSpy).toHaveBeenCalledWith("status", "in_progress");

    // Assert redirect to assignment landing page
    expect(redirect).toHaveBeenCalledWith("/client/assignments/asg-1");
  });
});
