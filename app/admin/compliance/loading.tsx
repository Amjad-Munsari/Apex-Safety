import { Skeleton } from "@/components/ui/skeleton"
import { Card } from "@/components/ui/card"

export default function Loading() {
  return (
    <div className="flex flex-col gap-8 pt-8">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3 w-40 bg-muted" />
          <Skeleton className="h-9 w-56 bg-muted" />
          <Skeleton className="h-4 w-72 bg-muted" />
        </div>
        <Skeleton className="h-10 w-36 bg-muted rounded-sm" />
      </div>

      {/* 3 stat cards */}
      <div className="grid grid-cols-3 gap-4">
        {["Current", "Expiring", "Expired"].map((label) => (
          <Card key={label} className="bg-card border-border rounded-sm p-6">
            <Skeleton className="h-3 w-24 bg-muted mb-3" />
            <Skeleton className="h-10 w-16 bg-muted mb-1" />
            <Skeleton className="h-3 w-20 bg-muted" />
          </Card>
        ))}
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-10 border-b border-border pb-3">
        {["All", "Current", "Expiring (30 days)", "Expired", "No Expiry Date"].map((tab) => (
          <Skeleton key={tab} className="h-3 w-16 bg-muted" />
        ))}
      </div>

      {/* Table */}
      <Card className="bg-card border-border rounded-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center gap-3">
          <Skeleton className="h-3 w-24 bg-muted" />
          <Skeleton className="h-3 w-12 bg-muted ml-auto" />
        </div>
        <table className="w-full">
          <thead className="bg-muted">
            <tr>
              {["Document", "Client", "Expiry Date", "Status", "Actions"].map((col) => (
                <th key={col} className="px-6 py-3 border-b border-border">
                  <Skeleton className="h-3 w-16 bg-muted" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {Array.from({ length: 6 }).map((_, i) => (
              <tr key={i}>
                <td className="px-6 py-4"><Skeleton className="h-4 w-40 bg-muted" /></td>
                <td className="px-4 py-4"><Skeleton className="h-4 w-28 bg-muted" /></td>
                <td className="px-4 py-4"><Skeleton className="h-4 w-24 bg-muted" /></td>
                <td className="px-4 py-4"><Skeleton className="h-5 w-20 bg-muted rounded-full" /></td>
                <td className="px-4 py-4 text-right"><Skeleton className="h-8 w-20 bg-muted ml-auto rounded-sm" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
