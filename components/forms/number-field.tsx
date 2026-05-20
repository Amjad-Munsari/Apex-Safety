"use client"

import React from "react"
import { Minus, Plus } from "lucide-react"
import { Input } from "@/components/ui/input"
import { MicButton } from "./mic-button"
import { cn } from "@/lib/utils"
import type { FormSurface } from "./form-surface"

interface NumberFieldProps {
  value: number | string | undefined
  onChange: (value: number | string) => void
  placeholder?: string
  min?: number
  max?: number
  step?: number
  surface?: FormSurface
}

const surfaceTokens = {
  dark: {
    input: "bg-slate-950 border-slate-800 focus:ring-amber-500/20 focus:border-amber-500",
    btn: "border-slate-800 bg-slate-950 text-slate-300 hover:bg-slate-900 hover:text-amber-500 hover:border-amber-500/50",
  },
  cream: {
    input: "bg-white border-[#e5e1d8] text-[#1a1a1a] placeholder:text-[#a8a39d] focus:ring-amber-500/20 focus:border-amber-500",
    btn: "border-[#e5e1d8] bg-white text-[#1a1a1a] hover:bg-[#faf9f6] hover:text-amber-600 hover:border-amber-500/50",
  },
} as const

export function NumberField({
  value,
  onChange,
  placeholder,
  min,
  max,
  step = 1,
  surface = "dark",
}: NumberFieldProps) {
  const t = surfaceTokens[surface]

  const numeric = typeof value === "number" ? value : value === "" || value == null ? null : Number(value)
  const safeNumeric = numeric != null && !Number.isNaN(numeric) ? numeric : null

  const clamp = (n: number) => {
    let next = n
    if (typeof min === "number") next = Math.max(min, next)
    if (typeof max === "number") next = Math.min(max, next)
    return next
  }

  const bump = (delta: number) => {
    const base = safeNumeric ?? 0
    onChange(clamp(base + delta))
  }

  return (
    <div className="flex items-stretch gap-2">
      <button
        type="button"
        onClick={() => bump(-step)}
        className={cn(
          "shrink-0 h-12 w-12 rounded-sm border flex items-center justify-center transition-colors",
          t.btn
        )}
        aria-label="Decrease"
      >
        <Minus className="h-4 w-4" />
      </button>

      <div className="relative flex-1 group">
        <Input
          type="number"
          inputMode="decimal"
          className={cn("pr-12 h-12 rounded-sm text-center", t.input)}
          placeholder={placeholder}
          value={safeNumeric ?? ""}
          min={min}
          max={max}
          step={step}
          onChange={(e) => {
            const raw = e.target.value
            if (raw === "") {
              onChange("")
              return
            }
            const n = Number(raw)
            onChange(Number.isNaN(n) ? raw : n)
          }}
        />
        <MicButton
          surface={surface}
          onTranscript={(text) => {
            // Pull the first numeric token out of the transcript ("seventy" stays as text;
            // "70 units" becomes 70). Falls back to the raw transcript if no number is found.
            const match = text.match(/-?\d+(?:\.\d+)?/)
            if (match) onChange(clamp(Number(match[0])))
            else onChange(text)
          }}
        />
      </div>

      <button
        type="button"
        onClick={() => bump(step)}
        className={cn(
          "shrink-0 h-12 w-12 rounded-sm border flex items-center justify-center transition-colors",
          t.btn
        )}
        aria-label="Increase"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  )
}
