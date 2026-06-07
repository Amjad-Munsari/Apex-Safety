// Tests for GET and POST /api/sign/[token]
//
// Mock strategy: chainable adminClient spies declared BEFORE vi.mock factories
// (hoisting-safe pattern, same as tests/signing/signing.test.ts and
// tests/scheduler/send-reminder.spec.ts).

import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

// ── Constants ─────────────────────────────────────────────────────────────────

const FIXED_HASH = "aabbcc00" + "0".repeat(56) // 64-char hex

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
                select: () => ({
                  maybeSingle: () => proposalsUpdateSpy(),
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
      return {}
    },
    storage: {
      from: (_bucket: string) => ({
        createSignedUrl: (_path: string, _ttl: number) =>
          storageSignedUrlSpy(),
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
  proposal_pdf_path: "proposals/test.pdf",
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

const VALID_POST_BODY = {
  signer_name: "John Doe",
  signer_email: "john@example.com",
  signature_image: "data:image/png;base64,iVBORw0KGgo=",
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

  it("returns 200 on success path — inserts signature row with ip + dispatches proposal_signed", async () => {
    // Lookup → valid row
    proposalsSelectSpy.mockResolvedValue({ data: VALID_PROPOSAL_ROW, error: null })
    // Atomic consume → success
    proposalsUpdateSpy.mockResolvedValue({
      data: {
        id: VALID_PROPOSAL_ROW.id,
        client_id: VALID_PROPOSAL_ROW.client_id,
        signing_document_hash: "dochashtestvalue",
        services_json: VALID_PROPOSAL_ROW.services_json,
      },
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
    expect(insertArg.signature_image).toBe(VALID_POST_BODY.signature_image)

    // Notification dispatched with correct type
    expect(dispatchSpy).toHaveBeenCalledTimes(1)
    const dispatchArg = dispatchSpy.mock.calls[0][0] as Record<string, unknown>
    expect(dispatchArg.type).toBe("proposal_signed")
    expect(dispatchArg.client_name).toBe("Acme Fire Ltd")
    expect(dispatchArg.client_email).toBe("jane@acme.example")

    // revalidatePath called
    expect(revalidateSpy).toHaveBeenCalledWith("/admin/proposals")
  })

  it("returns 200 even when signature insert fails — does not 500 after successful consume", async () => {
    proposalsSelectSpy.mockResolvedValue({ data: VALID_PROPOSAL_ROW, error: null })
    proposalsUpdateSpy.mockResolvedValue({
      data: {
        id: VALID_PROPOSAL_ROW.id,
        client_id: VALID_PROPOSAL_ROW.client_id,
        signing_document_hash: null,
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

    const res = await POST(makeRequest("POST", VALID_POST_BODY), makeCtx("tok"))
    // Still succeeds — consume was atomic, insert failure is logged not 500d
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toEqual({ success: true })
  })

  it("defaults ip_address to '0.0.0.0' when x-forwarded-for header is absent", async () => {
    proposalsSelectSpy.mockResolvedValue({ data: VALID_PROPOSAL_ROW, error: null })
    proposalsUpdateSpy.mockResolvedValue({
      data: {
        id: VALID_PROPOSAL_ROW.id,
        client_id: VALID_PROPOSAL_ROW.client_id,
        signing_document_hash: null,
        services_json: [],
      },
      error: null,
    })
    signaturesInsertSpy.mockResolvedValue({ data: null, error: null })
    clientsSingleSpy.mockResolvedValue({
      data: { name: "Y", contact_email: "y@y.com" },
      error: null,
    })
    dispatchSpy.mockResolvedValue({ ok: true })

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
})
