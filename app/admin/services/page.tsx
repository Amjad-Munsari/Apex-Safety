import { Plus } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ServiceDialog } from "@/components/services/service-dialog"
import { ServiceActions } from "@/components/services/service-actions"
import { groupByCategory, type Service } from "@/lib/data/services"
import { fetchServices } from "@/lib/data/services-server"

export const dynamic = "force-dynamic"

function formatPrice(amount: number | null): string {
  if (amount === null) return "—"
  if (amount % 1 !== 0) {
    return `£${amount.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }
  return `£${amount.toLocaleString("en-GB")}`
}

export default async function ServicesPage() {
  const services = await fetchServices()
  const grouped = groupByCategory(services)
  const activeCount = services.filter(s => s.active).length

  return (
    <div className="flex flex-col gap-8 pt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* ─── HEADER ─── */}
      <div className="flex justify-between items-end">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3 font-mono text-xs tracking-widest text-muted-foreground uppercase">
            <span className="text-teal font-semibold">08</span>
            SERVICE CATALOG
          </div>
          <h2 className="font-serif text-[34px] leading-tight text-foreground">Services</h2>
          <p className="text-muted-foreground text-sm font-sans tracking-wide max-w-xl">
            Manage the list of available services, descriptions, and pricing used in proposals.
          </p>
        </div>

        <ServiceDialog>
          <Button className="bg-gold text-gold-foreground hover:bg-gold/90 rounded-md px-4 font-medium text-sm h-9 tracking-wide flex gap-2">
            <Plus className="w-4 h-4" /> Add Service
          </Button>
        </ServiceDialog>
      </div>

      {/* ─── TABLE ─── */}
      <Card className="bg-card ring-1 ring-foreground/10 rounded-lg overflow-hidden p-0 gap-0">
        <div className="flex items-center justify-between px-6 py-4 border-b border-foreground/5">
          <div className="flex items-center gap-3">
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Catalog
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-sm bg-foreground/5 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              {activeCount} Active · {services.length} Total
            </span>
          </div>
        </div>

        <table className="w-full text-left font-sans text-sm">
          <thead>
            <tr className="text-[10px] font-mono tracking-widest uppercase text-muted-foreground">
              <th className="font-normal px-6 h-10 border-b border-foreground/5">Name</th>
              <th className="font-normal px-4 h-10 border-b border-foreground/5 w-[160px]">Unit</th>
              <th className="font-normal px-4 h-10 border-b border-foreground/5 w-[140px] text-right">
                Price
              </th>
              <th className="font-normal px-6 h-10 border-b border-foreground/5 w-[200px] text-right">
                Status / Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {grouped.map(group => (
              <CategoryGroup
                key={group.title}
                title={group.title}
                services={group.services}
              />
            ))}
            {grouped.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="px-6 py-12 text-center text-muted-foreground font-mono text-xs uppercase tracking-widest"
                >
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

function CategoryGroup({
  title,
  services,
}: {
  title: string
  services: Service[]
}) {
  return (
    <>
      <tr className="bg-foreground/[0.02]">
        <td
          colSpan={4}
          className="px-6 py-3.5 font-mono uppercase tracking-widest text-muted-foreground border-b border-foreground/5"
        >
          <span className="text-sm font-semibold text-teal">{title}</span>
          <span className="ml-3 text-[10px] text-muted-foreground">{services.length} services</span>
        </td>
      </tr>
      {services.map(service => (
        <tr
          key={service.id}
          className="group hover:bg-foreground/[0.02] transition-colors border-b border-foreground/5 last:border-0"
        >
          <td className="px-6 py-3.5">
            <div className="font-medium text-foreground mb-0.5">{service.name}</div>
            <div className="text-xs text-muted-foreground line-clamp-1">
              {service.description || "No description"}
            </div>
          </td>
          <td className="px-4 py-3.5 text-muted-foreground text-xs font-mono">
            / {service.unit}
          </td>
          <td className="px-4 py-3.5 font-mono text-xs text-foreground text-right">
            {formatPrice(service.unit_price)}
          </td>
          <td className="px-6 py-3.5">
            <ServiceActions service={service} />
          </td>
        </tr>
      ))}
    </>
  )
}
