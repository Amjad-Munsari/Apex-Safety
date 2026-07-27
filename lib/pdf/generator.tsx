import React from "react"
import { renderToStream } from "@react-pdf/renderer"
import { ProposalDocument, ProposalDocumentProps } from "@/components/pdf/proposal-document"
import { ReportDocument, ReportDocumentProps } from "@/components/pdf/report-document"
import { ContractDocument, ContractDocumentProps } from "@/components/pdf/contract-document"
import { Branding, DEFAULT_BRANDING } from "@/lib/branding"
import { getAppSettings } from "@/lib/settings/app-settings"

/**
 * Saved practice colours from app_settings, so generated PDFs match the
 * portals. Falls back to the static defaults if settings can't be read —
 * a branding hiccup must never block generating a document.
 */
async function resolveBranding(): Promise<Branding> {
  try {
    const settings = await getAppSettings()
    return { primary: settings.brandingPrimary, secondary: settings.brandingSecondary }
  } catch {
    return DEFAULT_BRANDING
  }
}

function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    stream.on("data", (chunk) => {
      chunks.push(Buffer.from(chunk))
    })
    stream.on("end", () => {
      resolve(Buffer.concat(chunks))
    })
    stream.on("error", (err) => {
      reject(err)
    })
  })
}

export async function generateProposalPdfBuffer(props: ProposalDocumentProps): Promise<Buffer> {
  const branding = props.branding ?? (await resolveBranding())
  const stream = await renderToStream(<ProposalDocument {...props} branding={branding} />)
  return streamToBuffer(stream)
}

export async function generateReportPdfBuffer(props: ReportDocumentProps): Promise<Buffer> {
  const branding = props.branding ?? (await resolveBranding())
  const stream = await renderToStream(<ReportDocument {...props} branding={branding} />)
  return streamToBuffer(stream)
}

export async function generateContractPdfBuffer(props: ContractDocumentProps): Promise<Buffer> {
  const branding = props.branding ?? (await resolveBranding())
  const stream = await renderToStream(<ContractDocument {...props} branding={branding} />)
  return streamToBuffer(stream)
}
