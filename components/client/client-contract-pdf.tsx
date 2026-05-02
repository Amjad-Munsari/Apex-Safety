import type { ClientContract } from "@/lib/mock-client-docs"

export function ClientContractPdf({ contract }: { contract: ClientContract }) {
  return (
    <div className="bg-white rounded-sm overflow-hidden ring-1 ring-[#e5e1d8] shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
      <div className="aspect-[210/297] w-full p-12 text-[#1a1a1a] font-serif relative">
        {/* Letterhead */}
        <div className="flex justify-between items-start mb-12">
          <div>
            <div className="font-serif text-[28px] leading-tight text-[#1a1a1a]">
              888 Safety<br />& Training.
            </div>
          </div>
          <div className="text-right font-mono text-[9px] uppercase tracking-[0.2em] text-[#8a857f] leading-relaxed">
            <div>matt@888safetyandtraining.com</div>
            <div>0161 552 0918</div>
            <div className="mt-2 text-[#1a1a1a]">{contract.reference}</div>
          </div>
        </div>

        {/* Title */}
        <div className="space-y-2 mb-10">
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#8a857f]">
            Service Agreement · {contract.termMonths}-month term
          </div>
          <h1 className="font-serif text-[32px] leading-tight text-[#1a1a1a]">
            {contract.title}.
          </h1>
        </div>

        {/* Parties */}
        <div className="grid grid-cols-2 gap-6 mb-10 font-sans text-[12px] leading-relaxed">
          <div>
            <div className="font-mono text-[9px] uppercase tracking-[0.25em] text-[#8a857f] mb-2">Practice</div>
            <div>888 Safety &amp; Training Ltd</div>
            <div className="text-[#6b6560]">Matt Robinson, Principal</div>
            <div className="text-[#6b6560]">Wakefield</div>
          </div>
          <div>
            <div className="font-mono text-[9px] uppercase tracking-[0.25em] text-[#8a857f] mb-2">Client</div>
            <div>Hallam House Care Home</div>
            <div className="text-[#6b6560]">Sarah Whitfield, Facilities Manager</div>
            <div className="text-[#6b6560]">sarah@hallamhouse.co.uk</div>
          </div>
        </div>

        {/* Scope */}
        <div className="mb-10">
          <div className="font-mono text-[9px] uppercase tracking-[0.25em] text-[#8a857f] mb-3">
            01 · Scope of Service
          </div>
          <ul className="space-y-2 font-sans text-[12.5px] text-[#1a1a1a]">
            {contract.scope.map((item, i) => (
              <li key={i} className="flex gap-3">
                <span className="font-mono text-[10px] text-[#8a857f] mt-0.5">{String(i + 1).padStart(2, "0")}</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Terms */}
        <div className="mb-10">
          <div className="font-mono text-[9px] uppercase tracking-[0.25em] text-[#8a857f] mb-3">
            02 · Key Terms
          </div>
          <div className="font-sans text-[11.5px] text-[#1a1a1a]/80 leading-relaxed space-y-2">
            <p>Term: {contract.termMonths} months from the issue date, with auto-renewal subject to 30-day notice.</p>
            <p>Billing: Quarterly in advance. Excl. VAT. Late payments accrue 2.5% / month.</p>
            <p>Termination: Either party may terminate for material breach with 14-day notice.</p>
          </div>
        </div>

        {/* Total */}
        <div className="flex justify-between items-end pt-2 border-t border-[#1a1a1a]/10">
          <div>
            <div className="font-mono text-[9px] uppercase tracking-[0.25em] text-[#8a857f] mb-1">Annual Fee</div>
            <div className="font-mono text-[10px] text-[#6b6560]">Excl. VAT · billed quarterly</div>
          </div>
          <div className="font-serif text-[36px] leading-none text-[#1a1a1a]">
            £{contract.total.toLocaleString()}
          </div>
        </div>

        {/* Footer */}
        <div className="absolute bottom-8 left-12 right-12 flex justify-between font-mono text-[8.5px] uppercase tracking-[0.2em] text-[#8a857f]">
          <span>Page 1 of 4</span>
          <span>{contract.reference}</span>
          <span>Issued {contract.issuedAt}</span>
        </div>
      </div>
    </div>
  )
}
