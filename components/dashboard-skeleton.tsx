"use client"

import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-10 pt-8 pb-20 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex justify-between items-end">
        <div className="flex flex-col gap-4">
          <div className="h-4 w-32 bg-white/5 rounded-sm" />
          <div className="h-10 w-96 bg-white/5 rounded-sm" />
        </div>
        <div className="flex gap-12">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex flex-col items-end gap-2">
              <div className="h-3 w-20 bg-white/5 rounded-sm" />
              <div className="h-8 w-12 bg-white/5 rounded-sm" />
            </div>
          ))}
        </div>
      </div>

      {/* Row 1 Skeleton */}
      <div className="grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-6">
        <div className="h-[420px] bg-white/5 rounded-sm border border-white/5" />
        <div className="h-[420px] bg-white/5 rounded-sm border border-white/5" />
      </div>

      {/* Row 2 Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-[400px] bg-white/5 rounded-sm border border-white/5" />
        ))}
      </div>
    </div>
  )
}
