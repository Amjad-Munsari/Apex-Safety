"use client"

import { Card } from "@/components/ui/card"
import { FileSignature, Send } from "lucide-react"
import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { toast } from "sonner"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface ProposalCardProps {
  id: string
  clientName: string
  total: number
  createdAt: string
  status: "Draft" | "Sent" | "Signed" | "Contract Issued"
  documentUrl: string | null
  detailHref: string
}

export function ProposalCard({
  id,
  clientName,
  total,
  createdAt,
  status,
  documentUrl,
  detailHref,
}: ProposalCardProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function go(e: React.MouseEvent) {
    e.preventDefault()
    router.push(detailHref)
  }

  function send(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    // Route through the same send-for-signature flow as the detail page: this
    // mints a signing token, hashes the PDF, and emails the client a signing
    // link. A bare status flip would mark it "Sent" while the client got nothing.
    startTransition(async () => {
      const res = await fetch(`/api/proposals/${id}/send-for-signature`, { method: "POST" })
      if (res.ok) {
        toast.success(`Proposal sent to ${clientName} for signature`)
        router.refresh()
        return
      }
      let errorCode: string | undefined
      try {
        const body = (await res.json()) as { error?: string }
        errorCode = body.error
      } catch {
        /* non-JSON body */
      }
      if (errorCode === "no_pdf") {
        toast.error("Generate the proposal PDF before sending.")
      } else if (errorCode === "no_client_email") {
        toast.error("This client has no contact email on file.")
      } else {
        toast.error("Could not send proposal for signature. Please try again.")
      }
    })
  }

  return (
    <Card
      role="link"
      tabIndex={0}
      onClick={go}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          router.push(detailHref)
        }
      }}
      className="bg-[#1c1c1c] border-white/5 p-4 rounded-sm hover:border-white/20 transition-all group relative cursor-pointer focus:outline-none focus:ring-2 focus:ring-gold/40"
    >
      <div className="font-medium text-white mb-1 group-hover:text-gold transition-colors">
        {clientName}
      </div>
      <div className="font-serif text-lg text-white/90 mb-3">
        £{total.toLocaleString()}
      </div>

      <div className="flex justify-between items-center">
        <div className="font-mono text-[9px] uppercase tracking-widest text-[#555]">
          {new Date(createdAt).toLocaleDateString("en-GB")}
        </div>
        <TooltipProvider delay={150}>
          <div className="flex items-center gap-1">
            {documentUrl && (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <a
                      href={documentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      aria-label="Open proposal PDF"
                      className="text-white/40 hover:text-white transition-colors p-1 rounded-sm focus:outline-none focus:ring-2 focus:ring-gold/40"
                    >
                      <FileSignature className="w-3.5 h-3.5" />
                    </a>
                  }
                />
                <TooltipContent>Open PDF</TooltipContent>
              </Tooltip>
            )}

            {status === "Draft" && (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <button
                      type="button"
                      onClick={send}
                      disabled={pending}
                      aria-label="Send proposal"
                      className="text-white/40 hover:text-gold transition-colors p-1 rounded-sm focus:outline-none focus:ring-2 focus:ring-gold/40 disabled:opacity-50"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  }
                />
                <TooltipContent>Send for signature</TooltipContent>
              </Tooltip>
            )}
          </div>
        </TooltipProvider>
      </div>
    </Card>
  )
}
