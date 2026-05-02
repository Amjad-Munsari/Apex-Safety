import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { ClientContractPdf } from "@/components/client/client-contract-pdf"
import { ClientContractActions } from "@/components/client/client-contract-actions"
import { getClientContract } from "@/lib/mock-client-docs"

export default async function ClientContractDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const contract = getClientContract(id)

  if (!contract) {
    return (
      <div className="py-24 text-center font-mono text-xs uppercase tracking-widest text-[#999]">
        Contract not found
      </div>
    )
  }

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <Link href="/client/contracts" className="inline-flex items-center gap-2 text-[#999] hover:text-black transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" />
        <span className="font-mono text-[9px] uppercase tracking-[0.25em] font-bold">Back to Contracts</span>
      </Link>

      <section className="space-y-3">
        <div className="flex items-center gap-3 font-mono text-[9px] tracking-[0.25em] text-[#999] uppercase font-bold">
          <span className="text-[#3b8273]">{contract.reference}</span>
          <span className="opacity-30">·</span>
          <span>Issued {contract.issuedAt}</span>
        </div>
        <h2 className="font-serif text-[40px] text-[#1a1a1a] font-normal tracking-tight leading-[1.05]">
          {contract.title}.
        </h2>
        <p className="text-[#888] text-[13px] font-sans tracking-tight max-w-xl">
          £{contract.total.toLocaleString()} for {contract.termMonths} months · linked to proposal{" "}
          <span className="text-[#1a1a1a] font-mono text-[11px]">{contract.proposalRef}</span>
        </p>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8 items-start">
        <ClientContractPdf contract={contract} />
        <div className="lg:sticky lg:top-24">
          <ClientContractActions contract={contract} />
        </div>
      </div>
    </div>
  )
}
