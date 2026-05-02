import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { clientContracts } from "@/lib/mock-client-docs"

export default function ClientContractsPage() {
  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <section className="space-y-3">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[10px] text-[#3b8273] tracking-[0.4em] uppercase font-medium">
            07 · Contracts
          </span>
        </div>
        <h2 className="font-serif text-[44px] text-[#1a1a1a] font-normal tracking-tight leading-[1.05]">
          Service agreements.
        </h2>
        <p className="text-[#6b6560] text-[13px] font-sans tracking-tight max-w-xl">
          Counter-signed agreements between Hallam House and Dineen Fire &amp; Safety.
        </p>
      </section>

      <section className="space-y-4">
        {clientContracts.map((c) => {
          const isSigned = c.status === "Signed"
          return (
            <Link
              key={c.id}
              href={`/client/contracts/${c.id}`}
              className="block bg-white border border-[#e5e1d8] rounded-sm shadow-[0_1px_2px_rgba(0,0,0,0.02)] hover:shadow-md hover:border-[#d8d3c8] transition-all p-7 group"
            >
              <div className="flex items-start justify-between gap-6">
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center gap-3 font-mono text-[9px] tracking-[0.25em] text-[#8a857f] uppercase font-bold">
                    <span>{c.reference}</span>
                    <span className="opacity-50">·</span>
                    <span>Issued {c.issuedAt}</span>
                    <span className="opacity-50">·</span>
                    <span>From proposal {c.proposalRef}</span>
                  </div>
                  <h3 className="font-serif text-[24px] text-[#1a1a1a] tracking-tight leading-tight group-hover:text-black">
                    {c.title}
                  </h3>
                  <p className="font-sans text-[13px] text-[#6b6560]">
                    £{c.total.toLocaleString()} · {c.termMonths}-month term
                  </p>
                </div>

                <div className="flex flex-col items-end gap-3 shrink-0">
                  <div
                    className={cn(
                      "px-3 py-1.5 border rounded-full font-mono text-[9px] uppercase tracking-[0.2em] font-bold leading-none flex items-center gap-2",
                      isSigned
                        ? "border-[#3b8273]/40 text-[#3b8273] bg-[#f4f8f6]"
                        : "border-[#c0a66d] text-[#c0a66d] bg-[#fcf9f1]",
                    )}
                  >
                    <div className={cn("w-1.5 h-1.5 rounded-full", isSigned ? "bg-[#3b8273]" : "bg-[#c0a66d]")} />
                    {c.status}
                  </div>
                  <div className="flex items-center gap-1.5 text-[#6b6560] group-hover:text-black transition-colors font-mono text-[9px] uppercase tracking-[0.25em] font-bold">
                    Open
                    <ChevronRight className="w-3 h-3" />
                  </div>
                </div>
              </div>
            </Link>
          )
        })}
      </section>
    </div>
  )
}
