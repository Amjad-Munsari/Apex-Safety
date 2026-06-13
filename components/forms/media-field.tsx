"use client"

import React, { useRef } from "react"
import { Plus, X, Loader2, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useMediaProcessor } from "@/hooks/use-media-processor"
import { cn } from "@/lib/utils"
import type { FormSurface } from "./form-surface"

interface MediaFieldProps {
  value: string[] // List of storage URLs or preview blobs
  onChange: (urls: string[]) => void
  surface?: FormSurface
}

const surfaceTokens = {
  dark: {
    cell: "border-slate-800 bg-slate-950",
    checkFill: "fill-slate-950",
    addBtn: "border-slate-800 hover:border-amber-500/50 hover:bg-amber-500/5",
    addIconWrap: "bg-slate-800 group-hover:bg-amber-500/20",
    addIcon: "text-slate-400 group-hover:text-amber-500",
    addLabel: "text-slate-500 group-hover:text-amber-500/80",
  },
  cream: {
    cell: "border-border bg-muted",
    checkFill: "fill-white",
    addBtn: "border-border hover:border-amber-500/60 hover:bg-amber-500/5",
    addIconWrap: "bg-muted group-hover:bg-amber-500/20",
    addIcon: "text-muted-foreground group-hover:text-amber-600",
    addLabel: "text-muted-foreground group-hover:text-amber-600",
  },
} as const

export function MediaField({ value = [], onChange, surface = "dark" }: MediaFieldProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { isProcessing, processImage } = useMediaProcessor()
  const t = surfaceTokens[surface]

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    const processedFiles = []
    for (const file of files) {
      const processed = await processImage(file)
      if (processed) {
        processedFiles.push(URL.createObjectURL(processed))
      }
    }

    onChange([...value, ...processedFiles])
  }

  const removeMedia = (index: number) => {
    const newValue = [...value]
    newValue.splice(index, 1)
    onChange(newValue)
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {value.map((url, i) => (
          <div key={i} className={cn("relative aspect-square rounded-lg overflow-hidden border group", t.cell)}>
            <img src={url} alt="Uploaded media" className="object-cover w-full h-full" />
            <Button
              size="icon"
              variant="destructive"
              className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => removeMedia(i)}
            >
              <X className="h-3 w-3" />
            </Button>
            <div className="absolute bottom-1 right-1">
              <CheckCircle2 className={cn("h-4 w-4 text-emerald-500", t.checkFill)} />
            </div>
          </div>
        ))}

        <button
          type="button"
          className={cn(
            "aspect-square rounded-lg border-2 border-dashed flex flex-col items-center justify-center transition-all group",
            t.addBtn,
            isProcessing && "opacity-50 cursor-not-allowed"
          )}
          onClick={() => fileInputRef.current?.click()}
          disabled={isProcessing}
        >
          {isProcessing ? (
            <Loader2 className="h-6 w-6 text-amber-500 animate-spin" />
          ) : (
            <>
              <div className={cn("h-10 w-10 rounded-full flex items-center justify-center mb-2 transition-colors", t.addIconWrap)}>
                <Plus className={cn("h-6 w-6", t.addIcon)} />
              </div>
              <span className={cn("text-xs font-medium", t.addLabel)}>Add Photo</span>
            </>
          )}
        </button>
      </div>

      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/*,.heic"
        multiple
        onChange={handleFileChange}
      />
    </div>
  )
}
