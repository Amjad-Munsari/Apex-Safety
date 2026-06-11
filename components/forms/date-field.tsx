"use client"

import React from "react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import type { FormSurface } from "./form-surface"

interface DateFieldProps {
  value: string | undefined
  onChange: (value: string) => void
  surface?: FormSurface
  /** YYYY-MM-DD lower bound, passed to the native date input (audit #8). */
  min?: string
  /** YYYY-MM-DD upper bound, passed to the native date input (audit #8). */
  max?: string
}

const surfaceTokens = {
  dark: {
    input:
      "bg-slate-950 border-slate-800 text-slate-100 focus:ring-amber-500/20 focus:border-amber-500 [color-scheme:dark]",
    formatted: "text-slate-400",
  },
  cream: {
    input:
      "bg-white border-[#e5e1d8] text-[#1a1a1a] placeholder:text-[#a8a39d] focus:ring-amber-500/20 focus:border-amber-500",
    formatted: "text-[#6b6560]",
  },
} as const

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

function format(value: string | undefined) {
  if (!value) return null
  // Parse the YYYY-MM-DD value as a calendar date — avoid timezone shifts from `new Date(value)`.
  const [y, m, d] = value.split("-").map(Number)
  if (!y || !m || !d) return null
  return `${String(d).padStart(2, "0")} ${MONTHS[m - 1]} ${y}`
}

export function DateField({ value, onChange, surface = "dark", min, max }: DateFieldProps) {
  const t = surfaceTokens[surface]
  const formatted = format(value)

  return (
    <div className="space-y-2">
      <Input
        type="date"
        className={cn("h-12 rounded-sm", t.input)}
        value={value ?? ""}
        min={min}
        max={max}
        onChange={(e) => onChange(e.target.value)}
      />
      {formatted && (
        <div className={cn("text-xs font-mono uppercase tracking-wider", t.formatted)}>
          {formatted}
        </div>
      )}
    </div>
  )
}
