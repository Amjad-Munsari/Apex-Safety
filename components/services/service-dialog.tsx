"use client"

import React, { useState, useTransition } from "react"
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
import {
  type Service,
  type ServiceCategory,
  SERVICE_CATEGORIES,
} from "@/lib/data/services"
import { addService, updateService } from "@/app/admin/services/actions"
import { toast } from "sonner"

interface ServiceDialogProps {
  service?: Service
  children?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function ServiceDialog({ service, children, open, onOpenChange }: ServiceDialogProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [category, setCategory] = useState<ServiceCategory>(
    service?.category ?? SERVICE_CATEGORIES[0]
  )
  const [isPending, startTransition] = useTransition()

  const isEditing = !!service
  const controlledOpen = open !== undefined ? open : isOpen
  const setControlledOpen = onOpenChange || setIsOpen

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    const formData = new FormData(e.currentTarget)
    const name = (formData.get("name") as string).trim()
    const description = (formData.get("description") as string)?.trim() || null
    const priceRaw = ((formData.get("unit_price") as string) ?? '').trim()
    // Blank price = quote-on-request service.
    const unit_price = priceRaw === '' ? null : parseFloat(priceRaw)
    const unit = ((formData.get("unit") as string) || "each").trim()

    if (!name) {
      toast.error("Name is required")
      return
    }
    if (unit_price !== null && (Number.isNaN(unit_price) || unit_price < 0)) {
      toast.error("Price must be a positive number, or blank for quote on request")
      return
    }

    startTransition(async () => {
      try {
        if (isEditing) {
          await updateService(service.id, { name, description, category, unit_price, unit })
          toast.success("Service updated")
        } else {
          await addService({ name, description, category, unit_price, unit, active: true })
          toast.success("Service added")
        }
        setControlledOpen(false)
      } catch (err: any) {
        toast.error(err?.message || "Failed to save service")
      }
    })
  }

  return (
    <Dialog open={controlledOpen} onOpenChange={setControlledOpen}>
      {children && React.isValidElement(children) ? (
        <DialogTrigger render={children} />
      ) : null}
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle className="font-serif text-base">
            {isEditing ? "Edit service" : "Add service"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Adjust the catalog entry. Changes apply instantly to the proposal builder."
              : "New entry will appear in the catalog and the proposal builder."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit}>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="name" className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                Name
              </Label>
              <Input
                id="name"
                name="name"
                defaultValue={service?.name}
                required
                placeholder="e.g. Fire Risk Assessment (Type 1)"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="category" className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                  Category
                </Label>
                <select
                  id="category"
                  name="category"
                  value={category}
                  onChange={e => setCategory(e.target.value as ServiceCategory)}
                  className="h-7 rounded-md border border-input bg-input/20 px-2 text-xs text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
                >
                  {SERVICE_CATEGORIES.map(c => (
                    <option key={c} value={c} className="bg-popover text-foreground">
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="unit" className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                  Unit
                </Label>
                <Input
                  id="unit"
                  name="unit"
                  defaultValue={service?.unit ?? "each"}
                  placeholder="each, course, month, block, user…"
                />
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="unit_price" className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                Unit price (£)
              </Label>
              <Input
                id="unit_price"
                name="unit_price"
                type="number"
                step="0.01"
                min="0"
                defaultValue={service?.unit_price ?? undefined}
                placeholder="Leave blank for quote on request"
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="description" className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                Description
              </Label>
              <Textarea
                id="description"
                name="description"
                defaultValue={service?.description ?? ""}
                placeholder="Detailed description used by the proposal builder…"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="submit"
              disabled={isPending}
              className="bg-gold text-foreground hover:bg-gold/90"
            >
              {isPending
                ? "Saving…"
                : isEditing
                  ? "Save changes"
                  : "Add service"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
