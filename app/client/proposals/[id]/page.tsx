import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { ClientProposalPdf } from "@/components/client/client-proposal-pdf"
import { ClientProposalActions } from "@/components/client/client-proposal-actions"
import { getClientProposal } from "@/lib/mock-client-docs"

export default async function ClientProposalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const proposal = getClientProposal(id)

  if (!proposal) {
    return (
      <div className="py-24 text-center font-mono text-xs uppercase tracking-widest text-[#999]">
        Proposal not found
      </div>
    )
  }

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* Back */}
      <Link href="/client/proposals" className="inline-flex items-center gap-2 text-[#999] hover:text-black transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" />
        <span className="font-mono text-[9px] uppercase tracking-[0.25em] font-bold">Back to Proposals</span>
      </Link>

      {/* Header */}
      <section className="space-y-3">
        <div className="flex items-center gap-3 font-mono text-[9px] tracking-[0.25em] text-[#999] uppercase font-bold">
          <span className="text-[#3b8273]">{proposal.reference}</span>
          <span className="opacity-30">·</span>
          <span>Received {proposal.receivedAt}</span>
        </div>
        <h2 className="font-serif text-[40px] text-[#1a1a1a] font-normal tracking-tight leading-[1.05]">
          {proposal.title}.
        </h2>
        <p className="text-[#888] text-[13px] font-sans tracking-tight max-w-xl">
          £{proposal.total.toLocaleString()} for {proposal.termMonths} months · {proposal.scope.length} services bundled
        </p>
      </section>

      {/* Body */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8 items-start">
        <ClientProposalPdf proposal={proposal} />
        <div className="lg:sticky lg:top-24">
          <ClientProposalActions proposal={proposal} />
        </div>
      </div>
    </div>
  )
}
