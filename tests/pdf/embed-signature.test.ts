// TDD tests for lib/pdf/embed-signature.ts
//
// Validates: signature PNG embedded into PDF bytes, result re-loadable,
// byte-length grows, page count unchanged, throws on malformed data URL.

import { describe, expect, it } from "vitest"
import { PDFDocument } from "pdf-lib"
import { embedSignatureInPdf } from "@/lib/pdf/embed-signature"

// A real 1×1 transparent PNG in base64 — smallest valid PNG.
// Source: well-known "1x1 PNG" test fixture.
const TINY_PNG_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

async function makeMinimalPdfBytes(): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  doc.addPage()
  return doc.save()
}

describe("embedSignatureInPdf", () => {
  it("returns a Uint8Array longer than the input (image bytes added)", async () => {
    const inputBytes = await makeMinimalPdfBytes()
    const result = await embedSignatureInPdf(inputBytes, TINY_PNG_DATA_URL, {
      signerName: "Jane Doe",
      signedAt: new Date("2026-06-08T10:00:00Z").toISOString(),
    })

    expect(result).toBeInstanceOf(Uint8Array)
    expect(result.length).toBeGreaterThan(inputBytes.length)
  })

  it("produces a re-loadable PDF with the same page count", async () => {
    const inputBytes = await makeMinimalPdfBytes()
    const result = await embedSignatureInPdf(inputBytes, TINY_PNG_DATA_URL, {
      signerName: "Jane Doe",
      signedAt: new Date("2026-06-08T10:00:00Z").toISOString(),
    })

    // Must not throw — bytes are a valid PDF
    const reloaded = await PDFDocument.load(result)
    expect(reloaded.getPageCount()).toBe(1)
  })

  it("throws a descriptive Error when given a non-data-URL string", async () => {
    const inputBytes = await makeMinimalPdfBytes()

    await expect(
      embedSignatureInPdf(inputBytes, "not-a-data-url", {
        signerName: "Jane Doe",
        signedAt: new Date("2026-06-08T10:00:00Z").toISOString(),
      })
    ).rejects.toThrow(/malformed|data URL|signature_image/i)
  })

  it("throws when data URL prefix is wrong (e.g. JPEG instead of PNG)", async () => {
    const inputBytes = await makeMinimalPdfBytes()

    await expect(
      embedSignatureInPdf(
        inputBytes,
        "data:image/jpeg;base64,/9j/4AAQSkZJRgAB",
        {
          signerName: "Jane Doe",
          signedAt: new Date("2026-06-08T10:00:00Z").toISOString(),
        }
      )
    ).rejects.toThrow(/malformed|data URL|signature_image/i)
  })
})
