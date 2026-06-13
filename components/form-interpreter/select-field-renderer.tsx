"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import type { EntityComponentProps } from "@coltorapps/builder-react"
import type { selectFieldEntity } from "@/lib/form-builder/entities/select-field"

type Props = EntityComponentProps<typeof selectFieldEntity> & {
  surface?: "dark" | "cream"
  /** Phase 15: dynamic required from a fired `require` visibility rule. */
  dynamicRequired?: boolean
}

const surfaceTokens = {
  dark: {
    label: "text-white/70",
    required: "text-[#8b2b21]",
    trigger: "bg-transparent border-white/10 text-white",
    content: "bg-[#1c1c1c] border-white/10 text-white",
    helpText: "text-white/40",
    error: "text-[#8b2b21]",
  },
  cream: {
    label: "text-foreground",
    required: "text-danger",
    trigger: "bg-card border-border text-foreground",
    content: "bg-card border-border text-foreground",
    helpText: "text-muted-foreground",
    error: "text-danger",
  },
} as const

// Single-select only. The half-built `allowMultiple` mode was removed (audit #5):
// it had no builder toggle, passed required validation on an empty array, and was
// unsupported inside repeating sections. A real multi-select should be a distinct
// field type, not a toggle on Select.
export function SelectFieldRenderer({ entity, setValue, surface = "cream", dynamicRequired = false }: Props) {
  const t = surfaceTokens[surface]
  const attrs = entity.attributes
  const options = (attrs.options ?? []) as Array<{ value: string; label: string }>
  const error = entity.error ? String(entity.error) : undefined
  const value = (entity.value ?? "") as string

  return (
    <div className="flex flex-col gap-1.5">
      <label className={cn("text-sm font-semibold", t.label)}>
        {attrs.label}
        {(attrs.required || dynamicRequired) && <span className={cn("ml-1", t.required)}>*</span>}
      </label>
      <Select
        value={value}
        onValueChange={(v) => setValue(v)}
        // base-ui's SelectValue renders the raw value unless given a value→label
        // map; without this the trigger shows the option's value, not its label.
        items={Object.fromEntries(options.map((o) => [o.value, o.label]))}
      >
        <SelectTrigger className={cn("w-full h-12 rounded-sm", t.trigger)}>
          <SelectValue placeholder="Select an option..." />
        </SelectTrigger>
        <SelectContent
          align="start"
          alignItemWithTrigger={false}
          className={cn("rounded-sm", t.content)}
        >
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {/* helpText not available on selectField entity in Phase 13 */}
      {error && (
        <p className={cn("text-xs", t.error)}>{error}</p>
      )}
    </div>
  )
}
