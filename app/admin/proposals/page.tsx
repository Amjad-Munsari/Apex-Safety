import { adminClient } from "@/lib/supabase/admin"
import { calculateProposalTotal } from "@/lib/supabase/dashboard"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { ProposalCard } from "./proposal-card"

type ProposalStatus = "Draft" | "Sent" | "Signed" | "Contract Issued"

export const dynamic = "force-dynamic"

export default async function ProposalsPage() {
  const { data: proposals } = await adminClient
    .from("proposals")
    .select(`
      *,
      client:clients(name)
    `)
    .order("created_at", { ascending: false })

  const items = proposals || []

  // Pre-sign every PDF URL in one batch so the cards stay synchronous below.
  const signedUrls = new Map<string, string>()
  const pathsToSign = items
    .map(p => p.proposal_pdf_path)
    .filter((p): p is string => Boolean(p))

  if (pathsToSign.length > 0) {
    const { data: signed, error: signError } = await adminClient.storage
      .from("proposals")
      .createSignedUrls(pathsToSign, 60 * 60)
    if (signError) {
      console.error("Failed to sign proposal PDF URLs:", signError)
    } else if (signed) {
      for (const entry of signed) {
        if (entry.path && entry.signedUrl) signedUrls.set(entry.path, entry.signedUrl)
      }
    }
  }

  return (
    <div className="flex flex-col gap-8 pt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* ─── HEADER ─── */}
      <div className="flex justify-between items-end">
        <div className="flex flex-col gap-2">
          <Link href="/admin" className="flex items-center gap-2 text-[#666] hover:text-white transition-colors mb-2">
            <ArrowLeft className="w-4 h-4" />
            <span className="font-mono text-xs uppercase tracking-widest">Back to Dashboard</span>
          </Link>
          <div className="flex items-center gap-3 font-mono text-xs tracking-widest text-[#666] uppercase">
            <span className="text-gold font-semibold">06</span>
            SALES PIPELINE
          </div>
          <h2 className="font-serif text-[34px] leading-tight text-white">
            Active Proposals
          </h2>
          <p className="text-[#666] text-sm font-sans tracking-wide max-w-xl">
            Track the status of sent proposals and signed contracts.
          </p>
        </div>
        
        <Link href="/admin/proposals/new">
          <Button className="bg-white hover:bg-white/90 text-black rounded-sm px-6 font-medium text-sm h-10 tracking-wide border-none flex gap-2">
            + New Proposal
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {['Draft', 'Sent', 'Signed', 'Contract Issued'].map((status) => {
          const filtered = items.filter(i => i.status === status)
          const totalValue = filtered.reduce((acc, curr) => acc + ((curr as { total_price?: number }).total_price || calculateProposalTotal(curr.services_json)), 0)

          return (
            <div key={status} className="flex flex-col gap-4">
              <div className="flex justify-between items-center px-1">
                <h3 className="font-mono text-[10px] uppercase tracking-widest text-[#555]">{status}</h3>
                <span className="font-mono text-[10px] text-white/20">{filtered.length}</span>
              </div>
              
              <div className="flex flex-col gap-4 min-h-[500px] p-2 rounded-sm bg-white/[0.02] border border-white/[0.05]">
                  {filtered.map((prop) => {
                    const total = (prop as { total_price?: number }).total_price || calculateProposalTotal(prop.services_json)
                    const documentUrl = prop.proposal_pdf_path
                      ? signedUrls.get(prop.proposal_pdf_path) ?? null
                      : null

                    // Contracts feature has no DB backing yet — drop the deep-link
                    // to /admin/contracts/yellow-broom (mocked). Code audit 2026-05-29.
                    const detailHref = `/admin/proposals/${prop.id}`

                    return (
                      <ProposalCard
                        key={prop.id}
                        id={prop.id}
                        clientName={(prop.client as { name?: string } | null)?.name || "Unknown client"}
                        total={total}
                        createdAt={prop.created_at}
                        status={status as ProposalStatus}
                        documentUrl={documentUrl}
                        detailHref={detailHref}
                      />
                    )
                  })}
                
                {filtered.length === 0 && (
                  <div className="flex-1 flex items-center justify-center border border-dashed border-white/[0.05] rounded-sm">
                    <span className="font-mono text-[9px] uppercase tracking-widest text-white/5">Empty</span>
                  </div>
                )}
              </div>

              <div className="px-1 pt-2 border-t border-white/5">
                <div className="font-mono text-[10px] text-[#444] uppercase tracking-widest">Total Value</div>
                <div className="font-serif text-xl text-white/40">£{totalValue.toLocaleString()}</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
