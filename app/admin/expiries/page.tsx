import { getUpcomingExpiries } from "@/lib/supabase/dashboard"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { FileText, Building2 } from "lucide-react"
import { RemindButton } from "./remind-button"
import {
  daysUntilExpiry,
  todayIsoInTimeZone,
} from "@/lib/compliance/expiry-status"

export const dynamic = "force-dynamic"

export default async function ExpiriesPage() {
  const expiries = await getUpcomingExpiries()
  const todayIso = todayIsoInTimeZone()

  return (
    <div className="flex flex-col gap-8 pt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* ─── HEADER ─── */}
      <div className="flex justify-between items-end">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3 font-mono text-xs tracking-widest text-muted-foreground uppercase">
            <span className="text-gold font-semibold">02</span>
            COMPLIANCE MONITORING
          </div>
          <h2 className="font-serif text-[34px] leading-tight text-foreground">
            Upcoming Expiries
          </h2>
          <p className="text-muted-foreground text-sm font-sans tracking-wide max-w-xl">
            A comprehensive view of all client documents expiring in the next 30 days.
          </p>
        </div>
      </div>

      <Card className="bg-card border-border rounded-sm overflow-hidden">
        <table className="w-full text-left font-sans text-sm">
          <thead className="bg-muted">
            <tr className="text-[10px] font-mono tracking-widest uppercase text-muted-foreground">
              <th className="font-normal px-6 py-4 border-b border-border">Document</th>
              <th className="font-normal px-6 py-4 border-b border-border">Client</th>
              <th className="font-normal px-6 py-4 border-b border-border">Expiry Date</th>
              <th className="font-normal px-6 py-4 border-b border-border">Status</th>
              <th className="font-normal px-6 py-4 border-b border-border text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {expiries.map((doc) => {
              const daysLeft = daysUntilExpiry(
                doc.expiry_date as string,
                todayIso
              )
              return (
                <tr key={doc.id} className="group hover:bg-muted transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <FileText className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <div className="font-medium text-foreground">{doc.filename}</div>
                        <div className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest">{doc.document_category}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-foreground/70">
                      <Building2 className="w-3.5 h-3.5" />
                      {(doc.client as { name?: string } | null)?.name}
                    </div>
                  </td>
                  <td className="px-6 py-4 font-mono text-muted-foreground">
                    {new Date(doc.expiry_date || "").toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-6 py-4">
                    {daysLeft <= 0 ? (
                      <Badge variant="outline" className="border-danger/40 text-danger bg-danger/5 font-mono text-[10px] uppercase tracking-widest gap-2">
                        <div className="w-1 h-1 rounded-full bg-danger animate-pulse" />
                        OVERDUE
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-gold/40 text-gold bg-gold/5 font-mono text-[10px] uppercase tracking-widest">
                        {daysLeft} days left
                      </Badge>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <RemindButton docId={doc.id} clientName={(doc.client as { name?: string } | null)?.name || "client"} />
                  </td>
                </tr>
              )
            })}
            {expiries.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground font-mono text-xs uppercase tracking-widest">
                  No expiring documents found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
