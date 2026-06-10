import { Skeleton } from "@/components/ui/skeleton"
import { Card } from "@/components/ui/card"

export default function Loading() {
  return (
    <div className="flex flex-col gap-8 pt-8">
      {/* Title block */}
      <div className="flex flex-col gap-3">
        <Skeleton className="h-3 w-40 bg-white/5" />
        <Skeleton className="h-9 w-64 bg-white/5" />
        <Skeleton className="h-4 w-48 bg-white/5" />
      </div>

      {/* Form skeleton — title + field blocks */}
      <Card className="bg-[#1c1c1c] border-white/5 rounded-sm p-6 flex flex-col gap-6">
        {/* Section heading */}
        <Skeleton className="h-5 w-48 bg-white/5" />

        {/* Field blocks */}
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-2">
            <Skeleton className="h-3 w-32 bg-white/5" />
            <Skeleton className="h-10 w-full bg-white/5 rounded-sm" />
          </div>
        ))}
      </Card>

      <Card className="bg-[#1c1c1c] border-white/5 rounded-sm p-6 flex flex-col gap-6">
        <Skeleton className="h-5 w-40 bg-white/5" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-2">
            <Skeleton className="h-3 w-28 bg-white/5" />
            <Skeleton className="h-16 w-full bg-white/5 rounded-sm" />
          </div>
        ))}
      </Card>

      {/* Action bar */}
      <div className="flex justify-end gap-3">
        <Skeleton className="h-10 w-28 bg-white/5 rounded-sm" />
        <Skeleton className="h-10 w-36 bg-white/5 rounded-sm" />
      </div>
    </div>
  )
}
