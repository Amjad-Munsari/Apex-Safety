"use client"

import { useEffect } from "react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import type { EntityComponentProps } from "@coltorapps/builder-react"
import type { textFieldEntity } from "@/lib/form-builder/entities/text-field"

type Props = EntityComponentProps<typeof textFieldEntity> & {
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

export function TextFieldRenderer({ entity, setValue, surface = "cream", dynamicRequired = false }: Props) {
  const t = surfaceTokens[surface]
  const attrs = entity.attributes
  const value = (entity.value ?? "") as string
  const error = entity.error ? String(entity.error) : undefined

  // Handle prefillSource at mount — currentDate sets today's ISO date string.
  // currentUserName would require a server round-trip; deferred to Phase 14.
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
      <Input
        type="text"
        className={cn("h-12 rounded-sm", t.input)}
        placeholder={attrs.placeholder ?? ""}
        maxLength={attrs.maxLength}
        value={value}
        onChange={(e) => setValue(e.target.value)}
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
