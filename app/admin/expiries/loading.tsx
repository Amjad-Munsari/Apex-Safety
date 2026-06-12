import { Skeleton } from "@/components/ui/skeleton"
import { Card } from "@/components/ui/card"

export default function Loading() {
  return (
    <div className="flex flex-col gap-8 pt-8">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3 w-40 bg-muted" />
          <Skeleton className="h-9 w-52 bg-muted" />
          <Skeleton className="h-4 w-80 bg-muted" />
        </div>
      </div>

      {/* Table */}
      <Card className="bg-card border-border rounded-sm overflow-hidden">
        <table className="w-full text-left font-sans text-sm">
          <thead className="bg-muted">
            <tr>
              {["Document", "Client", "Expiry Date", "Status", "Action"].map((col) => (
                <th key={col} className="px-6 py-4 border-b border-border">
                  <Skeleton className="h-3 w-20 bg-muted" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {Array.from({ length: 8 }).map((_, i) => (
              <tr key={i}>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <Skeleton className="w-4 h-4 bg-muted shrink-0" />
                    <div className="flex flex-col gap-1">
                      <Skeleton className="h-4 w-36 bg-muted" />
                      <Skeleton className="h-3 w-24 bg-muted" />
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4"><Skeleton className="h-4 w-28 bg-muted" /></td>
                <td className="px-6 py-4"><Skeleton className="h-4 w-24 bg-muted" /></td>
                <td className="px-6 py-4"><Skeleton className="h-5 w-24 bg-muted rounded-full" /></td>
                <td className="px-6 py-4 text-right"><Skeleton className="h-8 w-24 bg-muted ml-auto rounded-sm" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
