"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Power, PowerOff, Trash2, Loader2, AlertTriangle } from "lucide-react"
import { setClientActive, deleteClient } from "@/app/admin/clients/actions"
import { toast } from "sonner"

interface ClientDangerZoneProps {
  clientId: string
  clientName: string
  active: boolean
  /** Counts surfaced in the delete confirmation so the admin sees the blast radius. */
  counts: {
    assessments: number
    proposals: number
    documents: number
    portalUsers: number
  }
}

export function ClientDangerZone({
  clientId,
  clientName,
  active,
  counts,
}: ClientDangerZoneProps) {
  const router = useRouter()

  const [busy, setBusy] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [confirmName, setConfirmName] = useState("")
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const nameMatches = confirmName.trim() === clientName

  async function handleToggleActive() {
    setBusy(true)
    try {
      const res = await setClientActive(clientId, !active)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(res.active ? "Client reactivated." : "Client deactivated.")
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete() {
    if (!nameMatches) return
    setBusy(true)
    setDeleteError(null)
    try {
      const res = await deleteClient(clientId, confirmName)
      if (!res.ok) {
        setDeleteError(res.error)
        return
      }
      toast.success(`${clientName} permanently deleted.`)
      router.push("/admin/clients")
    } finally {
      setBusy(false)
    }
  }

  const blast: { label: string; n: number }[] = [
    { label: "assessment", n: counts.assessments },
    { label: "proposal", n: counts.proposals },
    { label: "document", n: counts.documents },
    { label: "portal user", n: counts.portalUsers },
  ].filter((b) => b.n > 0)

  return (
    <div className="border border-danger/30 rounded-sm bg-danger/[0.03] p-6 flex flex-col gap-5">
      <div className="flex items-center gap-2 text-danger font-mono text-[10px] uppercase tracking-widest">
        <AlertTriangle className="w-3.5 h-3.5" /> Danger Zone
      </div>

      {/* Deactivate / Reactivate */}
      <div className="flex items-center justify-between gap-6 flex-wrap">
        <div>
          <div className="text-foreground text-sm font-medium">
            {active ? "Deactivate client" : "Reactivate client"}
          </div>
          <div className="text-foreground/40 text-xs mt-0.5 max-w-md">
            {active
              ? "Mark this client inactive. All data is kept and this can be undone."
              : "Restore this client to active status."}
          </div>
        </div>
        <Button
          onClick={handleToggleActive}
          disabled={busy}
          variant="outline"
          size="sm"
          className="bg-muted border-border hover:bg-muted text-foreground/70 text-[10px] uppercase tracking-wider font-mono h-8 gap-2 shrink-0"
        >
          {busy ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : active ? (
            <PowerOff className="w-3 h-3" />
          ) : (
            <Power className="w-3 h-3" />
          )}
          {active ? "Deactivate" : "Reactivate"}
        </Button>
      </div>

      <div className="h-px bg-border" />

      {/* Delete permanently */}
      <div className="flex items-center justify-between gap-6 flex-wrap">
        <div>
          <div className="text-foreground text-sm font-medium">Delete permanently</div>
          <div className="text-foreground/40 text-xs mt-0.5 max-w-md">
            Erases this client and all related records and files. This cannot be
            undone.
          </div>
        </div>
        <Button
          onClick={() => {
            setConfirmName("")
            setDeleteError(null)
            setDeleteOpen(true)
          }}
          disabled={busy}
          variant="destructive"
          size="sm"
          className="rounded-sm text-[10px] uppercase tracking-wider font-mono h-8 gap-2 shrink-0"
        >
          <Trash2 className="w-3 h-3" /> Delete
        </Button>
      </div>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-[460px] bg-card border-border text-foreground">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl text-danger">
              Delete {clientName}?
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              This permanently removes the client and everything attached to it.
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2 flex flex-col gap-4">
            {blast.length > 0 && (
              <div className="text-xs text-foreground/60 leading-relaxed">
                The following will be erased:
                <ul className="mt-2 flex flex-col gap-1">
                  {blast.map((b) => (
                    <li key={b.label} className="flex items-center gap-2">
                      <span className="font-mono text-danger">{b.n}</span>
                      <span>
                        {b.label}
                        {b.n === 1 ? "" : "s"}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-foreground/40">
                  …plus all assignments, generated reports, and signatures.
                </p>
              </div>
            )}

            <div className="grid gap-2">
              <Label
                htmlFor="confirm-name"
                className="text-xs text-muted-foreground font-sans normal-case tracking-normal"
              >
                Type <span className="font-mono text-foreground">{clientName}</span> to
                confirm.
              </Label>
              <Input
                id="confirm-name"
                value={confirmName}
                onChange={(e) => setConfirmName(e.target.value)}
                autoComplete="off"
                className="bg-background border-border h-10 focus:ring-danger/30"
                placeholder={clientName}
              />
            </div>

            {deleteError && (
              <p className="text-danger text-xs font-mono">{deleteError}</p>
            )}
          </div>

          <DialogFooter className="gap-3">
            <Button
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              disabled={busy}
              className="bg-muted border-border hover:bg-muted text-foreground/70 text-[10px] uppercase tracking-wider font-mono h-9"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDelete}
              disabled={busy || !nameMatches}
              variant="destructive"
              className="rounded-sm gap-2 uppercase text-[10px] font-mono tracking-widest h-9"
            >
              {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
              Delete permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
