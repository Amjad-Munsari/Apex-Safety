import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { clientProposals } from "@/lib/mock-client-docs"

export default function ClientProposalsPage() {
  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* Hero */}
      <section className="space-y-3">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[10px] text-[#3b8273] tracking-[0.4em] uppercase font-medium">
            06 · Proposals
          </span>
        </div>
        <h2 className="font-serif text-[44px] text-[#1a1a1a] font-normal tracking-tight leading-[1.05]">
          Proposals from Matt.
        </h2>
        <p className="text-[#888] text-[13px] font-sans tracking-tight max-w-xl">
          Review what&apos;s been quoted, accept directly, or decline if it isn&apos;t a fit yet.
        </p>
      </section>

      {/* List */}
      <section className="space-y-4">
        {clientProposals.map((p) => {
          const isSigned = p.status === "Signed"
          return (
            <Link
              key={p.id}
              href={`/client/proposals/${p.id}`}
              className="block bg-white border border-[#e5e1d8] rounded-sm shadow-[0_1px_2px_rgba(0,0,0,0.02)] hover:shadow-md hover:border-[#d8d3c8] transition-all p-7 group"
            >
              <div className="flex items-start justify-between gap-6">
                {/* Left */}
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center gap-3 font-mono text-[9px] tracking-[0.25em] text-[#999] uppercase font-bold">
                    <span>{p.reference}</span>
                    <span className="opacity-30">·</span>
                    <span>Received {p.receivedAt}</span>
                  </div>
                  <h3 className="font-serif text-[24px] text-[#1a1a1a] tracking-tight leading-tight group-hover:text-black">
                    {p.title}
                  </h3>
                  <p className="font-sans text-[13px] text-[#666]">
                    {p.scope.length} services · £{p.total.toLocaleString()} for {p.termMonths} months
                  </p>
                </div>

                {/* Right */}
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
                    {p.status}
                  </div>
                  <div className="flex items-center gap-1.5 text-[#999] group-hover:text-black transition-colors font-mono text-[9px] uppercase tracking-[0.25em] font-bold">
                    Open
                    <ChevronRight className="w-3 h-3" />
                  </div>
                </div>
              </div>

              {!isSigned && (
                <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#c0a66d] mt-5 pt-4 border-t border-[#f0ede6]">
                  Awaiting your signature · Expires {p.expiresAt}
                </p>
              )}
              {isSigned && p.signedAt && (
                <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#3b8273] mt-5 pt-4 border-t border-[#f0ede6]">
                  Signed by you on {p.signedAt}
                </p>
              )}
            </Link>
          )
        })}
      </section>
    </div>
  )
}
