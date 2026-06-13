import { Skeleton } from "@/components/ui/skeleton";

export default function AssessmentsLoading() {
  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="space-y-3">
        <Skeleton className="h-3 w-28 bg-muted" />
        <Skeleton className="h-9 w-48 bg-muted" />
        <Skeleton className="h-3 w-96 bg-muted" />
      </div>

      {/* Card list */}
      <div className="bg-card border border-border rounded-sm shadow-[0_1px_2px_rgba(0,0,0,0.02)] divide-y divide-border">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="px-6 py-5 flex items-center gap-4">
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-56 bg-muted" />
              <Skeleton className="h-3 w-32 bg-muted" />
            </div>
            <Skeleton className="h-5 w-20 bg-muted rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
