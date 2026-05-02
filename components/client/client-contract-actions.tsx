"use client"

import * as React from "react"
import { FileSignature, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { SignSuccess } from "./sign-success"
import type { ClientContract } from "@/lib/mock-client-docs"

type State = { kind: "idle" } | { kind: "signing" } | { kind: "signed"; at: string }

export function ClientContractActions({ contract }: { contract: ClientContract }) {
  const initial: State =
    contract.status === "Signed" && contract.signedAt
      ? { kind: "signed", at: contract.signedAt }
      : { kind: "idle" }
  const [state, setState] = React.useState<State>(initial)

  async function handleSign() {
    setState({ kind: "signing" })
    await new Promise((r) => setTimeout(r, 800))
    const at = new Date().toLocaleString("en-GB", {
      day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
    })
    setState({ kind: "signed", at })
    toast.success("Contract signed", {
      description: "Matt will counter-sign on his end and send a final PDF.",
    })
  }

  if (state.kind === "signed") {
    return (
      <SignSuccess
        title="Contract signed."
        message={`Signed ${state.at}. Matt will counter-sign and you'll receive the final executed PDF in your portal.`}
      />
    )
  }

  const signing = state.kind === "signing"

  return (
    <div className="bg-white border border-[#e5e1d8] rounded-sm p-6 space-y-4">
      <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-[#888] font-bold">
        Signature Required
      </div>
      <p className="font-sans text-[13px] text-[#1a1a1a]/80 leading-relaxed">
        By signing you bind Hallam House to the scope and terms set out in the document. The fully executed copy will land back in this portal once Matt counter-signs.
      </p>
      <div className="pt-1">
        <Button
          onClick={handleSign}
          disabled={signing}
          className="w-full bg-[#1a1a1a] hover:bg-black text-white text-[10px] uppercase tracking-[0.25em] font-bold h-12 rounded-sm shadow-none flex items-center gap-2 justify-center"
        >
          {signing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileSignature className="w-3.5 h-3.5" />}
          {signing ? "Signing..." : "Sign Contract"}
        </Button>
      </div>
      <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#999] pt-2 border-t border-[#f0ede6]">
        Linked to proposal {contract.proposalRef}
      </p>
    </div>
  )
}
