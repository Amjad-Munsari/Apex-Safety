// Tests for GET and POST /api/sign/[token]
//
// Mock strategy: chainable adminClient spies declared BEFORE vi.mock factories
// (hoisting-safe pattern, same as tests/signing/signing.test.ts and
// tests/scheduler/send-reminder.spec.ts).

import { beforeEach, describe, expect, it, vi } from "vitest"
import { signedPdfPathFor } from "@/lib/signing-paths"
import { NextRequest } from "next/server"

// ── Constants ─────────────────────────────────────────────────────────────────

const FIXED_HASH = "aabbcc00" + "0".repeat(56) // 64-char hex
const FIXED_PDF_BASE64 =
  "JVBERi0xLjcKJYGBgYEKCjEgMCBvYmoKPDwKL1R5cGUgL1BhZ2VzCi9LaWRzIFsgNCAwIFIgXQovQ291bnQgMQo+PgplbmRvYmoKCjIgMCBvYmoKPDwKL1R5cGUgL0NhdGFsb2cKL1BhZ2VzIDEgMCBSCj4+CmVuZG9iagoKMyAwIG9iago8PAovUHJvZHVjZXIgPEZFRkYwMDcwMDA2NDAwNjYwMDJEMDA2QzAwNjkwMDYyMDAyMDAwMjgwMDY4MDA3NDAwNzQwMDcwMDA3MzAwM0EwMDJGMDAyRjAwNjcwMDY5MDA3NDAwNjgwMDc1MDA2MjAwMkUwMDYzMDA2RjAwNkQwMDJGMDA0ODAwNkYwMDcwMDA2NDAwNjkwMDZFMDA2NzAwMkYwMDcwMDA2NDAwNjYwMDJEMDA2QzAwNjkwMDYyMDAyOT4KL01vZERhdGUgKEQ6MjAyMDAxMDEwMDAwMDBaKQovQ3JlYXRvciA8RkVGRjAwNzAwMDY0MDA2NjAwMkQwMDZDMDA2OTAwNjIwMDIwMDAyODAwNjgwMDc0MDA3NDAwNzAwMDczMDAzQTAwMkYwMDJGMDA2NzAwNjkwMDc0MDA2ODAwNzUwMDYyMDAyRTAwNjMwMDZGMDA2RDAwMkYwMDQ4MDA2RjAwNzAwMDY0MDA2OTAwNkUwMDY3MDAyRjAwNzAwMDY0MDA2NjAwMkQwMDZDMDA2OTAwNjIwMDI5PgovQ3JlYXRpb25EYXRlIChEOjIwMjAwMTAxMDAwMDAwWikKPj4KZW5kb2JqCgo0IDAgb2JqCjw8Ci9UeXBlIC9QYWdlCi9QYXJlbnQgMSAwIFIKL1Jlc291cmNlcyA8PAo+PgovTWVkaWFCb3ggWyAwIDAgNTk1LjI4IDg0MS44OSBdCj4+CmVuZG9iagoKeHJlZgowIDUKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDE2IDAwMDAwIG4gCjAwMDAwMDAwNzYgMDAwMDAgbiAKMDAwMDAwMDEyNiAwMDAwMCBuIAowMDAwMDAwNTk2IDAwMDAwIG4gCgp0cmFpbGVyCjw8Ci9TaXplIDUKL1Jvb3QgMiAwIFIKL0luZm8gMyAwIFIKPj4KCnN0YXJ0eHJlZgo2OTMKJSVFT0Y="
const FIXED_DOCUMENT_HASH =
  "ed5101ed7fd73825e1772502204f153118265e93c0ee5564e586e922c7e71c92"

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Build the same minimal valid PDF on every run so its integrity hash is fixed. */
function makeMinimalPdfBlob(): Blob {
  return new Blob([Buffer.from(FIXED_PDF_BASE64, "base64")], {
    type: "application/pdf",
  })
}

// ── Spies (declared before vi.mock so hoisting can close over them) ───────────

// proposals.select().eq().maybeSingle()
const proposalsSelectSpy = vi.fn()
// consume path: proposals.update().eq().eq().gt().select().maybeSingle()
const proposalsUpdateSpy = vi.fn()
// rollback path: proposals.update().eq().eq().eq()  (awaited directly)
const proposalsRollbackSpy = vi.fn()
// captures every proposals.update(payload) arg, in call order
const proposalsUpdatePayloads: unknown[] = []
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
// atomic signing RPC
const redeemSignatureSpy = vi.fn()
// cleanup of a generated artefact when the RPC fails or loses the race
const storageRemoveSpy = vi.fn()

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock("server-only", () => ({}))

vi.mock("@/lib/supabase/admin", () => ({
  adminClient: {
    from: (table: string) => {
      if (table === "proposals") {
        // One chainable builder serves both terminals:
        //  - consume: .eq().eq().gt().select().maybeSingle() → proposalsUpdateSpy
        //  - rollback: .eq().eq().eq() awaited directly → proposalsRollbackSpy (thenable)
        const updateBuilder: Record<string, unknown> = {
          eq: () => updateBuilder,
          gt: () => updateBuilder,
          select: () => updateBuilder,
          maybeSingle: () => proposalsUpdateSpy(),
          then: (
            resolve: (v: unknown) => unknown,
            reject: (e: unknown) => unknown
          ) => Promise.resolve(proposalsRollbackSpy()).then(resolve, reject),
        }
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => proposalsSelectSpy(),
            }),
          }),
          update: (payload: unknown) => {
            proposalsUpdatePayloads.push(payload)
            return updateBuilder
          },
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
      from: () => ({
        createSignedUrl: () => storageSignedUrlSpy(),
        download: (path: string) => storageDownloadSpy(path),
        upload: (
          path: string,
          data: unknown,
          opts: unknown
        ) => storageUploadSpy(path, data, opts),
        remove: (paths: string[]) => storageRemoveSpy(paths),
      }),
    },
    rpc: (name: string, args: unknown) => redeemSignatureSpy(name, args),
  },
}))

vi.mock("@/lib/signing", () => ({
  hashToken: () => FIXED_HASH,
  generateSigningToken: () => ({ raw: "raw", hash: FIXED_HASH }),
  validateSigningToken: vi.fn(),
  hashDocument: vi.fn(),
}))

const dispatchSpy = vi.fn()
vi.mock("@/lib/notifications/dispatch", () => ({
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
  signing_document_hash: FIXED_DOCUMENT_HASH,
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
  proposal_id: VALID_PROPOSAL_ROW.id,
  client_id: VALID_PROPOSAL_ROW.client_id,
  signing_document_hash: FIXED_DOCUMENT_HASH,
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
    proposalsUpdatePayloads.length = 0
    // Sane defaults so existing success-path tests are unaffected.
    issueContractCoreSpy.mockResolvedValue({ ok: true })
    proposalsRollbackSpy.mockResolvedValue({ error: null })
    dispatchSpy.mockResolvedValue({ ok: true })
    workflowErrorsInsertSpy.mockResolvedValue({ error: null })
    storageDownloadSpy.mockResolvedValue({
      data: makeMinimalPdfBlob(),
      error: null,
    })
    storageUploadSpy.mockResolvedValue({ data: {}, error: null })
    storageRemoveSpy.mockResolvedValue({ data: [], error: null })
    redeemSignatureSpy.mockResolvedValue({
      data: [VALID_CONSUMED_ROW],
      error: null,
    })
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
    // Atomic RPC → no row (lost the race)
    redeemSignatureSpy.mockResolvedValue({ data: [], error: null })

    const res = await POST(makeRequest("POST", VALID_POST_BODY), makeCtx("tok"))
    expect(res.status).toBe(409)
    const json = await res.json()
    expect(json).toEqual({ error: "already_signed" })
    expect(storageRemoveSpy).toHaveBeenCalledTimes(1)
    expect(issueContractCoreSpy).not.toHaveBeenCalled()
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

    // The stamped PDF goes to its OWN key. This assertion used to require the
    // ORIGINAL key, pinning the evidence bug: overwriting the original destroyed
    // the bytes proposal_signatures.document_hash attests to, so the hash could
    // never be verified against anything (migration 029).
    expect(storageUploadSpy).toHaveBeenCalledTimes(1)
    const [uploadPath, , uploadOpts] =
      storageUploadSpy.mock.calls[0] as [string, unknown, Record<string, unknown>]
    const originalPath = VALID_PROPOSAL_ROW.proposal_pdf_path as string
    const rpcArgs = redeemSignatureSpy.mock.calls[0][1] as Record<string, unknown>
    expect(uploadPath).toBe(
      signedPdfPathFor(
        originalPath,
        String(rpcArgs.p_signed_document_hash)
      )
    )
    expect(uploadPath).not.toBe(originalPath)
    expect(uploadOpts).toMatchObject({ contentType: "application/pdf", upsert: true })

    // The atomic commit links that exact content-addressed key and hash.
    expect(rpcArgs.p_signed_pdf_path).toBe(uploadPath)
    expect(String(rpcArgs.p_signed_document_hash)).toMatch(/^[0-9a-f]{64}$/)
    expect(rpcArgs.p_expected_document_hash).toBe(FIXED_DOCUMENT_HASH)
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

    // The atomic RPC receives the evidence and request metadata together.
    expect(redeemSignatureSpy).toHaveBeenCalledTimes(1)
    const commitArgs = redeemSignatureSpy.mock.calls[0][1] as Record<string, unknown>
    expect(commitArgs.p_signer_name).toBe("John Doe")
    expect(commitArgs.p_signer_email).toBe("john@example.com")
    expect(commitArgs.p_ip_address).toBe("1.2.3.4")
    expect(commitArgs.p_user_agent).toBe("TestAgent/1.0")
    expect(commitArgs.p_expected_document_hash).toBe(FIXED_DOCUMENT_HASH)
    expect(commitArgs.p_signature_image).toBe(TINY_PNG_DATA_URL)

    // Notification dispatched with correct type
    expect(dispatchSpy).toHaveBeenCalledTimes(1)
    const dispatchArg = dispatchSpy.mock.calls[0][0] as Record<string, unknown>
    expect(dispatchArg.type).toBe("proposal_signed")
    expect(dispatchArg.client_name).toBe("Acme Fire Ltd")
    expect(dispatchArg.client_email).toBe("jane@acme.example")

    // revalidatePath called
    expect(revalidateSpy).toHaveBeenCalledWith("/admin/proposals")
  })

  it("leaves the token unused when the evidence PDF cannot be downloaded", async () => {
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
    expect(res.status).toBe(503)
    const json = await res.json()
    expect(json).toEqual({ error: "evidence_unavailable" })
    expect(storageUploadSpy).not.toHaveBeenCalled()
    expect(redeemSignatureSpy).not.toHaveBeenCalled()
    expect(issueContractCoreSpy).not.toHaveBeenCalled()
  })

  it("leaves the token unused when the stamped PDF cannot be stored", async () => {
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
    expect(res.status).toBe(503)
    const json = await res.json()
    expect(json).toEqual({ error: "evidence_unavailable" })
    expect(redeemSignatureSpy).not.toHaveBeenCalled()
    expect(issueContractCoreSpy).not.toHaveBeenCalled()
  })

  it("returns 500 without issuing a contract when the atomic evidence commit fails", async () => {
    const pdfBlob = await makeMinimalPdfBlob()

    proposalsSelectSpy.mockResolvedValue({ data: VALID_PROPOSAL_ROW, error: null })
    redeemSignatureSpy.mockResolvedValue({
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
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json).toEqual({ error: "signature_persist_failed" })
    expect(issueContractCoreSpy).not.toHaveBeenCalled()
    expect(storageRemoveSpy).toHaveBeenCalledTimes(1)
    expect(workflowErrorsInsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({ workflow_name: "proposal_signature_commit" })
    )
  })

  it("records commit failure even when orphan cleanup also fails", async () => {
    const pdfBlob = await makeMinimalPdfBlob()

    proposalsSelectSpy.mockResolvedValue({ data: VALID_PROPOSAL_ROW, error: null })
    redeemSignatureSpy.mockResolvedValue({
      data: null,
      error: { message: "commit boom" },
    })
    storageRemoveSpy.mockResolvedValue({
      data: null,
      error: { message: "cleanup boom" },
    })
    storageDownloadSpy.mockResolvedValue({ data: pdfBlob, error: null })
    storageUploadSpy.mockResolvedValue({ data: {}, error: null })

    const res = await POST(makeRequest("POST", VALID_POST_BODY), makeCtx("tok"))

    expect(res.status).toBe(500)
    expect(workflowErrorsInsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({ workflow_name: "proposal_signature_commit" })
    )
    expect(issueContractCoreSpy).not.toHaveBeenCalled()
  })

  it("fails before storage or commit when the proposal has no document hash", async () => {
    proposalsSelectSpy.mockResolvedValue({
      data: { ...VALID_PROPOSAL_ROW, signing_document_hash: null },
      error: null,
    })

    const res = await POST(makeRequest("POST", VALID_POST_BODY), makeCtx("tok"))

    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json).toEqual({ error: "server_error" })
    expect(issueContractCoreSpy).not.toHaveBeenCalled()
    expect(storageDownloadSpy).not.toHaveBeenCalled()
    expect(redeemSignatureSpy).not.toHaveBeenCalled()
  })

  it("records a workflow_errors row when the confirmation email fails to send", async () => {
    const pdfBlob = await makeMinimalPdfBlob()

    proposalsSelectSpy.mockResolvedValue({ data: VALID_PROPOSAL_ROW, error: null })
    proposalsUpdateSpy.mockResolvedValue({ data: { ...VALID_CONSUMED_ROW }, error: null })
    signaturesInsertSpy.mockResolvedValue({ data: null, error: null })
    clientsSingleSpy.mockResolvedValue({
      data: { name: "Acme", contact_email: "a@a.com" },
      error: null,
    })
    // The proposal_signed confirmation email fails (e.g. missing RESEND_API_KEY).
    dispatchSpy.mockResolvedValue({ ok: false, error: "RESEND_API_KEY not configured" })
    storageDownloadSpy.mockResolvedValue({ data: pdfBlob, error: null })
    storageUploadSpy.mockResolvedValue({ data: {}, error: null })

    const res = await POST(makeRequest("POST", VALID_POST_BODY), makeCtx("tok"))

    // Signature is persisted, so the request still succeeds — but the delivery
    // failure is recorded rather than silently swallowed.
    expect(res.status).toBe(200)
    expect(workflowErrorsInsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({ workflow_name: "proposal_signed_email" })
    )
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

    const commitArgs = redeemSignatureSpy.mock.calls[0][1] as Record<string, unknown>
    expect(commitArgs.p_ip_address).toBe("0.0.0.0")
  })

  it("rejects a proposal PDF that changed after the signing link was sent", async () => {
    proposalsSelectSpy.mockResolvedValue({ data: VALID_PROPOSAL_ROW, error: null })
    proposalsSelectSpy.mockResolvedValue({
      data: {
        ...VALID_PROPOSAL_ROW,
        signing_document_hash: "f".repeat(64),
      },
      error: null,
    })

    const res = await POST(makeRequest("POST", VALID_POST_BODY), makeCtx("tok"))
    expect(res.status).toBe(409)
    const json = await res.json()
    expect(json).toEqual({ error: "document_changed" })
    expect(redeemSignatureSpy).not.toHaveBeenCalled()
    expect(issueContractCoreSpy).not.toHaveBeenCalled()
    expect(workflowErrorsInsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        workflow_name: "proposal_signing_document_changed",
      })
    )
  })

  it("fails before storage or commit when proposal_pdf_path is null", async () => {
    proposalsSelectSpy.mockResolvedValue({
      data: { ...VALID_PROPOSAL_ROW, proposal_pdf_path: null },
      error: null,
    })

    const res = await POST(makeRequest("POST", VALID_POST_BODY), makeCtx("tok"))
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json).toEqual({ error: "server_error" })
    expect(storageDownloadSpy).not.toHaveBeenCalled()
    expect(storageUploadSpy).not.toHaveBeenCalled()
    expect(redeemSignatureSpy).not.toHaveBeenCalled()
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

// ── Suite: confirmation email retry (Task 4) ──────────────────────────────────
//
// The signature and the token redemption are committed by
// redeem_proposal_signature before any of this runs. Everything here is about
// the email that follows, and the first assertion in every test is that the
// commit was left alone.

describe("POST /api/sign/[token] — confirmation email retry", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    proposalsUpdatePayloads.length = 0
    issueContractCoreSpy.mockResolvedValue({ ok: true })
    proposalsRollbackSpy.mockResolvedValue({ error: null })
    workflowErrorsInsertSpy.mockResolvedValue({ error: null })
    storageDownloadSpy.mockResolvedValue({ data: makeMinimalPdfBlob(), error: null })
    storageUploadSpy.mockResolvedValue({ data: {}, error: null })
    storageRemoveSpy.mockResolvedValue({ data: [], error: null })
    proposalsSelectSpy.mockResolvedValue({ data: VALID_PROPOSAL_ROW, error: null })
    redeemSignatureSpy.mockResolvedValue({ data: [VALID_CONSUMED_ROW], error: null })
    clientsSingleSpy.mockResolvedValue({
      data: { name: "Acme Fire Ltd", contact_email: "jane@acme.example" },
      error: null,
    })
    dispatchSpy.mockResolvedValue({ ok: true, outboxId: "outbox-1" })
  })

  it("sends the confirmation through the outbox with a per-proposal idempotency key", async () => {
    const res = await POST(makeRequest("POST", VALID_POST_BODY), makeCtx("tok"))
    expect(res.status).toBe(200)

    expect(dispatchSpy).toHaveBeenCalledTimes(1)
    const [payload, options] = dispatchSpy.mock.calls[0] as [
      Record<string, unknown>,
      Record<string, unknown>,
    ]
    expect(payload.type).toBe("proposal_signed")
    // One confirmation per proposal, ever — this key is what enforces it.
    expect(options.idempotencyKey).toBe(`proposal_signed:${VALID_PROPOSAL_ROW.id}`)
    expect(options.clientId).toBe(VALID_PROPOSAL_ROW.client_id)
    expect(options.relatedType).toBe("proposal")
    expect(options.relatedId).toBe(VALID_PROPOSAL_ROW.id)
  })

  it("keeps the inline retry budget small — the customer is waiting on this request", async () => {
    await POST(makeRequest("POST", VALID_POST_BODY), makeCtx("tok"))

    const options = dispatchSpy.mock.calls[0][1] as { maxAttempts?: number }
    expect(options.maxAttempts).toBeLessThanOrEqual(2)
  })

  it("records the outbox id on the workflow error so the failure is re-sendable", async () => {
    dispatchSpy.mockResolvedValue({
      ok: false,
      error: "fetch failed",
      errorKind: "transient",
      outboxId: "outbox-42",
    })

    const res = await POST(makeRequest("POST", VALID_POST_BODY), makeCtx("tok"))
    expect(res.status).toBe(200)

    const arg = workflowErrorsInsertSpy.mock.calls[0][0] as Record<string, unknown>
    expect(arg.workflow_name).toBe("proposal_signed_email")
    expect(arg.payload).toMatchObject({
      proposalId: VALID_PROPOSAL_ROW.id,
      outboxId: "outbox-42",
      errorKind: "transient",
    })
  })

  it("never re-runs or rolls back the signature commit when the email fails", async () => {
    dispatchSpy.mockResolvedValue({
      ok: false,
      error: "Invalid `to` field",
      errorKind: "hard",
      outboxId: "outbox-43",
    })

    const res = await POST(makeRequest("POST", VALID_POST_BODY), makeCtx("tok"))

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ success: true })
    // The commit ran exactly once and nothing touched the proposal afterwards.
    expect(redeemSignatureSpy).toHaveBeenCalledTimes(1)
    expect(proposalsRollbackSpy).not.toHaveBeenCalled()
    expect(storageRemoveSpy).not.toHaveBeenCalled()
    expect(proposalsUpdatePayloads).toHaveLength(0)
  })

  it("still issues the contract when the confirmation email fails", async () => {
    // The two downstream steps are independent: a dead email address must not
    // cost the customer their service agreement.
    dispatchSpy.mockResolvedValue({ ok: false, error: "fetch failed", outboxId: "o" })

    await POST(makeRequest("POST", VALID_POST_BODY), makeCtx("tok"))

    expect(issueContractCoreSpy).toHaveBeenCalledTimes(1)
  })
})
