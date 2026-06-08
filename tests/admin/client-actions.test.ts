// Tests for the admin client lifecycle actions (app/admin/clients/actions.ts):
//   - setClientActive  — reversible active flag toggle
//   - deleteClient      — irreversible hard delete with server-side name guard,
//                         Storage cleanup, customer-template cleanup, row delete
//
// Vitest + JSDOM; no real Supabase or auth — all I/O is mocked. The adminClient
// mock records which tables were deleted (and in what order), storage list/remove
// calls, and workflow_errors inserts so we can assert the contract from
// docs/superpowers/specs/2026-06-08-admin-client-removal-design.md.

import { describe, it, expect, vi, beforeEach } from "vitest"

// ── Recording state (reset per test) ─────────────────────────────────────────

let clientRow: { name: string } | null
let clientFetchError: { message: string } | null
const deletedTables: string[] = []
const updateArgs: Record<string, unknown>[] = []
const removeCalls: { bucket: string; paths: string[] }[] = []
const workflowInserts: Record<string, unknown>[] = []
// bucket -> (prefix -> entries). Entry with id=null is a folder (recurse).
let storageTree: Record<string, Record<string, { name: string; id: string | null }[]>>
let storageListError: { message: string } | null

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("@/lib/auth-helpers", () => ({
  requireAdmin: vi.fn().mockResolvedValue("admin-1"),
  isAdmin: vi.fn().mockResolvedValue(true),
}))

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))

vi.mock("@/lib/supabase/admin", () => ({
  adminClient: {
    from: (table: string) => {
      if (table === "clients") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({ data: clientRow, error: clientFetchError }),
            }),
          }),
          update: (arg: Record<string, unknown>) => {
            updateArgs.push(arg)
            return { eq: () => Promise.resolve({ error: null }) }
          },
          delete: () => {
            deletedTables.push("clients")
            return { eq: () => Promise.resolve({ error: null }) }
          },
        }
      }
      if (table === "form_templates") {
        return {
          delete: () => {
            deletedTables.push("form_templates")
            // .eq("owner_type",...).eq("owner_id",...) — two chained eqs.
            return { eq: () => ({ eq: () => Promise.resolve({ error: null }) }) }
          },
        }
      }
      if (table === "workflow_errors") {
        return {
          insert: (arg: Record<string, unknown>) => {
            workflowInserts.push(arg)
            return Promise.resolve({ error: null })
          },
        }
      }
      return {}
    },
    storage: {
      from: (bucket: string) => ({
        list: (prefix: string) =>
          Promise.resolve({
            data: storageListError ? null : storageTree[bucket]?.[prefix] ?? [],
            error: storageListError,
          }),
        remove: (paths: string[]) => {
          removeCalls.push({ bucket, paths })
          return Promise.resolve({ error: null })
        },
      }),
    },
  },
}))

const CLIENT_ID = "11111111-1111-1111-1111-111111111111"

beforeEach(() => {
  vi.clearAllMocks()
  clientRow = { name: "Acme Properties Ltd" }
  clientFetchError = null
  deletedTables.length = 0
  updateArgs.length = 0
  removeCalls.length = 0
  workflowInserts.length = 0
  storageListError = null
  // Default: one report file, and a nested form-media file (exercises recursion).
  storageTree = {
    reports: {
      [CLIENT_ID]: [{ name: `report_${CLIENT_ID}.pdf`, id: "f-report" }],
    },
    "form-media": {
      [CLIENT_ID]: [{ name: "signatures", id: null }],
      [`${CLIENT_ID}/signatures`]: [{ name: "sub-1", id: null }],
      [`${CLIENT_ID}/signatures/sub-1`]: [{ name: "field.png", id: "f-sig" }],
    },
  }
})

describe("setClientActive", () => {
  it("updates the active flag and returns ok with the new value", async () => {
    const { setClientActive } = await import("@/app/admin/clients/actions")
    const res = await setClientActive(CLIENT_ID, false)
    expect(res).toEqual({ ok: true, active: false })
    expect(updateArgs).toContainEqual({ active: false })
  })

  it("reactivates when passed true", async () => {
    const { setClientActive } = await import("@/app/admin/clients/actions")
    const res = await setClientActive(CLIENT_ID, true)
    expect(res).toEqual({ ok: true, active: true })
    expect(updateArgs).toContainEqual({ active: true })
  })
})

describe("deleteClient — name guard", () => {
  it("rejects when the confirmation name does not match, deleting nothing", async () => {
    const { deleteClient } = await import("@/app/admin/clients/actions")
    const res = await deleteClient(CLIENT_ID, "Wrong Name")
    expect(res).toEqual({ ok: false, error: "Name does not match." })
    expect(deletedTables).toHaveLength(0)
    expect(removeCalls).toHaveLength(0)
  })

  it("rejects when the client no longer exists", async () => {
    clientRow = null
    const { deleteClient } = await import("@/app/admin/clients/actions")
    const res = await deleteClient(CLIENT_ID, "Acme Properties Ltd")
    expect(res).toEqual({ ok: false, error: "Client not found." })
    expect(deletedTables).toHaveLength(0)
  })

  it("trims surrounding whitespace before comparing", async () => {
    const { deleteClient } = await import("@/app/admin/clients/actions")
    const res = await deleteClient(CLIENT_ID, "  Acme Properties Ltd  ")
    expect(res).toEqual({ ok: true })
  })
})

describe("deleteClient — happy path", () => {
  it("cleans storage in both buckets, removes customer templates before the client row, and returns ok", async () => {
    const { deleteClient } = await import("@/app/admin/clients/actions")
    const res = await deleteClient(CLIENT_ID, "Acme Properties Ltd")

    expect(res).toEqual({ ok: true })

    // Storage: a remove() call per bucket that had files, scoped to the client prefix.
    const reportsRemove = removeCalls.find((c) => c.bucket === "reports")
    const mediaRemove = removeCalls.find((c) => c.bucket === "form-media")
    expect(reportsRemove?.paths).toEqual([`${CLIENT_ID}/report_${CLIENT_ID}.pdf`])
    // Nested folder walk resolves the deep file path.
    expect(mediaRemove?.paths).toEqual([`${CLIENT_ID}/signatures/sub-1/field.png`])

    // Order: customer templates deleted BEFORE the client row (clientId must
    // stay resolvable through cleanup; row delete is the final atomic step).
    expect(deletedTables).toEqual(["form_templates", "clients"])

    // No workflow_errors on the happy path.
    expect(workflowInserts).toHaveLength(0)
  })
})

describe("deleteClient — storage failure is non-blocking", () => {
  it("logs workflow_errors but still deletes the client row", async () => {
    storageListError = { message: "bucket unavailable" }
    const { deleteClient } = await import("@/app/admin/clients/actions")
    const res = await deleteClient(CLIENT_ID, "Acme Properties Ltd")

    expect(res).toEqual({ ok: true })
    // The failure was recorded…
    expect(workflowInserts).toHaveLength(1)
    expect(workflowInserts[0]).toMatchObject({
      workflow_name: "client_delete_storage",
      payload: { clientId: CLIENT_ID },
    })
    // …and the delete still proceeded.
    expect(deletedTables).toEqual(["form_templates", "clients"])
  })
})
