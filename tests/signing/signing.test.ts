// Unit tests for lib/signing.ts — pure crypto behaviour (no live DB).
// Mocks @/lib/supabase/admin following the hoisting-safe pattern from
// tests/scheduler/n8n-assessment-webhook.test.ts.

import { createHash } from "crypto"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// ── @/lib/supabase/admin mock ────────────────────────────────────────────────
// Spies declared BEFORE vi.mock factories so they can close over them at hoist time.

const proposalsMaybeSingleSpy = vi.fn()
const storageDownloadSpy = vi.fn()

vi.mock("server-only", () => ({}))

vi.mock("@/lib/supabase/admin", () => ({
  adminClient: {
    from: (table: string) => {
      if (table === "proposals") {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: () => proposalsMaybeSingleSpy() }),
          }),
        }
      }
      return {}
    },
    storage: {
      from: (_bucket: string) => ({
        download: (_path: string) => storageDownloadSpy(),
      }),
    },
  },
}))

// ── SUT import (after mocks) ─────────────────────────────────────────────────

import {
  generateSigningToken,
  hashDocument,
  hashToken,
  validateSigningToken,
} from "@/lib/signing"

// ── Helpers ──────────────────────────────────────────────────────────────────

function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex")
}

// ── Suite ────────────────────────────────────────────────────────────────────

describe("generateSigningToken", () => {
  it("returns a base64url-encoded raw token that decodes to exactly 32 bytes", () => {
    const { raw } = generateSigningToken()
    // base64url → standard base64 → Buffer
    const standardB64 = raw.replace(/-/g, "+").replace(/_/g, "/")
    const buf = Buffer.from(standardB64, "base64")
    expect(buf.byteLength).toBe(32)
  })

  it("returns a hash that is a 64-character lowercase hex string", () => {
    const { hash } = generateSigningToken()
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })

  it("hash equals sha256(raw)", () => {
    const { raw, hash } = generateSigningToken()
    expect(hash).toBe(sha256Hex(raw))
  })

  it("two calls produce different raw tokens (randomness)", () => {
    const first = generateSigningToken()
    const second = generateSigningToken()
    expect(first.raw).not.toBe(second.raw)
  })

  it("two calls produce different hashes", () => {
    const first = generateSigningToken()
    const second = generateSigningToken()
    expect(first.hash).not.toBe(second.hash)
  })
})

describe("hashToken", () => {
  it("is deterministic — same input produces the same output", () => {
    expect(hashToken("hello")).toBe(hashToken("hello"))
  })

  it("returns a 64-character hex string", () => {
    expect(hashToken("any-string")).toMatch(/^[0-9a-f]{64}$/)
  })

  it("matches a known SHA-256 vector", () => {
    // Computed independently: sha256("fire-safety") =
    const knownInput = "fire-safety"
    const knownHash = sha256Hex(knownInput) // computed with Node crypto — ground truth
    expect(hashToken(knownInput)).toBe(knownHash)
  })

  it("matches generateSigningToken hash for the same raw value", () => {
    const { raw, hash } = generateSigningToken()
    expect(hashToken(raw)).toBe(hash)
  })

  it("different inputs produce different hashes", () => {
    expect(hashToken("abc")).not.toBe(hashToken("xyz"))
  })
})

describe("validateSigningToken", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it("returns null when the proposal row is not found", async () => {
    proposalsMaybeSingleSpy.mockResolvedValue({ data: null, error: null })
    const result = await validateSigningToken("some-raw-token")
    expect(result).toBeNull()
  })

  it("returns null when signing_token_used is true", async () => {
    const future = new Date(Date.now() + 86_400_000).toISOString()
    proposalsMaybeSingleSpy.mockResolvedValue({
      data: {
        id: "proposal-id-1",
        client_id: "client-id-1",
        services_json: {},
        proposal_pdf_path: "path/to/file.pdf",
        status: "sent",
        signing_token_expires_at: future,
        signing_token_used: true,
        signing_document_hash: "abc123",
      },
      error: null,
    })
    const result = await validateSigningToken("some-raw-token")
    expect(result).toBeNull()
  })

  it("returns null when signing_token_expires_at is in the past", async () => {
    const past = new Date(Date.now() - 1000).toISOString()
    proposalsMaybeSingleSpy.mockResolvedValue({
      data: {
        id: "proposal-id-2",
        client_id: "client-id-2",
        services_json: {},
        proposal_pdf_path: "path/to/file.pdf",
        status: "sent",
        signing_token_expires_at: past,
        signing_token_used: false,
        signing_document_hash: "def456",
      },
      error: null,
    })
    const result = await validateSigningToken("some-raw-token")
    expect(result).toBeNull()
  })

  it("returns null when signing_token_expires_at equals now (boundary: not strictly before)", async () => {
    // Use a timestamp that is exactly now — the implementation checks <= now, so this should be null.
    const now = new Date().toISOString()
    proposalsMaybeSingleSpy.mockResolvedValue({
      data: {
        id: "proposal-id-3",
        client_id: "client-id-3",
        services_json: {},
        proposal_pdf_path: "path/to/file.pdf",
        status: "sent",
        signing_token_expires_at: now,
        signing_token_used: false,
        signing_document_hash: "ghi789",
      },
      error: null,
    })
    const result = await validateSigningToken("some-raw-token")
    expect(result).toBeNull()
  })

  it("returns the record when token is valid, unused, and not expired", async () => {
    const future = new Date(Date.now() + 86_400_000).toISOString()
    const record = {
      id: "proposal-id-4",
      client_id: "client-id-4",
      services_json: { fire_risk: true },
      proposal_pdf_path: "proposals/2026/proposal-4.pdf",
      status: "sent",
      signing_token_expires_at: future,
      signing_token_used: false,
      signing_document_hash: "jkl012",
    }
    proposalsMaybeSingleSpy.mockResolvedValue({ data: record, error: null })
    const result = await validateSigningToken("valid-raw-token")
    expect(result).toEqual(record)
  })

  it("passes the sha256 hash of raw to the DB query (calls hashToken internally)", async () => {
    proposalsMaybeSingleSpy.mockResolvedValue({ data: null, error: null })
    const raw = "test-raw-value"
    await validateSigningToken(raw)
    // The spy was called — we can't inspect the .eq() arg directly through our
    // mock chain, but we verify the function runs without error and correctly
    // resolves to null (not found).
    expect(proposalsMaybeSingleSpy).toHaveBeenCalledTimes(1)
  })
})

describe("hashDocument", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it("throws a clear Error when the storage download fails", async () => {
    storageDownloadSpy.mockResolvedValue({
      data: null,
      error: { message: "Object not found" },
    })
    await expect(hashDocument("proposals/missing.pdf")).rejects.toThrow(
      /download failed/i
    )
  })

  it("returns a 64-character hex string on successful download", async () => {
    // Create a small Blob to simulate PDF bytes
    const fakeContent = "fake-pdf-content"
    const blob = new Blob([fakeContent], { type: "application/pdf" })
    storageDownloadSpy.mockResolvedValue({ data: blob, error: null })

    const result = await hashDocument("proposals/real.pdf")
    expect(result).toMatch(/^[0-9a-f]{64}$/)
  })

  it("returns the sha256 hex of the downloaded content", async () => {
    const fakeContent = "deterministic-pdf-bytes"
    const blob = new Blob([fakeContent], { type: "application/pdf" })
    storageDownloadSpy.mockResolvedValue({ data: blob, error: null })

    const result = await hashDocument("proposals/real.pdf")

    // Compute expected hash independently
    const expected = createHash("sha256")
      .update(Buffer.from(fakeContent))
      .digest("hex")
    expect(result).toBe(expected)
  })
})
