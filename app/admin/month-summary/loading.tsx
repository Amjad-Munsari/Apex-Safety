import { Skeleton } from "@/components/ui/skeleton"
import { Card } from "@/components/ui/card"

export default function Loading() {
  return (
    <div className="flex flex-col gap-8 pt-8">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3 w-36 bg-muted" />
        <Skeleton className="h-9 w-52 bg-muted" />
        <Skeleton className="h-4 w-56 bg-muted" />
      </div>

      {/* 4 stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {["01", "02", "03", "04"].map((num) => (
          <Card key={num} className="bg-card border-border rounded-sm p-6">
            <Skeleton className="h-3 w-28 bg-muted mb-3" />
            <Skeleton className="h-12 w-16 bg-muted mb-1" />
            <Skeleton className="h-3 w-20 bg-muted" />
          </Card>
        ))}
      </div>

      {/* Workflow errors table */}
      <Card className="bg-card border-border rounded-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center gap-3">
          <Skeleton className="h-3 w-32 bg-muted" />
          <Skeleton className="h-3 w-8 bg-muted ml-auto" />
        </div>
        <div className="divide-y divide-border">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="px-6 py-4 flex items-center gap-4">
              <Skeleton className="h-4 w-40 bg-muted" />
              <Skeleton className="h-4 w-32 bg-muted" />
              <Skeleton className="h-4 w-24 bg-muted ml-auto" />
            </div>
          ))}
        </div>
      </Card>

      {/* Recent assessments table */}
      <Card className="bg-card border-border rounded-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center gap-3">
          <Skeleton className="h-3 w-44 bg-muted" />
          <Skeleton className="h-3 w-12 bg-muted ml-auto" />
        </div>
        <table className="w-full">
          <thead className="bg-muted">
            <tr>
              {["Client", "Template", "Date", "Status"].map((col) => (
                <th key={col} className="px-6 py-3 border-b border-border">
                  <Skeleton className="h-3 w-16 bg-muted" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {Array.from({ length: 5 }).map((_, i) => (
              <tr key={i}>
                <td className="px-6 py-4"><Skeleton className="h-4 w-32 bg-muted" /></td>
                <td className="px-4 py-4"><Skeleton className="h-4 w-40 bg-muted" /></td>
                <td className="px-4 py-4"><Skeleton className="h-4 w-20 bg-muted" /></td>
                <td className="px-4 py-4"><Skeleton className="h-4 w-24 bg-muted" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
