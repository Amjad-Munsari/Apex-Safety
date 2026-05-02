"use client"

import * as React from "react"
import { toast } from "sonner"
import { Send, FileSignature, Download, Mail } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { ContractStatus } from "@/lib/mock-contracts"

export function ContractActions({
  initialStatus,
  clientName,
}: {
  initialStatus: ContractStatus
  clientName: string
}) {
  const [status, setStatus] = React.useState<ContractStatus>(initialStatus)
  const [pending, setPending] = React.useState<null | "send" | "counter">(null)

  async function handleSend() {
    setPending("send")
    await new Promise((r) => setTimeout(r, 500))
    setStatus("Sent for Signing")
    setPending(null)
    toast.success("Contract sent for signature", {
      description: `${clientName} has been emailed a signing link.`,
    })
  }

  async function handleCounterSign() {
    setPending("counter")
    await new Promise((r) => setTimeout(r, 500))
    setStatus("Counter-Signed")
    setPending(null)
    toast.success("Contract counter-signed", {
      description: `Both parties have now executed the agreement.`,
    })
  }

  const showSend = status === "Draft"
  const showCounter = status === "Client Signed"

  return (
    <div className="flex flex-col gap-3">
      {showSend && (
        <Button
          onClick={handleSend}
          disabled={pending !== null}
          className="bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-black rounded-sm px-5 font-medium text-[11px] h-10 tracking-wide border-none flex gap-2 justify-center"
        >
          <Send className="w-3.5 h-3.5" />
          {pending === "send" ? "Sending..." : "Send for Signature"}
        </Button>
      )}
      {showCounter && (
        <Button
          onClick={handleCounterSign}
          disabled={pending !== null}
          className="bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-black rounded-sm px-5 font-medium text-[11px] h-10 tracking-wide border-none flex gap-2 justify-center"
        >
          <FileSignature className="w-3.5 h-3.5" />
          {pending === "counter" ? "Counter-signing..." : "Counter-Sign"}
        </Button>
      )}

      <Button
        variant="outline"
        onClick={() => toast.info("PDF download will be available once the contract is fully executed.")}
        className="border-white/10 bg-transparent text-white/70 hover:bg-white/[0.03] rounded-sm h-10 text-[10px] uppercase tracking-[0.2em] font-mono flex gap-2 justify-center"
      >
        <Download className="w-3.5 h-3.5" /> Download PDF
      </Button>
      <Button
        variant="outline"
        onClick={() => toast.info(`Reminder queued — ${clientName} will be nudged tomorrow.`)}
        className="border-white/10 bg-transparent text-white/70 hover:bg-white/[0.03] rounded-sm h-10 text-[10px] uppercase tracking-[0.2em] font-mono flex gap-2 justify-center"
      >
        <Mail className="w-3.5 h-3.5" /> Send Reminder
      </Button>

      <div className="pt-3 mt-2 border-t border-white/5 font-mono text-[10px] text-white/40 uppercase tracking-[0.2em]">
        Current State<br />
        <span className="text-white/80 font-sans normal-case tracking-normal text-xs mt-1 inline-block">
          {status}
        </span>
      </div>
    </div>
  )
}
