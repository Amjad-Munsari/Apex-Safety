"use client"

import { CheckboxField } from "@/components/forms/checkbox-field"
import { cn } from "@/lib/utils"
import type { EntityComponentProps } from "@coltorapps/builder-react"
import type { checkboxFieldEntity } from "@/lib/form-builder/entities/checkbox-field"

type Props = EntityComponentProps<typeof checkboxFieldEntity> & {
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
    label: "text-[#1a1a1a]",
    required: "text-[#8b2b21]",
    helpText: "text-[#6b6560]",
    error: "text-[#8b2b21]",
  },
} as const

export function CheckboxFieldRenderer({ entity, setValue, surface = "cream", dynamicRequired = false }: Props) {
  const t = surfaceTokens[surface]
  const attrs = entity.attributes
  const value = entity.value as boolean | string[] | undefined
  const error = entity.error ? String(entity.error) : undefined
  const label = (attrs.label ?? "") as string

  return (
    <div className="flex flex-col gap-1.5">
      <label className={cn("text-sm font-semibold", t.label)}>
        {label}
        {(attrs.required || dynamicRequired) && <span className={cn("ml-1", t.required)}>*</span>}
      </label>
      <CheckboxField
        surface={surface}
        label={label}
        value={value}
        onChange={(v) => setValue(v as boolean)}
      />
      {/* helpText not available on checkboxField entity in Phase 13 */}
      {error && (
        <p className={cn("text-xs", t.error)}>{error}</p>
      )}
    </div>
  )
}
