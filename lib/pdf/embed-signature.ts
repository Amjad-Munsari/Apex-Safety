import { PDFDocument, StandardFonts, rgb } from "pdf-lib"
import {
  PAGE_MARGIN_X,
  SIG_BLOCK_BOTTOM,
  SIG_BLOCK_WIDTH,
  SIG_LINE_Y,
  SIG_IMAGE_X,
  SIG_IMAGE_MAX_WIDTH,
  SIG_IMAGE_MAX_HEIGHT,
} from "./signature-layout"

/** Options for the signature stamp drawn on the PDF. */
export interface EmbedSignatureOpts {
  signerName: string
  signedAt: string // ISO 8601 string
}

/**
 * Stamps a signature PNG onto the SIGNED FOR CLIENT block of a proposal PDF.
 *
 * The proposal template pins the signature block at fixed coordinates
 * (lib/pdf/signature-layout.ts), so the image is drawn directly on the client
 * signature rule and the "Name & role / Date" placeholder is replaced with
 * the signer's attestation, mirroring the pre-printed 888 column.
 *
 * @param pdfBytes - Raw bytes of the existing PDF.
 * @param signaturePngDataUrl - PNG image as a `data:image/png;base64,...` data URL.
 * @param opts - Signer metadata rendered as attestation text below the rule.
 * @returns New PDF bytes with the signature embedded.
 * @throws {Error} When `signaturePngDataUrl` is not a valid `data:image/png;base64,` URL.
 */
export async function embedSignatureInPdf(
  pdfBytes: Uint8Array,
  signaturePngDataUrl: string,
  opts: EmbedSignatureOpts
): Promise<Uint8Array> {
  // Guard: validate data URL format
  const PNG_PREFIX = "data:image/png;base64,"
  if (
    typeof signaturePngDataUrl !== "string" ||
    !signaturePngDataUrl.startsWith(PNG_PREFIX)
  ) {
    throw new Error(
      "embedSignatureInPdf: malformed signature_image — expected a data URL with prefix 'data:image/png;base64,'"
    )
  }

  // Decode base64 payload to bytes
  const base64 = signaturePngDataUrl.slice(PNG_PREFIX.length)
  const pngBytes = Uint8Array.from(Buffer.from(base64, "base64"))

  // Load the PDF and embed the PNG
  const doc = await PDFDocument.load(pdfBytes)
  const pngImage = await doc.embedPng(pngBytes)

  // Draw on the LAST page — the template renders the signature block there.
  const pages = doc.getPages()
  const lastPage = pages[pages.length - 1]

  // Scale image to fit the signing area while preserving aspect ratio.
  // Never upscale — a small capture would just blur.
  const imgDims = pngImage.scale(1)
  const scale = Math.min(
    SIG_IMAGE_MAX_WIDTH / imgDims.width,
    SIG_IMAGE_MAX_HEIGHT / imgDims.height,
    1
  )
  const drawWidth = imgDims.width * scale
  const drawHeight = imgDims.height * scale

  // Bottom-anchor the signature so it sits on the SIGNED FOR CLIENT rule
  lastPage.drawImage(pngImage, {
    x: SIG_IMAGE_X,
    y: SIG_LINE_Y + 2,
    width: drawWidth,
    height: drawHeight,
  })

  // White-out the "Name & role / Date" placeholder under the rule, then write
  // the signer attestation in its place. The rect stays below the rule at
  // SIG_LINE_Y so the line itself is preserved.
  lastPage.drawRectangle({
    x: PAGE_MARGIN_X - 2,
    y: SIG_BLOCK_BOTTOM - 12,
    width: SIG_BLOCK_WIDTH + 4,
    height: SIG_LINE_Y - SIG_BLOCK_BOTTOM + 8,
    color: rgb(1, 1, 1),
  })

  const font = await doc.embedFont(StandardFonts.Helvetica)
  const TEXT_COLOR = rgb(0.6, 0.6, 0.6)

  const signedDate = new Date(opts.signedAt)
  const dateShort = signedDate.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
  const timestampFull = signedDate.toLocaleString("en-GB")

  lastPage.drawText(`${opts.signerName.trim()} / ${dateShort}`, {
    x: PAGE_MARGIN_X,
    y: SIG_BLOCK_BOTTOM + 2,
    size: 8,
    font,
    color: TEXT_COLOR,
  })

  lastPage.drawText(`Electronically signed ${timestampFull}`, {
    x: PAGE_MARGIN_X,
    y: SIG_BLOCK_BOTTOM - 8,
    size: 7,
    font,
    color: TEXT_COLOR,
  })

  return doc.save()
}
