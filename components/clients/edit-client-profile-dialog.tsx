"use client"

import * as React from "react"
import { Pencil, Save } from "lucide-react"
import { toast } from "sonner"

import { updateClientProfile } from "@/app/admin/clients/actions"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type ClientProfile = {
  name: string
  contactName: string | null
  contactEmail: string | null
  contactPhone: string | null
  siteAddress: string | null
}

export function EditClientProfileDialog({
  clientId,
  profile,
}: {
  clientId: string
  profile: ClientProfile
}) {
  const [open, setOpen] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)
  const [form, setForm] = React.useState({
    name: profile.name,
    contactName: profile.contactName ?? "",
    contactEmail: profile.contactEmail ?? "",
    contactPhone: profile.contactPhone ?? "",
    siteAddress: profile.siteAddress ?? "",
  })

  function reset() {
    setForm({
      name: profile.name,
      contactName: profile.contactName ?? "",
      contactEmail: profile.contactEmail ?? "",
      contactPhone: profile.contactPhone ?? "",
      siteAddress: profile.siteAddress ?? "",
    })
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!form.name.trim()) return
    setSubmitting(true)
    try {
      const result = await updateClientProfile(clientId, form)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setOpen(false)
      toast.success("Client details updated")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update client details.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen(true)}
        className="border-border rounded-sm h-10 gap-2"
      >
        <Pencil className="size-3.5" />
        Edit details
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) reset()
        }}
      >
        <DialogContent className="sm:max-w-[520px] border-border bg-card text-foreground rounded-sm">
          <DialogHeader>
            <div className="text-[10px] font-mono tracking-[0.25em] text-muted-foreground uppercase mb-1">
              Client record
            </div>
            <DialogTitle className="font-serif text-[22px] font-normal">
              Edit organisation details.
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={submit} className="grid gap-4 pt-2">
            <ProfileField
              label="Business name"
              value={form.name}
              onChange={(name) => setForm((current) => ({ ...current, name }))}
              required
            />
            <ProfileField
              label="Primary contact"
              value={form.contactName}
              onChange={(contactName) =>
                setForm((current) => ({ ...current, contactName }))
              }
            />
            <ProfileField
              label="Email"
              type="email"
              value={form.contactEmail}
              onChange={(contactEmail) =>
                setForm((current) => ({ ...current, contactEmail }))
              }
            />
            <ProfileField
              label="Phone"
              value={form.contactPhone}
              onChange={(contactPhone) =>
                setForm((current) => ({ ...current, contactPhone }))
              }
            />
            <ProfileField
              label="Site address"
              value={form.siteAddress}
              onChange={(siteAddress) =>
                setForm((current) => ({ ...current, siteAddress }))
              }
            />

            <div className="flex justify-end gap-3 pt-3 border-t border-border">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting || !form.name.trim()} className="gap-2">
                <Save className="size-3.5" />
                {submitting ? "Saving…" : "Save details"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}

function ProfileField({
  label,
  value,
  onChange,
  type = "text",
  required = false,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  required?: boolean
}) {
  return (
    <label className="grid gap-2">
      <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </span>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="bg-muted border border-border rounded-sm h-10 px-3 text-sm text-foreground focus:border-gold/50 focus:ring-2 focus:ring-gold/20 outline-none"
      />
    </label>
  )
}
