"use client"

/**
 * AttachPhotosAffordance
 *
 * A per-field photo-attach widget rendered as a horizontal affordance bar beneath
 * any non-section renderer whose `attrs.attachPhotos === true` (D-05, D-06, FORM-05).
 *
 * Layout (UI-SPEC §"attachPhotos Affordance" lines 302-322):
 *   [📎 Attach photos] [N attached] [+ Add Photo] (button opens hidden file input)
 *   Thumbnail strip below — 40×40 images; loader on uploading; AlertCircle on error.
 *
 * Upload contract:
 *   File → useMediaProcessor (HEIC→JPEG + EXIF + compress)
 *       → FileReader.readAsDataURL()
 *       → uploadMediaAction(submissionId, entityId, dataUrl, "image", clientId, "photo")
 *       → storagePath stored in local state strip
 *
 * Session-local trade-off (Phase 14 MVP):
 *   Storage paths are NOT mirrored to the parent renderer's entity.value.
 *   The field_media row insert (via uploadMediaAction) is the authoritative record.
 *   The thumbnail strip is session-local — on page reload it shows 0 attached photos
 *   until a Phase 16+ fetcher queries field_media by (submission_id, field_id).
 *   Preview URLs are kept in local state after upload (not revoked immediately) so
 *   thumbnails remain visible during the session. All previewUrls are revoked on unmount.
 *
 * Remove trade-off:
 *   handleRemove removes the entry from local state and revokes the previewUrl.
 *   It does NOT delete the storage object or the field_media row —
 *   orphan cleanup is a Phase 16+ concern.
 *
 * @see D-05 (per-field attachPhotos affordance semantics — NOT a bottom gallery)
 * @see D-06 (attachPhotos attribute)
 * @see FORM-05 (per-field affordance applies even to multi-photo fields)
 * @see T-14-06-04 (XSS: objectURL blob: scheme is safe; no data URL rendered as img src)
 */

import { useState, useRef, useEffect, useCallback } from "react"
import { Paperclip, Plus, AlertCircle, Loader2, X } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { useMediaProcessor } from "@/hooks/use-media-processor"
import { uploadMediaAction } from "@/app/admin/assessments/actions"

// ── Types ─────────────────────────────────────────────────────────────────────

type PhotoStatus = "uploading" | "uploaded" | "error"

interface PhotoEntry {
  id: string
  path?: string
  /** Object URL kept alive for the session so the thumbnail is visible after upload. */
  previewUrl?: string
  status: PhotoStatus
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface AttachPhotosAffordanceProps {
  submissionId: string
  entityId: string
  fieldLabel: string
  surface?: "dark" | "cream"
  clientId: string
}

// ── Surface tokens ────────────────────────────────────────────────────────────

const surfaceTokens = {
  dark: {
    container: "border-white/10",
    iconColor: "text-white/40",
    labelText: "text-white/50",
    countBadge: "bg-teal-900/60 text-teal-300 border border-teal-700/50",
    button: "text-white/50 hover:text-white/80 hover:bg-white/5 border border-white/10 hover:border-white/20",
    thumbnail: "border-white/10 rounded-sm",
    removeButton: "bg-red-700/80 hover:bg-red-600 text-white",
    errorOverlay: "bg-black/60 text-red-400",
    uploadingOverlay: "bg-black/40",
  },
  cream: {
    container: "border-[#e5e1d8]",
    iconColor: "text-[#6b6560]",
    labelText: "text-[#6b6560]",
    countBadge: "bg-teal-50 text-teal-700 border border-teal-200",
    button: "text-[#6b6560] hover:text-[#1a1a1a] hover:bg-[#f0ede6] border border-[#e5e1d8] hover:border-[#c8c4bc]",
    thumbnail: "border-[#e5e1d8] rounded-sm",
    removeButton: "bg-red-600/80 hover:bg-red-500 text-white",
    errorOverlay: "bg-black/50 text-red-300",
    uploadingOverlay: "bg-black/30",
  },
} as const

// ── Component ─────────────────────────────────────────────────────────────────

export function AttachPhotosAffordance({
  submissionId,
  entityId,
  fieldLabel,
  surface = "cream",
  clientId,
}: AttachPhotosAffordanceProps) {
  const t = surfaceTokens[surface]

  const [photos, setPhotos] = useState<PhotoEntry[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { processImage } = useMediaProcessor()

  // Revoke all previewUrls on unmount to prevent memory leaks (T-14-06-04)
  useEffect(() => {
    return () => {
      setPhotos((prev) => {
        prev.forEach((p) => {
          if (p.previewUrl) URL.revokeObjectURL(p.previewUrl)
        })
        return []
      })
    }
  }, [])

  const handleFiles = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const selected = Array.from(e.target.files ?? [])
      // Reset input so the same file can be re-selected after a remove
      if (fileInputRef.current) fileInputRef.current.value = ""
      if (selected.length === 0) return

      for (const file of selected) {
        // Create a pending entry immediately with an object-URL preview
        const id = crypto.randomUUID()
        const previewUrl = URL.createObjectURL(file)
        const pending: PhotoEntry = { id, previewUrl, status: "uploading" }

        setPhotos((prev) => [...prev, pending])

        try {
          // Step 1: HEIC→JPEG + EXIF + compression (FORM-06)
          const processedFile = await processImage(file)
          if (!processedFile) throw new Error("Image processing returned null")

          // Step 2: Convert to data URL for server action
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => resolve(reader.result as string)
            reader.onerror = () => reject(new Error("FileReader failed"))
            reader.readAsDataURL(processedFile)
          })

          // Step 3: Upload via server action
          const storagePath = await uploadMediaAction(
            submissionId,
            entityId,
            dataUrl,
            "image",
            clientId,
            "photo"
          )

          // Step 4: Mark as uploaded — KEEP previewUrl for session display (session-local trade-off)
          setPhotos((prev) =>
            prev.map((p) =>
              p.id === id ? { ...p, path: storagePath, status: "uploaded" } : p
            )
          )
        } catch {
          toast.error("Photo could not be processed. Try a different image.")
          setPhotos((prev) =>
            prev.map((p) => (p.id === id ? { ...p, status: "error" } : p))
          )
        }
      }
    },
    [submissionId, entityId, clientId, processImage]
  )

  // Remove entry from strip. Revokes previewUrl.
  // NOTE: does NOT delete the storage object or field_media row — Phase 16+ orphan cleanup.
  const handleRemove = (id: string) => {
    setPhotos((prev) => {
      const entry = prev.find((p) => p.id === id)
      if (entry?.previewUrl) URL.revokeObjectURL(entry.previewUrl)
      return prev.filter((p) => p.id !== id)
    })
  }

  const uploadedCount = photos.filter((p) => p.status === "uploaded").length

  return (
    <div className={cn("pt-2 mt-2 border-t border-dashed", t.container)}>
      {/* Affordance bar: Paperclip icon + label + count badge + Add Photo button */}
      <div className="flex items-center gap-2 flex-wrap">
        <Paperclip className={cn("h-3.5 w-3.5 flex-shrink-0", t.iconColor)} aria-hidden="true" />
        <span className={cn("text-xs font-medium", t.labelText)}>Attach photos</span>

        {uploadedCount > 0 && (
          <span className={cn("px-1.5 py-0.5 rounded-sm text-xs font-mono", t.countBadge)}>
            {uploadedCount} attached
          </span>
        )}

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            "ml-auto flex items-center gap-1.5 px-2 py-1 rounded-sm text-xs transition-colors",
            t.button
          )}
          aria-label={`Attach photo to ${fieldLabel}`}
        >
          <Plus className="h-3 w-3" aria-hidden="true" />
          Add Photo
        </button>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          className="sr-only"
          aria-label={`Attach photo to ${fieldLabel}`}
          onChange={handleFiles}
        />
      </div>

      {/* Thumbnail strip — horizontal scroll */}
      {photos.length > 0 && (
        <div className="flex gap-2 mt-2 overflow-x-auto pb-1">
          {photos.map((photo, i) => (
            <div
              key={photo.id}
              className={cn(
                "relative flex-shrink-0 w-10 h-10 overflow-hidden border",
                t.thumbnail
              )}
            >
              {/* Preview thumbnail — object URL (safe blob: scheme, T-14-06-04) */}
              {photo.previewUrl && (
                <img
                  src={photo.previewUrl}
                  alt={`Attached photo ${i + 1}`}
                  className="w-full h-full object-cover"
                />
              )}

              {/* Uploading overlay */}
              {photo.status === "uploading" && (
                <div
                  className={cn(
                    "absolute inset-0 flex items-center justify-center",
                    t.uploadingOverlay
                  )}
                >
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-white" />
                </div>
              )}

              {/* Error overlay */}
              {photo.status === "error" && (
                <div
                  className={cn(
                    "absolute inset-0 flex items-center justify-center",
                    t.errorOverlay
                  )}
                >
                  <AlertCircle className="h-3.5 w-3.5" />
                </div>
              )}

              {/* Remove button — top-right, shown on all non-uploading items */}
              {photo.status !== "uploading" && (
                <button
                  type="button"
                  aria-label={`Remove attached photo ${i + 1}`}
                  onClick={() => handleRemove(photo.id)}
                  className={cn(
                    "absolute top-0 right-0 h-4 w-4 flex items-center justify-center",
                    "rounded-bl-sm",
                    t.removeButton
                  )}
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
