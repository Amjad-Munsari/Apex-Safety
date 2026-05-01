"use client"

import { useState } from "react"
// Dynamic imports for browser-only libraries

export function useMediaProcessor() {
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const processImage = async (file: File): Promise<File | null> => {
    setIsProcessing(true)
    setError(null)

    try {
      let currentFile = file

      // 1. Convert HEIC to JPEG
      if (file.name.toLowerCase().endsWith(".heic") || file.type === "image/heic") {
        const heic2any = (await import("heic2any")).default
        const convertedBlob = await heic2any({
          blob: file,
          toType: "image/jpeg",
          quality: 0.8,
        })
        const blobArray = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob
        currentFile = new File([blobArray], file.name.replace(/\.heic$/i, ".jpg"), {
          type: "image/jpeg",
        })
      }

      // 2. Compress to 1.2 - 1.5 MB
      const options = {
        maxSizeMB: 1.5,
        maxWidthOrHeight: 2560,
        useWebWorker: true,
      }

      const imageCompression = (await import("browser-image-compression")).default
      const compressedFile = await imageCompression(currentFile, options)
      return compressedFile
    } catch (err) {
      console.error("Media Processing Error:", err)
      setError("Failed to process image")
      return null
    } finally {
      setIsProcessing(false)
    }
  }

  return {
    isProcessing,
    error,
    processImage,
  }
}
