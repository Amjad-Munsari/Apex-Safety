"use client"

import React from "react"
import { Star } from "lucide-react"
import { cn } from "@/lib/utils"
import type { FormSurface } from "./form-renderer"

interface RatingFieldProps {
  value: number | undefined
  maxRating?: number
  onChange: (value: number) => void
  surface?: FormSurface
}

const surfaceTokens = {
  dark: {
    starIdle: "text-slate-700 hover:text-amber-500/40",
    valueText: "text-slate-300",
    valueMuted: "text-slate-500",
  },
  cream: {
    starIdle: "text-[#d8d4cc] hover:text-amber-500/40",
    valueText: "text-[#1a1a1a]",
    valueMuted: "text-[#8a857f]",
  },
} as const

export function RatingField({
  value,
  maxRating = 5,
  onChange,
  surface = "dark",
}: RatingFieldProps) {
  const t = surfaceTokens[surface]
  const current = typeof value === "number" ? value : 0

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1">
        {Array.from({ length: maxRating }).map((_, i) => {
          const star = i + 1
          const filled = star <= current
          return (
            <button
              key={star}
              type="button"
              onClick={() => onChange(star === current ? 0 : star)}
              className={cn(
                "p-1 transition-colors",
                filled ? "text-[#d97706]" : t.starIdle
              )}
              aria-label={`Rate ${star} of ${maxRating}`}
            >
              <Star className="h-7 w-7" fill={filled ? "currentColor" : "none"} strokeWidth={1.5} />
            </button>
          )
        })}
      </div>
      <span className={cn("font-mono text-sm tabular-nums", current > 0 ? t.valueText : t.valueMuted)}>
        {current} / {maxRating}
      </span>
    </div>
  )
}
