"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Trash2 } from "lucide-react"
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
import { deleteDocument } from "@/lib/documents/actions"
import { deleteAssessment } from "@/app/admin/assessments/actions"
import { deleteProposal } from "@/app/admin/proposals/actions"

type Kind = "document" | "assessment" | "proposal"

const CONFIG: Record<
  Kind,
  { title: string; body: string; success: string; run: (id: string) => Promise<unknown> }
> = {
  document: {
    title: "Delete this document?",
    body: "The file and its record are permanently removed from this client. This cannot be undone.",
    success: "Document deleted",
    run: (id) => deleteDocument(id),
  },
  assessment: {
    title: "Delete this assessment?",
    body: "The assessment, its report PDF, and any linked assignment are permanently removed. This cannot be undone.",
    success: "Assessment deleted",
    run: (id) => deleteAssessment(id),
  },
  proposal: {
    title: "Delete this proposal?",
    body: "The proposal and its PDF are permanently removed. This cannot be undone.",
    success: "Proposal deleted",
    run: (id) => deleteProposal(id),
  },
}

export function DeleteEntityButton({
  kind,
  id,
  label,
}: {
  kind: Kind
  id: string
  /** Optional visible text next to the trash icon. Omit for an icon-only button. */
  label?: string
}) {
  const cfg = CONFIG[kind]
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  function handleConfirm() {
    startTransition(async () => {
      try {
        await cfg.run(id)
        toast.success(cfg.success)
        router.refresh()
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Delete failed — please try again")
      } finally {
        setOpen(false)
      }
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Delete ${kind}`}
        className="inline-flex items-center gap-1.5 h-7 px-2 rounded-sm text-muted-foreground hover:text-danger hover:bg-danger/10 font-mono text-[10px] uppercase tracking-widest transition-colors"
      >
        <Trash2 className="w-3 h-3" />
        {label}
      </button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif text-base">{cfg.title}</AlertDialogTitle>
            <AlertDialogDescription>{cfg.body}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              disabled={pending}
              className="bg-destructive text-primary-foreground hover:bg-destructive/90"
            >
              {pending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
