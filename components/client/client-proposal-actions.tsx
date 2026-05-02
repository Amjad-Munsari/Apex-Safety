"use client"

import * as React from "react"
import { CheckCircle2, X, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { SignSuccess } from "./sign-success"
import type { ClientProposal } from "@/lib/mock-client-docs"

type State =
  | { kind: "idle" }
  | { kind: "signing" }
  | { kind: "signed"; at: string }
  | { kind: "declined" }

export function ClientProposalActions({ proposal }: { proposal: ClientProposal }) {
  const initial: State =
    proposal.status === "Signed" && proposal.signedAt
      ? { kind: "signed", at: proposal.signedAt }
      : { kind: "idle" }
  const [state, setState] = React.useState<State>(initial)

  async function handleSign() {
    setState({ kind: "signing" })
    await new Promise((r) => setTimeout(r, 800))
    const at = new Date().toLocaleString("en-GB", {
      day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
    })
    setState({ kind: "signed", at })
    toast.success("Proposal accepted", { description: "Matt has been notified — a contract will follow shortly." })
  }

  function handleDecline() {
    setState({ kind: "declined" })
    toast.info("Proposal declined", { description: "Matt will be notified. You can reopen this any time." })
  }

  if (state.kind === "signed") {
    return (
      <SignSuccess
        title="Proposal accepted."
        message={`Signed ${state.at}. Matt has been notified and will issue the contract within one working day.`}
      />
    )
  }

  if (state.kind === "declined") {
    return (
      <div className="bg-white border border-[#e5e1d8] rounded-sm p-12 flex flex-col items-center justify-center text-center min-h-[280px]">
        <div className="w-14 h-14 rounded-full bg-[#1a1a1a]/5 ring-1 ring-[#1a1a1a]/10 flex items-center justify-center mb-5">
          <X className="w-7 h-7 text-[#1a1a1a]/60" />
        </div>
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#888] font-bold mb-2">
          Proposal Declined
        </div>
        <h3 className="font-serif text-[24px] text-[#1a1a1a] tracking-tight">No further action.</h3>
        <p className="font-sans text-[13px] text-[#666] mt-2 max-w-md">
          We&apos;ve let Matt know. If anything changes, drop him a line and he&apos;ll re-issue.
        </p>
      </div>
    )
  }

  const signing = state.kind === "signing"

  return (
    <div className="bg-white border border-[#e5e1d8] rounded-sm p-6 space-y-4">
      <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-[#888] font-bold">
        Your Decision
      </div>
      <p className="font-sans text-[13px] text-[#1a1a1a]/80 leading-relaxed">
        Accepting this proposal e-signs the document and triggers a service contract for your records.
      </p>
      <div className="flex flex-col gap-2 pt-2">
        <Button
          onClick={handleSign}
          disabled={signing}
          className="bg-[#1a1a1a] hover:bg-black text-white text-[10px] uppercase tracking-[0.25em] font-bold h-12 rounded-sm shadow-none flex items-center gap-2 justify-center"
        >
          {signing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
          {signing ? "Signing..." : "Accept & Sign"}
        </Button>
        <Button
          onClick={handleDecline}
          disabled={signing}
          variant="outline"
          className="rounded-sm border-[#e5e1d8] bg-transparent hover:bg-[#f9f8f6] text-[#1a1a1a] text-[10px] uppercase tracking-[0.25em] font-bold h-11 shadow-none"
        >
          Decline
        </Button>
      </div>
    </div>
  )
}
