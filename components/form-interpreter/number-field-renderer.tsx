"use client"

import { NumberField } from "@/components/forms/number-field"
import { cn } from "@/lib/utils"
import type { EntityComponentProps } from "@coltorapps/builder-react"
import type { numberFieldEntity } from "@/lib/form-builder/entities/number-field"

type Props = EntityComponentProps<typeof numberFieldEntity> & {
  surface?: "dark" | "cream"
  /** Phase 15: dynamic required from a fired `require` visibility rule. */
  dynamicRequired?: boolean
}

const surfaceTokens = {
  dark: {
    label: "text-white/70",
    required: "text-[#8b2b21]",
    helpText: "text-white/40",
    error: "text-[#8b2b21]",
  },
  cream: {
    label: "text-foreground",
    required: "text-danger",
    helpText: "text-muted-foreground",
    error: "text-danger",
  },
} as const

export function NumberFieldRenderer({ entity, setValue, surface = "cream", dynamicRequired = false }: Props) {
  const t = surfaceTokens[surface]
  const attrs = entity.attributes
  const value = entity.value as number | string | undefined
  const error = entity.error ? String(entity.error) : undefined

  return (
    <div className="flex flex-col gap-1.5">
      <label className={cn("text-sm font-semibold", t.label)}>
        {attrs.label}
        {(attrs.required || dynamicRequired) && <span className={cn("ml-1", t.required)}>*</span>}
      </label>
      <NumberField
        surface={surface}
        value={value}
        min={attrs.min}
        max={attrs.max}
        onChange={(v) => setValue(v)}
        dictation={{
          label: attrs.label,
          kind: "number",
          helpText: attrs.helpText,
          min: attrs.min,
          max: attrs.max,
        }}
      />
      {attrs.helpText && (
        <p className={cn("text-xs", t.helpText)}>{attrs.helpText}</p>
      )}
      {error && (
        <p className={cn("text-xs", t.error)}>{error}</p>
      )}
    </div>
  )
}
