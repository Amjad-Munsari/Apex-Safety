import { describe, expect, it } from "vitest"
import {
  detectAllowedDocumentType,
  mimeMatchesDetectedType,
} from "@/lib/files/file-signature"

describe("compliance document file signatures", () => {
  it.each([
    [[0x25, 0x50, 0x44, 0x46, 0x2d], "application/pdf", "pdf"],
    [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], "image/png", "png"],
    [[0xff, 0xd8, 0xff, 0xe0], "image/jpeg", "jpg"],
  ])("detects a supported header", (header, mime, extension) => {
    expect(detectAllowedDocumentType(Uint8Array.from(header as number[]))).toEqual({
      mime,
      extension,
    })
  })

  it("detects WEBP and HEIC container brands", () => {
    expect(
      detectAllowedDocumentType(
        Uint8Array.from([...Buffer.from("RIFF"), 0, 0, 0, 0, ...Buffer.from("WEBP")])
      )
    ).toEqual({ mime: "image/webp", extension: "webp" })

    expect(
      detectAllowedDocumentType(
        Uint8Array.from([0, 0, 0, 0, ...Buffer.from("ftypheic")])
      )
    ).toEqual({ mime: "image/heic", extension: "heic" })
  })

  it("rejects content whose header is not on the allowlist", () => {
    expect(detectAllowedDocumentType(Uint8Array.from(Buffer.from("<script>")))).toBeNull()
  })

  it("requires the declared MIME to match the detected bytes", () => {
    expect(mimeMatchesDetectedType("application/pdf", "application/pdf")).toBe(true)
    expect(mimeMatchesDetectedType("image/jpg", "image/jpeg")).toBe(true)
    expect(mimeMatchesDetectedType("application/pdf", "image/png")).toBe(false)
  })
})
