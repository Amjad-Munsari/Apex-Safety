import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * Triage actions behind the Resolve button on /admin/errors.
 *
 * The contract that matters operationally: only an admin can triage, a row is
 * flagged rather than deleted, a repeated click cannot rewrite an already
 * resolved row, and a DB failure never reports success.
 */

const requireAdminSpy = vi.fn()
const revalidatePathSpy = vi.fn()
const logAppErrorSpy = vi.fn()
const fromSpy = vi.fn()

/** Records the filters applied to an update so the guards can be asserted. */
type UpdateCall = {
  table: string
  values: Record<string, unknown>
  eq: [string, unknown][]
  not: [string, string, unknown][]
}

let updateCalls: UpdateCall[] = []
let updateResult: { data: { id: string }[] | null; error: { message: string } | null }

function queryBuilder(table: string) {
  return {
    update(values: Record<string, unknown>) {
      const call: UpdateCall = { table, values, eq: [], not: [] }
      updateCalls.push(call)
      const chain = {
        eq(column: string, value: unknown) {
          call.eq.push([column, value])
          return chain
        },
        not(column: string, operator: string, value: unknown) {
          call.not.push([column, operator, value])
          return chain
        },
        select() {
          return Promise.resolve(updateResult)
        },
      }
      return chain
    },
  }
}

vi.mock("@/lib/auth-helpers", () => ({ requireAdmin: (...args: unknown[]) => requireAdminSpy(...args) }))
vi.mock("@/lib/supabase/admin", () => ({
  adminClient: { from: (table: string) => fromSpy(table) },
}))
vi.mock("next/cache", () => ({ revalidatePath: (...args: unknown[]) => revalidatePathSpy(...args) }))
vi.mock("@/lib/observability/log", () => ({ logAppError: (...args: unknown[]) => logAppErrorSpy(...args) }))

beforeEach(() => {
  vi.clearAllMocks()
  updateCalls = []
  updateResult = { data: [{ id: "err-1" }], error: null }
  requireAdminSpy.mockResolvedValue("admin-1")
  fromSpy.mockImplementation((table: string) => queryBuilder(table))
})

describe("resolveWorkflowError", () => {
  it("refuses to run without an admin session", async () => {
    requireAdminSpy.mockRejectedValue(new Error("Unauthorized"))
    const { resolveWorkflowError } = await import("@/app/admin/errors/actions")

    await expect(resolveWorkflowError("err-1")).rejects.toThrow("Unauthorized")
    expect(fromSpy).not.toHaveBeenCalled()
  })

  it("does not write when there is no admin id to attribute the change to", async () => {
    requireAdminSpy.mockResolvedValue(null)
    const { resolveWorkflowError } = await import("@/app/admin/errors/actions")

    expect(await resolveWorkflowError("err-1")).toEqual({ ok: false, error: "Not authorised." })
    expect(fromSpy).not.toHaveBeenCalled()
  })

  it("rejects a missing id before touching the database", async () => {
    const { resolveWorkflowError } = await import("@/app/admin/errors/actions")

    expect(await resolveWorkflowError("")).toEqual({ ok: false, error: "Missing error id." })
    expect(fromSpy).not.toHaveBeenCalled()
  })

  it("flags the one row as resolved and refreshes the pages that count failures", async () => {
    const { resolveWorkflowError } = await import("@/app/admin/errors/actions")
    const result = await resolveWorkflowError("err-1")

    expect(result).toEqual({ ok: true, affected: 1 })
    expect(updateCalls).toHaveLength(1)
    expect(updateCalls[0].table).toBe("workflow_errors")
    expect(updateCalls[0].values).toEqual({ resolved: true })
    expect(updateCalls[0].eq).toEqual([["id", "err-1"]])
    // Guard makes the update a no-op the second time, so a double-click is safe.
    expect(updateCalls[0].not).toEqual([["resolved", "is", true]])
    expect(revalidatePathSpy).toHaveBeenCalledWith("/admin/errors")
    expect(revalidatePathSpy).toHaveBeenCalledWith("/admin")
  })

  it("reports zero affected when the row was already resolved", async () => {
    updateResult = { data: [], error: null }
    const { resolveWorkflowError } = await import("@/app/admin/errors/actions")

    expect(await resolveWorkflowError("err-1")).toEqual({ ok: true, affected: 0 })
  })

  it("surfaces a database failure instead of claiming success", async () => {
    updateResult = { data: null, error: { message: "permission denied" } }
    const { resolveWorkflowError } = await import("@/app/admin/errors/actions")

    expect(await resolveWorkflowError("err-1")).toEqual({ ok: false, error: "permission denied" })
    expect(revalidatePathSpy).not.toHaveBeenCalled()
  })

  it("captures an unexpected throw to the error log and stays quiet to the user", async () => {
    fromSpy.mockImplementation(() => {
      throw new Error("connection reset")
    })
    const { resolveWorkflowError } = await import("@/app/admin/errors/actions")

    expect(await resolveWorkflowError("err-1")).toEqual({
      ok: false,
      error: "Could not update. Try again.",
    })
    expect(logAppErrorSpy).toHaveBeenCalledWith(
      expect.objectContaining({ area: "workflow-errors.resolve", source: "action" }),
    )
    expect(revalidatePathSpy).not.toHaveBeenCalled()
  })
})

describe("reopenWorkflowError", () => {
  it("clears the flag only on rows that are currently resolved", async () => {
    const { reopenWorkflowError } = await import("@/app/admin/errors/actions")
    const result = await reopenWorkflowError("err-1")

    expect(result).toEqual({ ok: true, affected: 1 })
    expect(updateCalls[0].values).toEqual({ resolved: false })
    expect(updateCalls[0].eq).toEqual([
      ["id", "err-1"],
      ["resolved", true],
    ])
    expect(revalidatePathSpy).toHaveBeenCalledWith("/admin/errors")
  })

  it("refuses to run without an admin session", async () => {
    requireAdminSpy.mockRejectedValue(new Error("Unauthorized"))
    const { reopenWorkflowError } = await import("@/app/admin/errors/actions")

    await expect(reopenWorkflowError("err-1")).rejects.toThrow("Unauthorized")
    expect(fromSpy).not.toHaveBeenCalled()
  })
})
