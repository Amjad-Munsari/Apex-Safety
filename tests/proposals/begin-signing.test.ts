// Tests for beginProposalSigning — the client-portal "Accept & Sign" entry
// point into the tokenized signing flow.
//
// Contract under test:
//   - Requires an authenticated client context (org-scoped).
//   - Enforces the deactivated-client write freeze.
//   - Only proposals owned by the caller's org, in status "Sent", with a
//     generated PDF can begin signing.
//   - Mints a fresh token: stores the SHA-256 HASH (never the raw token),
//     resets signing_token_used, captures the document hash, and does NOT
//     touch status/sent_at (the proposal is already "Sent").
//   - Redirects to /sign/<raw-token>.
//
// Mock strategy: chainable adminClient spies declared BEFORE vi.mock factories
// (hoisting-safe pattern, same as tests/proposals/sign-route.test.ts).

import { beforeEach, describe, expect, it, vi } from "vitest"
import { createHash } from "crypto"

// ── Spies (declared before vi.mock so hoisting can close over them) ───────────

// proposals.select().eq().eq().maybeSingle()
const proposalsSelectSpy = vi.fn()
// proposals.update(payload).eq() — captures the update payload
const proposalsUpdateSpy = vi.fn()
// storage.from("proposals").download()
const storageDownloadSpy = vi.fn()
const getClientContextSpy = vi.fn()
const assertClientActiveSpy = vi.fn()
const redirectSpy = vi.fn()

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock("server-only", () => ({}))

vi.mock("@/lib/supabase/admin", () => ({
  adminClient: {
    from: (table: string) => {
      if (table !== "proposals") throw new Error(`unexpected table: ${table}`)
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: () => proposalsSelectSpy(),
            }),
          }),
        }),
        update: (payload: unknown) => ({
          eq: () => proposalsUpdateSpy(payload),
        }),
      }
    },
    storage: {
      from: () => ({
        download: () => storageDownloadSpy(),
      }),
    },
  },
}))

vi.mock("@/lib/auth-helpers", () => ({
  getClientContext: () => getClientContextSpy(),
}))

vi.mock("@/lib/clients/require-active", () => ({
  assertClientActive: (clientId: string) => assertClientActiveSpy(clientId),
}))

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    redirectSpy(url)
    const err = new Error("NEXT_REDIRECT") as Error & { digest: string }
    err.digest = `NEXT_REDIRECT;replace;${url};307;`
    throw err
  },
}))

import { beginProposalSigning } from "@/app/client/proposals/actions"

// ── Fixtures ──────────────────────────────────────────────────────────────────

const CLIENT_ID = "11111111-1111-1111-1111-111111111111"
const PROPOSAL_ID = "22222222-2222-2222-2222-222222222222"

const PDF_BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]) // "%PDF-"
const PDF_HASH = createHash("sha256").update(Buffer.from(PDF_BYTES)).digest("hex")

function sentProposal(overrides: Record<string, unknown> = {}) {
  return {
    id: PROPOSAL_ID,
    status: "Sent",
    proposal_pdf_path: `${PROPOSAL_ID}/proposal.pdf`,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  getClientContextSpy.mockResolvedValue({ client_id: CLIENT_ID, role: "owner" })
  assertClientActiveSpy.mockResolvedValue(undefined)
  proposalsSelectSpy.mockResolvedValue({ data: sentProposal(), error: null })
  proposalsUpdateSpy.mockResolvedValue({ error: null })
  storageDownloadSpy.mockResolvedValue({
    data: new Blob([PDF_BYTES], { type: "application/pdf" }),
    error: null,
  })
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("beginProposalSigning — guards", () => {
  it("throws when there is no client session", async () => {
    getClientContextSpy.mockResolvedValue(null)
    await expect(beginProposalSigning(PROPOSAL_ID)).rejects.toThrow(
      "Not a client user"
    )
    expect(proposalsUpdateSpy).not.toHaveBeenCalled()
  })

  it("enforces the deactivated-client write freeze", async () => {
    assertClientActiveSpy.mockRejectedValue(new Error("Client is deactivated"))
    await expect(beginProposalSigning(PROPOSAL_ID)).rejects.toThrow(
      "Client is deactivated"
    )
    expect(assertClientActiveSpy).toHaveBeenCalledWith(CLIENT_ID)
    expect(proposalsUpdateSpy).not.toHaveBeenCalled()
  })

  it("throws when the proposal is not found / not owned by the org", async () => {
    proposalsSelectSpy.mockResolvedValue({ data: null, error: null })
    await expect(beginProposalSigning(PROPOSAL_ID)).rejects.toThrow(
      "Proposal not found"
    )
    expect(proposalsUpdateSpy).not.toHaveBeenCalled()
  })

  it.each(["Draft", "Signed", "Contract Issued"])(
    "rejects status %s — only Sent proposals can begin signing",
    async (status) => {
      proposalsSelectSpy.mockResolvedValue({
        data: sentProposal({ status }),
        error: null,
      })
      await expect(beginProposalSigning(PROPOSAL_ID)).rejects.toThrow()
      expect(proposalsUpdateSpy).not.toHaveBeenCalled()
    }
  )

  it("throws when the PDF has not been generated yet", async () => {
    proposalsSelectSpy.mockResolvedValue({
      data: sentProposal({ proposal_pdf_path: null }),
      error: null,
    })
    await expect(beginProposalSigning(PROPOSAL_ID)).rejects.toThrow()
    expect(proposalsUpdateSpy).not.toHaveBeenCalled()
  })
})

describe("beginProposalSigning — happy path", () => {
  it("mints a hashed token, captures the document hash, and redirects to /sign/<raw>", async () => {
    await expect(beginProposalSigning(PROPOSAL_ID)).rejects.toThrow(
      "NEXT_REDIRECT"
    )

    expect(redirectSpy).toHaveBeenCalledTimes(1)
    const url: string = redirectSpy.mock.calls[0][0]
    expect(url).toMatch(/^\/sign\/[A-Za-z0-9_-]{20,}$/)
    const raw = url.slice("/sign/".length)

    expect(proposalsUpdateSpy).toHaveBeenCalledTimes(1)
    const payload = proposalsUpdateSpy.mock.calls[0][0] as Record<string, unknown>

    // Stored token is the SHA-256 hash of the raw token, never the raw value.
    expect(payload.signing_token).toBe(
      createHash("sha256").update(raw).digest("hex")
    )
    expect(payload.signing_token_used).toBe(false)
    expect(payload.signing_document_hash).toBe(PDF_HASH)

    // ~30-day expiry window.
    const expires = new Date(payload.signing_token_expires_at as string).getTime()
    const days = (expires - Date.now()) / (24 * 60 * 60 * 1000)
    expect(days).toBeGreaterThan(29)
    expect(days).toBeLessThan(31)

    // Proposal is already "Sent" — the portal entry point must not rewrite
    // status or sent_at (that would clobber the original send timestamp).
    expect(payload).not.toHaveProperty("status")
    expect(payload).not.toHaveProperty("sent_at")
  })

  it("surfaces a friendly error when the token update fails", async () => {
    proposalsUpdateSpy.mockResolvedValue({ error: { message: "boom" } })
    await expect(beginProposalSigning(PROPOSAL_ID)).rejects.toThrow(
      /could not start signing/i
    )
    expect(redirectSpy).not.toHaveBeenCalled()
  })
})
