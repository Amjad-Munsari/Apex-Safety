import React from "react"
import { renderToStream } from "@react-pdf/renderer"
import { ProposalDocument, ProposalDocumentProps } from "@/components/pdf/proposal-document"
import { ReportDocument, ReportDocumentProps } from "@/components/pdf/report-document"
import { ContractDocument, ContractDocumentProps } from "@/components/pdf/contract-document"

export async function generateProposalPdfBuffer(props: ProposalDocumentProps): Promise<Buffer> {
  const stream = await renderToStream(<ProposalDocument {...props} />)

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

export async function generateReportPdfBuffer(props: ReportDocumentProps): Promise<Buffer> {
  const stream = await renderToStream(<ReportDocument {...props} />)

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

export async function generateContractPdfBuffer(props: ContractDocumentProps): Promise<Buffer> {
  const stream = await renderToStream(<ContractDocument {...props} />)

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
