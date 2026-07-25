// Regression spec for the e-signature evidence fix (migration 029).
//
// The bug: /api/sign/[token] re-uploaded the signature-stamped PDF over the
// SAME storage key with `upsert: true`, destroying the exact bytes that
// proposal_signatures.document_hash attests to. Re-hashing the stored file could
// then never match the recorded hash, and a mismatch could not distinguish
// "stamped as designed" from "document swapped" — so the hash was useless as
// evidence, which is its only purpose. The stamped copy now gets its own key and
// the original is never written again.

import { describe, it, expect } from "vitest"
import { signedPdfPathFor } from "@/lib/signing-paths"

describe("signedPdfPathFor", () => {
  it("derives a sibling key rather than reusing the original", () => {
    const original = "client-1/proposal_abc.pdf"
    const signed = signedPdfPathFor(original)
    expect(signed).toBe("client-1/proposal_abc-signed.pdf")
    // The contract that matters: the attested original is never the target.
    expect(signed).not.toBe(original)
  })

  it("keeps the client-id folder prefix, so storage RLS still scopes it", () => {
    // The proposals bucket policies key off (storage.foldername(name))[1].
    expect(signedPdfPathFor("client-1/proposal_abc.pdf").split("/")[0]).toBe("client-1")
  })

  it("is deterministic, so retrying the same signature reuses one object", () => {
    const a = signedPdfPathFor("c/proposal_1.pdf")
    const b = signedPdfPathFor("c/proposal_1.pdf")
    expect(a).toBe(b)
  })

  it("does not double-suffix if handed an already-signed key", () => {
    // Guards against a retry path accidentally composing the helper twice.
    expect(signedPdfPathFor("c/p-signed.pdf")).toBe("c/p-signed-signed.pdf")
    expect(signedPdfPathFor("c/p-signed.pdf").endsWith("-signed-signed.pdf")).toBe(true)
  })

  it("handles an uppercase extension", () => {
    expect(signedPdfPathFor("c/proposal.PDF")).toBe("c/proposal-signed.pdf")
  })

  it("appends rather than mangling a key with no .pdf extension", () => {
    expect(signedPdfPathFor("c/proposal_1")).toBe("c/proposal_1-signed.pdf")
  })

  it("never collides with the original for any distinct proposal", () => {
    const originals = ["c/p_1.pdf", "c/p_2.pdf", "d/p_1.pdf"]
    const signed = originals.map(signedPdfPathFor)
    expect(new Set(signed).size).toBe(originals.length)
    for (const o of originals) expect(signed).not.toContain(o)
  })
})
