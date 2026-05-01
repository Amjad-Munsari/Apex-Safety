import React from "react"
import { renderToStream } from "@react-pdf/renderer"
import { ProposalDocument, ProposalDocumentProps } from "@/components/pdf/proposal-document"

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
