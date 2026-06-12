// Tests for the contractor directory actions (app/admin/directory/actions.ts):
//   - addContractor          — insert with optional-field normalization
//   - updateContractor       — row-scoped update, `active` preserved when omitted
//   - toggleContractorActive — visibility flag flip
//   - deleteContractor       — soft delete via deleted_at
//
// Vitest + JSDOM; no real Supabase or auth — all I/O is mocked. The adminClient
// mock records inserts/updates and their row scoping so we can assert the
// payload contract, and requireAdmin is mocked so we can assert every action
// is gated.

import { describe, it, expect, vi, beforeEach } from "vitest"

// ── Recording state (reset per test) ─────────────────────────────────────────

const insertArgs: Record<string, unknown>[] = []
const updateArgs: { payload: Record<string, unknown>; id: string }[] = []
let dbError: { message: string } | null

// ── Mocks ─────────────────────────────────────────────────────────────────────

const requireAdminMock = vi.fn().mockResolvedValue("admin-1")
vi.mock("@/lib/auth-helpers", () => ({
  requireAdmin: (...args: unknown[]) => requireAdminMock(...args),
}))

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))

vi.mock("@/lib/supabase/admin", () => ({
  adminClient: {
    from: (table: string) => {
      if (table !== "contractors") throw new Error(`unexpected table ${table}`)
      return {
        insert: (rows: Record<string, unknown>[]) => {
          insertArgs.push(...rows)
          return Promise.resolve({ error: dbError })
        },
        update: (payload: Record<string, unknown>) => ({
          eq: (_col: string, id: string) => {
            updateArgs.push({ payload, id })
            return Promise.resolve({ error: dbError })
          },
        }),
      }
    },
  },
}))

const CONTRACTOR_ID = "22222222-2222-2222-2222-222222222222"

const BASE_INPUT = {
  company_name: "Acme Fire Protection Ltd",
  category: "Fire Alarms & Detection" as const,
  contact_name: "Jane Smith",
  phone: "07700 900123",
  email: "info@acmefire.co.uk",
}

beforeEach(() => {
  vi.clearAllMocks()
  requireAdminMock.mockResolvedValue("admin-1")
  insertArgs.length = 0
  updateArgs.length = 0
  dbError = null
})

describe("addContractor", () => {
  it("inserts the row with blank optional fields normalized to null and active defaulting true", async () => {
    const { addContractor } = await import("@/app/admin/directory/actions")
    await addContractor({ ...BASE_INPUT, website: "  ", address: "", notes: undefined })

    expect(requireAdminMock).toHaveBeenCalled()
    expect(insertArgs).toHaveLength(1)
    expect(insertArgs[0]).toEqual({
      ...BASE_INPUT,
      website: null,
      address: null,
      notes: null,
      active: true,
    })
  })

  it("passes optional fields through when provided", async () => {
    const { addContractor } = await import("@/app/admin/directory/actions")
    await addContractor({
      ...BASE_INPUT,
      website: "https://acmefire.co.uk",
      address: "12 Industrial Way",
      notes: "Approved for alarm servicing",
      active: false,
    })

    expect(insertArgs[0]).toMatchObject({
      website: "https://acmefire.co.uk",
      address: "12 Industrial Way",
      notes: "Approved for alarm servicing",
      active: false,
    })
  })

  it("rejects when not admin, inserting nothing", async () => {
    requireAdminMock.mockRejectedValue(new Error("Unauthorized"))
    const { addContractor } = await import("@/app/admin/directory/actions")
    await expect(addContractor(BASE_INPUT)).rejects.toThrow("Unauthorized")
    expect(insertArgs).toHaveLength(0)
  })

  it("surfaces the database error message", async () => {
    dbError = { message: "duplicate key" }
    const { addContractor } = await import("@/app/admin/directory/actions")
    await expect(addContractor(BASE_INPUT)).rejects.toThrow("duplicate key")
  })
})

describe("updateContractor", () => {
  it("updates the targeted row and omits `active` when not provided", async () => {
    const { updateContractor } = await import("@/app/admin/directory/actions")
    await updateContractor(CONTRACTOR_ID, { ...BASE_INPUT, notes: "Updated note" })

    expect(updateArgs).toHaveLength(1)
    expect(updateArgs[0].id).toBe(CONTRACTOR_ID)
    expect(updateArgs[0].payload).toMatchObject({ ...BASE_INPUT, notes: "Updated note" })
    // Editing details must not silently flip visibility.
    expect(updateArgs[0].payload).not.toHaveProperty("active")
  })
})

describe("toggleContractorActive", () => {
  it("flips the active flag on the targeted row", async () => {
    const { toggleContractorActive } = await import("@/app/admin/directory/actions")
    await toggleContractorActive(CONTRACTOR_ID, false)

    expect(requireAdminMock).toHaveBeenCalled()
    expect(updateArgs).toHaveLength(1)
    expect(updateArgs[0].id).toBe(CONTRACTOR_ID)
    expect(updateArgs[0].payload).toMatchObject({ active: false })
  })
})

describe("deleteContractor", () => {
  it("soft-deletes by stamping deleted_at instead of removing the row", async () => {
    const { deleteContractor } = await import("@/app/admin/directory/actions")
    await deleteContractor(CONTRACTOR_ID)

    expect(updateArgs).toHaveLength(1)
    expect(updateArgs[0].id).toBe(CONTRACTOR_ID)
    expect(typeof updateArgs[0].payload.deleted_at).toBe("string")
    expect(Number.isNaN(Date.parse(updateArgs[0].payload.deleted_at as string))).toBe(false)
  })
})
