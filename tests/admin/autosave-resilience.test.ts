// Verifies the autosave resilience fix: a debounced/flushed autosave that lands
// AFTER its draft was deleted or submitted must no-op silently instead of
// throwing "Submission not found" (which surfaced as a console error + toast).
// Genuine cross-tenant attempts must still be rejected.

import { describe, it, expect, vi, beforeEach } from "vitest"

// Configurable per-test mock state.
let subLookup: { client_id: string } | null // result of the submission existence check
let updateRows: Array<{ id: string }> | null // rows matched by the autosave UPDATE
let updateError: { message: string } | null

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: () => Promise.resolve({ data: { user: { id: "admin-user" } } }) },
  }),
}))

vi.mock("@/lib/auth-helpers", () => ({
  isAdmin: vi.fn(),
  getClientContext: vi.fn(),
  requireActorUserId: vi.fn().mockResolvedValue("admin-user"),
}))

vi.mock("@/lib/clients/require-active", () => ({
  assertClientActive: vi.fn(),
}))

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("next/navigation", () => ({ redirect: vi.fn() }))
vi.mock("next/server", () => ({ after: vi.fn() }))

vi.mock("@/lib/supabase/admin", () => ({
  adminClient: {
    from: () => ({
      // Existence check: .select("client_id").eq("id", id).maybeSingle()
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({ data: subLookup }),
        }),
      }),
      // Autosave write: .update({...}).eq().eq().eq().select("id")
      update: () => ({
        eq: () => ({
          eq: () => ({
            eq: () => ({
              select: () => Promise.resolve({ data: updateRows, error: updateError }),
            }),
          }),
        }),
      }),
    }),
  },
}))

import { isAdmin, getClientContext } from "@/lib/auth-helpers"

const SUBMISSION_ID = "22222222-2222-2222-2222-222222222222"

beforeEach(() => {
  vi.clearAllMocks()
  subLookup = { client_id: "client-1" }
  updateRows = [{ id: SUBMISSION_ID }]
  updateError = null
  vi.mocked(isAdmin).mockResolvedValue(true)
  vi.mocked(getClientContext).mockResolvedValue(null)
})

describe("autosaveAnswers resilience", () => {
  it("no-ops (no throw) when the draft was deleted mid-autosave", async () => {
    // The draft is gone by the time the pending save lands.
    subLookup = null
    const { autosaveAnswers } = await import("@/app/admin/assessments/actions")
    const result = await autosaveAnswers(SUBMISSION_ID, { field: "value" })
    expect(result).toEqual({ saved: false })
  })

  it("no-ops when the row was submitted/deleted between the check and the write (zero rows)", async () => {
    subLookup = { client_id: "client-1" }
    updateRows = [] // status flipped away from 'draft' or row removed
    const { autosaveAnswers } = await import("@/app/admin/assessments/actions")
    const result = await autosaveAnswers(SUBMISSION_ID, { field: "value" })
    expect(result).toEqual({ saved: false })
  })

  it("saves normally when the draft still exists", async () => {
    const { autosaveAnswers } = await import("@/app/admin/assessments/actions")
    const result = await autosaveAnswers(SUBMISSION_ID, { field: "value" })
    expect(result).toEqual({ saved: true })
  })

  it("still rejects a genuine cross-tenant autosave", async () => {
    subLookup = { client_id: "client-1" }
    vi.mocked(isAdmin).mockResolvedValue(false)
    vi.mocked(getClientContext).mockResolvedValue({ client_id: "client-OTHER" } as never)
    const { autosaveAnswers } = await import("@/app/admin/assessments/actions")
    await expect(autosaveAnswers(SUBMISSION_ID, { field: "value" })).rejects.toThrow(/Unauthorized/)
  })
})
