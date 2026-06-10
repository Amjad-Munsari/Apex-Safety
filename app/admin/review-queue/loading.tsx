import { Skeleton } from "@/components/ui/skeleton"
import { Card } from "@/components/ui/card"

export default function Loading() {
  return (
    <div className="flex flex-col gap-8 pt-8">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3 w-36 bg-white/5" />
          <Skeleton className="h-9 w-60 bg-white/5" />
          <Skeleton className="h-4 w-72 bg-white/5" />
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-6 border-b border-white/5 pb-3">
        <Skeleton className="h-3 w-28 bg-white/5" />
        <Skeleton className="h-3 w-20 bg-white/5" />
      </div>

      {/* Card list */}
      <div className="grid grid-cols-1 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i} className="bg-[#1c1c1c] border-white/5 rounded-sm p-6">
            <div className="flex justify-between items-start">
              <div className="flex gap-6">
                <Skeleton className="w-12 h-12 bg-white/5 rounded-sm shrink-0" />
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-6 w-36 bg-white/5" />
                    <Skeleton className="h-5 w-28 bg-white/5 rounded-full" />
                  </div>
                  <Skeleton className="h-4 w-48 bg-white/5" />
                  <div className="flex gap-6">
                    <Skeleton className="h-3 w-32 bg-white/5" />
                    <Skeleton className="h-3 w-32 bg-white/5" />
                  </div>
                </div>
              </div>
              <Skeleton className="h-10 w-32 bg-white/5 rounded-sm shrink-0" />
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
