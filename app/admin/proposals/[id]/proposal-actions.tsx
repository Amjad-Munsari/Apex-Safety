"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { toast } from "sonner"
import { Send, CheckCircle2, FileSignature, Download, Pencil, Trash2, FileText } from "lucide-react"
import { useRouter } from "next/navigation"
import { deleteProposal, regenerateProposalPdf, markProposalSignedManually, issueContract } from "../actions"

type ProposalStatus = "Draft" | "Sent" | "Signed" | "Contract Issued"

interface ProposalActionsProps {
  proposalId: string
  clientId?: string | null
  clientName: string
  status: ProposalStatus
  documentUrl: string | null
  hasPdf: boolean
}

export function ProposalActions({
  proposalId,
  clientId,
  clientName,
  status,
  documentUrl,
  hasPdf,
}: ProposalActionsProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [optimisticStatus, setOptimisticStatus] = useState<ProposalStatus>(status)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)

  function handleSendForSignature() {
    setOptimisticStatus("Sent")
    startTransition(async () => {
      const res = await fetch(`/api/proposals/${proposalId}/send-for-signature`, {
        method: "POST",
      })
      if (!res.ok) {
        setOptimisticStatus(status)
        let errorCode: string | undefined
        try {
          const body = (await res.json()) as { error?: string }
          errorCode = body.error
        } catch {
          // non-JSON body — fall through to generic message
        }
        if (errorCode === "no_pdf") {
          toast.error("Generate the proposal PDF before sending.")
        } else if (errorCode === "no_client_email") {
          toast.error("This client has no contact email on file.")
        } else {
          toast.error("Could not send proposal for signature. Please try again.")
        }
        return
      }
      const body = (await res.json()) as { delivery_email_failed?: boolean }
      if (body.delivery_email_failed) {
        toast.warning("Proposal marked Sent, but the signature email was not delivered.", {
          description: "Check Workflow Errors before retrying.",
        })
      } else {
        toast.success(`Proposal sent to ${clientName} for signature`)
      }
      router.refresh()
    })
  }

  function handleMarkSigned() {
    setOptimisticStatus("Signed")
    startTransition(async () => {
      const res = await markProposalSignedManually(proposalId)
      if (res.ok) {
        toast.success("Proposal marked as signed")
        router.refresh()
      } else {
        setOptimisticStatus(status)
        toast.error(res.error || "Could not mark the proposal as signed.")
      }
    })
  }

  function handleIssueContract() {
    setOptimisticStatus("Contract Issued")
    startTransition(async () => {
      const res = await issueContract(proposalId)
      if (res.ok) {
        toast.success(`Contract issued to ${clientName}`)
        router.refresh()
      } else {
        setOptimisticStatus(status)
        toast.error(res.error || "Could not issue the contract.")
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

  async function handleGeneratePdf() {
    setIsGenerating(true)
    try {
      await regenerateProposalPdf(proposalId)
      toast.success("Proposal PDF generated")
      router.refresh()
    } catch (err: any) {
      toast.error(err?.message || "Failed to generate PDF. Please try again.")
    } finally {
      setIsGenerating(false)
    }
  }

  function handleEdit() {
    const params = new URLSearchParams()
    if (clientId) params.set("clientId", clientId)
    params.set("from", proposalId)
    router.push(`/admin/proposals/new?${params.toString()}`)
  }

  async function handleConfirmDelete() {
    setIsDeleting(true)
    try {
      await deleteProposal(proposalId)
      toast.success(`Proposal for ${clientName} deleted`)
      router.push("/admin/proposals")
    } catch (err: any) {
      setIsDeleting(false)
      toast.error(err?.message || "Failed to delete proposal")
    }
  }

  const canSend = optimisticStatus === "Draft"
  const canSign = optimisticStatus === "Sent"
  const canIssue = optimisticStatus === "Signed"

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-6 w-full">
        {/* Left cluster — secondary actions */}
        <div className="flex flex-wrap items-center gap-3">
          {hasPdf ? (
            <Button
              variant="outline"
              onClick={handleDownload}
              className="border-border hover:bg-muted rounded-sm h-9 px-4 font-mono text-[10px] uppercase tracking-widest gap-2"
            >
              <Download className="w-3.5 h-3.5" /> Download PDF
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={handleGeneratePdf}
              disabled={isGenerating}
              className="border-gold/40 text-gold hover:bg-gold/10 hover:text-gold rounded-sm h-9 px-4 font-mono text-[10px] uppercase tracking-widest gap-2"
            >
              <FileText className="w-3.5 h-3.5" /> {isGenerating ? "Generating…" : "Generate PDF"}
            </Button>
          )}

          <Button
            variant="outline"
            onClick={handleEdit}
            className="border-border hover:bg-muted rounded-sm h-9 px-4 font-mono text-[10px] uppercase tracking-widest gap-2"
          >
            <Pencil className="w-3.5 h-3.5" /> Edit
          </Button>

          <Button
            variant="outline"
            onClick={() => setIsDeleteOpen(true)}
            className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive rounded-sm h-9 px-4 font-mono text-[10px] uppercase tracking-widest gap-2"
          >
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </Button>
        </div>

        {/* Right cluster — primary status-advance action */}
        <div className="flex items-center">
          {canSend && (
            <Button
              onClick={handleSendForSignature}
              disabled={pending}
              className="bg-gold hover:bg-gold/90 text-gold-foreground rounded-sm h-9 px-5 font-mono text-[10px] uppercase tracking-widest gap-2"
            >
              <Send className="w-3.5 h-3.5" /> Send for signature
            </Button>
          )}

          {canSign && (
            <Button
              onClick={handleMarkSigned}
              disabled={pending}
              className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-sm h-9 px-5 font-mono text-[10px] uppercase tracking-widest gap-2"
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> Mark as signed
            </Button>
          )}

          {canIssue && (
            <Button
              onClick={handleIssueContract}
              disabled={pending}
              className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-sm h-9 px-5 font-mono text-[10px] uppercase tracking-widest gap-2"
            >
              <FileSignature className="w-3.5 h-3.5" /> Issue contract
            </Button>
          )}
        </div>
      </div>

      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif text-base">
              Delete this proposal?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Permanently removes the proposal for{" "}
              <span className="text-foreground">{clientName}</span> and its PDF from storage.{" "}
              <strong>This cannot be undone.</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="bg-destructive/10 text-destructive hover:bg-destructive/20"
            >
              {isDeleting ? "Deleting…" : "Delete proposal"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
