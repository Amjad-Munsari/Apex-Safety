import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div className="flex flex-col gap-8 pt-8">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3 w-32 bg-white/5" />
          <Skeleton className="h-9 w-52 bg-white/5" />
          <Skeleton className="h-4 w-72 bg-white/5" />
        </div>
        <Skeleton className="h-10 w-36 bg-white/5 rounded-sm" />
      </div>

      {/* 4-column kanban */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {["Draft", "Sent", "Signed", "Contract Issued"].map((col) => (
          <div key={col} className="flex flex-col gap-4">
            <div className="flex justify-between items-center px-1">
              <Skeleton className="h-3 w-16 bg-white/5" />
              <Skeleton className="h-3 w-4 bg-white/5" />
            </div>
            <div className="flex flex-col gap-4 min-h-[500px] p-2 rounded-sm bg-white/[0.02] border border-white/[0.05]">
              {Array.from({ length: col === "Draft" ? 3 : col === "Sent" ? 2 : 1 }).map((_, i) => (
                <div key={i} className="bg-[#1c1c1c] border border-white/5 rounded-sm p-4 flex flex-col gap-3">
                  <Skeleton className="h-4 w-3/4 bg-white/5" />
                  <Skeleton className="h-3 w-1/2 bg-white/5" />
                  <Skeleton className="h-6 w-20 bg-white/5 rounded-sm" />
                </div>
              ))}
            </div>
            <div className="px-1 pt-2 border-t border-white/5">
              <Skeleton className="h-3 w-20 bg-white/5 mb-1" />
              <Skeleton className="h-7 w-24 bg-white/5" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
