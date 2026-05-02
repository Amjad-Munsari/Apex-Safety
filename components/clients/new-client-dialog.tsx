"use client"

import * as React from "react"
import { Plus, Send } from "lucide-react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

export function NewClientButton() {
  const [open, setOpen] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)
  const [form, setForm] = React.useState({
    businessName: "",
    contactName: "",
    email: "",
    phone: "",
  })

  const reset = () => setForm({ businessName: "", contactName: "", email: "", phone: "" })

  const canSubmit =
    form.businessName.trim().length > 0 &&
    form.contactName.trim().length > 0 &&
    form.email.trim().length > 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    await new Promise((r) => setTimeout(r, 600))
    setSubmitting(false)
    setOpen(false)
    reset()
    toast.success("Invite sent", {
      description: `${form.contactName} at ${form.businessName} will receive a portal invite shortly.`,
    })
  }

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className="bg-white hover:bg-white/90 text-black rounded-sm px-6 font-medium text-sm h-10 tracking-wide border-none flex gap-2"
      >
        <Plus className="w-4 h-4" /> New Client
      </Button>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset() }}>
        <DialogContent className="sm:max-w-[440px] border-white/5 bg-[#1c1c1c] text-white rounded-sm">
          <DialogHeader>
            <div className="text-[10px] font-mono tracking-[0.25em] text-[#666] uppercase mb-1">
              New Client
            </div>
            <DialogTitle className="font-serif text-[22px] font-normal text-white tracking-tight leading-tight">
              Onboard a new client.
            </DialogTitle>
            <p className="text-[#888] text-xs font-sans tracking-wide mt-1">
              They&apos;ll receive a portal invite and start with a 0h hours balance.
            </p>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5 pt-2">
            <Field
              label="Business Name"
              value={form.businessName}
              onChange={(v) => setForm((f) => ({ ...f, businessName: v }))}
              placeholder="Yellow Broom Ltd"
              autoFocus
            />
            <Field
              label="Primary Contact"
              value={form.contactName}
              onChange={(v) => setForm((f) => ({ ...f, contactName: v }))}
              placeholder="Sarah Whitfield"
            />
            <Field
              label="Email"
              type="email"
              value={form.email}
              onChange={(v) => setForm((f) => ({ ...f, email: v }))}
              placeholder="sarah@yellowbroom.co.uk"
            />
            <Field
              label="Phone"
              value={form.phone}
              onChange={(v) => setForm((f) => ({ ...f, phone: v }))}
              placeholder="0161 552 0918"
            />

            <div className="flex justify-between items-center pt-3 border-t border-white/5">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-[#888] hover:text-white text-[10px] uppercase tracking-[0.2em] font-mono transition-colors"
              >
                Cancel
              </button>
              <Button
                type="submit"
                disabled={!canSubmit || submitting}
                className="bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-black rounded-sm px-5 font-medium text-[11px] h-9 tracking-wide border-none flex gap-2"
              >
                <Send className="w-3.5 h-3.5" />
                {submitting ? "Sending..." : "Send Invite"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  autoFocus,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
  autoFocus?: boolean
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#777]">{label}</span>
      <input
        type={type}
        autoFocus={autoFocus}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="bg-black/40 border border-white/10 rounded-sm h-9 px-3 text-sm text-white placeholder:text-white/20 focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20 outline-none transition-all"
      />
    </label>
  )
}
