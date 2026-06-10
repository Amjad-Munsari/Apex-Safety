import { Skeleton } from "@/components/ui/skeleton";

export default function ClientDashboardLoading() {
  return (
    <div className="space-y-12">
      {/* Greeting + date */}
      <section className="space-y-3">
        <Skeleton className="h-3 w-24 bg-[#ede9e0]" />
        <Skeleton className="h-10 w-72 bg-[#ede9e0]" />
        <Skeleton className="h-3 w-48 bg-[#ede9e0]" />
      </section>

      {/* 3 metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="bg-white border border-[#e5e1d8] rounded-sm shadow-[0_1px_2px_rgba(0,0,0,0.02)] p-6 space-y-3"
          >
            <Skeleton className="h-3 w-20 bg-[#ede9e0]" />
            <Skeleton className="h-8 w-12 bg-[#ede9e0]" />
          </div>
        ))}
      </div>

      {/* Short attention list */}
      <div className="space-y-3">
        <Skeleton className="h-3 w-32 bg-[#ede9e0]" />
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-14 w-full bg-[#ede9e0]" />
        ))}
      </div>
    </div>
  );
}
