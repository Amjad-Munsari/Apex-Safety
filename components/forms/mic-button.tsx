"use client"

import React from "react"
import { Mic, MicOff, Square, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { useSTT, type DictationContext } from "@/hooks/use-stt"
import { cn } from "@/lib/utils"
import type { FormSurface } from "./form-surface"

interface MicButtonProps {
  className?: string
  onTranscript: (text: string) => void
  surface?: FormSurface
  /** Field metadata sent with the audio so the model formats the value for the field. */
  dictation?: DictationContext
}

const idleByForSurface = {
  dark: "text-muted-foreground hover:text-foreground",
  cream: "text-muted-foreground hover:text-foreground",
} as const

export function MicButton({ className, onTranscript, surface = "dark", dictation }: MicButtonProps) {
  const {
    isRecording,
    isTranscribing,
    supported,
    startRecording,
    stopRecording,
    transcript,
    setTranscript,
    error,
    clearError,
  } = useSTT(dictation)

  // The transcript arrives once, after the server round-trip completes.
  const lastCommittedRef = React.useRef("")
  React.useEffect(() => {
    if (!isRecording && !isTranscribing && transcript && transcript !== lastCommittedRef.current) {
      lastCommittedRef.current = transcript
      onTranscript(transcript)
      setTranscript("")
    }
  }, [isRecording, isTranscribing, transcript, onTranscript, setTranscript])

  React.useEffect(() => {
    if (error) {
      toast.error(error)
      clearError()
    }
  }, [error, clearError])

  const handleClick = () => {
    if (!supported) {
      toast.error("Audio recording isn't available in this browser. Update it or check microphone permissions.")
      return
    }
    if (isRecording) {
      stopRecording()
    } else {
      lastCommittedRef.current = ""
      startRecording()
    }
  }

  return (
    <div className={cn("absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2", className)}>
      {isRecording && (
        <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-gold animate-pulse">
          Recording…
        </span>
      )}
      {isTranscribing && (
        <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-gold animate-pulse">
          Transcribing…
        </span>
      )}
      <Button
        type="button"
        size="icon"
        variant="ghost"
        title={supported ? (isRecording ? "Stop recording" : "Speak to dictate") : "Audio recording not supported in this browser"}
        aria-label={supported ? (isRecording ? "Stop recording" : "Speak to dictate") : "Audio recording not supported in this browser"}
        className={cn(
          "h-8 w-8 rounded-full transition-all duration-300",
          isRecording && "bg-gold/20 text-gold animate-pulse scale-110",
          !isRecording && idleByForSurface[surface],
          !supported && "opacity-60"
        )}
        onClick={handleClick}
        disabled={isTranscribing}
      >
        {isTranscribing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isRecording ? (
          <Square className="h-4 w-4 fill-current" />
        ) : !supported ? (
          <MicOff className="h-4 w-4" />
        ) : (
          <Mic className="h-4 w-4" />
        )}
      </Button>
    </div>
  )
}
