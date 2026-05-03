"use client"

import React from "react"
import { Mic, MicOff, Square, Loader2 } from "lucide-react"
import { toast } from "sonner"
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
  const {
    isRecording,
    isTranscribing,
    supported,
    startRecording,
    stopRecording,
    transcript,
    setTranscript,
  } = useSTT()

  // Only commit when recording has stopped — interim updates would spam the
  // consumer with partial text.
  const lastCommittedRef = React.useRef("")
  React.useEffect(() => {
    if (!isRecording && transcript && transcript !== lastCommittedRef.current) {
      lastCommittedRef.current = transcript
      onTranscript(transcript)
      setTranscript("")
    }
  }, [isRecording, transcript, onTranscript, setTranscript])

  const handleClick = () => {
    if (!supported) {
      toast.error("Speech-to-text isn't available in this browser. Try Chrome or Edge on desktop.")
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
        <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-amber-500 animate-pulse">
          Listening…
        </span>
      )}
      <Button
        type="button"
        size="icon"
        variant="ghost"
        title={supported ? (isRecording ? "Stop recording" : "Speak to dictate") : "Speech-to-text not supported in this browser"}
        className={cn(
          "h-8 w-8 rounded-full transition-all duration-300",
          isRecording && "bg-amber-500/20 text-amber-500 animate-pulse scale-110",
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
