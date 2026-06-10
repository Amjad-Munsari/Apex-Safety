import { Skeleton } from "@/components/ui/skeleton"
import { Card } from "@/components/ui/card"

export default function Loading() {
  return (
    <div className="flex flex-col gap-8 pt-8">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3 w-36 bg-white/5" />
        <Skeleton className="h-9 w-52 bg-white/5" />
        <Skeleton className="h-4 w-56 bg-white/5" />
      </div>

      {/* 4 stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {["01", "02", "03", "04"].map((num) => (
          <Card key={num} className="bg-[#1c1c1c] border-white/5 rounded-sm p-6">
            <Skeleton className="h-3 w-28 bg-white/5 mb-3" />
            <Skeleton className="h-12 w-16 bg-white/5 mb-1" />
            <Skeleton className="h-3 w-20 bg-white/5" />
          </Card>
        ))}
      </div>

      {/* Workflow errors table */}
      <Card className="bg-[#1c1c1c] border-white/5 rounded-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-white/5 flex items-center gap-3">
          <Skeleton className="h-3 w-32 bg-white/5" />
          <Skeleton className="h-3 w-8 bg-white/5 ml-auto" />
        </div>
        <div className="divide-y divide-white/5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="px-6 py-4 flex items-center gap-4">
              <Skeleton className="h-4 w-40 bg-white/5" />
              <Skeleton className="h-4 w-32 bg-white/5" />
              <Skeleton className="h-4 w-24 bg-white/5 ml-auto" />
            </div>
          ))}
        </div>
      </Card>

      {/* Recent assessments table */}
      <Card className="bg-[#1c1c1c] border-white/5 rounded-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-white/5 flex items-center gap-3">
          <Skeleton className="h-3 w-44 bg-white/5" />
          <Skeleton className="h-3 w-12 bg-white/5 ml-auto" />
        </div>
        <table className="w-full">
          <thead className="bg-[#151515]">
            <tr>
              {["Client", "Template", "Date", "Status"].map((col) => (
                <th key={col} className="px-6 py-3 border-b border-white/5">
                  <Skeleton className="h-3 w-16 bg-white/5" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {Array.from({ length: 5 }).map((_, i) => (
              <tr key={i}>
                <td className="px-6 py-4"><Skeleton className="h-4 w-32 bg-white/5" /></td>
                <td className="px-4 py-4"><Skeleton className="h-4 w-40 bg-white/5" /></td>
                <td className="px-4 py-4"><Skeleton className="h-4 w-20 bg-white/5" /></td>
                <td className="px-4 py-4"><Skeleton className="h-4 w-24 bg-white/5" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
