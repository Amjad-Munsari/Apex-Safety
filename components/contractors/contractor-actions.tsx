"use client"

import { useState, useTransition } from "react"
import { Edit, Trash } from "lucide-react"
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
import { ContractorDialog } from "./contractor-dialog"
import type { Contractor } from "@/lib/data/contractors"
import { deleteContractor, toggleContractorActive } from "@/app/admin/directory/actions"
import { toast } from "sonner"

export function ContractorActions({ contractor }: { contractor: Contractor }) {
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  function onToggleActive() {
    startTransition(async () => {
      try {
        await toggleContractorActive(contractor.id, !contractor.active)
        toast.success(
          contractor.active
            ? "Contractor hidden from client directory"
            : "Contractor visible to clients"
        )
      } catch (err: any) {
        toast.error(err?.message || "Failed to update contractor")
      }
    })
  }

  function onConfirmDelete() {
    startTransition(async () => {
      try {
        await deleteContractor(contractor.id)
        setIsDeleteOpen(false)
        toast.success(`${contractor.company_name} removed`)
      } catch (err: any) {
        toast.error(err?.message || "Failed to delete contractor")
      }
    })
  }

  return (
    <>
      <div className="flex items-center justify-end gap-1.5">
        <button
          onClick={onToggleActive}
          disabled={isPending}
          title={contractor.active ? "Deactivate" : "Activate"}
          className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-mono uppercase tracking-widest leading-none transition disabled:opacity-50 ${
            contractor.active
              ? "text-success bg-success/10 hover:bg-success/15"
              : "text-muted-foreground bg-foreground/5 hover:bg-foreground/10"
          }`}
        >
          <span
            className={`inline-block size-1.5 rounded-full ${
              contractor.active ? "bg-success" : "bg-muted-foreground"
            }`}
          />
          {contractor.active ? "Active" : "Inactive"}
        </button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsEditOpen(true)}
          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
        >
          <span className="sr-only">Edit</span>
          <Edit className="h-3.5 w-3.5" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsDeleteOpen(true)}
          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
        >
          <span className="sr-only">Delete</span>
          <Trash className="h-3.5 w-3.5" />
        </Button>
      </div>

      <ContractorDialog contractor={contractor} open={isEditOpen} onOpenChange={setIsEditOpen} />

      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif text-base">Delete contractor?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="text-foreground">{contractor.company_name}</span> will be removed from
              the directory and the client portal.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={onConfirmDelete}
              disabled={isPending}
              className="bg-destructive/10 text-destructive hover:bg-destructive/20"
            >
              {isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
