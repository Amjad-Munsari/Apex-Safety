// Phase 17 Plan 03 — Admin page ORDER BY swap assertion
//
// Asserts that app/admin/clients/[id]/page.tsx fetches form_assignments with:
//   .order("due_date", { ascending: true, nullsFirst: false })
//   .order("created_at", { ascending: false })
// in that exact sequence (due_date order BEFORE created_at order).
//
// Pattern: spy-on-Supabase-chain from assignments-query.test.ts (Phase 16 Plan 04).

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Spy setup ────────────────────────────────────────────────────────────────
const orderSpy: ReturnType<typeof vi.fn> = vi.fn();

// Mock client data returned by the clients query.
const MOCK_CLIENT = {
  id: "test-client-id",
  name: "Test Client",
  site_address: "123 Test St",
  contact_name: null,
  contact_email: null,
  contact_phone: null,
  hours_balance: 0,
  created_at: new Date().toISOString(),
};

// Each call to orderSpy returns a new object that is also chainable and
// thenable — needed because the page calls .order() on several different
// fetches and the chain needs to remain valid throughout.
const makeChainable = (): Record<string, unknown> => ({
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  is: vi.fn().mockReturnThis(),
  order: orderSpy.mockImplementation(() => makeChainable()),
  single: vi.fn(() => Promise.resolve({ data: null, error: null })),
  then: (resolve: (v: { data: unknown[]; error: null }) => void) =>
    resolve({ data: [], error: null }),
});

// The clients table query calls .single() and must return a valid client row
// so the page doesn't call notFound() and abort before the assignments query.
const makeClientChainable = (): Record<string, unknown> => ({
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  is: vi.fn().mockReturnThis(),
  order: orderSpy.mockImplementation(() => makeChainable()),
  single: vi.fn(() => Promise.resolve({ data: MOCK_CLIENT, error: null })),
  then: (resolve: (v: { data: typeof MOCK_CLIENT; error: null }) => void) =>
    resolve({ data: MOCK_CLIENT, error: null }),
});

// Mock the admin client — prevents server-only from throwing in the test env.
vi.mock("@/lib/supabase/admin", () => ({
  adminClient: {
    from: vi.fn((table: string) => {
      if (table === "clients") return makeClientChainable();
      return makeChainable();
    }),
  },
}));

// Mock dashboard to avoid transitive server-only import.
vi.mock("@/lib/supabase/dashboard", () => ({
  calculateProposalTotal: vi.fn(() => 0),
}));

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => { throw new Error("notFound"); }),
  redirect: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

// Stub UI components to avoid "use client" / React import issues in jsdom test env.
vi.mock("@/components/admin/upload-document-modal", () => ({
  UploadDocumentModal: () => null,
}));
vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: { children: unknown }) => children,
}));
vi.mock("@/components/clients/adjust-hours-dialog", () => ({
  AdjustHoursDialog: () => null,
}));
vi.mock("@/app/admin/clients/[id]/client-tabs", () => ({
  ClientTabs: () => null,
}));
vi.mock("lucide-react", () => ({
  Building: () => null,
  Calendar: () => null,
  Clock: () => null,
  MapPin: () => null,
}));

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("admin client detail page — form_assignments ORDER BY (Phase 17 BLOCKING #1)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    orderSpy.mockImplementation(() => makeChainable());
  });

  it("orders form_assignments by due_date ASC NULLS LAST then created_at DESC", async () => {
    const Page = (await import("@/app/admin/clients/[id]/page")).default;
    await Page({ params: Promise.resolve({ id: "test-client-id" }) });

    const calls = orderSpy.mock.calls as Array<[string, { ascending: boolean; nullsFirst?: boolean }]>;

    // Must include a due_date ASC NULLS LAST call.
    const dueDateCall = calls.find(
      ([col, opts]) =>
        col === "due_date" &&
        opts?.ascending === true &&
        opts?.nullsFirst === false
    );
    expect(dueDateCall).toBeDefined();

    // Must include a created_at DESC call immediately after due_date
    // (the two are chained consecutively in the assignments fetch).
    const dueDateIndex = calls.findIndex(
      ([col, opts]) =>
        col === "due_date" &&
        opts?.ascending === true &&
        opts?.nullsFirst === false
    );
    expect(dueDateIndex).toBeGreaterThanOrEqual(0);

    const nextCall = calls[dueDateIndex + 1];
    expect(nextCall).toBeDefined();
    expect(nextCall[0]).toBe("created_at");
    expect(nextCall[1]?.ascending).toBe(false);
  });
});
