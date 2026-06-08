import { PDFDocument, StandardFonts, rgb } from "pdf-lib"

/** Options for the signature stamp drawn on the PDF. */
export interface EmbedSignatureOpts {
  signerName: string
  signedAt: string // ISO 8601 string
}

/**
 * Stamps a signature PNG onto the last page of a PDF document.
 *
 * @param pdfBytes - Raw bytes of the existing PDF.
 * @param signaturePngDataUrl - PNG image as a `data:image/png;base64,...` data URL.
 * @param opts - Signer metadata rendered as attestation text below the image.
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

  // Draw on the LAST page
  const pages = doc.getPages()
  const lastPage = pages[pages.length - 1]

  // Signature box dimensions (points)
  const BOX_WIDTH = 180
  const BOX_HEIGHT = 70
  const MARGIN_LEFT = 50
  const MARGIN_BOTTOM = 60

  // Scale image to fit box while preserving aspect ratio
  const imgDims = pngImage.scale(1)
  const scaleX = BOX_WIDTH / imgDims.width
  const scaleY = BOX_HEIGHT / imgDims.height
  const scale = Math.min(scaleX, scaleY)
  const drawWidth = imgDims.width * scale
  const drawHeight = imgDims.height * scale

  const x = MARGIN_LEFT
  const y = MARGIN_BOTTOM

  lastPage.drawImage(pngImage, {
    x,
    y,
    width: drawWidth,
    height: drawHeight,
  })

  // Attestation text below/beside the image
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const FONT_SIZE = 8
  const TEXT_COLOR = rgb(0.25, 0.25, 0.25)
  const TEXT_Y_OFFSET = 8 // points below the image bottom edge

  const signedAtFormatted = new Date(opts.signedAt).toLocaleString("en-GB")

  lastPage.drawText(`Electronically signed by ${opts.signerName.trim()}`, {
    x,
    y: y - TEXT_Y_OFFSET - FONT_SIZE,
    size: FONT_SIZE,
    font,
    color: TEXT_COLOR,
  })

  lastPage.drawText(signedAtFormatted, {
    x,
    y: y - TEXT_Y_OFFSET - FONT_SIZE * 2 - 2,
    size: FONT_SIZE,
    font,
    color: TEXT_COLOR,
  })

  return doc.save()
}
