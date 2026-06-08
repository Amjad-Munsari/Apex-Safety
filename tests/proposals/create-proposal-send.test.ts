// TDD: tests/proposals/create-proposal-send.test.ts
// SUT: createProposal (app/admin/proposals/actions.ts)
//
// Verifies that:
//  • The Send path (saveAsDraft absent/false) mints a signing token and writes
//    status "Sent" to the proposals table — the production bug this fixes.
//  • The Draft path (saveAsDraft: true) does NOT mint a token and never writes
//    status "Sent".
//
// Hoisting-safe pattern: spies declared BEFORE vi.mock factories.

import { describe, it, expect, vi, beforeEach } from "vitest"

// ── Spies (declared before vi.mock factories so they can be referenced) ───────

const requireAdminSpy = vi.fn()
const generateSigningTokenSpy = vi.fn()
const hashDocumentSpy = vi.fn()
const dispatchNotificationSpy = vi.fn()
const revalidatePathSpy = vi.fn()
const generateProposalPdfBufferSpy = vi.fn()

// Chainable adminClient builder.
// createProposal uses:
//   .from("proposals").insert([...]).select().single()        → new row
//   .from("clients").select(...).eq(...).single()             → client (PDF step)
//   .from("proposals").update({pdf_path,total}).eq(...)       → path+total write
//   .storage.from("proposals").upload(...)                    → PDF upload
// sendProposalForSignature (called by createProposal on Send path) uses:
//   .from("proposals").select(...).eq(...).maybeSingle()      → proposal re-read
//   .from("clients").select(...).eq(...).single()             → client again
//   .from("proposals").update({signing_token,...}).eq(...)    → token write

const proposalsInsertSpy = vi.fn()
const proposalsMaybeSingleSpy = vi.fn()
const proposalsUpdateSpy = vi.fn() // captures the patch object passed to .update()
const clientsSingleSpy = vi.fn()
const storageUploadSpy = vi.fn()

// Track every call to proposals.update() separately so we can distinguish
// the "pdf_path + total" write from the "signing_token + status" write.
const proposalsUpdatePatchHistory: Record<string, unknown>[] = []

vi.mock("server-only", () => ({}))

vi.mock("@/lib/auth-helpers", () => ({
  requireAdmin: (...args: unknown[]) => requireAdminSpy(...args),
}))

vi.mock("@/lib/signing", () => ({
  generateSigningToken: (...args: unknown[]) => generateSigningTokenSpy(...args),
  hashDocument: (...args: unknown[]) => hashDocumentSpy(...args),
}))

vi.mock("@/lib/notifications/n8n-dispatch", () => ({
  dispatchNotification: (...args: unknown[]) => dispatchNotificationSpy(...args),
}))

vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => revalidatePathSpy(...args),
}))

// lib/site-url — return a stable test origin so signing_url is deterministic
vi.mock("@/lib/site-url", () => ({
  getSiteUrl: () => "https://test.example.com",
}))

// @/lib/pdf/generator — dynamic import inside createProposal; mock the module
vi.mock("@/lib/pdf/generator", () => ({
  generateProposalPdfBuffer: (...args: unknown[]) => generateProposalPdfBufferSpy(...args),
}))

// ai + @ai-sdk/openai — createProposal imports these at module level
vi.mock("ai", () => ({ generateText: vi.fn() }))
vi.mock("@ai-sdk/openai", () => ({ createOpenAI: vi.fn(() => vi.fn()) }))

vi.mock("@/lib/supabase/admin", () => ({
  adminClient: {
    from: (table: string) => {
      if (table === "proposals") {
        return {
          insert: (_rows: unknown[]) => ({
            select: () => ({
              single: () => proposalsInsertSpy(),
            }),
          }),
          select: (_cols: string) => ({
            eq: (_col: string, _val: string) => ({
              maybeSingle: () => proposalsMaybeSingleSpy(),
            }),
          }),
          update: (patch: Record<string, unknown>) => {
            // Record every update patch for later assertion
            proposalsUpdatePatchHistory.push(patch)
            return {
              eq: (_col: string, _val: string) => proposalsUpdateSpy(patch),
            }
          },
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
      return {}
    },
    storage: {
      from: (_bucket: string) => ({
        upload: (...args: unknown[]) => storageUploadSpy(...args),
      }),
    },
  },
}))

// ── Import SUT after all mocks are registered ────────────────────────────────

import { createProposal } from "@/app/admin/proposals/actions"

// ── Fixtures ─────────────────────────────────────────────────────────────────

const PROPOSAL_ID = "proposal-uuid-99"
const CLIENT_ID = "client-uuid-42"

/** The newly-inserted proposal row (minimal shape) */
const INSERT_ROW = {
  id: PROPOSAL_ID,
  client_id: CLIENT_ID,
  status: "Draft",
  proposal_pdf_path: null,
  services_json: [{ service: { name: "Fire Risk Assessment" }, quantity: 1 }],
}

/**
 * The row returned by sendProposalForSignature's re-load (maybeSingle).
 * Must include proposal_pdf_path so the "no_pdf" guard passes.
 */
const SEND_LOAD_ROW = {
  ...INSERT_ROW,
  proposal_pdf_path: `${CLIENT_ID}/proposal_${PROPOSAL_ID}.pdf`,
}

const CLIENT_ROW_PDF = {
  name: "Acme Ltd",
  site_address: "1 Test St",
  contact_name: "Jane Smith",
}

const CLIENT_ROW_SIGN = {
  name: "Acme Ltd",
  contact_name: "Jane Smith",
  contact_email: "jane@acme.co.uk",
}

const TOKEN_FIXTURE = { raw: "raw-token-xyz", hash: "hash-xyz" }
const DOC_HASH = "doc-hash-xyz"
const PDF_BUFFER = Buffer.from("fake-pdf")

// ── Suite ─────────────────────────────────────────────────────────────────────

describe("createProposal — Send path (saveAsDraft omitted / false)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    proposalsUpdatePatchHistory.length = 0

    // requireAdmin resolves for all calls (createProposal + sendProposalForSignature)
    requireAdminSpy.mockResolvedValue("admin-user-id")

    // Insert returns the new proposal row
    proposalsInsertSpy.mockResolvedValue({ data: INSERT_ROW, error: null })

    // PDF-step client load (name, site_address, contact_name)
    clientsSingleSpy.mockResolvedValue({ data: CLIENT_ROW_PDF, error: null })

    // PDF generation and upload succeed
    generateProposalPdfBufferSpy.mockResolvedValue(PDF_BUFFER)
    storageUploadSpy.mockResolvedValue({ error: null })

    // proposals.update() always succeeds
    proposalsUpdateSpy.mockResolvedValue({ error: null })

    // sendProposalForSignature re-loads the proposal (now with pdf path)
    proposalsMaybeSingleSpy.mockResolvedValue({ data: SEND_LOAD_ROW, error: null })

    // sendProposalForSignature loads the client for signing
    // Second call to clientsSingleSpy returns the signing-shape row
    clientsSingleSpy
      .mockResolvedValueOnce({ data: CLIENT_ROW_PDF, error: null })  // PDF step
      .mockResolvedValueOnce({ data: CLIENT_ROW_SIGN, error: null }) // signing step

    // Signing helpers
    generateSigningTokenSpy.mockReturnValue(TOKEN_FIXTURE)
    hashDocumentSpy.mockResolvedValue(DOC_HASH)

    // Notification dispatch
    dispatchNotificationSpy.mockResolvedValue({ ok: true, status: 200 })

    // Stable NEXT_PUBLIC_SITE_URL (getSiteUrl is mocked but env also set)
    process.env.NEXT_PUBLIC_SITE_URL = "https://test.example.com"
  })

  it("writes signing_token (hash) and status='Sent' to proposals", async () => {
    await createProposal({
      clientId: CLIENT_ID,
      servicesJson: [{ service: { name: "FRA", description: "", unit_price: 500 }, quantity: 1 }],
      subtotal: 500,
      scopeText: "We will conduct a fire risk assessment.",
    })

    // Find the update patch that contains signing_token — that is the token write
    const tokenWrite = proposalsUpdatePatchHistory.find(p => "signing_token" in p)
    expect(tokenWrite).toBeDefined()
    expect(tokenWrite?.signing_token).toBe(TOKEN_FIXTURE.hash)
    expect(tokenWrite?.status).toBe("Sent")
    expect(tokenWrite?.signing_token_used).toBe(false)
    expect(tokenWrite?.signing_document_hash).toBe(DOC_HASH)
  })

  it("calls generateSigningToken once on the Send path", async () => {
    await createProposal({
      clientId: CLIENT_ID,
      servicesJson: [{ service: { name: "FRA", description: "", unit_price: 500 }, quantity: 1 }],
      subtotal: 500,
      scopeText: "Scope.",
    })

    expect(generateSigningTokenSpy).toHaveBeenCalledTimes(1)
  })

  it("dispatches proposal_signature_request notification", async () => {
    await createProposal({
      clientId: CLIENT_ID,
      servicesJson: [{ service: { name: "FRA", description: "", unit_price: 500 }, quantity: 1 }],
      subtotal: 500,
      scopeText: "Scope.",
    })

    expect(dispatchNotificationSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "proposal_signature_request",
        client_email: CLIENT_ROW_SIGN.contact_email,
        signing_url: expect.stringContaining(`/sign/${TOKEN_FIXTURE.raw}`),
      })
    )
  })

  it("returns the proposal id after a successful send", async () => {
    const result = await createProposal({
      clientId: CLIENT_ID,
      servicesJson: [{ service: { name: "FRA", description: "", unit_price: 500 }, quantity: 1 }],
      subtotal: 500,
      scopeText: "Scope.",
    })

    expect(result).toBe(PROPOSAL_ID)
  })
})

describe("createProposal — Draft path (saveAsDraft: true)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    proposalsUpdatePatchHistory.length = 0

    requireAdminSpy.mockResolvedValue("admin-user-id")
    proposalsInsertSpy.mockResolvedValue({ data: INSERT_ROW, error: null })
    clientsSingleSpy.mockResolvedValue({ data: CLIENT_ROW_PDF, error: null })
    generateProposalPdfBufferSpy.mockResolvedValue(PDF_BUFFER)
    storageUploadSpy.mockResolvedValue({ error: null })
    proposalsUpdateSpy.mockResolvedValue({ error: null })
    // maybeSingle should NOT be called on the Draft path
    proposalsMaybeSingleSpy.mockResolvedValue({ data: SEND_LOAD_ROW, error: null })

    process.env.NEXT_PUBLIC_SITE_URL = "https://test.example.com"
  })

  it("does NOT write a signing_token on the Draft path", async () => {
    await createProposal({
      clientId: CLIENT_ID,
      servicesJson: [{ service: { name: "FRA", description: "", unit_price: 500 }, quantity: 1 }],
      subtotal: 500,
      scopeText: "Draft scope.",
      saveAsDraft: true,
    })

    const tokenWrite = proposalsUpdatePatchHistory.find(p => "signing_token" in p)
    expect(tokenWrite).toBeUndefined()
  })

  it("does NOT call generateSigningToken on the Draft path", async () => {
    await createProposal({
      clientId: CLIENT_ID,
      servicesJson: [{ service: { name: "FRA", description: "", unit_price: 500 }, quantity: 1 }],
      subtotal: 500,
      scopeText: "Draft scope.",
      saveAsDraft: true,
    })

    expect(generateSigningTokenSpy).not.toHaveBeenCalled()
  })

  it("does NOT dispatch a notification on the Draft path", async () => {
    await createProposal({
      clientId: CLIENT_ID,
      servicesJson: [{ service: { name: "FRA", description: "", unit_price: 500 }, quantity: 1 }],
      subtotal: 500,
      scopeText: "Draft scope.",
      saveAsDraft: true,
    })

    expect(dispatchNotificationSpy).not.toHaveBeenCalled()
  })

  it("only writes proposal_pdf_path + total_price on the Draft path (no status change)", async () => {
    await createProposal({
      clientId: CLIENT_ID,
      servicesJson: [{ service: { name: "FRA", description: "", unit_price: 500 }, quantity: 1 }],
      subtotal: 500,
      scopeText: "Draft scope.",
      saveAsDraft: true,
    })

    // Exactly one update: the pdf_path + total write
    expect(proposalsUpdatePatchHistory).toHaveLength(1)
    const patch = proposalsUpdatePatchHistory[0]
    expect(patch).toHaveProperty("proposal_pdf_path")
    expect(patch).toHaveProperty("total_price")
    expect(patch).not.toHaveProperty("status")
    expect(patch).not.toHaveProperty("signing_token")
  })

  it("returns the proposal id after a successful draft save", async () => {
    const result = await createProposal({
      clientId: CLIENT_ID,
      servicesJson: [{ service: { name: "FRA", description: "", unit_price: 500 }, quantity: 1 }],
      subtotal: 500,
      scopeText: "Draft scope.",
      saveAsDraft: true,
    })

    expect(result).toBe(PROPOSAL_ID)
  })
})
