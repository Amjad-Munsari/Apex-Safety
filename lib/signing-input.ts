const PNG_DATA_URL_PREFIX = "data:image/png;base64,"
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

export const MAX_SIGNER_NAME_CHARS = 120
export const MAX_SIGNER_EMAIL_CHARS = 254
export const MAX_SIGNATURE_BYTES = 500_000

interface SigningInput {
  signer_name: string
  signer_email: string
  signature_image: string
}

type SigningInputResult =
  | { ok: true; value: SigningInput }
  | { ok: false; message: string }

function isPng(bytes: Uint8Array): boolean {
  return PNG_MAGIC.every((value, index) => bytes[index] === value)
}

export function validateSigningInput(body: unknown): SigningInputResult {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, message: "Request body is invalid" }
  }

  const candidate = body as Record<string, unknown>
  const signerName =
    typeof candidate.signer_name === "string" ? candidate.signer_name.trim() : ""
  const signerEmail =
    typeof candidate.signer_email === "string" ? candidate.signer_email.trim() : ""
  const signatureImage =
    typeof candidate.signature_image === "string" ? candidate.signature_image : ""

  if (!signerName) {
    return { ok: false, message: "signer_name is required" }
  }
  if (signerName.length > MAX_SIGNER_NAME_CHARS) {
    return {
      ok: false,
      message: `signer_name must be ${MAX_SIGNER_NAME_CHARS} characters or fewer`,
    }
  }
  if (
    signerEmail.length > MAX_SIGNER_EMAIL_CHARS ||
    !EMAIL_REGEX.test(signerEmail)
  ) {
    return { ok: false, message: "signer_email is invalid" }
  }
  if (!signatureImage.startsWith(PNG_DATA_URL_PREFIX)) {
    return {
      ok: false,
      message: "signature_image must be a PNG data URL",
    }
  }

  const base64 = signatureImage.slice(PNG_DATA_URL_PREFIX.length)
  const maxBase64Chars = Math.ceil(MAX_SIGNATURE_BYTES / 3) * 4
  if (
    base64.length === 0 ||
    base64.length > maxBase64Chars ||
    base64.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)
  ) {
    return { ok: false, message: "signature_image is invalid or too large" }
  }

  const signatureBytes = Buffer.from(base64, "base64")
  if (
    signatureBytes.byteLength === 0 ||
    signatureBytes.byteLength > MAX_SIGNATURE_BYTES ||
    !isPng(signatureBytes)
  ) {
    return { ok: false, message: "signature_image is invalid or too large" }
  }

  return {
    ok: true,
    value: {
      signer_name: signerName,
      signer_email: signerEmail,
      signature_image: signatureImage,
    },
  }
}
