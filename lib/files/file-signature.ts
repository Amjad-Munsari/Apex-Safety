export type AllowedDocumentType =
  | "application/pdf"
  | "image/png"
  | "image/jpeg"
  | "image/webp"
  | "image/heic"

export interface DetectedDocumentType {
  mime: AllowedDocumentType
  extension: "pdf" | "png" | "jpg" | "webp" | "heic"
}

function startsWith(bytes: Uint8Array, signature: number[]): boolean {
  return signature.every((value, index) => bytes[index] === value)
}

function ascii(bytes: Uint8Array, start: number, end: number): string {
  return String.fromCharCode(...bytes.slice(start, end))
}

/**
 * Detect the small allowlist of document formats accepted by Compliance.
 *
 * Browser-provided MIME types and filename extensions are metadata supplied by
 * the caller. This checks the file header before any object is written to
 * Storage, so renaming an executable to `.pdf` cannot bypass the upload gate.
 */
export function detectAllowedDocumentType(
  bytes: Uint8Array
): DetectedDocumentType | null {
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) {
    return { mime: "application/pdf", extension: "pdf" }
  }
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { mime: "image/png", extension: "png" }
  }
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) {
    return { mime: "image/jpeg", extension: "jpg" }
  }
  if (
    bytes.length >= 12 &&
    ascii(bytes, 0, 4) === "RIFF" &&
    ascii(bytes, 8, 12) === "WEBP"
  ) {
    return { mime: "image/webp", extension: "webp" }
  }
  if (bytes.length >= 12 && ascii(bytes, 4, 8) === "ftyp") {
    const brand = ascii(bytes, 8, 12)
    if (["heic", "heix", "hevc", "hevx", "mif1", "msf1"].includes(brand)) {
      return { mime: "image/heic", extension: "heic" }
    }
  }
  return null
}

export function mimeMatchesDetectedType(
  declaredMime: string,
  detectedMime: AllowedDocumentType
): boolean {
  const normalized = declaredMime.toLowerCase()
  if (detectedMime === "image/jpeg") {
    return normalized === "image/jpeg" || normalized === "image/jpg"
  }
  return normalized === detectedMime
}
