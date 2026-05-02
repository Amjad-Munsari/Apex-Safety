import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import { UploadDocumentModal } from "./upload-document-modal"
import { Card } from "@/components/ui/card"
import { Building, Calendar, Clock, MapPin } from "lucide-react"
import { AdjustHoursDialog } from "@/components/clients/adjust-hours-dialog"
import { ClientTabs } from "./client-tabs"
import { calculateProposalTotal } from "@/lib/supabase/dashboard"

export default async function ClientDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select("*")
    .eq("id", id)
    .single()

  if (clientError || !client) {
    notFound()
  }

  const { data: documents } = await supabase
    .from("documents")
    .select("*")
    .eq("client_id", id)
    .order("uploaded_at", { ascending: false })

  const { data: proposalRows } = await supabase
    .from("proposals")
    .select("*")
    .eq("client_id", id)
    .order("created_at", { ascending: false })

  const proposals = (proposalRows ?? []).map((p) => ({
    id: p.id,
    status: p.status,
    created_at: p.created_at,
    total: (p as any).total_price || calculateProposalTotal(p.services_json),
    pdfUrl: p.proposal_pdf_path
      ? (supabase as any).storage.from("proposals").getPublicUrl(p.proposal_pdf_path).data.publicUrl
      : null,
  }))

  return (
    <div className="flex flex-col gap-10 pt-8 pb-20 max-w-6xl mx-auto w-full">
      {/* ─── HEADER ─── */}
      <div className="flex justify-between items-end">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3 font-mono text-xs tracking-widest text-[#666] uppercase">
            <Building className="w-3.5 h-3.5" />
            Client Record
          </div>
          <h2 className="font-serif text-[32px] md:text-[34px] leading-tight text-white whitespace-nowrap">
            {client.name}
          </h2>
        </div>

        <div className="flex gap-4 items-center">
          <UploadDocumentModal clientId={client.id} />
        </div>
      </div>

      {/* ─── SUMMARY CARDS ─── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-[#1c1c1c] border-white/5 rounded-sm p-6 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-[#888] font-mono text-[10px] uppercase tracking-widest mb-2">
            <MapPin className="w-3 h-3" /> Site Address
          </div>
          <div className="text-white/90 text-sm leading-relaxed">
            {client.site_address || "No primary address registered."}
          </div>
        </Card>

        <Card className="bg-[#1c1c1c] border-white/5 rounded-sm p-6 flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2 text-[#888] font-mono text-[10px] uppercase tracking-widest mb-2">
            <div className="flex items-center gap-2">
              <Clock className="w-3 h-3" /> Retained Hours
            </div>
            <AdjustHoursDialog clientId={client.id} currentBalance={client.hours_balance || 0} />
          </div>
          <div className="text-white font-serif text-3xl">
            {client.hours_balance || 0}{" "}
            <span className="text-sm font-sans text-white/40">hrs</span>
          </div>
        </Card>

        <Card className="bg-[#1c1c1c] border-white/5 rounded-sm p-6 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-[#888] font-mono text-[10px] uppercase tracking-widest mb-2">
            <Calendar className="w-3 h-3" /> Client Since
          </div>
          <div className="text-white/90 text-sm leading-relaxed">
            {new Date(client.created_at).toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
          </div>
        </Card>
      </div>

      <ClientTabs
        clientId={client.id}
        clientName={client.name}
        hoursBalance={client.hours_balance || 0}
        documents={documents ?? []}
        proposals={proposals}
      />
    </div>
  )
}
