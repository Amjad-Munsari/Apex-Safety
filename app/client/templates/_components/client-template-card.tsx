"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { Trash2 } from "lucide-react"
import { toast } from "sonner"
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
import { deleteClientTemplate } from "../actions"

interface ClientTemplateCardProps {
  id: string
  name: string
  templateType: string
  isPublished: boolean
  isForked: boolean
  createdAt: string
  versionNumber: number
}

export function ClientTemplateCard({
  id,
  name,
  templateType,
  isPublished,
  isForked,
  createdAt,
  versionNumber,
}: ClientTemplateCardProps) {
  const router = useRouter()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  function handleDelete() {
    startTransition(async () => {
      try {
        await deleteClientTemplate(id)
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
      <Link href={`/client/templates/${id}`}>
        <div className="bg-card border border-border rounded-sm p-5 flex flex-col gap-4 hover:border-foreground/30 transition-colors">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1 min-w-0 pr-8">
              <h4 className="font-serif text-[18px] text-foreground leading-tight truncate">{name}</h4>
              <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
                {templateType}
                {isForked && <span className="ml-2 text-gold">· FORKED</span>}
              </span>
            </div>
            <span className={
              isPublished
                ? "font-mono text-[9px] uppercase tracking-[0.25em] text-teal bg-teal/10 px-2 py-1 rounded-sm"
                : "font-mono text-[9px] uppercase tracking-[0.25em] text-muted-foreground bg-muted px-2 py-1 rounded-sm"
            }>
              {isPublished ? "Live" : "Draft"}
            </span>
          </div>
          <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground mt-auto">
            v{versionNumber} · {new Date(createdAt).toLocaleDateString("en-GB")}
          </div>
        </div>
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
              Are you sure you want to delete &ldquo;{name}&rdquo;? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={pending}
              className="bg-danger hover:bg-danger/90 text-primary-foreground"
            >
              {pending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
