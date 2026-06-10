import { Skeleton } from "@/components/ui/skeleton"

export default function ClientDetailLoading() {
  return (
    <div className="flex flex-col gap-10 pt-12 pb-20 max-w-6xl mx-auto w-full">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3 w-24 bg-white/10" />
          <Skeleton className="h-9 w-64 bg-white/10" />
        </div>
        <Skeleton className="h-9 w-36 bg-white/10" />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-[#1c1c1c] border border-white/5 rounded-sm p-6 flex flex-col gap-3"
          >
            <Skeleton className="h-3 w-24 bg-white/10" />
            <Skeleton className="h-5 w-40 bg-white/10" />
          </div>
        ))}
      </div>

      {/* Tabs bar */}
      <div className="flex gap-2 border-b border-white/10 pb-0">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-8 w-24 bg-white/10 rounded-t-sm" />
        ))}
      </div>

      {/* Table skeleton */}
      <div className="flex flex-col gap-3">
        <Skeleton className="h-8 w-full bg-white/5 rounded-sm" />
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <Skeleton key={i} className="h-12 w-full bg-white/5 rounded-sm" />
        ))}
      </div>
    </div>
  )
}
