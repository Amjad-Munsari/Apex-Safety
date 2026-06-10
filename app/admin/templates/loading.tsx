import { Skeleton } from "@/components/ui/skeleton"
import { Card } from "@/components/ui/card"

export default function Loading() {
  return (
    <div className="flex flex-col gap-8 pt-8">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3 w-32 bg-white/5" />
          <Skeleton className="h-9 w-56 bg-white/5" />
        </div>
        <Skeleton className="h-10 w-36 bg-white/5 rounded-sm" />
      </div>

      {/* Card grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="bg-[#1c1c1c] border-white/5 rounded-sm p-6 flex flex-col gap-4">
            <div className="flex items-start justify-between">
              <div className="flex flex-col gap-2">
                <Skeleton className="h-5 w-40 bg-white/5" />
                <Skeleton className="h-3 w-24 bg-white/5" />
              </div>
              <Skeleton className="h-5 w-16 bg-white/5 rounded-full" />
            </div>
            <div className="flex flex-col gap-2 mt-auto">
              <Skeleton className="h-3 w-32 bg-white/5" />
              <Skeleton className="h-3 w-24 bg-white/5" />
            </div>
            <div className="flex gap-2 pt-2 border-t border-white/5">
              <Skeleton className="h-8 flex-1 bg-white/5 rounded-sm" />
              <Skeleton className="h-8 w-20 bg-white/5 rounded-sm" />
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
