"use client"

import * as React from "react"
import { toast } from "sonner"
import { Activity } from "lucide-react"

import { Button } from "@/components/ui/button"
import { emitDiagnosticProbe } from "./actions"

/**
 * Writes one deliberate row through the real logging path.
 *
 * This exists because "no errors" and "error logging is broken" look identical
 * on a page like this, and the difference matters most exactly when you're
 * relying on the page. One click proves the chain — action → logger →
 * redaction → service-role insert → this view.
 */
export function ProbeButton() {
  const [pending, setPending] = React.useState(false)

  async function handleProbe() {
    setPending(true)
    try {
      const result = await emitDiagnosticProbe()
      if (result.ok) {
        toast.success("Probe recorded — reload to see it under diagnostics.probe")
      } else {
        toast.error(result.error)
      }
    } catch {
      toast.error("Probe failed to reach the server.")
    } finally {
      setPending(false)
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      onClick={handleProbe}
      disabled={pending}
      className="rounded-sm font-mono text-[10px] uppercase tracking-widest h-7 gap-2"
    >
      <Activity className="w-3 h-3" />
      {pending ? "Testing…" : "Test logging"}
    </Button>
  )
}
