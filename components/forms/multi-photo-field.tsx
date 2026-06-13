"use client"

import React, { useRef } from "react"
import { Plus, X, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useMediaProcessor } from "@/hooks/use-media-processor"
import { cn } from "@/lib/utils"
import type { FormSurface } from "./form-surface"

interface MultiPhotoFieldProps {
  value: string[] | undefined
  onChange: (urls: string[]) => void
  maxPhotos?: number
  surface?: FormSurface
}

const surfaceTokens = {
  dark: {
    cell: "border-border bg-muted",
    addBtn: "border-border hover:border-gold/50 hover:bg-gold/5",
    addIconWrap: "bg-muted group-hover:bg-gold/20",
    addIcon: "text-muted-foreground group-hover:text-gold",
    addLabel: "text-muted-foreground group-hover:text-gold/80",
    countLabel: "text-muted-foreground",
  },
  cream: {
    cell: "border-border bg-muted",
    addBtn: "border-border hover:border-gold/60 hover:bg-gold/5",
    addIconWrap: "bg-muted group-hover:bg-gold/20",
    addIcon: "text-muted-foreground group-hover:text-gold",
    addLabel: "text-muted-foreground group-hover:text-gold",
    countLabel: "text-muted-foreground",
  },
} as const

export function MultiPhotoField({
  value,
  onChange,
  maxPhotos = 5,
  surface = "dark",
}: MultiPhotoFieldProps) {
  const t = surfaceTokens[surface]
  const photos = value ?? []
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { isProcessing, processImage } = useMediaProcessor()
  const remaining = Math.max(0, maxPhotos - photos.length)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return

    const room = remaining
    const accepted = files.slice(0, room)
    const next: string[] = []
    for (const file of accepted) {
      const processed = await processImage(file)
      if (processed) {
        next.push(URL.createObjectURL(processed))
      }
    }
    onChange([...photos, ...next])
    // Reset the input so the same file can be re-picked after a remove.
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const remove = (index: number) => {
    const copy = [...photos]
    copy.splice(index, 1)
    onChange(copy)
  }

  const canAdd = remaining > 0 && !isProcessing

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {photos.map((url, i) => (
          <div
            key={`${url}-${i}`}
            className={cn(
              "relative aspect-square rounded-sm overflow-hidden border group",
              t.cell
            )}
          >
            <img src={url} alt={`Photo ${i + 1}`} className="object-cover w-full h-full" />
            <Button
              size="icon"
              variant="destructive"
              className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => remove(i)}
              type="button"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        ))}

        {canAdd && (
          <button
            type="button"
            className={cn(
              "aspect-square rounded-sm border-2 border-dashed flex flex-col items-center justify-center transition-all group",
              t.addBtn
            )}
            onClick={() => fileInputRef.current?.click()}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <Loader2 className="h-6 w-6 text-gold animate-spin" />
            ) : (
              <>
                <div
                  className={cn(
                    "h-10 w-10 rounded-full flex items-center justify-center mb-2 transition-colors",
                    t.addIconWrap
                  )}
                >
                  <Plus className={cn("h-6 w-6", t.addIcon)} />
                </div>
                <span className={cn("text-xs font-medium", t.addLabel)}>Add Photo</span>
              </>
            )}
          </button>
        )}
      </div>

      <div className={cn("text-xs font-mono uppercase tracking-wider", t.countLabel)}>
        {photos.length} / {maxPhotos}
      </div>

      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/*"
        capture="environment"
        multiple
        onChange={handleFileChange}
      />
    </div>
  )
}
