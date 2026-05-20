"use client"

import { NumberField } from "@/components/forms/number-field"
import { cn } from "@/lib/utils"
import type { EntityComponentProps } from "@coltorapps/builder-react"
import type { numberFieldEntity } from "@/lib/form-builder/entities/number-field"

type Props = EntityComponentProps<typeof numberFieldEntity> & {
  surface?: "dark" | "cream"
}

const surfaceTokens = {
  dark: {
    label: "text-white/70",
    required: "text-[#8b2b21]",
    helpText: "text-white/40",
    error: "text-[#8b2b21]",
  },
  cream: {
    label: "text-[#1a1a1a]",
    required: "text-[#8b2b21]",
    helpText: "text-[#6b6560]",
    error: "text-[#8b2b21]",
  },
} as const

export function NumberFieldRenderer({ entity, setValue, surface = "cream" }: Props) {
  const t = surfaceTokens[surface]
  const attrs = entity.attributes
  const value = entity.value as number | string | undefined
  const error = entity.error ? String(entity.error) : undefined

  return (
    <div className="flex flex-col gap-1.5">
      <label className={cn("text-sm font-semibold", t.label)}>
        {attrs.label}
        {attrs.required && <span className={cn("ml-1", t.required)}>*</span>}
      </label>
      <NumberField
        surface={surface}
        value={value}
        min={attrs.min}
        max={attrs.max}
        onChange={(v) => setValue(v)}
      />
      {/* helpText not available on numberField entity in Phase 13 */}
      {error && (
        <p className={cn("text-xs", t.error)}>{error}</p>
      )}
    </div>
  )
}
