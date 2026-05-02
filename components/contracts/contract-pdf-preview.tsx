import type { MockContract } from "@/lib/mock-contracts"

export function ContractPdfPreview({ contract }: { contract: MockContract }) {
  return (
    <div className="bg-[#f4f1ea] rounded-sm overflow-hidden ring-1 ring-white/5 shadow-2xl shadow-black/40">
      {/* PDF "page" */}
      <div className="aspect-[210/297] w-full p-12 text-[#1a1a1a] font-serif relative">
        {/* Watermark */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="font-mono text-[10rem] text-black/[0.03] tracking-widest rotate-[-25deg]">
            DRAFT
          </span>
        </div>

        {/* Letterhead */}
        <div className="flex justify-between items-start mb-12 relative">
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
            <div className="mt-2 text-[#1a1a1a]">{contract.reference}</div>
          </div>
        </div>

        {/* Title */}
        <div className="space-y-2 mb-10">
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#888]">
            Service Agreement · {contract.termMonths}-month term
          </div>
          <h1 className="font-serif text-[34px] leading-tight text-[#1a1a1a]">
            {contract.clientName}.
          </h1>
        </div>

        {/* Parties */}
        <div className="grid grid-cols-2 gap-6 mb-10 font-sans text-[12px] leading-relaxed">
          <div>
            <div className="font-mono text-[9px] uppercase tracking-[0.25em] text-[#888] mb-2">Practice</div>
            <div>Dineen Fire &amp; Safety Ltd</div>
            <div className="text-[#666]">Matt Dineen, Principal</div>
            <div className="text-[#666]">19 Cathedral Yard, Manchester</div>
          </div>
          <div>
            <div className="font-mono text-[9px] uppercase tracking-[0.25em] text-[#888] mb-2">Client</div>
            <div>{contract.clientName}</div>
            <div className="text-[#666]">{contract.clientContact}</div>
            <div className="text-[#666]">{contract.clientEmail}</div>
          </div>
        </div>

        {/* Scope */}
        <div className="mb-10">
          <div className="font-mono text-[9px] uppercase tracking-[0.25em] text-[#888] mb-3">
            01 · Scope of Service
          </div>
          <ul className="space-y-2 font-sans text-[12px] text-[#1a1a1a]">
            {contract.scope.map((item, i) => (
              <li key={i} className="flex gap-3">
                <span className="font-mono text-[10px] text-[#888] mt-0.5">{String(i + 1).padStart(2, "0")}</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Total */}
        <div className="flex justify-between items-end pt-4 border-t border-[#1a1a1a]/10">
          <div>
            <div className="font-mono text-[9px] uppercase tracking-[0.25em] text-[#888] mb-1">Annual Fee</div>
            <div className="font-mono text-[10px] text-[#666]">Excl. VAT · billed quarterly</div>
          </div>
          <div className="font-serif text-[36px] leading-none text-[#1a1a1a]">
            £{contract.total.toLocaleString()}
          </div>
        </div>

        {/* Footer ribbon */}
        <div className="absolute bottom-8 left-12 right-12 flex justify-between font-mono text-[8.5px] uppercase tracking-[0.2em] text-[#999]">
          <span>Page 1 of 4</span>
          <span>{contract.reference}</span>
          <span>Issued {contract.issuedAt}</span>
        </div>
      </div>
    </div>
  )
}
