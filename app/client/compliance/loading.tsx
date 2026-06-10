import { Skeleton } from "@/components/ui/skeleton";

export default function ComplianceLoading() {
  return (
    <div className="space-y-12">
      {/* Section header */}
      <section className="space-y-3">
        <Skeleton className="h-3 w-24 bg-[#ede9e0]" />
        <Skeleton className="h-12 w-80 bg-[#ede9e0]" />
      </section>

      {/* Stat row */}
      <div className="flex gap-6">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex-1 space-y-2">
            <Skeleton className="h-3 w-16 bg-[#ede9e0]" />
            <Skeleton className="h-7 w-10 bg-[#ede9e0]" />
          </div>
        ))}
      </div>

      {/* Document table rows */}
      <div className="bg-white border border-[#e5e1d8] rounded-sm shadow-[0_1px_2px_rgba(0,0,0,0.02)] divide-y divide-[#e5e1d8]">
        <div className="px-6 py-3 flex gap-4">
          <Skeleton className="h-3 w-32 bg-[#ede9e0]" />
          <Skeleton className="h-3 w-20 bg-[#ede9e0] ml-auto" />
        </div>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="px-6 py-4 flex items-center gap-4">
            <Skeleton className="h-4 w-48 bg-[#ede9e0]" />
            <Skeleton className="h-3 w-20 bg-[#ede9e0] ml-auto" />
            <Skeleton className="h-5 w-16 bg-[#ede9e0] rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
