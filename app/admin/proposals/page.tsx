import { adminClient } from "@/lib/supabase/admin"
import { calculateProposalTotal } from "@/lib/supabase/dashboard"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ArrowLeft, FileSignature, Send, CheckCircle2, Search } from "lucide-react"

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
          const totalValue = filtered.reduce((acc, curr) => acc + ((curr as any).total_price || calculateProposalTotal(curr.services_json)), 0)

          return (
            <div key={status} className="flex flex-col gap-4">
              <div className="flex justify-between items-center px-1">
                <h3 className="font-mono text-[10px] uppercase tracking-widest text-[#555]">{status}</h3>
                <span className="font-mono text-[10px] text-white/20">{filtered.length}</span>
              </div>
              
              <div className="flex flex-col gap-4 min-h-[500px] p-2 rounded-sm bg-white/[0.02] border border-white/[0.05]">
                  {filtered.map((prop) => {
                    const total = (prop as any).total_price || calculateProposalTotal(prop.services_json)
                    const documentUrl = prop.proposal_pdf_path ? adminClient.storage.from('proposals').getPublicUrl(prop.proposal_pdf_path).data.publicUrl : null

                    return (
                      <Card key={prop.id} className="bg-[#1c1c1c] border-white/5 p-4 rounded-sm hover:border-white/20 transition-all group relative">
                        <div className="font-medium text-white mb-1 group-hover:text-gold transition-colors">{(prop.client as any)?.name}</div>
                        <div className="font-serif text-lg text-white/90 mb-3">£{total.toLocaleString()}</div>
                        
                        <div className="flex justify-between items-center">
                          <div className="font-mono text-[9px] uppercase tracking-widest text-[#555]">
                            {new Date(prop.created_at).toLocaleDateString('en-GB')}
                          </div>
                          <div className="flex items-center gap-3">
                            {documentUrl && (
                              <a 
                                href={documentUrl} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-white/40 hover:text-white transition-colors p-1"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <FileSignature className="w-3.5 h-3.5" />
                              </a>
                            )}
                            <div className="text-white/20">
                              {status === 'Draft' && !documentUrl && <FileSignature className="w-3.5 h-3.5" />}
                              {status === 'Sent' && <Send className="w-3.5 h-3.5" />}
                              {status === 'Signed' && <CheckCircle2 className="w-3.5 h-3.5" />}
                              {status === 'Contract Issued' && <Search className="w-3.5 h-3.5" />}
                            </div>
                          </div>
                        </div>
                      </Card>
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
