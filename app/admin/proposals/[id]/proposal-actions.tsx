"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { Send, CheckCircle2, FileSignature, Download, Pencil } from "lucide-react"
import { useRouter } from "next/navigation"
import { updateProposalStatus } from "../actions"

type ProposalStatus = "Draft" | "Sent" | "Signed" | "Contract Issued"

interface ProposalActionsProps {
  proposalId: string
  clientId?: string | null
  clientName: string
  status: ProposalStatus
  documentUrl: string | null
}

export function ProposalActions({
  proposalId,
  clientId,
  clientName,
  status,
  documentUrl,
}: ProposalActionsProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [optimisticStatus, setOptimisticStatus] = useState<ProposalStatus>(status)

  function advance(next: ProposalStatus, message: string) {
    setOptimisticStatus(next)
    startTransition(async () => {
      try {
        await updateProposalStatus(proposalId, next)
        toast.success(message)
        router.refresh()
      } catch (err) {
        setOptimisticStatus(status)
        toast.error("Could not update proposal status. Please try again.")
      }
    })
  }

  function handleDownload() {
    if (documentUrl) {
      const link = document.createElement("a")
      link.href = documentUrl
      link.download = `proposal-${proposalId.slice(0, 8)}.pdf`
      link.rel = "noopener noreferrer"
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      return
    }
    toast.info("PDF will be available once the proposal document has been generated.")
  }

  function handleEdit() {
    const params = new URLSearchParams()
    if (clientId) params.set("clientId", clientId)
    params.set("from", proposalId)
    router.push(`/admin/proposals/new?${params.toString()}`)
  }

  const canSend = optimisticStatus === "Draft"
  const canSign = optimisticStatus === "Sent"
  const canIssue = optimisticStatus === "Signed"

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        variant="outline"
        onClick={handleDownload}
        className="border-white/10 hover:bg-white/5 rounded-sm h-9 px-4 font-mono text-[10px] uppercase tracking-widest gap-2"
      >
        <Download className="w-3.5 h-3.5" /> Download PDF
      </Button>

      <Button
        variant="outline"
        onClick={handleEdit}
        className="border-white/10 hover:bg-white/5 rounded-sm h-9 px-4 font-mono text-[10px] uppercase tracking-widest gap-2"
      >
        <Pencil className="w-3.5 h-3.5" /> Edit
      </Button>

      {canSend && (
        <Button
          onClick={() => advance("Sent", `Proposal sent to ${clientName} for signature`)}
          disabled={pending}
          className="bg-gold hover:bg-gold/90 text-black rounded-sm h-9 px-5 font-mono text-[10px] uppercase tracking-widest gap-2"
        >
          <Send className="w-3.5 h-3.5" /> Send for signature
        </Button>
      )}

      {canSign && (
        <Button
          onClick={() => advance("Signed", `Proposal marked as signed`)}
          disabled={pending}
          className="bg-white hover:bg-white/90 text-black rounded-sm h-9 px-5 font-mono text-[10px] uppercase tracking-widest gap-2"
        >
          <CheckCircle2 className="w-3.5 h-3.5" /> Mark as signed
        </Button>
      )}

      {canIssue && (
        <Button
          onClick={() => advance("Contract Issued", `Contract issued to ${clientName}`)}
          disabled={pending}
          className="bg-white hover:bg-white/90 text-black rounded-sm h-9 px-5 font-mono text-[10px] uppercase tracking-widest gap-2"
        >
          <FileSignature className="w-3.5 h-3.5" /> Issue contract
        </Button>
      )}
    </div>
  )
}
