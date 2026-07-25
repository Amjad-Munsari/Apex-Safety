import { describe, expect, it } from "vitest"
import {
  MAX_SIGNATURE_BYTES,
  MAX_SIGNER_EMAIL_CHARS,
  MAX_SIGNER_NAME_CHARS,
  validateSigningInput,
} from "@/lib/signing-input"

const PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

describe("public signing input", () => {
  it("normalizes a valid request", () => {
    expect(
      validateSigningInput({
        signer_name: "  Sarah Whitfield  ",
        signer_email: "  sarah@example.com  ",
        signature_image: PNG,
      })
    ).toEqual({
      ok: true,
      value: {
        signer_name: "Sarah Whitfield",
        signer_email: "sarah@example.com",
        signature_image: PNG,
      },
    })
  })

  it("rejects unbounded signer fields", () => {
    expect(
      validateSigningInput({
        signer_name: "a".repeat(MAX_SIGNER_NAME_CHARS + 1),
        signer_email: "sarah@example.com",
        signature_image: PNG,
      })
    ).toMatchObject({ ok: false })

    expect(
      validateSigningInput({
        signer_name: "Sarah",
        signer_email: `${"a".repeat(MAX_SIGNER_EMAIL_CHARS)}@example.com`,
        signature_image: PNG,
      })
    ).toMatchObject({ ok: false })
  })

  it("rejects a forged prefix and oversized decoded signature", () => {
    expect(
      validateSigningInput({
        signer_name: "Sarah",
        signer_email: "sarah@example.com",
        signature_image: "data:image/png;base64,PHNjcmlwdD4=",
      })
    ).toMatchObject({ ok: false })

    const oversized = Buffer.alloc(MAX_SIGNATURE_BYTES + 1)
    oversized.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    expect(
      validateSigningInput({
        signer_name: "Sarah",
        signer_email: "sarah@example.com",
        signature_image: `data:image/png;base64,${oversized.toString("base64")}`,
      })
    ).toMatchObject({ ok: false })
  })
})
