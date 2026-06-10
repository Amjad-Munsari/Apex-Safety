import { Skeleton } from "@/components/ui/skeleton";

export default function ProposalsLoading() {
  return (
    <div className="space-y-12">
      {/* Hero header */}
      <section className="space-y-3">
        <Skeleton className="h-3 w-24 bg-[#ede9e0]" />
        <Skeleton className="h-12 w-64 bg-[#ede9e0]" />
        <Skeleton className="h-3 w-80 bg-[#ede9e0]" />
      </section>

      {/* Card grid */}
      <section className="space-y-4">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="bg-white border border-[#e5e1d8] rounded-sm shadow-[0_1px_2px_rgba(0,0,0,0.02)] p-7"
          >
            <div className="flex items-start justify-between gap-6">
              {/* Left */}
              <div className="flex-1 space-y-3">
                <Skeleton className="h-3 w-40 bg-[#ede9e0]" />
                <Skeleton className="h-7 w-64 bg-[#ede9e0]" />
                <Skeleton className="h-3 w-32 bg-[#ede9e0]" />
              </div>
              {/* Right */}
              <div className="flex flex-col items-end gap-3 shrink-0">
                <Skeleton className="h-6 w-28 bg-[#ede9e0] rounded-full" />
                <Skeleton className="h-3 w-12 bg-[#ede9e0]" />
              </div>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
