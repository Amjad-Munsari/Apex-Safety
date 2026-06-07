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
      } catch (err) {
        toast.error("Could not delete template. Please try again.")
      }
    })
  }

  return (
    <div className="relative group">
      <Link href={`/admin/templates/${id}`}>
        <Card className="bg-[#1c1c1c] border-white/5 rounded-sm p-6 hover:border-white/10 hover:bg-[#222] transition-all cursor-pointer">
          <div className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-1.5 pr-8">
                <h3 className="font-medium text-white group-hover:text-white/90 leading-tight">
                  {name}
                </h3>
                <span className="text-[11px] font-mono text-white/40 uppercase tracking-wider">
                  {templateType}
                </span>
              </div>
              <div className="flex flex-col items-end gap-1.5 shrink-0">
                {isPublished ? (
                  <Badge className="bg-teal/20 text-teal border-teal/30 text-[10px] font-mono">
                    LIVE
                  </Badge>
                ) : (
                  <Badge className="bg-white/5 text-white/40 border-white/10 text-[10px] font-mono">
                    DRAFT
                  </Badge>
                )}
                {hasUnpublishedDraft && isPublished && (
                  <Badge className="bg-[#c0a66d]/20 text-[#c0a66d] border-[#c0a66d]/30 text-[10px] font-mono">
                    UNPUBLISHED EDITS
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex items-center gap-4 font-mono text-[10px] text-white/30 uppercase tracking-wider border-t border-white/5 pt-4">
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
        className="absolute top-3 right-3 inline-flex items-center justify-center h-7 w-7 rounded-sm text-white/30 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this template?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &ldquo;{name}&rdquo;? This cannot be undone.
              Any forks customers have made will not be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={pending}
              className="bg-red-500 hover:bg-red-400 text-white"
            >
              {pending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
