"use client"

import * as React from "react"
import { Plus, Send, Copy, Check, KeyRound, AlertTriangle } from "lucide-react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { createClient, inviteClientUser } from "@/app/admin/clients/actions"

export function NewClientButton({
  onCreated,
}: {
  /** Optional callback fired with the new client id after a successful insert. */
  onCreated?: (id: string) => void
} = {}) {
  const [open, setOpen] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)
  const [form, setForm] = React.useState({
    businessName: "",
    contactName: "",
    email: "",
    phone: "",
  })
  // After a successful onboard we swap the form out for an invite-link panel.
  // `inviteWarning` covers the partial-success case: the client row was created
  // but the auth invite could not be minted (the admin can retry from the
  // client's Access tab). The org still exists, so this is not a hard failure.
  const [result, setResult] = React.useState<
    | { businessName: string; link: string; contactName: string }
    | { businessName: string; link: null; inviteWarning: string }
    | null
  >(null)

  const reset = () => {
    setForm({ businessName: "", contactName: "", email: "", phone: "" })
    setResult(null)
  }

  const canSubmit =
    form.businessName.trim().length > 0 &&
    form.contactName.trim().length > 0 &&
    form.email.trim().length > 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    try {
      const { id } = await createClient({
        name: form.businessName,
        contactName: form.contactName,
        contactEmail: form.email,
        contactPhone: form.phone,
      })

      // Embedded usage (e.g. the proposal builder pre-filling a client) only
      // needs the org to exist and advances to the next step — provisioning
      // portal access there would be premature. Keep the lightweight path.
      if (onCreated) {
        setOpen(false)
        reset()
        toast.success("Client added", {
          description: `${form.businessName} is now in the client list.`,
        })
        onCreated(id)
        return
      }

      // Standalone onboarding: invite the primary contact as the org owner.
      // Email automation is deferred, so we surface the action link for the
      // admin to send manually (mirrors the Access tab convention).
      const invite = await inviteClientUser(id, {
        name: form.contactName,
        email: form.email,
        role: "owner",
      })

      if (invite.ok) {
        setResult({ businessName: form.businessName, link: invite.link, contactName: invite.name })
        toast.success("Client onboarded", {
          description: `${form.businessName} added — invite link ready to send.`,
        })
      } else {
        // Client created, invite failed — surface the warning but don't pretend
        // the whole thing failed (the org row is real).
        setResult({ businessName: form.businessName, link: null, inviteWarning: invite.error })
        toast.warning("Client added — invite not sent", {
          description: invite.error,
        })
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to add client")
    } finally {
      setSubmitting(false)
    }
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
          {result ? (
            <ResultPanel result={result} onClose={() => { setOpen(false); reset() }} />
          ) : (
          <>
          <DialogHeader>
            <div className="text-[10px] font-mono tracking-[0.25em] text-[#666] uppercase mb-1">
              New Client
            </div>
            <DialogTitle className="font-serif text-[22px] font-normal text-white tracking-tight leading-tight">
              Onboard a new client.
            </DialogTitle>
            <p className="text-[#888] text-xs font-sans tracking-wide mt-1">
              They&apos;ll get an invite link to set up portal access, and start with a 0h hours balance.
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
              placeholder="Jane Smith"
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
          </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

function ResultPanel({
  result,
  onClose,
}: {
  result:
    | { businessName: string; link: string; contactName: string }
    | { businessName: string; link: null; inviteWarning: string }
  onClose: () => void
}) {
  const [copied, setCopied] = React.useState(false)
  const invited = result.link !== null

  return (
    <>
      <DialogHeader>
        <div className="text-[10px] font-mono tracking-[0.25em] text-[#666] uppercase mb-1">
          {invited ? "Client Onboarded" : "Client Added"}
        </div>
        <DialogTitle className="font-serif text-[22px] font-normal text-white tracking-tight leading-tight">
          {result.businessName} is in.
        </DialogTitle>
        <p className="text-[#888] text-xs font-sans tracking-wide mt-1">
          {invited
            ? `Send this link to ${result.contactName} — it signs them in and lets them set a password. It's single-use and expires; regenerate from the client's Access tab if it lapses.`
            : "The client was created, but a portal invite couldn't be generated automatically. You can invite the contact from the client's Access tab."}
        </p>
      </DialogHeader>

      <div className="pt-2">
        {invited ? (
          <div className="flex flex-col gap-2 bg-amber-500/5 border border-amber-500/20 rounded-sm p-4">
            <div className="flex items-center gap-2 text-[#d8c08a] font-mono text-[10px] uppercase tracking-[0.2em]">
              <KeyRound className="w-3.5 h-3.5" />
              Invite link
            </div>
            <div className="flex items-stretch gap-2">
              <code className="flex-1 min-w-0 truncate bg-black/40 border border-white/10 rounded-sm px-3 py-2.5 font-mono text-[11px] text-white/80">
                {result.link}
              </code>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(result.link!)
                    setCopied(true)
                    setTimeout(() => setCopied(false), 2000)
                  } catch {
                    /* clipboard blocked — user can still select the text manually */
                  }
                }}
                className="shrink-0 inline-flex items-center gap-2 px-3 rounded-sm bg-white/10 hover:bg-white/15 text-white font-mono text-[10px] uppercase tracking-widest transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-amber-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3 bg-amber-500/5 border border-amber-500/20 rounded-sm p-4">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-white/60 text-xs leading-relaxed">{result.inviteWarning}</p>
          </div>
        )}
      </div>

      <div className="flex justify-end pt-4 border-t border-white/5">
        <Button
          onClick={onClose}
          className="bg-white hover:bg-white/90 text-black rounded-sm px-5 font-medium text-[11px] h-9 tracking-wide border-none"
        >
          Done
        </Button>
      </div>
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
