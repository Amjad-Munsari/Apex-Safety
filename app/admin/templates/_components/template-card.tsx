"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
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
import { deleteTemplate } from "../actions"

interface TemplateCardProps {
  id: string
  name: string
  templateType: string
  isPublished: boolean
  createdAt: string
  versionNumber: number
  publishedCount: number
  hasUnpublishedDraft: boolean
  /** Owning organisation name — shown on customer-owned templates only. */
  ownerLabel?: string
}

export function TemplateCard({
  id,
  name,
  templateType,
  isPublished,
  createdAt,
  versionNumber,
  publishedCount,
  hasUnpublishedDraft,
  ownerLabel,
}: TemplateCardProps) {
  const router = useRouter()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  function handleDelete() {
    startTransition(async () => {
      try {
        await deleteTemplate(id)
        toast.success(`Template "${name}" deleted`)
        setConfirmOpen(false)
        router.refresh()
      } catch {
        toast.error("Could not delete template. Please try again.")
      }
    })
  }

  return (
    <div className="relative group">
      <Link href={`/admin/templates/${id}`}>
        <Card className="bg-card border-border rounded-sm p-6 hover:border-border hover:bg-card transition-all cursor-pointer">
          <div className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-1.5 pr-8">
                <h3 className="font-medium text-foreground group-hover:text-foreground/90 leading-tight">
                  {name}
                </h3>
                <span className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">
                  {templateType}
                </span>
                {ownerLabel && (
                  <span className="text-[11px] font-mono text-gold/80 uppercase tracking-wider">
                    {ownerLabel}
                  </span>
                )}
              </div>
              <div className="flex flex-col items-end gap-1.5 shrink-0">
                {isPublished ? (
                  <Badge className="bg-teal/20 text-teal border-teal/30 text-[10px] font-mono">
                    LIVE
                  </Badge>
                ) : (
                  <Badge className="bg-muted text-muted-foreground border-border text-[10px] font-mono">
                    DRAFT
                  </Badge>
                )}
                {hasUnpublishedDraft && isPublished && (
                  <Badge className="bg-gold/20 text-gold border-gold/30 text-[10px] font-mono">
                    UNPUBLISHED EDITS
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex items-center gap-4 font-mono text-[10px] text-muted-foreground uppercase tracking-wider border-t border-border pt-4">
              <span>v{versionNumber}</span>
              <span>·</span>
              <span>{publishedCount} published</span>
              <span>·</span>
              <span>{new Date(createdAt).toLocaleDateString("en-GB")}</span>
            </div>
          </div>
        </Card>
      </Link>

      <button
        type="button"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setConfirmOpen(true)
        }}
        aria-label={`Delete template ${name}`}
        className="absolute top-3 right-3 inline-flex items-center justify-center h-7 w-7 rounded-sm text-muted-foreground hover:text-danger hover:bg-danger/10 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this template?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{name}&rdquo; will be removed from future use. Existing
              assignments, submissions, and customer forks will not be changed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={pending}
              className="bg-destructive hover:bg-destructive/90 text-white"
            >
              {pending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
