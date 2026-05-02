"use client"

import { useState } from "react"
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
import { Service, deleteService, setServiceActive } from "@/lib/data/services"
import { toast } from "sonner"

export function ServiceActions({ service }: { service: Service }) {
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)

  function onToggleActive() {
    setServiceActive(service.id, !service.active)
    toast.success(service.active ? "Service deactivated" : "Service activated")
  }

  function onConfirmDelete() {
    deleteService(service.id)
    setIsDeleteOpen(false)
    toast.success(`${service.name} removed`)
  }

  return (
    <>
      <div className="flex items-center justify-end gap-1.5">
        <button
          onClick={onToggleActive}
          title={service.active ? "Deactivate" : "Activate"}
          className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-mono uppercase tracking-widest leading-none transition ${
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
              catalog and the proposal builder. This is a demo store, so it will reset on reload.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={onConfirmDelete}
              className="bg-destructive/10 text-destructive hover:bg-destructive/20"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
