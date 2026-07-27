// TDD: tests/proposals/send-for-signature.test.ts
// Route: POST /api/proposals/[id]/send-for-signature
//
// Hoisting-safe pattern: spies declared BEFORE vi.mock factories.

import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

// ── Spies (declared before vi.mock so they can close over factories at hoist) ─

const requireAdminSpy = vi.fn()
const generateSigningTokenSpy = vi.fn()
const hashDocumentSpy = vi.fn()
const dispatchNotificationSpy = vi.fn()
const revalidatePathSpy = vi.fn()

// Chainable adminClient builder
// The mock needs to support two table shapes:
//   adminClient.from("proposals").select(...).eq(...).maybeSingle()  → proposal row
//   adminClient.from("clients").select(...).eq(...).single()         → client row
//   adminClient.from("proposals").update(...).eq(...)                → update

const proposalsMaybeSingleSpy = vi.fn()
const clientsSingleSpy = vi.fn()
const proposalsUpdateEqSpy = vi.fn()
const workflowErrorsInsertSpy = vi.fn()

vi.mock("server-only", () => ({}))

vi.mock("@/lib/auth-helpers", () => ({
  requireAdmin: (...args: unknown[]) => requireAdminSpy(...args),
}))

vi.mock("@/lib/signing", () => ({
  generateSigningToken: (...args: unknown[]) => generateSigningTokenSpy(...args),
  hashDocument: (...args: unknown[]) => hashDocumentSpy(...args),
}))

vi.mock("@/lib/notifications/dispatch", () => ({
  dispatchNotification: (...args: unknown[]) => dispatchNotificationSpy(...args),
}))

vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => revalidatePathSpy(...args),
}))

vi.mock("@/lib/supabase/admin", () => ({
  adminClient: {
    from: (table: string) => {
      if (table === "proposals") {
        return {
          select: (_cols: string) => ({
            eq: (_col: string, _val: string) => ({
              maybeSingle: () => proposalsMaybeSingleSpy(),
            }),
          }),
          update: (_patch: Record<string, unknown>) => ({
            eq: (_col: string, _val: string) => proposalsUpdateEqSpy(_patch),
          }),
        }
      }
      if (table === "clients") {
        return {
          select: (_cols: string) => ({
            eq: (_col: string, _val: string) => ({
              single: () => clientsSingleSpy(),
            }),
          }),
        }
      }
      if (table === "workflow_errors") {
        return { insert: (...args: unknown[]) => workflowErrorsInsertSpy(...args) }
      }
      return {}
    },
  },
}))

// ── Import SUT after all mocks are registered ───────────────────────────────

import { POST } from "@/app/api/proposals/[id]/send-for-signature/route"

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeRequest(id: string): [NextRequest, { params: Promise<{ id: string }> }] {
  const req = new NextRequest(`http://localhost/api/proposals/${id}/send-for-signature`, {
    method: "POST",
  })
  const ctx = { params: Promise.resolve({ id }) }
  return [req, ctx]
}

// ── Fixtures ────────────────────────────────────────────────────────────────

const PROPOSAL_ID = "proposal-uuid-1"
const CLIENT_ID = "client-uuid-1"

const PROPOSAL_ROW = {
  id: PROPOSAL_ID,
  client_id: CLIENT_ID,
  status: "Draft",
  proposal_pdf_path: "client-uuid-1/proposal_proposal-uuid-1.pdf",
  services_json: [{ service: { name: "Fire Risk Assessment" }, quantity: 1 }],
}

const CLIENT_ROW = {
  name: "Acme Ltd",
  contact_name: "John Smith",
  contact_email: "john@acme.co.uk",
}

const TOKEN_FIXTURE = { raw: "raw-token-abc", hash: "hash-abc" }

// ── Suite ────────────────────────────────────────────────────────────────────

describe("POST /api/proposals/[id]/send-for-signature", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default happy-path stubs (individual tests override as needed)
    requireAdminSpy.mockResolvedValue("admin-user-id")
    proposalsMaybeSingleSpy.mockResolvedValue({ data: PROPOSAL_ROW, error: null })
    clientsSingleSpy.mockResolvedValue({ data: CLIENT_ROW, error: null })
    generateSigningTokenSpy.mockReturnValue(TOKEN_FIXTURE)
    hashDocumentSpy.mockResolvedValue("doc-hash-abc")
    proposalsUpdateEqSpy.mockResolvedValue({ error: null })
    dispatchNotificationSpy.mockResolvedValue({ ok: true, status: 200 })
    workflowErrorsInsertSpy.mockResolvedValue({ error: null })
    process.env.NEXT_PUBLIC_SITE_URL = "https://test.example.com"
  })

  // ── 401 when requireAdmin throws ─────────────────────────────────────────

  it("returns 401 when requireAdmin throws Unauthorized", async () => {
    requireAdminSpy.mockRejectedValueOnce(new Error("Unauthorized"))
    const [req, ctx] = makeRequest(PROPOSAL_ID)

    const res = await POST(req, ctx)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body).toEqual({ error: "Unauthorized" })
  })

  // ── 404 when proposal not found ──────────────────────────────────────────

  it("returns 404 when the proposal row does not exist", async () => {
    proposalsMaybeSingleSpy.mockResolvedValueOnce({ data: null, error: null })
    const [req, ctx] = makeRequest(PROPOSAL_ID)

    const res = await POST(req, ctx)

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body).toEqual({ error: "not_found" })
  })

  // ── 409 when proposal is already finalised ───────────────────────────────

  it("returns 409 with error 'already_finalised' when proposal.status is 'Signed'", async () => {
    proposalsMaybeSingleSpy.mockResolvedValueOnce({
      data: { ...PROPOSAL_ROW, status: "Signed" },
      error: null,
    })
    const [req, ctx] = makeRequest(PROPOSAL_ID)

    const res = await POST(req, ctx)

    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body).toEqual({ error: "already_finalised" })
    expect(proposalsUpdateEqSpy).not.toHaveBeenCalled()
    expect(dispatchNotificationSpy).not.toHaveBeenCalled()
  })

  it("returns 409 with error 'already_finalised' when proposal.status is 'Contract Issued'", async () => {
    proposalsMaybeSingleSpy.mockResolvedValueOnce({
      data: { ...PROPOSAL_ROW, status: "Contract Issued" },
      error: null,
    })
    const [req, ctx] = makeRequest(PROPOSAL_ID)

    const res = await POST(req, ctx)

    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body).toEqual({ error: "already_finalised" })
    expect(proposalsUpdateEqSpy).not.toHaveBeenCalled()
    expect(dispatchNotificationSpy).not.toHaveBeenCalled()
  })

  // ── 400 when proposal has no PDF ─────────────────────────────────────────

  it("returns 400 with error 'no_pdf' when proposal_pdf_path is null", async () => {
    proposalsMaybeSingleSpy.mockResolvedValueOnce({
      data: { ...PROPOSAL_ROW, proposal_pdf_path: null },
      error: null,
    })
    const [req, ctx] = makeRequest(PROPOSAL_ID)

    const res = await POST(req, ctx)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe("no_pdf")
  })

  // ── 400 when client has no email ─────────────────────────────────────────

  it("returns 400 with error 'no_client_email' when contact_email is missing", async () => {
    clientsSingleSpy.mockResolvedValueOnce({
      data: { name: "Acme Ltd", contact_name: "John", contact_email: null },
      error: null,
    })
    const [req, ctx] = makeRequest(PROPOSAL_ID)

    const res = await POST(req, ctx)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe("no_client_email")
  })

  // ── Happy path ───────────────────────────────────────────────────────────

  it("happy path: returns { success: true, signing_url } containing raw token", async () => {
    const [req, ctx] = makeRequest(PROPOSAL_ID)

    const res = await POST(req, ctx)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.signing_url).toContain("/sign/")
    expect(body.signing_url).toContain(TOKEN_FIXTURE.raw)
  })

  it("happy path: updates proposals with status 'Sent' and the token hash from generateSigningToken", async () => {
    const [req, ctx] = makeRequest(PROPOSAL_ID)

    await POST(req, ctx)

    expect(proposalsUpdateEqSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "Sent",
        signing_token: TOKEN_FIXTURE.hash,
        signing_token_used: false,
        signing_document_hash: "doc-hash-abc",
      })
    )
  })

  it("happy path: calls revalidatePath for both admin proposal paths", async () => {
    const [req, ctx] = makeRequest(PROPOSAL_ID)

    await POST(req, ctx)

    expect(revalidatePathSpy).toHaveBeenCalledWith("/admin/proposals")
    expect(revalidatePathSpy).toHaveBeenCalledWith(`/admin/proposals/${PROPOSAL_ID}`)
  })

  it("happy path: dispatches proposal_signature_request notification with correct payload", async () => {
    const [req, ctx] = makeRequest(PROPOSAL_ID)

    await POST(req, ctx)

    expect(dispatchNotificationSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "proposal_signature_request",
        client_name: CLIENT_ROW.name,
        client_email: CLIENT_ROW.contact_email,
        signing_url: expect.stringContaining(`/sign/${TOKEN_FIXTURE.raw}`),
      })
    )
  })

  it("still returns success when dispatch notification fails (non-fatal)", async () => {
    dispatchNotificationSpy.mockResolvedValueOnce({ ok: false, error: "webhook 500" })
    const [req, ctx] = makeRequest(PROPOSAL_ID)

    const res = await POST(req, ctx)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.delivery_email_failed).toBe(true)
    expect(workflowErrorsInsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        workflow_name: "proposal_signature_request",
        error_message: "webhook 500",
      })
    )
  })
})
