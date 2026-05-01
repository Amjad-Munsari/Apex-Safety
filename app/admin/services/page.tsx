import { adminClient } from "@/lib/supabase/admin"
import { Card } from "@/components/ui/card"
import Link from "next/link"
import { ArrowLeft, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ServiceDialog, Service } from "@/components/services/service-dialog"
import { ServiceActions } from "@/components/services/service-actions"

export const dynamic = "force-dynamic"

export default async function ServicesPage() {
  const { data: services } = await adminClient
    .from("services")
    .select("*")
    .is("deleted_at", null)
    .order("category", { ascending: true })
    .order("name", { ascending: true })

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
            <span className="text-white font-semibold">05</span>
            SERVICE CATALOG
          </div>
          <h2 className="font-serif text-[34px] leading-tight text-white">Services</h2>
          <p className="text-[#666] text-sm font-sans tracking-wide max-w-xl">
            Manage the list of available services, descriptions, and pricing used in proposals.
          </p>
        </div>
        
        <ServiceDialog>
          <Button className="bg-white hover:bg-white/90 text-black rounded-sm px-6 font-medium text-sm h-10 tracking-wide border-none flex gap-2">
            <Plus className="w-4 h-4" /> Add Service
          </Button>
        </ServiceDialog>
      </div>

      {/* ─── TABLE ─── */}
      <Card className="bg-[#1c1c1c] border-white/5 rounded-sm overflow-hidden">
        <table className="w-full text-left font-sans text-sm">
          <thead className="bg-[#151515]">
            <tr className="text-[10px] font-mono tracking-widest uppercase text-[#555]">
              <th className="font-normal px-6 py-4 border-b border-white/5">Name</th>
              <th className="font-normal px-4 py-4 border-b border-white/5">Category</th>
              <th className="font-normal px-4 py-4 border-b border-white/5 text-right">Price</th>
              <th className="font-normal px-4 py-4 border-b border-white/5 text-center">Status</th>
              <th className="font-normal px-6 py-4 border-b border-white/5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {services?.map((service: Service) => (
              <tr key={service.id} className="group hover:bg-white/[0.02] transition-colors relative">
                <td className="px-6 py-4">
                  <div className="font-medium text-white mb-0.5">{service.name}</div>
                  <div className="text-xs text-white/40 line-clamp-1">{service.description || "No description"}</div>
                </td>
                <td className="px-4 py-4 text-white/70">
                  {service.category || "—"}
                </td>
                <td className="px-4 py-4 font-mono text-xs text-white/90 text-right">
                  £{service.unit_price.toFixed(2)}
                </td>
                <td className="px-4 py-4 text-center">
                  <div className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider leading-none ${service.active ? 'text-success bg-success/10 border border-success/20' : 'text-[#666] bg-white/5 border border-white/10'}`}>
                    {service.active ? "Active" : "Inactive"}
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <ServiceActions service={service} />
                </td>
              </tr>
            ))}
            {(!services || services.length === 0) && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-white/20 font-mono text-xs uppercase tracking-widest">
                  No services found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
