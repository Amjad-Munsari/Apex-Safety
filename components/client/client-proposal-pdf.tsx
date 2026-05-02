import type { ClientProposal } from "@/lib/mock-client-docs"

export function ClientProposalPdf({ proposal }: { proposal: ClientProposal }) {
  return (
    <div className="bg-white rounded-sm overflow-hidden ring-1 ring-[#e5e1d8] shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
      <div className="aspect-[210/297] w-full p-12 text-[#1a1a1a] font-serif relative">
        {/* Letterhead */}
        <div className="flex justify-between items-start mb-12">
          <div>
            <div className="font-serif text-[28px] leading-tight text-[#1a1a1a]">
              Dineen Fire<br />& Safety.
            </div>
            <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#888] mt-3">
              Solo practice · Est. 2019
            </div>
          </div>
          <div className="text-right font-mono text-[9px] uppercase tracking-[0.2em] text-[#888] leading-relaxed">
            <div>matt@dineen-fire.co.uk</div>
            <div>0161 552 0918</div>
            <div className="mt-2 text-[#1a1a1a]">{proposal.reference}</div>
          </div>
        </div>

        {/* Title */}
        <div className="space-y-2 mb-10">
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#888]">
            Proposal · {proposal.termMonths}-month term · Valid until {proposal.expiresAt}
          </div>
          <h1 className="font-serif text-[32px] leading-tight text-[#1a1a1a]">
            {proposal.title}.
          </h1>
        </div>

        {/* Intro */}
        <p className="font-sans text-[12.5px] text-[#1a1a1a]/80 leading-relaxed mb-10 max-w-[480px]">
          Hi Sarah — please find attached your renewed compliance programme for the year ahead. The scope below mirrors what we covered last year, with two small additions you flagged in our March visit.
        </p>

        {/* Scope */}
        <div className="mb-10">
          <div className="font-mono text-[9px] uppercase tracking-[0.25em] text-[#888] mb-3">
            01 · Scope of Service
          </div>
          <div className="border-t border-[#1a1a1a]/10">
            {proposal.scope.map((item, i) => (
              <div key={item.id} className="grid grid-cols-[1fr_auto] gap-6 py-3 border-b border-[#1a1a1a]/10">
                <div>
                  <div className="font-sans text-[12.5px] text-[#1a1a1a] flex items-center gap-3">
                    <span className="font-mono text-[10px] text-[#888] w-6">{String(i + 1).padStart(2, "0")}</span>
                    {item.name}
                  </div>
                  <div className="font-sans text-[11px] text-[#888] ml-9 mt-1">{item.detail}</div>
                </div>
                <div className="font-mono text-[12px] text-[#1a1a1a] self-center">
                  £{item.price.toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Total */}
        <div className="flex justify-between items-end pt-2">
          <div>
            <div className="font-mono text-[9px] uppercase tracking-[0.25em] text-[#888] mb-1">Annual Fee</div>
            <div className="font-mono text-[10px] text-[#666]">Excl. VAT · billed quarterly</div>
          </div>
          <div className="font-serif text-[36px] leading-none text-[#1a1a1a]">
            £{proposal.total.toLocaleString()}
          </div>
        </div>

        {/* Footer */}
        <div className="absolute bottom-8 left-12 right-12 flex justify-between font-mono text-[8.5px] uppercase tracking-[0.2em] text-[#999]">
          <span>Page 1 of 3</span>
          <span>{proposal.reference}</span>
          <span>Valid until {proposal.expiresAt}</span>
        </div>
      </div>
    </div>
  )
}
