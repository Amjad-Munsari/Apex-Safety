// Phase 17 Plan 17-02 — sendAssignmentReminder filled spec (replaces Wave-0 scaffold)
//
// Vitest hoisting-safe pattern: declare spy BEFORE vi.mock factory, have
// factory wrap the spy. This mirrors Plan 16-04 Task 2b §Deviation 3.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Spy (declared before vi.mock so hoisting can close over it) ────────────
const dispatchSpy = vi.fn();

vi.mock("@/lib/notifications/n8n-dispatch", () => ({
  dispatchNotification: (...args: unknown[]) => dispatchSpy(...args),
}));

// ── Import after mock is hoisted ────────────────────────────────────────────
import { sendAssignmentReminder } from "@/lib/scheduler/send-reminder";

// ── Env snapshot helpers ────────────────────────────────────────────────────
let savedSiteUrl: string | undefined;
let savedVercelUrl: string | undefined;

beforeEach(() => {
  savedSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  savedVercelUrl = process.env.VERCEL_URL;
  dispatchSpy.mockReset();
});

afterEach(() => {
  if (savedSiteUrl === undefined) {
    delete process.env.NEXT_PUBLIC_SITE_URL;
  } else {
    process.env.NEXT_PUBLIC_SITE_URL = savedSiteUrl;
  }
  if (savedVercelUrl === undefined) {
    delete process.env.VERCEL_URL;
  } else {
    process.env.VERCEL_URL = savedVercelUrl;
  }
});

// ── Common args fixture ─────────────────────────────────────────────────────
const baseArgs = {
  cadence: "7d" as const,
  client_email: "client@example.com",
  client_name: "Alice Corp",
  template_name: "Fire Risk Assessment",
  due_date: "2026-07-01",
  assignmentId: "abc-123",
  instructions: "Complete before the site visit",
};

// ── Tests ───────────────────────────────────────────────────────────────────

describe("sendAssignmentReminder (Phase 17)", () => {
  // Test 1: builds absolute assignment_url from NEXT_PUBLIC_SITE_URL
  it("builds absolute assignment_url from NEXT_PUBLIC_SITE_URL when set", async () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://test.example.com";
    delete process.env.VERCEL_URL;

    dispatchSpy.mockResolvedValueOnce({ ok: true, status: 200 });

    await sendAssignmentReminder({ ...baseArgs, assignmentId: "abc-123" });

    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        assignment_url: "https://test.example.com/client/assignments/abc-123",
      })
    );
  });

  // Test 2: passes cadence + client contact + template name + due_date + instructions unchanged
  it("passes cadence, client_email, client_name, template_name, due_date, instructions through unchanged", async () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://test.example.com";
    delete process.env.VERCEL_URL;

    dispatchSpy.mockResolvedValueOnce({ ok: true, status: 200 });

    await sendAssignmentReminder(baseArgs);

    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "assignment_reminder",
        cadence: "7d",
        client_email: "client@example.com",
        client_name: "Alice Corp",
        template_name: "Fire Risk Assessment",
        due_date: "2026-07-01",
        instructions: "Complete before the site visit",
      })
    );
  });

  // Test 3: returns dispatchNotification's result verbatim — never swallows ok:false
  it("returns dispatchNotification result verbatim — does not swallow ok:false", async () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://test.example.com";
    delete process.env.VERCEL_URL;

    dispatchSpy.mockResolvedValueOnce({ ok: false, error: "webhook 500" });

    const result = await sendAssignmentReminder(baseArgs);

    expect(result).toEqual({ ok: false, error: "webhook 500" });
  });
});
