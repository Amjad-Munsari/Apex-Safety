"use client"

import React, { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { addService, updateService } from "@/app/admin/services/actions"
import { toast } from "sonner"

export type Service = {
  id: string
  name: string
  description: string | null
  category: string | null
  unit_price: number
  active: boolean
}

interface ServiceDialogProps {
  service?: Service
  children?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function ServiceDialog({ service, children, open, onOpenChange }: ServiceDialogProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const isEditing = !!service
  const controlledOpen = open !== undefined ? open : isOpen
  const setControlledOpen = onOpenChange || setIsOpen

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsLoading(true)

    const formData = new FormData(e.currentTarget)
    const data = {
      name: formData.get("name") as string,
      description: formData.get("description") as string,
      category: formData.get("category") as string,
      unit_price: parseFloat(formData.get("unit_price") as string),
    }

    try {
      if (isEditing) {
        await updateService(service.id, data)
        toast.success("Service updated successfully")
      } else {
        await addService(data)
        toast.success("Service created successfully")
      }
      setControlledOpen(false)
      router.refresh()
    } catch (err: any) {
      toast.error(err.message || "Failed to save service")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={controlledOpen} onOpenChange={setControlledOpen}>
      {children && React.isValidElement(children) ? (
        <DialogTrigger render={children} />
      ) : null}
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Service" : "Add Service"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Make changes to the service here. Click save when you're done."
              : "Add a new service to the catalog."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                name="name"
                defaultValue={service?.name}
                required
                placeholder="e.g. Fire Risk Assessment (Type 1)"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="category">Category</Label>
              <Input
                id="category"
                name="category"
                defaultValue={service?.category || ""}
                placeholder="e.g. Fire Safety"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="unit_price">Unit Price (£)</Label>
              <Input
                id="unit_price"
                name="unit_price"
                type="number"
                step="0.01"
                min="0"
                defaultValue={service?.unit_price}
                required
                placeholder="e.g. 150.00"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description (used by AI for drafting)</Label>
              <Textarea
                id="description"
                name="description"
                defaultValue={service?.description || ""}
                placeholder="Detailed description of what this service includes..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
