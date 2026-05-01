"use client"

import { Textarea } from "@/components/ui/textarea"
import { MicButton } from "@/components/forms/mic-button"
import { MediaField } from "@/components/forms/media-field"
import { Label } from "@/components/ui/label"

interface AppendixFieldProps {
  notesValue: string
  mediaValue: string[]
  onChangeNotes: (value: string) => void
  onChangeMedia: (urls: string[]) => void
}

export function AppendixField({
  notesValue,
  mediaValue,
  onChangeNotes,
  onChangeMedia
}: AppendixFieldProps) {
  return (
    <div className="border-l-2 border-amber-500/40 pl-6 py-2 mt-8">
      <div className="mb-6">
        <h3 className="text-xl font-medium text-slate-200 font-outfit tracking-wider">
          ADDITIONAL OBSERVATIONS
        </h3>
        <p className="text-slate-500 text-sm mt-1">
          Capture any other issues, context, or visual evidence not covered by the form schema.
        </p>
      </div>

      <div className="space-y-6">
        <div>
          <Label className="uppercase text-[0.65rem] tracking-[0.1em] text-slate-500 font-bold mb-3 block">
            General Notes
          </Label>
          <div className="relative group">
            <Textarea
              className="bg-slate-950 border-slate-800 focus:ring-amber-500/20 focus:border-amber-500 pr-12 min-h-[140px] rounded-sm"
              placeholder="Dictate or type additional observations..."
              value={notesValue}
              onChange={(e) => onChangeNotes(e.target.value)}
            />
            <MicButton
              className="top-3 translate-y-0"
              onTranscript={(text) => onChangeNotes((notesValue ? notesValue + " " : "") + text)}
            />
          </div>
        </div>

        <div>
          <Label className="uppercase text-[0.65rem] tracking-[0.1em] text-slate-500 font-bold mb-3 block">
            Appendix Evidence
          </Label>
          <MediaField
            value={mediaValue || []}
            onChange={onChangeMedia}
          />
        </div>
      </div>
    </div>
  )
}
