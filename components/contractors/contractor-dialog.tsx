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
  type Contractor,
  type ContractorCategory,
  CONTRACTOR_CATEGORIES,
} from "@/lib/data/contractors"
import { addContractor, updateContractor } from "@/app/admin/directory/actions"
import { toast } from "sonner"

interface ContractorDialogProps {
  contractor?: Contractor
  children?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function ContractorDialog({ contractor, children, open, onOpenChange }: ContractorDialogProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [category, setCategory] = useState<ContractorCategory>(
    contractor?.category ?? CONTRACTOR_CATEGORIES[0]
  )
  const [isPending, startTransition] = useTransition()

  const isEditing = !!contractor
  const controlledOpen = open !== undefined ? open : isOpen
  const setControlledOpen = onOpenChange || setIsOpen

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    const formData = new FormData(e.currentTarget)
    const company_name = (formData.get("company_name") as string).trim()
    const contact_name = (formData.get("contact_name") as string).trim()
    const phone = (formData.get("phone") as string).trim()
    const email = (formData.get("email") as string).trim()
    const website = (formData.get("website") as string)?.trim() || null
    const address = (formData.get("address") as string)?.trim() || null
    const notes = (formData.get("notes") as string)?.trim() || null

    if (!company_name) {
      toast.error("Company name is required")
      return
    }
    if (!contact_name) {
      toast.error("Contact name is required")
      return
    }
    if (!phone) {
      toast.error("Phone number is required")
      return
    }
    if (!email) {
      toast.error("Email address is required")
      return
    }

    startTransition(async () => {
      try {
        if (isEditing) {
          await updateContractor(contractor.id, {
            company_name,
            category,
            contact_name,
            phone,
            email,
            website,
            address,
            notes,
          })
          toast.success("Contractor updated")
        } else {
          await addContractor({
            company_name,
            category,
            contact_name,
            phone,
            email,
            website,
            address,
            notes,
            active: true,
          })
          toast.success("Contractor added")
        }
        setControlledOpen(false)
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Failed to save contractor")
      }
    })
  }

  return (
    <Dialog open={controlledOpen} onOpenChange={setControlledOpen}>
      {children && React.isValidElement(children) ? (
        <DialogTrigger render={children} />
      ) : null}
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="font-serif text-base">
            {isEditing ? "Edit contractor" : "Add contractor"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the contractor details. Changes apply instantly to the client portal directory."
              : "New entry will appear in the client portal directory once set to active."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit}>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="company_name" className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                Company name
              </Label>
              <Input
                id="company_name"
                name="company_name"
                defaultValue={contractor?.company_name}
                required
                placeholder="e.g. Acme Fire Protection Ltd"
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="category" className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                Category
              </Label>
              <select
                id="category"
                name="category"
                value={category}
                onChange={e => setCategory(e.target.value as ContractorCategory)}
                className="h-7 rounded-md border border-input bg-input/20 px-2 text-xs text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
              >
                {CONTRACTOR_CATEGORIES.map(c => (
                  <option key={c} value={c} className="bg-popover text-foreground">
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="contact_name" className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                Contact name
              </Label>
              <Input
                id="contact_name"
                name="contact_name"
                defaultValue={contractor?.contact_name}
                required
                placeholder="e.g. Jane Smith"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="phone" className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                  Phone
                </Label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  defaultValue={contractor?.phone}
                  required
                  placeholder="Office or mobile number"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="email" className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                  Email
                </Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  defaultValue={contractor?.email}
                  required
                  placeholder="e.g. info@acmefire.co.uk"
                />
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="website" className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                Website <span className="normal-case tracking-normal">(optional)</span>
              </Label>
              <Input
                id="website"
                name="website"
                defaultValue={contractor?.website ?? ""}
                placeholder="https://…"
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="address" className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                Address <span className="normal-case tracking-normal">(optional)</span>
              </Label>
              <Input
                id="address"
                name="address"
                defaultValue={contractor?.address ?? ""}
                placeholder="e.g. 12 Industrial Way, Manchester, M1 1AA"
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="notes" className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                Notes <span className="normal-case tracking-normal">(optional)</span>
              </Label>
              <Textarea
                id="notes"
                name="notes"
                defaultValue={contractor?.notes ?? ""}
                placeholder="What is this contractor approved for? Any coverage areas or special notes…"
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
                  : "Add contractor"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
