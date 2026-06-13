"use client"

import React from "react"
import { Minus, Plus } from "lucide-react"
import { Input } from "@/components/ui/input"
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
    input: "bg-card border-border text-foreground placeholder:text-muted-foreground focus:ring-gold/20 focus:border-gold",
    btn: "border-border bg-card text-foreground hover:bg-muted hover:text-gold hover:border-gold/50",
  },
  cream: {
    input: "bg-card border-border text-foreground placeholder:text-muted-foreground focus:ring-gold/20 focus:border-gold",
    btn: "border-border bg-card text-foreground hover:bg-muted hover:text-gold hover:border-gold/50",
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

  // Narrow-bounded fields (e.g. PAS 79 likelihood/consequence 1–5) — typing is
  // disabled because the value space is so small that the −/+ buttons are the
  // only sensible input. Wider ranges (e.g. fire-warden count 0–999) and
  // unbounded fields keep free typing.
  // The bug this guards against: typing into a field already showing a value
  // appends ("1" + "5" → "15") and lands an out-of-range value in the store
  // that downstream computed fields reject, leaving the form in a broken
  // intermediate state. The 10-unit threshold is the practical line between
  // a rating-style picker and a free-entry quantity.
  const isNarrowBounded =
    typeof min === "number" && typeof max === "number" && max - min <= 10

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

      <div className="flex-1">
        <Input
          type="number"
          inputMode="decimal"
          className={cn("h-12 rounded-sm text-center", t.input)}
          placeholder={placeholder}
          value={safeNumeric ?? ""}
          min={min}
          max={max}
          step={step}
          readOnly={isNarrowBounded}
          onFocus={(e) => e.target.select()}
          onChange={
            isNarrowBounded
              ? undefined
              : (e) => {
                  const raw = e.target.value
                  if (raw === "") {
                    onChange("")
                    return
                  }
                  const n = Number(raw)
                  onChange(Number.isNaN(n) ? raw : n)
                }
          }
          onBlur={
            isNarrowBounded
              ? undefined
              : (e) => {
                  // Defensive clamp for wide-bounded fields — paste / multi-digit
                  // edits that exceed bounds normalise when focus leaves.
                  if (e.target.value === "") return
                  const n = Number(e.target.value)
                  if (Number.isNaN(n)) return
                  const clamped = clamp(n)
                  if (clamped !== n) onChange(clamped)
                }
          }
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
