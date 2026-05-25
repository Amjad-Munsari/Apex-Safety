"use client"

import { useEffect } from "react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import type { EntityComponentProps } from "@coltorapps/builder-react"
import type { textFieldEntity } from "@/lib/form-builder/entities/text-field"
import { MicButton } from "@/components/forms/mic-button"

type Props = EntityComponentProps<typeof textFieldEntity> & {
  surface?: "dark" | "cream"
  /** Phase 15: dynamic required from a fired `require` visibility rule. */
  dynamicRequired?: boolean
}

const surfaceTokens = {
  dark: {
    label: "text-white/70",
    required: "text-[#8b2b21]",
    input: "bg-transparent border-white/10 text-white placeholder:text-white/30 focus-visible:border-white/30",
    helpText: "text-white/40",
    error: "text-[#8b2b21]",
  },
  cream: {
    label: "text-[#1a1a1a]",
    required: "text-[#8b2b21]",
    input: "bg-white border-[#e5e1d8] text-[#1a1a1a] placeholder:text-[#a8a39d]",
    helpText: "text-[#6b6560]",
    error: "text-[#8b2b21]",
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
      {/* Relative wrapper so MicButton can be absolutely positioned inside the input */}
      <div className="relative">
        <Input
          type="text"
          className={cn("h-12 rounded-sm pr-12", t.input)}
          placeholder={attrs.placeholder ?? ""}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <MicButton
          onTranscript={(t) => setValue((value ?? "") + (value ? " " : "") + t)}
          surface={surface}
        />
      </div>
      {attrs.helpText && (
        <p className={cn("text-xs", t.helpText)}>{attrs.helpText}</p>
      )}
      {error && (
        <p className={cn("text-xs", t.error)}>{error}</p>
      )}
    </div>
  )
}
