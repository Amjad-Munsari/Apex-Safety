"use client"

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react"

// Dictation hook backing components/forms/mic-button.tsx.
//
// Records with MediaRecorder, converts to WAV in the browser and sends it to
// POST /api/transcribe (OpenRouter, server-side key). This replaces the old
// Web Speech API implementation, which only worked in desktop Chrome/Edge
// with Google's speech service reachable — everywhere else the mic was dead.

/**
 * What the speaker is dictating into. Sent alongside the audio so the model
 * returns a value formatted for the field (digits for numbers, a single line
 * for text inputs, punctuated sentences for textareas) instead of a raw
 * verbatim transcript.
 */
export interface DictationContext {
  label?: string
  kind?: "text" | "textarea" | "number"
  placeholder?: string
  helpText?: string
  min?: number
  max?: number
}

const MAX_RECORDING_MS = 120_000 // matches the 2-minute cap enforced by the route
// Below these, the clip is an accidental tap or a mic that captured nothing —
// uploading it invites the model to invent content, so we refuse client-side.
const MIN_RECORDING_SECONDS = 0.5
const SILENCE_PEAK_THRESHOLD = 0.01

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined" || !MediaRecorder.isTypeSupported) return undefined
  // Chromium/Firefox record webm/opus; Safari records mp4/AAC. Both decode
  // fine in lib/audio/wav.ts before upload.
  for (const type of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"]) {
    if (MediaRecorder.isTypeSupported(type)) return type
  }
  return undefined
}

// Browser capability, read via useSyncExternalStore so SSR renders "supported"
// and the client corrects it during hydration without a setState-in-effect.
const subscribeNever = () => () => {}
const isRecordingSupported = () =>
  typeof MediaRecorder !== "undefined" && !!navigator.mediaDevices?.getUserMedia

export function useSTT(dictation?: DictationContext) {
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [transcript, setTranscript] = useState("")
  const [error, setError] = useState<string | null>(null)
  const supported = useSyncExternalStore(subscribeNever, isRecordingSupported, () => true)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (stopTimerRef.current) clearTimeout(stopTimerRef.current)
      const recorder = recorderRef.current
      if (recorder && recorder.state !== "inactive") {
        recorder.onstop = null // unmounting — discard, don't transcribe
        recorder.stop()
      }
      streamRef.current?.getTracks().forEach((track) => track.stop())
    }
  }, [])

  const releaseStream = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }

  const transcribe = async (blob: Blob) => {
    setIsTranscribing(true)
    try {
      const { encodeRecordingToWav } = await import("@/lib/audio/wav")
      const { wav, durationSeconds, peak } = await encodeRecordingToWav(blob)

      if (durationSeconds < MIN_RECORDING_SECONDS) {
        if (mountedRef.current) setError("Recording too short — tap, speak, then tap again to stop.")
        return
      }
      if (peak < SILENCE_PEAK_THRESHOLD) {
        if (mountedRef.current) setError("No speech detected — the recording was silent.")
        return
      }

      // `dictation` is captured from the render that started the recording —
      // field metadata is static, so the closure value is always current.
      const form = new FormData()
      form.append("audio", wav, "dictation.wav")
      if (dictation) {
        form.append("context", JSON.stringify(dictation))
      }

      const res = await fetch("/api/transcribe", { method: "POST", body: form })
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(body?.error ?? `Transcription failed (${res.status}).`)
      }
      const { text } = (await res.json()) as { text: string }
      if (!mountedRef.current) return
      if (text) {
        setTranscript(text)
      } else {
        setError("No speech detected — try again, closer to the microphone.")
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : "Transcription failed. Please try again.")
      }
    } finally {
      if (mountedRef.current) setIsTranscribing(false)
    }
  }

  const startRecording = async () => {
    if (isRecording || isTranscribing || !isRecordingSupported()) return
    setError(null)

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      setError("Microphone access was blocked. Allow the microphone for this site and try again.")
      return
    }

    streamRef.current = stream
    const mimeType = pickMimeType()
    const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
    chunksRef.current = []

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data)
    }
    recorder.onstop = () => {
      if (stopTimerRef.current) {
        clearTimeout(stopTimerRef.current)
        stopTimerRef.current = null
      }
      releaseStream()
      recorderRef.current = null
      if (!mountedRef.current) return
      setIsRecording(false)
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" })
      chunksRef.current = []
      if (blob.size === 0) {
        setError("No audio was captured. Please try again.")
        return
      }
      void transcribe(blob)
    }

    recorderRef.current = recorder
    recorder.start()
    setIsRecording(true)
    stopTimerRef.current = setTimeout(() => {
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        recorderRef.current.stop()
      }
    }, MAX_RECORDING_MS)
  }

  const stopRecording = () => {
    const recorder = recorderRef.current
    if (recorder && recorder.state !== "inactive") {
      recorder.stop()
    }
  }

  const clearError = useCallback(() => setError(null), [])

  return {
    isRecording,
    isTranscribing,
    transcript,
    error,
    supported,
    startRecording,
    stopRecording,
    setTranscript,
    clearError,
  }
}
