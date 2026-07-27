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
import { ServiceDialog } from "./service-dialog"
import type { Service } from "@/lib/data/services"
import { deleteService, toggleServiceActive } from "@/app/admin/services/actions"
import { toast } from "sonner"
import { errorMessage } from "@/lib/utils"

export function ServiceActions({ service }: { service: Service }) {
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  function onToggleActive() {
    startTransition(async () => {
      try {
        await toggleServiceActive(service.id, !service.active)
        toast.success(service.active ? "Service deactivated" : "Service activated")
      } catch (err) {
        toast.error(errorMessage(err) || "Failed to update service")
      }
    })
  }

  function onConfirmDelete() {
    startTransition(async () => {
      try {
        await deleteService(service.id)
        setIsDeleteOpen(false)
        toast.success(`${service.name} removed`)
      } catch (err) {
        toast.error(errorMessage(err) || "Failed to delete service")
      }
    })
  }

  return (
    <>
      <div className="flex items-center justify-end gap-1.5">
        <button
          onClick={onToggleActive}
          disabled={isPending}
          title={service.active ? "Deactivate" : "Activate"}
          className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-mono uppercase tracking-widest leading-none transition disabled:opacity-50 ${
            service.active
              ? "text-success bg-success/10 hover:bg-success/15"
              : "text-muted-foreground bg-foreground/5 hover:bg-foreground/10"
          }`}
        >
          <span
            className={`inline-block size-1.5 rounded-full ${
              service.active ? "bg-success" : "bg-muted-foreground"
            }`}
          />
          {service.active ? "Active" : "Inactive"}
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

      <ServiceDialog service={service} open={isEditOpen} onOpenChange={setIsEditOpen} />

      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif text-base">Delete service?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="text-foreground">{service.name}</span> will be removed from the
              catalog and the proposal builder.
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
