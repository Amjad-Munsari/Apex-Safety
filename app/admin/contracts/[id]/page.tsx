import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Card } from "@/components/ui/card"
import { ContractStatusBadge } from "@/components/contracts/contract-status-badge"
import { ContractPdfPreview } from "@/components/contracts/contract-pdf-preview"
import { ContractActions } from "@/components/contracts/contract-actions"
import { getMockContract } from "@/lib/mock-contracts"

export default async function ContractDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const contract = getMockContract(id)
  if (!contract) {
    return (
      <div className="pt-12 text-center font-mono text-xs uppercase tracking-widest text-white/30">
        Contract not found
      </div>
    )
  }

  const timeline = [
    { label: "Drafted", date: contract.issuedAt, done: true },
    { label: "Sent for Signature", date: contract.issuedAt, done: contract.status !== "Draft" },
    { label: "Client Signed", date: contract.signedByClientAt ?? "—", done: !!contract.signedByClientAt },
    { label: "Counter-Signed", date: contract.signedByPracticeAt ?? "—", done: !!contract.signedByPracticeAt },
  ]

  return (
    <div className="flex flex-col gap-8 pt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div className="flex flex-col gap-2">
          <Link href="/admin/proposals" className="flex items-center gap-2 text-[#666] hover:text-white transition-colors mb-2">
            <ArrowLeft className="w-4 h-4" />
            <span className="font-mono text-xs uppercase tracking-widest">Back to Proposals</span>
          </Link>
          <div className="flex items-center gap-3 font-mono text-xs tracking-widest text-[#666] uppercase">
            <span className="text-gold font-semibold">{contract.reference}</span>
            <span className="opacity-30">·</span>
            Service Agreement
          </div>
          <h2 className="font-serif text-[34px] leading-tight text-white">
            {contract.clientName}.
          </h2>
          <p className="text-[#666] text-sm font-sans tracking-wide max-w-xl">
            £{contract.total.toLocaleString()} · {contract.termMonths}-month term · linked to proposal{" "}
            <span className="text-white/80 font-mono text-[11px]">{contract.proposalRef}</span>
          </p>
        </div>
        <ContractStatusBadge status={contract.status} />
      </div>

      {/* Body */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-8">
        {/* Left: PDF preview */}
        <div className="flex flex-col gap-3">
          <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-[#666]">
            01 · Document Preview
          </div>
          <ContractPdfPreview contract={contract} />
        </div>

        {/* Right: Action rail */}
        <div className="flex flex-col gap-6">
          <Card className="bg-[#1c1c1c] border-white/5 rounded-sm p-5">
            <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-[#666] mb-4">
              Actions
            </div>
            <ContractActions initialStatus={contract.status} clientName={contract.clientName} />
          </Card>

          <Card className="bg-[#1c1c1c] border-white/5 rounded-sm p-5">
            <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-[#666] mb-4">
              Timeline
            </div>
            <ol className="flex flex-col gap-4">
              {timeline.map((step, i) => (
                <li key={i} className="flex items-start gap-3">
                  <div
                    className={`mt-1 w-2 h-2 rounded-full shrink-0 ${
                      step.done ? "bg-[#3b8273]" : "bg-white/10"
                    }`}
                  />
                  <div className="flex flex-col">
                    <span className={`text-xs ${step.done ? "text-white" : "text-white/40"}`}>
                      {step.label}
                    </span>
                    <span className="font-mono text-[10px] text-[#666] uppercase tracking-[0.2em]">
                      {step.date}
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          </Card>

          <Card className="bg-[#1c1c1c] border-white/5 rounded-sm p-5">
            <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-[#666] mb-3">
              Counterparty
            </div>
            <div className="text-white text-sm">{contract.clientContact}</div>
            <div className="text-[#888] font-mono text-[11px] mt-1">{contract.clientEmail}</div>
          </Card>
        </div>
      </div>
    </div>
  )
}
