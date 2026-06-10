import { Skeleton } from "@/components/ui/skeleton"
import { Card } from "@/components/ui/card"

export default function Loading() {
  return (
    <div className="flex flex-col gap-8 pt-8">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3 w-36 bg-white/5" />
          <Skeleton className="h-9 w-48 bg-white/5" />
          <Skeleton className="h-4 w-64 bg-white/5" />
        </div>
        <Skeleton className="h-10 w-32 bg-white/5 rounded-sm" />
      </div>

      {/* Table */}
      <Card className="bg-[#1c1c1c] border-white/5 rounded-sm overflow-hidden">
        <table className="w-full text-left font-sans text-sm">
          <thead className="bg-[#151515]">
            <tr>
              {["Client", "RAG", "Hours", "Next Expiry", "Proposal", "Docs"].map((col) => (
                <th key={col} className="font-normal px-6 py-4 border-b border-white/5">
                  <Skeleton className="h-3 w-16 bg-white/5" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {Array.from({ length: 8 }).map((_, i) => (
              <tr key={i}>
                <td className="px-6 py-4"><Skeleton className="h-4 w-36 bg-white/5" /></td>
                <td className="px-4 py-4"><Skeleton className="h-5 w-16 bg-white/5 rounded-full" /></td>
                <td className="px-4 py-4 text-right"><Skeleton className="h-4 w-12 bg-white/5 ml-auto" /></td>
                <td className="px-4 py-4"><Skeleton className="h-4 w-28 bg-white/5" /></td>
                <td className="px-4 py-4"><Skeleton className="h-4 w-20 bg-white/5" /></td>
                <td className="px-4 py-4 text-right"><Skeleton className="h-4 w-8 bg-white/5 ml-auto" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
