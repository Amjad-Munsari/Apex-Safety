import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * The Retry (re-send email) action behind /admin/errors.
 *
 * What matters operationally: only an admin can trigger a send, a failure with
 * no saved email says so instead of appearing to work, every outbox refusal
 * reaches the admin as its own sentence (each one is a different next step), and
 * a re-send that lands files the error away so it stops being chased.
 */

const requireAdminSpy = vi.fn()
const revalidatePathSpy = vi.fn()
const logAppErrorSpy = vi.fn()
const retryOutboxEntrySpy = vi.fn()
const fromSpy = vi.fn()

type UpdateCall = {
  table: string
  values: Record<string, unknown>
  eq: [string, unknown][]
  not: [string, string, unknown][]
}

let updateCalls: UpdateCall[] = []
let selectedColumns: string[] = []
let rowResult: { data: { id: string; payload: unknown } | null; error: { message: string } | null }

function queryBuilder(table: string) {
  return {
    select(columns: string) {
      selectedColumns.push(columns)
      const chain = {
        eq() {
          return chain
        },
        maybeSingle() {
          return Promise.resolve(rowResult)
        },
      }
      return chain
    },
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
        then(resolve: (value: unknown) => unknown) {
          return Promise.resolve({ data: [{ id: "err-1" }], error: null }).then(resolve)
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
vi.mock("@/lib/notifications/outbox", () => ({
  retryOutboxEntry: (...args: unknown[]) => retryOutboxEntrySpy(...args),
}))

beforeEach(() => {
  vi.clearAllMocks()
  updateCalls = []
  selectedColumns = []
  rowResult = { data: { id: "err-1", payload: { outboxId: "ob-1", proposalId: "p-1" } }, error: null }
  requireAdminSpy.mockResolvedValue("admin-1")
  retryOutboxEntrySpy.mockResolvedValue({ ok: true, outboxId: "ob-1" })
  fromSpy.mockImplementation((table: string) => queryBuilder(table))
})

describe("retryWorkflowError authorisation", () => {
  it("refuses to run without an admin session, before any email can be sent", async () => {
    requireAdminSpy.mockRejectedValue(new Error("Unauthorized"))
    const { retryWorkflowError } = await import("@/app/admin/errors/actions")

    await expect(retryWorkflowError("err-1")).rejects.toThrow("Unauthorized")
    expect(fromSpy).not.toHaveBeenCalled()
    expect(retryOutboxEntrySpy).not.toHaveBeenCalled()
  })

  it("sends nothing when there is no admin id to attribute the send to", async () => {
    requireAdminSpy.mockResolvedValue(null)
    const { retryWorkflowError } = await import("@/app/admin/errors/actions")

    expect(await retryWorkflowError("err-1")).toEqual({ ok: false, error: "Not authorised." })
    expect(retryOutboxEntrySpy).not.toHaveBeenCalled()
  })

  it("rejects a missing id before touching the database", async () => {
    const { retryWorkflowError } = await import("@/app/admin/errors/actions")

    expect(await retryWorkflowError("")).toEqual({ ok: false, error: "Missing error id." })
    expect(fromSpy).not.toHaveBeenCalled()
  })
})

describe("retryWorkflowError row lookup", () => {
  it("explains that a pre-outbox failure has no saved email to re-send", async () => {
    rowResult = { data: { id: "err-1", payload: { proposalId: "p-1" } }, error: null }
    const { retryWorkflowError } = await import("@/app/admin/errors/actions")
    const result = await retryWorkflowError("err-1")

    expect(result.ok).toBe(false)
    expect(result.ok === false && result.error).toMatch(/predates the email outbox/)
    expect(retryOutboxEntrySpy).not.toHaveBeenCalled()
    expect(updateCalls).toHaveLength(0)
  })

  it("treats a null payload the same way rather than throwing on it", async () => {
    rowResult = { data: { id: "err-1", payload: null }, error: null }
    const { retryWorkflowError } = await import("@/app/admin/errors/actions")

    expect((await retryWorkflowError("err-1")).ok).toBe(false)
    expect(retryOutboxEntrySpy).not.toHaveBeenCalled()
  })

  it("reports a vanished error row instead of sending on a guess", async () => {
    rowResult = { data: null, error: null }
    const { retryWorkflowError } = await import("@/app/admin/errors/actions")

    expect(await retryWorkflowError("err-1")).toEqual({
      ok: false,
      error: "That error record no longer exists.",
    })
    expect(retryOutboxEntrySpy).not.toHaveBeenCalled()
  })

  it("surfaces a lookup failure rather than claiming success", async () => {
    rowResult = { data: null, error: { message: "permission denied" } }
    const { retryWorkflowError } = await import("@/app/admin/errors/actions")

    expect(await retryWorkflowError("err-1")).toEqual({ ok: false, error: "permission denied" })
    expect(retryOutboxEntrySpy).not.toHaveBeenCalled()
  })

  it("reads the payload off the workflow error and passes the outbox id through", async () => {
    const { retryWorkflowError } = await import("@/app/admin/errors/actions")
    await retryWorkflowError("err-1")

    expect(fromSpy).toHaveBeenCalledWith("workflow_errors")
    expect(selectedColumns[0]).toContain("payload")
    expect(retryOutboxEntrySpy).toHaveBeenCalledWith("ob-1")
  })
})

describe("retryWorkflowError refusal mapping", () => {
  const cases: [string, RegExp][] = [
    ["in_progress", /already in progress/i],
    ["resend_not_allowed", /single-use link/i],
    ["payload_unavailable", /no longer usable/i],
    ["not_found", /no longer exists/i],
    ["not_retryable", /not in a state that can be re-sent/i],
  ]

  for (const [refusal, expected] of cases) {
    it(`turns the ${refusal} refusal into its own explanation and leaves the row open`, async () => {
      retryOutboxEntrySpy.mockResolvedValue({ ok: false, outboxId: "ob-1", refusal })
      const { retryWorkflowError } = await import("@/app/admin/errors/actions")
      const result = await retryWorkflowError("err-1")

      expect(result.ok).toBe(false)
      expect(result.ok === false && result.error).toMatch(expected)
      // A refused re-send is not a handled failure, so it must stay unresolved.
      expect(updateCalls).toHaveLength(0)
      expect(revalidatePathSpy).not.toHaveBeenCalled()
    })
  }

  it("passes through the provider error when the send failed rather than being refused", async () => {
    retryOutboxEntrySpy.mockResolvedValue({
      ok: false,
      outboxId: "ob-1",
      error: "Invalid `to` field",
      errorKind: "hard",
    })
    const { retryWorkflowError } = await import("@/app/admin/errors/actions")

    expect(await retryWorkflowError("err-1")).toEqual({ ok: false, error: "Invalid `to` field" })
    expect(updateCalls).toHaveLength(0)
  })

  it("still says something useful when a failed send carries no error text", async () => {
    retryOutboxEntrySpy.mockResolvedValue({ ok: false, outboxId: "ob-1" })
    const { retryWorkflowError } = await import("@/app/admin/errors/actions")
    const result = await retryWorkflowError("err-1")

    expect(result.ok).toBe(false)
    expect(result.ok === false && result.error).toMatch(/failed again/i)
  })
})

describe("retryWorkflowError success", () => {
  it("marks the error resolved and refreshes the pages that count failures", async () => {
    const { retryWorkflowError } = await import("@/app/admin/errors/actions")
    const result = await retryWorkflowError("err-1")

    expect(result.ok).toBe(true)
    expect(result.ok === true && result.affected).toBe(1)
    expect(updateCalls).toHaveLength(1)
    expect(updateCalls[0].table).toBe("workflow_errors")
    expect(updateCalls[0].values).toEqual({ resolved: true })
    expect(updateCalls[0].eq).toEqual([["id", "err-1"]])
    // Same guard as Resolve, so a second click cannot rewrite the row.
    expect(updateCalls[0].not).toEqual([["resolved", "is", true]])
    expect(revalidatePathSpy).toHaveBeenCalledWith("/admin/errors")
    expect(revalidatePathSpy).toHaveBeenCalledWith("/admin")
  })

  it("reports zero sent when the outbox had already delivered it, but still resolves the row", async () => {
    retryOutboxEntrySpy.mockResolvedValue({ ok: true, outboxId: "ob-1", refusal: "already_sent" })
    const { retryWorkflowError } = await import("@/app/admin/errors/actions")
    const result = await retryWorkflowError("err-1")

    expect(result.ok).toBe(true)
    expect(result.ok === true && result.affected).toBe(0)
    expect(result.ok === true && result.message).toMatch(/already been sent/i)
    expect(updateCalls).toHaveLength(1)
    expect(updateCalls[0].values).toEqual({ resolved: true })
  })
})

describe("retryWorkflowError unexpected failure", () => {
  it("captures the throw to the error log and stays plain to the admin", async () => {
    retryOutboxEntrySpy.mockRejectedValue(new Error("connection reset"))
    const { retryWorkflowError } = await import("@/app/admin/errors/actions")

    expect(await retryWorkflowError("err-1")).toEqual({
      ok: false,
      error: "Could not re-send. Try again.",
    })
    expect(logAppErrorSpy).toHaveBeenCalledWith(
      expect.objectContaining({ area: "workflow-errors.retry", source: "action" }),
    )
    expect(revalidatePathSpy).not.toHaveBeenCalled()
  })
})
