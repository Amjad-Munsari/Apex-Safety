"use client"

import { useEffect } from "react"
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

export function CheckboxFieldRenderer({ entity, setValue, surface = "cream", dynamicRequired = false }: Props) {
  const t = surfaceTokens[surface]
  const attrs = entity.attributes
  const value = entity.value as boolean | string[] | undefined
  const error = entity.error ? String(entity.error) : undefined
  const label = (attrs.label ?? "") as string

  // Seed the "checked by default" state on first mount when no answer exists yet
  // (audit #6). Guarded on `value === undefined` so a saved submission that
  // unchecked the box (value === false) is never re-checked on reload.
  useEffect(() => {
    if (value === undefined && attrs.defaultChecked) {
      setValue(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entity.id])

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
