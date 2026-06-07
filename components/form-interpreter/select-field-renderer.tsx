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
    multiItem: "border-white/10 text-white/70 bg-white/5 cursor-pointer",
    multiChecked: "border-teal bg-teal/10 text-white cursor-pointer",
  },
  cream: {
    label: "text-[#1a1a1a]",
    required: "text-[#8b2b21]",
    trigger: "bg-white border-[#e5e1d8] text-[#1a1a1a]",
    content: "bg-white border-[#e5e1d8] text-[#1a1a1a]",
    helpText: "text-[#6b6560]",
    error: "text-[#8b2b21]",
    multiItem: "border-[#e5e1d8] text-[#1a1a1a] bg-white cursor-pointer",
    multiChecked: "border-[#1a1a1a] bg-[#1a1a1a]/5 text-[#1a1a1a] cursor-pointer",
  },
} as const

export function SelectFieldRenderer({ entity, setValue, surface = "cream", dynamicRequired = false }: Props) {
  const t = surfaceTokens[surface]
  const attrs = entity.attributes
  const allowMultiple = (attrs.allowMultiple ?? false) as boolean
  const options = (attrs.options ?? []) as Array<{ value: string; label: string }>
  const error = entity.error ? String(entity.error) : undefined

  if (allowMultiple) {
    const selected: string[] = (() => {
      const v = entity.value
      return Array.isArray(v) ? (v as string[]) : []
    })()

    const toggle = (optValue: string) => {
      if (selected.includes(optValue)) {
        setValue(selected.filter((v) => v !== optValue))
      } else {
        setValue([...selected, optValue])
      }
    }

    return (
      <div className="flex flex-col gap-1.5">
        <label className={cn("text-sm font-semibold", t.label)}>
          {attrs.label}
          {(attrs.required || dynamicRequired) && <span className={cn("ml-1", t.required)}>*</span>}
        </label>
        <div className="flex flex-col gap-1">
          {options.map((opt) => {
            const checked = selected.includes(opt.value)
            return (
              <label
                key={opt.value}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-sm border transition-colors",
                  checked ? t.multiChecked : t.multiItem
                )}
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={checked}
                  onChange={() => toggle(opt.value)}
                />
                <span className="text-sm">{opt.label}</span>
              </label>
            )
          })}
        </div>
        {/* helpText not available on selectField entity in Phase 13 */}
        {error && (
          <p className={cn("text-xs", t.error)}>{error}</p>
        )}
      </div>
    )
  }

  // Single select
  const value = (entity.value ?? "") as string

  return (
    <div className="flex flex-col gap-1.5">
      <label className={cn("text-sm font-semibold", t.label)}>
        {attrs.label}
        {attrs.required && <span className={cn("ml-1", t.required)}>*</span>}
      </label>
      <Select
        value={value}
        onValueChange={(v) => setValue(v)}
        // base-ui's SelectValue renders the raw value unless given a value→label
        // map; without this the trigger shows the option's value, not its label.
        items={Object.fromEntries(options.map((o) => [o.value, o.label]))}
      >
        <SelectTrigger className={cn("h-12 rounded-sm", t.trigger)}>
          <SelectValue placeholder="Select an option..." />
        </SelectTrigger>
        <SelectContent className={cn("rounded-sm", t.content)}>
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
