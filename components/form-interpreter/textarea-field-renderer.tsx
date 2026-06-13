"use client"

import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import type { EntityComponentProps } from "@coltorapps/builder-react"
import type { textareaFieldEntity } from "@/lib/form-builder/entities/textarea-field"

type Props = EntityComponentProps<typeof textareaFieldEntity> & {
  surface?: "dark" | "cream"
  /** Phase 15: dynamic required from a fired `require` visibility rule. */
  dynamicRequired?: boolean
}

const surfaceTokens = {
  dark: {
    label: "text-foreground",
    required: "text-danger",
    input: "bg-card border-border text-foreground placeholder:text-muted-foreground",
    helpText: "text-muted-foreground",
    error: "text-danger",
  },
  cream: {
    label: "text-foreground",
    required: "text-danger",
    input: "bg-card border-border text-foreground placeholder:text-muted-foreground",
    helpText: "text-muted-foreground",
    error: "text-danger",
  },
} as const

export function TextareaFieldRenderer({ entity, setValue, surface = "cream", dynamicRequired = false }: Props) {
  const t = surfaceTokens[surface]
  const attrs = entity.attributes
  const value = (entity.value ?? "") as string
  const error = entity.error ? String(entity.error) : undefined

  return (
    <div className="flex flex-col gap-1.5">
      <label className={cn("text-sm font-semibold", t.label)}>
        {attrs.label}
        {(attrs.required || dynamicRequired) && <span className={cn("ml-1", t.required)}>*</span>}
      </label>
      <Textarea
        className={cn("min-h-[140px] rounded-sm", t.input)}
        placeholder={attrs.placeholder ?? ""}
        maxLength={attrs.maxLength}
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      {/* helpText not available on textareaField entity in Phase 13 */}
      {error && (
        <p className={cn("text-xs", t.error)}>{error}</p>
      )}
    </div>
  )
}
