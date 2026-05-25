"use client"

import React from "react"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"
import type { FormSurface } from "./form-surface"

interface CheckboxOption {
  label: string
  value: string
}

interface CheckboxFieldProps {
  value: boolean | string[] | undefined
  options?: readonly CheckboxOption[]
  label: string
  onChange: (value: boolean | string[]) => void
  surface?: FormSurface
}

const surfaceTokens = {
  dark: {
    box: "border-slate-700 bg-slate-950",
    boxChecked: "border-amber-500 bg-amber-500/10",
    check: "text-amber-500",
    label: "text-slate-200",
    row: "hover:bg-slate-900/50",
  },
  cream: {
    box: "border-[#d8d4cc] bg-white",
    boxChecked: "border-[#1a1a1a] bg-[#1a1a1a]",
    check: "text-white",
    label: "text-[#1a1a1a]",
    row: "hover:bg-[#faf9f6]",
  },
} as const

function CheckboxBox({
  checked,
  surface,
}: {
  checked: boolean
  surface: FormSurface
}) {
  const t = surfaceTokens[surface]
  return (
    <span
      className={cn(
        "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-sm border transition-colors",
        checked ? t.boxChecked : t.box
      )}
    >
      {checked && <Check className={cn("h-3.5 w-3.5", t.check)} strokeWidth={3} />}
    </span>
  )
}

export function CheckboxField({
  value,
  options,
  label,
  onChange,
  surface = "dark",
}: CheckboxFieldProps) {
  const t = surfaceTokens[surface]
  const isGroup = options && options.length > 0

  if (isGroup) {
    const selected: string[] = Array.isArray(value) ? value : []
    const toggle = (optValue: string) => {
      if (selected.includes(optValue)) {
        onChange(selected.filter((v) => v !== optValue))
      } else {
        onChange([...selected, optValue])
      }
    }

    return (
      <div className="flex flex-col gap-1">
        {options!.map((opt) => {
          const checked = selected.includes(opt.value)
          return (
            <label
              key={opt.value}
              className={cn(
                "relative flex items-center gap-3 px-3 py-2.5 rounded-sm cursor-pointer transition-colors",
                t.row
              )}
            >
              <input
                type="checkbox"
                className="sr-only"
                checked={checked}
                onChange={() => toggle(opt.value)}
              />
              <CheckboxBox checked={checked} surface={surface} />
              <span className={cn("text-sm", t.label)}>{opt.label}</span>
            </label>
          )
        })}
      </div>
    )
  }

  // Single checkbox
  const checked = value === true
  return (
    <label
      className={cn(
        "relative flex items-center gap-3 px-3 py-2.5 rounded-sm cursor-pointer transition-colors",
        t.row
      )}
    >
      <input
        type="checkbox"
        className="sr-only"
        checked={checked}
        onChange={() => onChange(!checked)}
      />
      <CheckboxBox checked={checked} surface={surface} />
      <span className={cn("text-sm", t.label)}>{label}</span>
    </label>
  )
}
