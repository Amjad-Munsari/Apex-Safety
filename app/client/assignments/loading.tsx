import { Skeleton } from "@/components/ui/skeleton";

export default function AssignmentsLoading() {
  return (
    <div className="space-y-12">
      {/* Page header */}
      <section className="space-y-3">
        <Skeleton className="h-3 w-28 bg-[#ede9e0]" />
        <Skeleton className="h-9 w-64 bg-[#ede9e0]" />
      </section>

      {/* Tab bar */}
      <div className="border-b border-[#e5e1d8] flex gap-6 pb-3">
        <Skeleton className="h-3 w-12 bg-[#ede9e0]" />
        <Skeleton className="h-3 w-20 bg-[#ede9e0]" />
      </div>

      {/* Card list */}
      <div className="flex flex-col gap-3">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="bg-white border border-[#e5e1d8] rounded-sm shadow-[0_1px_2px_rgba(0,0,0,0.02)] p-5 space-y-2"
          >
            <Skeleton className="h-3 w-40 bg-[#ede9e0]" />
            <Skeleton className="h-5 w-56 bg-[#ede9e0]" />
            <Skeleton className="h-3 w-32 bg-[#ede9e0]" />
          </div>
        ))}
      </div>
    </div>
  );
}
