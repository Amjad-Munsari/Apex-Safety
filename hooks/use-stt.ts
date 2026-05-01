"use client"

import { useState, useRef } from "react"

export function useSTT() {
  const [isRecording, setIsRecording] = useState(false)
  const [transcript, setTranscript] = useState("")
  const [isTranscribing, setIsTranscribing] = useState(false)
  const mediaRecorderRef = useRef<any>(null)
  const audioChunksRef = useRef<Blob[]>([])

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" })
        await transcribeAudio(audioBlob)
        stream.getTracks().forEach(track => track.stop())
      }

      mediaRecorder.start()
      setIsRecording(true)
    } catch (error) {
      console.error("Failed to start recording:", error)
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }

  const transcribeAudio = async (blob: Blob) => {
    setIsTranscribing(true)
    const formData = new FormData()
    formData.append("file", blob, "recording.webm")

    try {
      const response = await fetch("/api/proxy/stt", {
        method: "POST",
        body: formData,
      })
      const data = await response.json()
      if (data.text) {
        setTranscript(data.text)
      }
    } catch (error) {
      console.error("Transcription failed:", error)
    } finally {
      setIsTranscribing(false)
    }
  }

  return {
    isRecording,
    transcript,
    isTranscribing,
    startRecording,
    stopRecording,
    setTranscript,
  }
}
