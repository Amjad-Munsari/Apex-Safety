// Tests for GET and POST /api/sign/[token]
//
// Mock strategy: chainable adminClient spies declared BEFORE vi.mock factories
// (hoisting-safe pattern, same as tests/signing/signing.test.ts and
// tests/scheduler/send-reminder.spec.ts).

import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { PDFDocument } from "pdf-lib"

// ── Constants ─────────────────────────────────────────────────────────────────

const FIXED_HASH = "aabbcc00" + "0".repeat(56) // 64-char hex

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Build a minimal valid PDF Blob for use in download mocks. */
async function makeMinimalPdfBlob(): Promise<Blob> {
  const doc = await PDFDocument.create()
  doc.addPage()
  const bytes = await doc.save()
  return new Blob([bytes as BlobPart], { type: "application/pdf" })
}

// ── Spies (declared before vi.mock so hoisting can close over them) ───────────

// proposals.select().eq().maybeSingle()
const proposalsSelectSpy = vi.fn()
// proposals.update().eq().eq().select().maybeSingle()
const proposalsUpdateSpy = vi.fn()
// clients.select().eq().single()
const clientsSingleSpy = vi.fn()
// proposal_signatures.insert()
const signaturesInsertSpy = vi.fn()
// storage.from().createSignedUrl()
const storageSignedUrlSpy = vi.fn()
// storage.from().download()
const storageDownloadSpy = vi.fn()
// storage.from().upload()
const storageUploadSpy = vi.fn()
// workflow_errors.insert()  (auto-issue failure logging)
const workflowErrorsInsertSpy = vi.fn()
// issueContractCore — the route auto-fires this after a successful sign
const issueContractCoreSpy = vi.fn()

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock("server-only", () => ({}))

vi.mock("@/lib/supabase/admin", () => ({
  adminClient: {
    from: (table: string) => {
      if (table === "proposals") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => proposalsSelectSpy(),
            }),
          }),
          update: () => ({
            eq: () => ({
              eq: () => ({
                gt: () => ({
                  select: () => ({
                    maybeSingle: () => proposalsUpdateSpy(),
                  }),
                }),
              }),
            }),
          }),
        }
      }
      if (table === "clients") {
        return {
          select: () => ({
            eq: () => ({
              single: () => clientsSingleSpy(),
            }),
          }),
        }
      }
      if (table === "proposal_signatures") {
        return {
          insert: (data: unknown) => signaturesInsertSpy(data),
        }
      }
      if (table === "workflow_errors") {
        return {
          insert: (data: unknown) => workflowErrorsInsertSpy(data),
        }
      }
      return {}
    },
    storage: {
      from: (_bucket: string) => ({
        createSignedUrl: (_path: string, _ttl: number) =>
          storageSignedUrlSpy(),
        download: (_path: string) => storageDownloadSpy(_path),
        upload: (
          path: string,
          data: unknown,
          opts: unknown
        ) => storageUploadSpy(path, data, opts),
      }),
    },
  },
}))

vi.mock("@/lib/signing", () => ({
  hashToken: (_raw: string) => FIXED_HASH,
  generateSigningToken: () => ({ raw: "raw", hash: FIXED_HASH }),
  validateSigningToken: vi.fn(),
  hashDocument: vi.fn(),
}))

const dispatchSpy = vi.fn()
vi.mock("@/lib/notifications/n8n-dispatch", () => ({
  dispatchNotification: (...args: unknown[]) => dispatchSpy(...args),
}))

vi.mock("@/lib/proposals/issue-contract", () => ({
  issueContractCore: (...args: unknown[]) => issueContractCoreSpy(...args),
}))

const revalidateSpy = vi.fn()
vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => revalidateSpy(...args),
}))

// ── SUT import (after all mocks are registered) ───────────────────────────────

import { GET, POST } from "@/app/api/sign/[token]/route"

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeCtx(token: string): { params: Promise<{ token: string }> } {
  return { params: Promise.resolve({ token }) }
}

function makeRequest(
  method: "GET" | "POST",
  body?: unknown
): NextRequest {
  const url = "https://example.com/api/sign/abc123"
  if (method === "POST") {
    return new NextRequest(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "1.2.3.4",
        "user-agent": "TestAgent/1.0",
      },
      body: JSON.stringify(body),
    })
  }
  return new NextRequest(url, { method: "GET" })
}

const FUTURE = new Date(Date.now() + 86_400_000).toISOString()
const PAST = new Date(Date.now() - 1000).toISOString()

const VALID_PROPOSAL_ROW = {
  id: "proposal-uuid-1234",
  client_id: "client-uuid-5678",
  status: "Sent",
  services_json: [
    { service: { name: "Fire Risk Assessment" }, quantity: 1 },
    { service: { name: "Training" }, quantity: 2 },
  ],
  total_price: 1200,
  proposal_pdf_path: "client-uuid-5678/proposal_proposal-uuid-1234.pdf",
  signing_token_used: false,
  signing_token_expires_at: FUTURE,
  created_at: "2026-05-01T10:00:00.000Z",
  sent_at: "2026-05-02T09:00:00.000Z",
  signing_document_hash: "dochashtestvalue",
}

const VALID_CLIENT = {
  name: "Acme Fire Ltd",
  contact_name: "Jane Smith",
  contact_email: "jane@acme.example",
}

// A real 1×1 PNG data URL — valid for embedSignatureInPdf
const TINY_PNG_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

const VALID_POST_BODY = {
  signer_name: "John Doe",
  signer_email: "john@example.com",
  signature_image: TINY_PNG_DATA_URL,
}

// The consume mock's returned row now includes proposal_pdf_path
const VALID_CONSUMED_ROW = {
  id: VALID_PROPOSAL_ROW.id,
  client_id: VALID_PROPOSAL_ROW.client_id,
  signing_document_hash: "dochashtestvalue",
  services_json: VALID_PROPOSAL_ROW.services_json,
  proposal_pdf_path: VALID_PROPOSAL_ROW.proposal_pdf_path,
}

// ── Suite: GET ────────────────────────────────────────────────────────────────

describe("GET /api/sign/[token]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns 410 when no proposal row is found (anti-enumeration)", async () => {
    proposalsSelectSpy.mockResolvedValue({ data: null, error: null })

    const res = await GET(makeRequest("GET"), makeCtx("tok"))
    expect(res.status).toBe(410)
    const json = await res.json()
    expect(json).toEqual({ error: "expired" })
  })

  it("returns 410 when signing_token_expires_at is in the past", async () => {
    proposalsSelectSpy.mockResolvedValue({
      data: { ...VALID_PROPOSAL_ROW, signing_token_expires_at: PAST },
      error: null,
    })

    const res = await GET(makeRequest("GET"), makeCtx("tok"))
    expect(res.status).toBe(410)
    const json = await res.json()
    expect(json).toEqual({ error: "expired" })
  })

  it("returns 409 when signing_token_used is true", async () => {
    proposalsSelectSpy.mockResolvedValue({
      data: { ...VALID_PROPOSAL_ROW, signing_token_used: true },
      error: null,
    })

    const res = await GET(makeRequest("GET"), makeCtx("tok"))
    expect(res.status).toBe(409)
    const json = await res.json()
    expect(json).toEqual({ error: "already_signed" })
  })

  it("returns 200 with proposal payload on valid token — no internal IDs leaked", async () => {
    proposalsSelectSpy.mockResolvedValue({
      data: VALID_PROPOSAL_ROW,
      error: null,
    })
    clientsSingleSpy.mockResolvedValue({ data: VALID_CLIENT, error: null })
    storageSignedUrlSpy.mockResolvedValue({
      data: { signedUrl: "https://cdn.example.com/proposal.pdf" },
      error: null,
    })

    const res = await GET(makeRequest("GET"), makeCtx("tok"))
    expect(res.status).toBe(200)

    const json = await res.json()

    // Correct shape
    expect(json).toHaveProperty("proposal")
    const { proposal } = json

    // Expected values
    expect(proposal.reference).toBe("PRO-PROPOS") // first 6 chars of "proposal" → "propos" upper
    expect(proposal.title).toBe("Compliance & Training Programme") // 2 services
    expect(proposal.clientName).toBe("Acme Fire Ltd")
    expect(proposal.contactName).toBe("Jane Smith")
    expect(proposal.contactEmail).toBe("jane@acme.example")
    expect(proposal.total).toBe(1200)
    expect(proposal.serviceCount).toBe(2)
    expect(proposal.services).toHaveLength(2)
    expect(proposal.services[0]).toEqual({ name: "Fire Risk Assessment", quantity: 1 })
    expect(proposal.services[1]).toEqual({ name: "Training", quantity: 2 })
    expect(proposal.createdDate).toBe("2026-05-02T09:00:00.000Z") // sent_at preferred
    expect(proposal.pdfUrl).toBe("https://cdn.example.com/proposal.pdf")

    // Must NOT expose internal fields
    expect(proposal).not.toHaveProperty("id")
    expect(proposal).not.toHaveProperty("client_id")
    expect(proposal).not.toHaveProperty("signing_token")
    expect(proposal).not.toHaveProperty("signing_document_hash")
  })
})

// ── Suite: POST ───────────────────────────────────────────────────────────────

describe("POST /api/sign/[token]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: auto-issue succeeds so existing success-path tests are unaffected.
    issueContractCoreSpy.mockResolvedValue({ ok: true })
  })

  it("returns 400 when signature_image does not start with correct prefix", async () => {
    const body = {
      ...VALID_POST_BODY,
      signature_image: "data:image/jpeg;base64,/9j/4AAQ",
    }
    const res = await POST(makeRequest("POST", body), makeCtx("tok"))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe("validation")
    expect(json.message).toContain("signature_image")
  })

  it("returns 400 when signer_email is invalid", async () => {
    const body = { ...VALID_POST_BODY, signer_email: "not-an-email" }
    const res = await POST(makeRequest("POST", body), makeCtx("tok"))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe("validation")
    expect(json.message).toContain("signer_email")
  })

  it("returns 400 when signer_name is blank after trim", async () => {
    const body = { ...VALID_POST_BODY, signer_name: "   " }
    const res = await POST(makeRequest("POST", body), makeCtx("tok"))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe("validation")
    expect(json.message).toContain("signer_name")
  })

  it("returns 409 when atomic consume returns no row (race / already used)", async () => {
    // First query (lookup) → valid row
    proposalsSelectSpy.mockResolvedValue({ data: VALID_PROPOSAL_ROW, error: null })
    // Update consume → null (lost the race)
    proposalsUpdateSpy.mockResolvedValue({ data: null, error: null })

    const res = await POST(makeRequest("POST", VALID_POST_BODY), makeCtx("tok"))
    expect(res.status).toBe(409)
    const json = await res.json()
    expect(json).toEqual({ error: "already_signed" })
  })

  it("returns 200 on success path and re-uploads a stamped PDF", async () => {
    const pdfBlob = await makeMinimalPdfBlob()

    // Lookup → valid row
    proposalsSelectSpy.mockResolvedValue({ data: VALID_PROPOSAL_ROW, error: null })
    // Atomic consume → success, now includes proposal_pdf_path
    proposalsUpdateSpy.mockResolvedValue({
      data: VALID_CONSUMED_ROW,
      error: null,
    })
    // Signature insert → success
    signaturesInsertSpy.mockResolvedValue({ data: null, error: null })
    // Client for notification
    clientsSingleSpy.mockResolvedValue({
      data: { name: "Acme Fire Ltd", contact_email: "jane@acme.example" },
      error: null,
    })
    dispatchSpy.mockResolvedValue({ ok: true })
    // PDF download → returns a real PDF Blob
    storageDownloadSpy.mockResolvedValue({ data: pdfBlob, error: null })
    // PDF upload → success
    storageUploadSpy.mockResolvedValue({ data: {}, error: null })

    const res = await POST(makeRequest("POST", VALID_POST_BODY), makeCtx("tok"))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toEqual({ success: true })

    // The stamped PDF must be re-uploaded to the same path
    expect(storageUploadSpy).toHaveBeenCalledTimes(1)
    const [uploadPath, _uploadData, uploadOpts] =
      storageUploadSpy.mock.calls[0] as [string, unknown, Record<string, unknown>]
    expect(uploadPath).toBe(VALID_PROPOSAL_ROW.proposal_pdf_path)
    expect(uploadOpts).toMatchObject({ contentType: "application/pdf", upsert: true })
  })

  it("returns 200 and inserts signature row with ip + dispatches proposal_signed", async () => {
    const pdfBlob = await makeMinimalPdfBlob()

    // Lookup → valid row
    proposalsSelectSpy.mockResolvedValue({ data: VALID_PROPOSAL_ROW, error: null })
    // Atomic consume → success
    proposalsUpdateSpy.mockResolvedValue({
      data: VALID_CONSUMED_ROW,
      error: null,
    })
    // Signature insert → success
    signaturesInsertSpy.mockResolvedValue({ data: null, error: null })
    // Client for notification
    clientsSingleSpy.mockResolvedValue({
      data: { name: "Acme Fire Ltd", contact_email: "jane@acme.example" },
      error: null,
    })
    dispatchSpy.mockResolvedValue({ ok: true })
    storageDownloadSpy.mockResolvedValue({ data: pdfBlob, error: null })
    storageUploadSpy.mockResolvedValue({ data: {}, error: null })

    const res = await POST(makeRequest("POST", VALID_POST_BODY), makeCtx("tok"))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toEqual({ success: true })

    // Insert called with correct ip (from x-forwarded-for header)
    expect(signaturesInsertSpy).toHaveBeenCalledTimes(1)
    const insertArg = signaturesInsertSpy.mock.calls[0][0] as Record<string, unknown>
    expect(insertArg.proposal_id).toBe(VALID_PROPOSAL_ROW.id)
    expect(insertArg.signer_name).toBe("John Doe")
    expect(insertArg.signer_email).toBe("john@example.com")
    expect(insertArg.ip_address).toBe("1.2.3.4")
    expect(insertArg.user_agent).toBe("TestAgent/1.0")
    expect(insertArg.document_hash).toBe("dochashtestvalue")
    expect(insertArg.signature_image).toBe(TINY_PNG_DATA_URL)

    // Notification dispatched with correct type
    expect(dispatchSpy).toHaveBeenCalledTimes(1)
    const dispatchArg = dispatchSpy.mock.calls[0][0] as Record<string, unknown>
    expect(dispatchArg.type).toBe("proposal_signed")
    expect(dispatchArg.client_name).toBe("Acme Fire Ltd")
    expect(dispatchArg.client_email).toBe("jane@acme.example")

    // revalidatePath called
    expect(revalidateSpy).toHaveBeenCalledWith("/admin/proposals")
  })

  it("returns 200 even when PDF download fails — graceful best-effort", async () => {
    // Lookup → valid row
    proposalsSelectSpy.mockResolvedValue({ data: VALID_PROPOSAL_ROW, error: null })
    // Atomic consume → success
    proposalsUpdateSpy.mockResolvedValue({
      data: VALID_CONSUMED_ROW,
      error: null,
    })
    // Signature insert → success
    signaturesInsertSpy.mockResolvedValue({ data: null, error: null })
    // Client for notification
    clientsSingleSpy.mockResolvedValue({
      data: { name: "Acme Fire Ltd", contact_email: "jane@acme.example" },
      error: null,
    })
    dispatchSpy.mockResolvedValue({ ok: true })
    // PDF download FAILS
    storageDownloadSpy.mockResolvedValue({ data: null, error: { message: "storage error" } })

    const res = await POST(makeRequest("POST", VALID_POST_BODY), makeCtx("tok"))
    // Must still return 200 — signature row is already persisted
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toEqual({ success: true })
    // Upload must NOT have been called
    expect(storageUploadSpy).not.toHaveBeenCalled()
  })

  it("returns 200 even when PDF upload (re-stamp) throws — graceful best-effort", async () => {
    const pdfBlob = await makeMinimalPdfBlob()

    proposalsSelectSpy.mockResolvedValue({ data: VALID_PROPOSAL_ROW, error: null })
    proposalsUpdateSpy.mockResolvedValue({
      data: VALID_CONSUMED_ROW,
      error: null,
    })
    signaturesInsertSpy.mockResolvedValue({ data: null, error: null })
    clientsSingleSpy.mockResolvedValue({
      data: { name: "Acme Fire Ltd", contact_email: "jane@acme.example" },
      error: null,
    })
    dispatchSpy.mockResolvedValue({ ok: true })
    storageDownloadSpy.mockResolvedValue({ data: pdfBlob, error: null })
    // Upload THROWS
    storageUploadSpy.mockRejectedValue(new Error("upload timeout"))

    const res = await POST(makeRequest("POST", VALID_POST_BODY), makeCtx("tok"))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toEqual({ success: true })
  })

  it("returns 200 even when signature insert fails — does not 500 after successful consume", async () => {
    const pdfBlob = await makeMinimalPdfBlob()

    proposalsSelectSpy.mockResolvedValue({ data: VALID_PROPOSAL_ROW, error: null })
    proposalsUpdateSpy.mockResolvedValue({
      data: {
        ...VALID_CONSUMED_ROW,
        services_json: [],
      },
      error: null,
    })
    // Insert fails
    signaturesInsertSpy.mockResolvedValue({
      data: null,
      error: { message: "DB error" },
    })
    clientsSingleSpy.mockResolvedValue({
      data: { name: "X", contact_email: "x@x.com" },
      error: null,
    })
    dispatchSpy.mockResolvedValue({ ok: true })
    storageDownloadSpy.mockResolvedValue({ data: pdfBlob, error: null })
    storageUploadSpy.mockResolvedValue({ data: {}, error: null })

    const res = await POST(makeRequest("POST", VALID_POST_BODY), makeCtx("tok"))
    // Still succeeds — consume was atomic, insert failure is logged not 500d
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toEqual({ success: true })
  })

  it("defaults ip_address to '0.0.0.0' when x-forwarded-for header is absent", async () => {
    const pdfBlob = await makeMinimalPdfBlob()

    proposalsSelectSpy.mockResolvedValue({ data: VALID_PROPOSAL_ROW, error: null })
    proposalsUpdateSpy.mockResolvedValue({
      data: VALID_CONSUMED_ROW,
      error: null,
    })
    signaturesInsertSpy.mockResolvedValue({ data: null, error: null })
    clientsSingleSpy.mockResolvedValue({
      data: { name: "Y", contact_email: "y@y.com" },
      error: null,
    })
    dispatchSpy.mockResolvedValue({ ok: true })
    storageDownloadSpy.mockResolvedValue({ data: pdfBlob, error: null })
    storageUploadSpy.mockResolvedValue({ data: {}, error: null })

    // Request with no x-forwarded-for
    const req = new NextRequest("https://example.com/api/sign/abc", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(VALID_POST_BODY),
    })

    await POST(req, makeCtx("tok"))

    const insertArg = signaturesInsertSpy.mock.calls[0][0] as Record<string, unknown>
    expect(insertArg.ip_address).toBe("0.0.0.0")
  })

  it("returns 500 and does NOT insert when consume returns a row with null signing_document_hash", async () => {
    proposalsSelectSpy.mockResolvedValue({ data: VALID_PROPOSAL_ROW, error: null })
    proposalsUpdateSpy.mockResolvedValue({
      data: {
        ...VALID_CONSUMED_ROW,
        signing_document_hash: null,
      },
      error: null,
    })

    const res = await POST(makeRequest("POST", VALID_POST_BODY), makeCtx("tok"))
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json).toEqual({ error: "server_error" })
    expect(signaturesInsertSpy).not.toHaveBeenCalled()
  })

  it("skips PDF embed when proposal_pdf_path is null — still returns 200", async () => {
    proposalsSelectSpy.mockResolvedValue({ data: VALID_PROPOSAL_ROW, error: null })
    proposalsUpdateSpy.mockResolvedValue({
      data: {
        ...VALID_CONSUMED_ROW,
        proposal_pdf_path: null,
      },
      error: null,
    })
    signaturesInsertSpy.mockResolvedValue({ data: null, error: null })
    clientsSingleSpy.mockResolvedValue({
      data: { name: "Z", contact_email: "z@z.com" },
      error: null,
    })
    dispatchSpy.mockResolvedValue({ ok: true })

    const res = await POST(makeRequest("POST", VALID_POST_BODY), makeCtx("tok"))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toEqual({ success: true })
    // Neither download nor upload should be called when path is null
    expect(storageDownloadSpy).not.toHaveBeenCalled()
    expect(storageUploadSpy).not.toHaveBeenCalled()
  })

  it("auto-issues the contract after a successful sign (calls issueContractCore)", async () => {
    const pdfBlob = await makeMinimalPdfBlob()

    proposalsSelectSpy.mockResolvedValue({ data: VALID_PROPOSAL_ROW, error: null })
    proposalsUpdateSpy.mockResolvedValue({ data: VALID_CONSUMED_ROW, error: null })
    signaturesInsertSpy.mockResolvedValue({ data: null, error: null })
    clientsSingleSpy.mockResolvedValue({
      data: { name: "Acme Fire Ltd", contact_email: "jane@acme.example" },
      error: null,
    })
    dispatchSpy.mockResolvedValue({ ok: true })
    storageDownloadSpy.mockResolvedValue({ data: pdfBlob, error: null })
    storageUploadSpy.mockResolvedValue({ data: {}, error: null })

    const res = await POST(makeRequest("POST", VALID_POST_BODY), makeCtx("tok"))
    expect(res.status).toBe(200)

    // Contract auto-issued with the consumed proposal id
    expect(issueContractCoreSpy).toHaveBeenCalledTimes(1)
    expect(issueContractCoreSpy).toHaveBeenCalledWith(VALID_PROPOSAL_ROW.id)
    // Happy path logs nothing to workflow_errors
    expect(workflowErrorsInsertSpy).not.toHaveBeenCalled()
  })

  it("still returns 200 and logs workflow_errors when auto-issue returns ok:false", async () => {
    const pdfBlob = await makeMinimalPdfBlob()

    proposalsSelectSpy.mockResolvedValue({ data: VALID_PROPOSAL_ROW, error: null })
    proposalsUpdateSpy.mockResolvedValue({ data: VALID_CONSUMED_ROW, error: null })
    signaturesInsertSpy.mockResolvedValue({ data: null, error: null })
    clientsSingleSpy.mockResolvedValue({
      data: { name: "Acme Fire Ltd", contact_email: "jane@acme.example" },
      error: null,
    })
    dispatchSpy.mockResolvedValue({ ok: true })
    storageDownloadSpy.mockResolvedValue({ data: pdfBlob, error: null })
    storageUploadSpy.mockResolvedValue({ data: {}, error: null })
    // Contract generation fails (returned error, not thrown)
    issueContractCoreSpy.mockResolvedValue({ ok: false, error: "boom" })

    const res = await POST(makeRequest("POST", VALID_POST_BODY), makeCtx("tok"))
    // Signature is already persisted — the request must still succeed
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toEqual({ success: true })

    expect(workflowErrorsInsertSpy).toHaveBeenCalledTimes(1)
    const arg = workflowErrorsInsertSpy.mock.calls[0][0] as Record<string, unknown>
    expect(arg.workflow_name).toBe("auto_issue_contract")
    expect(arg.error_message).toBe("boom")
    expect(arg.payload).toMatchObject({
      proposalId: VALID_PROPOSAL_ROW.id,
      client_id: VALID_PROPOSAL_ROW.client_id,
    })
  })

  it("still returns 200 and logs workflow_errors when auto-issue throws", async () => {
    const pdfBlob = await makeMinimalPdfBlob()

    proposalsSelectSpy.mockResolvedValue({ data: VALID_PROPOSAL_ROW, error: null })
    proposalsUpdateSpy.mockResolvedValue({ data: VALID_CONSUMED_ROW, error: null })
    signaturesInsertSpy.mockResolvedValue({ data: null, error: null })
    clientsSingleSpy.mockResolvedValue({
      data: { name: "Acme Fire Ltd", contact_email: "jane@acme.example" },
      error: null,
    })
    dispatchSpy.mockResolvedValue({ ok: true })
    storageDownloadSpy.mockResolvedValue({ data: pdfBlob, error: null })
    storageUploadSpy.mockResolvedValue({ data: {}, error: null })
    // Contract generation throws (unexpected error)
    issueContractCoreSpy.mockRejectedValue(new Error("kaboom"))

    const res = await POST(makeRequest("POST", VALID_POST_BODY), makeCtx("tok"))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toEqual({ success: true })

    expect(workflowErrorsInsertSpy).toHaveBeenCalledTimes(1)
    const arg = workflowErrorsInsertSpy.mock.calls[0][0] as Record<string, unknown>
    expect(arg.workflow_name).toBe("auto_issue_contract")
    expect(arg.error_message).toBe("kaboom")
  })
})
