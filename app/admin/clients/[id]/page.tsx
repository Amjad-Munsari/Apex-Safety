import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import { UploadDocumentModal } from "./upload-document-modal"
import { Card } from "@/components/ui/card"
import { FileText, Calendar, Building, Clock, MapPin } from "lucide-react"

export default async function ClientDetailsPage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  // Fetch client details
  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select("*")
    .eq("id", id)
    .single()

  if (clientError || !client) {
    notFound()
  }

  // Fetch documents for this client
  const { data: documents } = await supabase
    .from("documents")
    .select("*")
    .eq("client_id", id)
    .order("uploaded_at", { ascending: false })

  return (
    <div className="flex flex-col gap-10 pb-20 max-w-6xl mx-auto w-full">
      
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

      {/* ─── CLIENT INFO CARDS ─── */}
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
            <div className="flex items-center gap-2 text-[#888] font-mono text-[10px] uppercase tracking-widest mb-2">
              <Clock className="w-3 h-3" /> Retained Hours
            </div>
            <div className="text-white font-serif text-3xl">
              {client.hours_balance} <span className="text-sm font-sans text-white/40">hrs</span>
            </div>
         </Card>

         <Card className="bg-[#1c1c1c] border-white/5 rounded-sm p-6 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-[#888] font-mono text-[10px] uppercase tracking-widest mb-2">
              <Calendar className="w-3 h-3" /> Client Since
            </div>
            <div className="text-white/90 text-sm leading-relaxed">
              {new Date(client.created_at).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
            </div>
         </Card>
      </div>

      {/* ─── DOCUMENTS TABLE ─── */}
      <Card className="bg-[#1c1c1c] border-white/5 rounded-sm overflow-hidden flex flex-col">
        <div className="px-6 py-4 flex justify-between items-center border-b border-white/5 shrink-0">
          <div className="flex items-center gap-3">
            <FileText className="w-4 h-4 text-white/40" />
            <h3 className="font-sans font-medium text-white tracking-wide text-lg">Documents</h3>
            <span className="px-2.5 py-1 bg-white/5 border border-white/10 rounded-full text-[9px] font-mono uppercase tracking-widest text-white/50 ml-3 leading-none">
              {documents?.length || 0} Files
            </span>
          </div>
        </div>
        
        <div className="w-full overflow-x-auto">
           {(!documents || documents.length === 0) ? (
             <div className="p-10 text-center flex flex-col items-center justify-center">
               <FileText className="w-8 h-8 text-white/20 mb-3" />
               <p className="text-white/50 text-sm">No documents uploaded yet.</p>
             </div>
           ) : (
             <table className="w-full text-left font-sans text-sm">
               <thead className="bg-[#151515]">
                 <tr className="text-[10px] font-mono tracking-widest uppercase text-[#555]">
                   <th className="font-normal px-6 py-3 border-b border-white/5">Filename</th>
                   <th className="font-normal px-4 py-3 border-b border-white/5">Category</th>
                   <th className="font-normal px-4 py-3 border-b border-white/5">Expiry Date</th>
                   <th className="font-normal px-6 py-3 border-b border-white/5 text-right">Uploaded</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-white/5">
                 {documents.map((doc) => {
                   
                   // Basic Expiry Logic
                   let isExpiring = false;
                   let isExpired = false;
                   
                   if (doc.expiry_date) {
                     const expiry = new Date(doc.expiry_date)
                     const now = new Date()
                     const diffDays = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
                     
                     if (diffDays < 0) isExpired = true
                     else if (diffDays <= 30) isExpiring = true
                   }

                   return (
                     <tr key={doc.id} className="group hover:bg-white/[0.02] transition-colors">
                       <td className="px-6 py-4">
                         <div className="font-medium text-white mb-0.5">{doc.filename}</div>
                       </td>
                       <td className="px-4 py-4 text-white/70">
                         {doc.document_category}
                       </td>
                       <td className="px-4 py-4">
                         {doc.expiry_date ? (
                           <div className="flex items-center gap-2">
                             <div className="text-white text-sm">
                               {new Date(doc.expiry_date).toLocaleDateString('en-GB')}
                             </div>
                             {isExpired && <div className="px-2 py-0.5 bg-danger/10 border border-danger/30 text-danger text-[9px] font-mono uppercase tracking-widest rounded leading-none">Expired</div>}
                             {isExpiring && <div className="px-2 py-0.5 bg-gold/10 border border-gold/30 text-gold text-[9px] font-mono uppercase tracking-widest rounded leading-none">Soon</div>}
                           </div>
                         ) : (
                           <span className="text-white/30">—</span>
                         )}
                       </td>
                       <td className="px-6 py-4 font-mono text-xs text-right text-white/50">
                          {new Date(doc.uploaded_at).toLocaleDateString('en-GB')}
                       </td>
                     </tr>
                   )
                 })}
               </tbody>
             </table>
           )}
        </div>
      </Card>

    </div>
  )
}
