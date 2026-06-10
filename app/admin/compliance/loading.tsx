import { Skeleton } from "@/components/ui/skeleton"
import { Card } from "@/components/ui/card"

export default function Loading() {
  return (
    <div className="flex flex-col gap-8 pt-8">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3 w-40 bg-white/5" />
          <Skeleton className="h-9 w-56 bg-white/5" />
          <Skeleton className="h-4 w-72 bg-white/5" />
        </div>
        <Skeleton className="h-10 w-36 bg-white/5 rounded-sm" />
      </div>

      {/* 3 stat cards */}
      <div className="grid grid-cols-3 gap-4">
        {["Current", "Expiring", "Expired"].map((label) => (
          <Card key={label} className="bg-[#1c1c1c] border-white/5 rounded-sm p-6">
            <Skeleton className="h-3 w-24 bg-white/5 mb-3" />
            <Skeleton className="h-10 w-16 bg-white/5 mb-1" />
            <Skeleton className="h-3 w-20 bg-white/5" />
          </Card>
        ))}
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-10 border-b border-white/5 pb-3">
        {["All", "Current", "Expiring (30 days)", "Expired", "No Expiry Date"].map((tab) => (
          <Skeleton key={tab} className="h-3 w-16 bg-white/5" />
        ))}
      </div>

      {/* Table */}
      <Card className="bg-[#1c1c1c] border-white/5 rounded-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-white/5 flex items-center gap-3">
          <Skeleton className="h-3 w-24 bg-white/5" />
          <Skeleton className="h-3 w-12 bg-white/5 ml-auto" />
        </div>
        <table className="w-full">
          <thead className="bg-[#151515]">
            <tr>
              {["Document", "Client", "Expiry Date", "Status", "Actions"].map((col) => (
                <th key={col} className="px-6 py-3 border-b border-white/5">
                  <Skeleton className="h-3 w-16 bg-white/5" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {Array.from({ length: 6 }).map((_, i) => (
              <tr key={i}>
                <td className="px-6 py-4"><Skeleton className="h-4 w-40 bg-white/5" /></td>
                <td className="px-4 py-4"><Skeleton className="h-4 w-28 bg-white/5" /></td>
                <td className="px-4 py-4"><Skeleton className="h-4 w-24 bg-white/5" /></td>
                <td className="px-4 py-4"><Skeleton className="h-5 w-20 bg-white/5 rounded-full" /></td>
                <td className="px-4 py-4 text-right"><Skeleton className="h-8 w-20 bg-white/5 ml-auto rounded-sm" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
