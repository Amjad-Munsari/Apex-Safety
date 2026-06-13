import { Plus } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ContractorDialog } from "@/components/contractors/contractor-dialog"
import { ContractorActions } from "@/components/contractors/contractor-actions"
import { groupByCategory, type Contractor } from "@/lib/data/contractors"
import { fetchContractors } from "@/lib/data/contractors-server"

export const dynamic = "force-dynamic"

export default async function DirectoryPage() {
  const contractors = await fetchContractors()
  const grouped = groupByCategory(contractors)
  const activeCount = contractors.filter(c => c.active).length

  return (
    <div className="flex flex-col gap-8 pt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* ─── HEADER ─── */}
      <div className="flex justify-between items-end">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3 font-mono text-xs tracking-widest text-muted-foreground uppercase">
            <span className="text-teal font-semibold">09</span>
            CONTRACTOR DIRECTORY
          </div>
          <h2 className="font-serif text-[34px] leading-tight text-foreground">Contractor Directory</h2>
          <p className="text-muted-foreground text-sm font-sans tracking-wide max-w-xl">
            Approved contractors your clients can call on for remedial works. Active entries appear in the client portal directory.
          </p>
        </div>

        <ContractorDialog>
          <Button className="bg-gold text-gold-foreground hover:bg-gold/90 rounded-md px-4 font-medium text-sm h-9 tracking-wide flex gap-2">
            <Plus className="w-4 h-4" /> Add Contractor
          </Button>
        </ContractorDialog>
      </div>

      {/* ─── TABLE ─── */}
      <div className="flex flex-col gap-3">
        <span className="inline-flex items-center self-start px-2 py-0.5 rounded-sm bg-foreground/5 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          {activeCount} Active · {contractors.length} Total
        </span>
        <Card className="bg-card ring-1 ring-foreground/10 rounded-lg overflow-hidden p-0 gap-0">
        <table className="w-full text-left font-sans text-sm">
          <thead>
            <tr className="text-[10px] font-mono tracking-widest uppercase text-muted-foreground">
              <th className="font-normal px-6 h-10 border-b border-foreground/5">Company</th>
              <th className="font-normal px-4 h-10 border-b border-foreground/5 w-[200px]">Contact</th>
              <th className="font-normal px-4 h-10 border-b border-foreground/5 w-[140px]">Phone</th>
              <th className="font-normal px-4 h-10 border-b border-foreground/5 w-[160px]">Website</th>
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
                contractors={group.contractors}
              />
            ))}
            {grouped.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-6 py-12 text-center text-muted-foreground font-mono text-xs uppercase tracking-widest"
                >
                  No contractors yet — add your first approved contractor.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </Card>
      </div>
    </div>
  )
}

function CategoryGroup({
  title,
  contractors,
}: {
  title: string
  contractors: Contractor[]
}) {
  return (
    <>
      <tr className="bg-foreground/[0.02]">
        <td
          colSpan={5}
          className="px-6 py-3.5 font-mono uppercase tracking-widest text-muted-foreground border-b border-foreground/5"
        >
          <span className="text-sm font-semibold text-teal">{title}</span>
          <span className="ml-3 text-[10px] text-muted-foreground">{contractors.length} contractor{contractors.length !== 1 ? "s" : ""}</span>
        </td>
      </tr>
      {contractors.map(contractor => (
        <tr
          key={contractor.id}
          className="group hover:bg-foreground/[0.02] transition-colors border-b border-foreground/5 last:border-0"
        >
          <td className="px-6 py-3.5">
            <div className="font-medium text-foreground mb-0.5">{contractor.company_name}</div>
            {contractor.notes && (
              <div className="text-xs text-muted-foreground line-clamp-1">
                {contractor.notes}
              </div>
            )}
          </td>
          <td className="px-4 py-3.5">
            <div className="text-sm text-foreground">{contractor.contact_name}</div>
            <div className="text-xs text-muted-foreground">{contractor.email}</div>
          </td>
          <td className="px-4 py-3.5 font-mono text-xs text-muted-foreground">
            {contractor.phone}
          </td>
          <td className="px-4 py-3.5 text-xs">
            {contractor.website ? (
              <a
                href={contractor.website.startsWith("http") ? contractor.website : `https://${contractor.website}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-teal hover:underline truncate max-w-[140px] inline-block"
              >
                {contractor.website}
              </a>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </td>
          <td className="px-6 py-3.5">
            <ContractorActions contractor={contractor} />
          </td>
        </tr>
      ))}
    </>
  )
}
