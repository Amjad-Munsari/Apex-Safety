import { Skeleton } from "@/components/ui/skeleton"
import { Card } from "@/components/ui/card"

export default function Loading() {
  return (
    <div className="flex flex-col gap-8 pt-8">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3 w-36 bg-muted" />
          <Skeleton className="h-9 w-48 bg-muted" />
          <Skeleton className="h-4 w-64 bg-muted" />
        </div>
        <Skeleton className="h-10 w-32 bg-muted rounded-sm" />
      </div>

      {/* Table */}
      <Card className="bg-card border-border rounded-sm overflow-hidden">
        <table className="w-full text-left font-sans text-sm">
          <thead className="bg-muted">
            <tr>
              {["Client", "RAG", "Hours", "Next Expiry", "Proposal", "Docs"].map((col) => (
                <th key={col} className="font-normal px-6 py-4 border-b border-border">
                  <Skeleton className="h-3 w-16 bg-muted" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {Array.from({ length: 8 }).map((_, i) => (
              <tr key={i}>
                <td className="px-6 py-4"><Skeleton className="h-4 w-36 bg-muted" /></td>
                <td className="px-4 py-4"><Skeleton className="h-5 w-16 bg-muted rounded-full" /></td>
                <td className="px-4 py-4 text-right"><Skeleton className="h-4 w-12 bg-muted ml-auto" /></td>
                <td className="px-4 py-4"><Skeleton className="h-4 w-28 bg-muted" /></td>
                <td className="px-4 py-4"><Skeleton className="h-4 w-20 bg-muted" /></td>
                <td className="px-4 py-4 text-right"><Skeleton className="h-4 w-8 bg-muted ml-auto" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
