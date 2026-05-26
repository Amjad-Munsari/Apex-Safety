// Phase 16 Plan 04 — assignments list query shape assertions
//
// D-08 / T-16-01 / T-16-08: The /client/assignments page query must:
//   - Filter .eq("client_id", ctx.client_id) — defense-in-depth on top of RLS
//   - Filter .is("deleted_at", null)         — RLS does NOT filter deleted_at
//
// Pattern: spy on the supabase chain to confirm both filters are applied before
// any data is fetched. Mirrors tests/form-builder/version-pin.test.ts.

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Module-level spy refs (defined before vi.mock calls) ─────────────────────
const eqSpy = vi.fn().mockReturnThis();
const isSpy = vi.fn().mockReturnThis();

// The page calls .order() twice; the second call must also be chainable.
// We return a thenable that also has .order() so both calls work.
const resolvedChain = {
  data: [] as unknown[],
  error: null,
  then: (resolve: (v: unknown) => void) => resolve({ data: [], error: null }),
};
const orderSpy: ReturnType<typeof vi.fn> = vi.fn().mockImplementation(() => ({
  ...resolvedChain,
  order: orderSpy,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: eqSpy,
      is: isSpy,
      order: orderSpy,
    }),
  }),
}));

vi.mock("@/lib/auth-helpers", () => ({
  getClientContext: vi.fn().mockResolvedValue({
    client_id: "client-org-001",
    role: "client",
  }),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
  notFound: vi.fn(),
}));

// ── Tests ────────────────────────────────────────────────────────────────────

describe("assignments list query — Phase 16 D-08 / T-16-01 / T-16-08", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-apply chain behavior after clearing
    eqSpy.mockReturnThis();
    isSpy.mockReturnThis();
    orderSpy.mockImplementation(() => ({
      ...resolvedChain,
      order: orderSpy,
    }));
  });

  it("applies .eq('client_id', ctx.client_id) defense-in-depth filter (T-16-01)", async () => {
    const Page = (await import("@/app/client/assignments/page")).default;
    await Page();

    expect(eqSpy).toHaveBeenCalledWith("client_id", "client-org-001");
  });

  it("applies .is('deleted_at', null) to exclude soft-deleted assignments (T-16-08)", async () => {
    const Page = (await import("@/app/client/assignments/page")).default;
    await Page();

    expect(isSpy).toHaveBeenCalledWith("deleted_at", null);
  });

  it("applies both filters in a single query chain", async () => {
    const Page = (await import("@/app/client/assignments/page")).default;
    await Page();

    // Both defense-in-depth filters must appear in the same query
    const eqCalls = eqSpy.mock.calls;
    const clientIdCall = eqCalls.find(
      ([col, val]) => col === "client_id" && val === "client-org-001"
    );
    expect(clientIdCall).toBeDefined();

    const isCalls = isSpy.mock.calls;
    const deletedAtCall = isCalls.find(
      ([col, val]) => col === "deleted_at" && val === null
    );
    expect(deletedAtCall).toBeDefined();
  });
});
