/**
 * Unit tests for getClientContextWithIdentity() (Phase 19, Plan 01, D-02)
 *
 * Covers six behavioral contracts:
 *  1. Real-user path: resolves org name and display name from the join
 *  2. Demo path: returns identity WITHOUT calling getUser()
 *  3. Name fallback: empty client_users.name falls back to email
 *  4. Org fallback: null clients join returns orgName "—"
 *  5. Join-shape normalization: client returned as array still resolves name
 *  6. Null session: getUser() returns null in non-demo mode → helper returns null
 *
 * Mocking style mirrors upload-media-action.test.ts and save-draft.test.ts:
 *   vi.mock("@/lib/supabase/server") with a factory that returns a stub client.
 *   vi.hoisted() for mutable references that the factory closure can capture safely.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoisted mutable state (safe for use inside vi.mock() factories) ───────────
const mocks = vi.hoisted(() => {
  const mockSingle = vi.fn();
  const mockLimit = vi.fn(() => ({ single: mockSingle }));
  const mockEq = vi.fn(() => ({ single: mockSingle, limit: mockLimit }));
  const mockSelect = vi.fn(() => ({ eq: mockEq, limit: mockLimit }));
  const mockFrom = vi.fn(() => ({ select: mockSelect }));
  const mockGetUser = vi.fn();
  const mockGetCookie = vi.fn();

  return { mockSingle, mockLimit, mockEq, mockSelect, mockFrom, mockGetUser, mockGetCookie };
});

// ── Cookie mock (next/headers is server-only; unavailable in jsdom) ───────────
vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    get: mocks.mockGetCookie,
  }),
}));

// ── Supabase server mock ──────────────────────────────────────────────────────
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: mocks.mockGetUser },
    from: mocks.mockFrom,
  }),
}));

// ── Import module under test AFTER mocks ─────────────────────────────────────
import { getClientContextWithIdentity } from "@/lib/auth-helpers";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Configure mocks for a given scenario. */
function setupScenario(opts: {
  isDemoMode: boolean;
  userId: string | null;
  row: Record<string, unknown> | null;
}) {
  const { isDemoMode, userId, row } = opts;

  // isDemoMode() reads cookies().get("demo_mode")
  mocks.mockGetCookie.mockImplementation((key: string) => {
    if (key === "demo_mode") return isDemoMode ? { value: "1" } : undefined;
    return undefined;
  });

  // getUser() reads auth.getUser()
  mocks.mockGetUser.mockResolvedValue({
    data: { user: userId ? { id: userId } : null },
  });

  // Query result for .select(...).eq(...).single() and .limit(1).single()
  if (row) {
    mocks.mockSingle.mockResolvedValue({ data: row, error: null });
  } else {
    mocks.mockSingle.mockResolvedValue({ data: null, error: { message: "no data" } });
  }
}

// ── Test Suite ────────────────────────────────────────────────────────────────

describe("getClientContextWithIdentity() — D-02 identity resolution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("(1) real-user path: resolves orgName from join and userName from name", async () => {
    setupScenario({
      isDemoMode: false,
      userId: "auth-user-001",
      row: {
        client_id: "org-001",
        role: "admin",
        name: "Sarah Whitfield",
        email: "sarah@hallam.co.uk",
        client: { name: "Hallam House Care Home" },
      },
    });

    const result = await getClientContextWithIdentity();

    expect(result).not.toBeNull();
    expect(result?.client_id).toBe("org-001");
    expect(result?.role).toBe("admin");
    expect(result?.orgName).toBe("Hallam House Care Home");
    expect(result?.userName).toBe("Sarah Whitfield");
  });

  it("(2) demo path: returns identity WITHOUT calling getUser()", async () => {
    setupScenario({
      isDemoMode: true,
      userId: null,
      row: {
        client_id: "demo-org",
        role: "admin",
        name: "Demo User",
        email: "demo@example.com",
        client: { name: "Demo Org" },
      },
    });

    const result = await getClientContextWithIdentity();

    // getUser MUST NOT be called in demo mode (stale-auth-header invariant, T-19-02)
    expect(mocks.mockGetUser).not.toHaveBeenCalled();
    expect(result).not.toBeNull();
    expect(result?.orgName).toBe("Demo Org");
    expect(result?.userName).toBe("Demo User");
  });

  it("(3) name fallback: empty client_users.name resolves to email", async () => {
    setupScenario({
      isDemoMode: false,
      userId: "auth-user-002",
      row: {
        client_id: "org-002",
        role: "viewer",
        name: "",
        email: "fallback@example.com",
        client: { name: "Some Org" },
      },
    });

    const result = await getClientContextWithIdentity();

    expect(result?.userName).toBe("fallback@example.com");
  });

  it("(4) org fallback: null clients join returns orgName '—'", async () => {
    setupScenario({
      isDemoMode: false,
      userId: "auth-user-003",
      row: {
        client_id: "org-003",
        role: "viewer",
        name: "Jane Doe",
        email: "jane@example.com",
        client: null,
      },
    });

    const result = await getClientContextWithIdentity();

    expect(result?.orgName).toBe("—");
  });

  it("(5) join-shape normalization: client returned as array resolves orgName from client[0].name", async () => {
    setupScenario({
      isDemoMode: false,
      userId: "auth-user-004",
      row: {
        client_id: "org-004",
        role: "admin",
        name: "Bob Smith",
        email: "bob@example.com",
        // Supabase can return the FK join as an array
        client: [{ name: "Array Org Name" }],
      },
    });

    const result = await getClientContextWithIdentity();

    expect(result?.orgName).toBe("Array Org Name");
  });

  it("(6) null session: getUser() returns null in non-demo mode → helper returns null", async () => {
    setupScenario({
      isDemoMode: false,
      userId: null,
      row: null,
    });

    const result = await getClientContextWithIdentity();

    expect(result).toBeNull();
  });
});
