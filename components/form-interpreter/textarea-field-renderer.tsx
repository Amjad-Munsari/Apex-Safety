"use client"

import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import type { EntityComponentProps } from "@coltorapps/builder-react"
import type { textareaFieldEntity } from "@/lib/form-builder/entities/textarea-field"
import { MicButton } from "@/components/forms/mic-button"

type Props = EntityComponentProps<typeof textareaFieldEntity> & {
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
      {/* Relative wrapper so MicButton can be absolutely positioned at bottom-right */}
      <div className="relative">
        <Textarea
          className={cn("min-h-[140px] rounded-sm pr-12 pb-8", t.input)}
          placeholder={attrs.placeholder ?? ""}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        {/* className override pushes the mic to bottom-right per UI-SPEC §"STT Mic Button" */}
        <MicButton
          className="absolute right-2 bottom-2 top-auto translate-y-0"
          onTranscript={(t) => setValue((value ?? "") + (value ? " " : "") + t)}
          surface={surface}
          dictation={{
            label: attrs.label,
            kind: "textarea",
            placeholder: attrs.placeholder,
          }}
        />
      </div>
      {/* helpText not available on textareaField entity in Phase 13 */}
      {error && (
        <p className={cn("text-xs", t.error)}>{error}</p>
      )}
    </div>
  )
}
