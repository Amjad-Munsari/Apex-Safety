import { Skeleton } from "@/components/ui/skeleton"
import { Card } from "@/components/ui/card"

export default function Loading() {
  return (
    <div className="flex flex-col gap-8 pt-8">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3 w-32 bg-muted" />
          <Skeleton className="h-9 w-56 bg-muted" />
        </div>
        <Skeleton className="h-10 w-36 bg-muted rounded-sm" />
      </div>

      {/* Card grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="bg-card border-border rounded-sm p-6 flex flex-col gap-4">
            <div className="flex items-start justify-between">
              <div className="flex flex-col gap-2">
                <Skeleton className="h-5 w-40 bg-muted" />
                <Skeleton className="h-3 w-24 bg-muted" />
              </div>
              <Skeleton className="h-5 w-16 bg-muted rounded-full" />
            </div>
            <div className="flex flex-col gap-2 mt-auto">
              <Skeleton className="h-3 w-32 bg-muted" />
              <Skeleton className="h-3 w-24 bg-muted" />
            </div>
            <div className="flex gap-2 pt-2 border-t border-border">
              <Skeleton className="h-8 flex-1 bg-muted rounded-sm" />
              <Skeleton className="h-8 w-20 bg-muted rounded-sm" />
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
