"use client"

import React from "react"
import { Mic, Square, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useSTT } from "@/hooks/use-stt"
import { cn } from "@/lib/utils"
import type { FormSurface } from "./form-renderer"

interface MicButtonProps {
  className?: string
  onTranscript: (text: string) => void
  surface?: FormSurface
}

const idleByForSurface = {
  dark: "text-slate-400 hover:text-slate-200",
  cream: "text-[#6b6560] hover:text-[#1a1a1a]",
} as const

export function MicButton({ className, onTranscript, surface = "dark" }: MicButtonProps) {
  const { isRecording, isTranscribing, startRecording, stopRecording, transcript, setTranscript } = useSTT()

  React.useEffect(() => {
    if (transcript) {
      onTranscript(transcript)
      setTranscript("")
    }
  }, [transcript, onTranscript, setTranscript])

  const handleClick = () => {
    if (isRecording) {
      stopRecording()
    } else {
      startRecording()
    }
  }

  return (
    <div className={cn("absolute right-2 top-1/2 -translate-y-1/2 flex items-center", className)}>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className={cn(
          "h-8 w-8 rounded-full transition-all duration-300",
          isRecording && "bg-amber-500/20 text-amber-500 animate-pulse scale-110",
          !isRecording && idleByForSurface[surface]
        )}
        onClick={handleClick}
        disabled={isTranscribing}
      >
        {isTranscribing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isRecording ? (
          <Square className="h-4 w-4 fill-current" />
        ) : (
          <Mic className="h-4 w-4" />
        )}
      </Button>
    </div>
  )
}
