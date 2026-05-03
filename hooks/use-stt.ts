"use client"

import { useEffect, useRef, useState } from "react"

type SpeechRecognitionCtor = new () => SpeechRecognitionLike

interface SpeechRecognitionLike {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null
  onend: ((event: Event) => void) | null
  onerror: ((event: { error: string }) => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

interface SpeechRecognitionResultEvent {
  resultIndex: number
  results: ArrayLike<{
    isFinal: boolean
    0: { transcript: string }
  }>
}

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export function useSTT() {
  const [isRecording, setIsRecording] = useState(false)
  const [transcript, setTranscript] = useState("")
  const [isTranscribing] = useState(false)
  const [supported, setSupported] = useState(true)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const finalRef = useRef<string>("")

  useEffect(() => {
    setSupported(!!getRecognitionCtor())
    return () => {
      recognitionRef.current?.abort()
    }
  }, [])

  const startRecording = async () => {
    const Ctor = getRecognitionCtor()
    if (!Ctor) {
      setSupported(false)
      return
    }

    finalRef.current = ""

    const recognition = new Ctor()
    recognition.continuous = false
    recognition.interimResults = true
    recognition.lang = "en-GB"

    recognition.onresult = (event) => {
      let interim = ""
      let final = ""
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        const text = result[0].transcript
        if (result.isFinal) {
          final += text
        } else {
          interim += text
        }
      }
      if (final) {
        finalRef.current = (finalRef.current + " " + final).trim()
      }
      // Show running text — final words plus interim for live feedback.
      const live = (finalRef.current + " " + interim).trim()
      if (live) setTranscript(live)
    }

    recognition.onend = () => {
      setIsRecording(false)
      // Commit the final transcript on end so the consumer's effect fires once with stable text.
      if (finalRef.current) {
        setTranscript(finalRef.current)
      }
      recognitionRef.current = null
    }

    recognition.onerror = (event) => {
      setIsRecording(false)
      recognitionRef.current = null
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setSupported(false)
      }
    }

    recognitionRef.current = recognition
    try {
      recognition.start()
      setIsRecording(true)
    } catch {
      setIsRecording(false)
    }
  }

  const stopRecording = () => {
    recognitionRef.current?.stop()
  }

  return {
    isRecording,
    transcript,
    isTranscribing,
    supported,
    startRecording,
    stopRecording,
    setTranscript,
  }
}
