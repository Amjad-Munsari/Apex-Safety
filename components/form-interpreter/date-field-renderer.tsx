"use client"

import { useEffect } from "react"
import { DateField } from "@/components/forms/date-field"
import { cn } from "@/lib/utils"
import type { EntityComponentProps } from "@coltorapps/builder-react"
import type { dateFieldEntity } from "@/lib/form-builder/entities/date-field"

type Props = EntityComponentProps<typeof dateFieldEntity> & {
  surface?: "dark" | "cream"
  /** Phase 15: dynamic required from a fired `require` visibility rule. */
  dynamicRequired?: boolean
}

const surfaceTokens = {
  dark: {
    label: "text-foreground",
    required: "text-danger",
    helpText: "text-muted-foreground",
    error: "text-danger",
  },
  cream: {
    label: "text-foreground",
    required: "text-danger",
    helpText: "text-muted-foreground",
    error: "text-danger",
  },
} as const

export function DateFieldRenderer({ entity, setValue, surface = "cream", dynamicRequired = false }: Props) {
  const t = surfaceTokens[surface]
  const attrs = entity.attributes
  const value = (entity.value ?? "") as string
  const error = entity.error ? String(entity.error) : undefined

  // Handle prefillSource: currentDate sets today's date (YYYY-MM-DD) at mount if no value yet.
  useEffect(() => {
    if (value) return
    if (attrs.prefillSource === "currentDate") {
      const today = new Date().toISOString().slice(0, 10)
      setValue(today)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entity.id])

  return (
    <div className="flex flex-col gap-1.5">
      <label className={cn("text-sm font-semibold", t.label)}>
        {attrs.label}
        {(attrs.required || dynamicRequired) && <span className={cn("ml-1", t.required)}>*</span>}
      </label>
      <DateField
        surface={surface}
        value={value || undefined}
        min={attrs.minDate}
        max={attrs.maxDate}
        onChange={(v) => setValue(v)}
      />
      {/* helpText not available on dateField entity in Phase 13 */}
      {error && (
        <p className={cn("text-xs", t.error)}>{error}</p>
      )}
    </div>
  )
}
