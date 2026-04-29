"use client"

import React, { useRef } from "react"
import { Image as ImageIcon, Plus, X, Loader2, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useMediaProcessor } from "@/hooks/use-media-processor"
import { cn } from "@/lib/utils"

interface MediaFieldProps {
  value: string[] // List of storage URLs or preview blobs
  onChange: (urls: string[]) => void
}

export function MediaField({ value = [], onChange }: MediaFieldProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { isProcessing, processImage } = useMediaProcessor()

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    const processedFiles = []
    for (const file of files) {
      const processed = await processImage(file)
      if (processed) {
        // In a real app, we'd upload to Supabase here
        // For Phase 2, we'll just use the blob URL as a preview
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
          <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-slate-800 bg-slate-950 group">
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
              <CheckCircle2 className="h-4 w-4 text-emerald-500 fill-slate-950" />
            </div>
          </div>
        ))}

        <button
          type="button"
          className={cn(
            "aspect-square rounded-lg border-2 border-dashed border-slate-800 hover:border-amber-500/50 hover:bg-amber-500/5 flex flex-col items-center justify-center transition-all group",
            isProcessing && "opacity-50 cursor-not-allowed"
          )}
          onClick={() => fileInputRef.current?.click()}
          disabled={isProcessing}
        >
          {isProcessing ? (
            <Loader2 className="h-6 w-6 text-amber-500 animate-spin" />
          ) : (
            <>
              <div className="h-10 w-10 rounded-full bg-slate-800 group-hover:bg-amber-500/20 flex items-center justify-center mb-2 transition-colors">
                <Plus className="h-6 w-6 text-slate-400 group-hover:text-amber-500" />
              </div>
              <span className="text-xs text-slate-500 font-medium group-hover:text-amber-500/80">Add Photo</span>
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
