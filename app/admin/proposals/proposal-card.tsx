"use client"

import { Card } from "@/components/ui/card"
import { Eye, FileSignature, Send } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { toast } from "sonner"
import { updateProposalStatus } from "./actions"

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

  function send(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    startTransition(async () => {
      try {
        await updateProposalStatus(id, "Sent")
        toast.success(`Proposal sent to ${clientName}`)
        router.refresh()
      } catch {
        toast.error("Could not send proposal. Please try again.")
      }
    })
  }

  // The card body is a full-card <Link> overlay, giving viewport prefetch +
  // useLinkStatus-eligible pending state. The PDF link and the Send
  // server-action button sit ABOVE the overlay (relative z-10) with
  // stopPropagation so they keep their own behaviour without navigating.
  return (
    <Card className="bg-[#1c1c1c] border-white/5 p-4 rounded-sm hover:border-white/20 transition-all group relative cursor-pointer focus-within:ring-2 focus-within:ring-gold/40">
      <Link
        href={detailHref}
        aria-label={`View proposal for ${clientName}`}
        className="absolute inset-0 z-0 rounded-sm focus:outline-none"
      />
      <div className="font-medium text-white mb-1 group-hover:text-gold transition-colors pointer-events-none relative z-10">
        {clientName}
      </div>
      <div className="font-serif text-lg text-white/90 mb-3 pointer-events-none relative z-10">
        £{total.toLocaleString()}
      </div>

      <div className="flex justify-between items-center relative z-10">
        <div className="font-mono text-[9px] uppercase tracking-widest text-[#555] pointer-events-none">
          {new Date(createdAt).toLocaleDateString("en-GB")}
        </div>
        <div className="flex items-center gap-1">
          {documentUrl && (
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
          )}

          {status === "Draft" && (
            <button
              type="button"
              onClick={send}
              disabled={pending}
              aria-label="Send proposal"
              className="text-white/40 hover:text-gold transition-colors p-1 rounded-sm focus:outline-none focus:ring-2 focus:ring-gold/40 disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          )}

          <Link
            href={detailHref}
            aria-label="View proposal detail"
            className="text-white/40 hover:text-white transition-colors p-1 rounded-sm focus:outline-none focus:ring-2 focus:ring-gold/40"
          >
            <Eye className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </Card>
  )
}
