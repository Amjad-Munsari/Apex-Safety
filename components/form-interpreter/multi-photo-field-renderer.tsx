"use client"

/**
 * MultiPhotoFieldRenderer
 *
 * Wraps an inline photo grid inside the coltorapps EntityComponentProps shell.
 * Implemented inline (not wrapping components/forms/multi-photo-field.tsx) because
 * the existing component stores object-URL previews as entity.value, which conflicts
 * with the Phase 14 contract: entity.value must be string[] of storage paths (D-17).
 *
 * Upload flow for each selected file:
 *   File → useMediaProcessor (HEIC→JPEG + EXIF auto-rotate + compress to 1.2-1.5MB)
 *       → canvas.toDataURL() / FileReader.readAsDataURL()
 *       → uploadMediaAction(submissionId, entity.id, dataUrl, "image", clientId, "photo")
 *       → storagePath appended to entity.value[] via setValue
 *
 * Pending items (in-flight uploads) are tracked in local state with object-URL
 * previews so the UI shows thumbnails instantly. Object URLs are revoked:
 *   - On success: immediately after the storage path is committed to entity.value.
 *   - On unmount: useEffect cleanup revokes all remaining pending previews.
 *
 * Orphan cleanup deferral:
 *   Removing a photo from the UI only updates entity.value (calls setValue with
 *   the path filtered out). The underlying storage object and field_media row are
 *   NOT deleted — orphan cleanup is a Phase 16 concern. Cost is small in the MVP
 *   admin-only fill flow; photos remain accessible via Supabase Studio if needed.
 *
 * DoS guard (T-14-04-02):
 *   Only (maxPhotos - currentCount) files are accepted per selection. Excess files
 *   are dropped with a toast "Only N photos can be added; the first N were queued."
 *
 * Object URL memory safety (T-14-04-01):
 *   All pending previewUrls are revoked on unmount and on successful upload.
 *
 * AttachPhotosAffordance cross-plan dependency (D-05):
 *   Plan 14-06 shipped the <AttachPhotosAffordance> component. The import and JSX
 *   are now active — rendered conditionally on attrs.attachPhotos.
 *
 * @see D-17 (photo storage path contract)
 * @see D-05 (attachPhotos affordance)
 * @see T-14-04-01 (object URL leak prevention)
 * @see T-14-04-02 (DoS guard on max file count)
 * @see FORM-06 (HEIC→JPEG + EXIF + compression requirement)
 */

import { useState, useRef, useEffect, useCallback } from "react"
import { Plus, X, Loader2, AlertCircle } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import type { EntityComponentProps } from "@coltorapps/builder-react"
import type { multiPhotoFieldEntity } from "@/lib/form-builder/entities/multi-photo-field"
import { useMediaProcessor } from "@/hooks/use-media-processor"
import { uploadMediaAction } from "@/app/admin/assessments/actions"

import { AttachPhotosAffordance } from "./attach-photos-affordance"

// ── Types ────────────────────────────────────────────────────────────────────

type PendingStatus = "processing" | "uploading" | "error"

interface PendingPhoto {
  id: string
  previewUrl: string // object URL; must be revoked on success/unmount
  status: PendingStatus
  errorMsg?: string
}

// ── Surface tokens ───────────────────────────────────────────────────────────

const surfaceTokens = {
  dark: {
    label: "text-white/70",
    required: "text-[#8b2b21]",
    helpText: "text-white/40",
    error: "text-[#8b2b21]",
    cell: "border-slate-800 bg-slate-950",
    removeBtn: "bg-red-700/80 hover:bg-red-600 text-white",
    addBtn: "border-slate-700 hover:border-amber-500/50 hover:bg-amber-500/5",
    addIcon: "text-slate-400 group-hover:text-amber-500",
    addLabel: "text-slate-500 group-hover:text-amber-500/80",
    countLabel: "text-slate-500",
    errorOverlay: "bg-black/60 text-red-400",
  },
  cream: {
    label: "text-[#1a1a1a]",
    required: "text-[#8b2b21]",
    helpText: "text-[#6b6560]",
    error: "text-[#8b2b21]",
    cell: "border-[#e5e1d8] bg-[#faf9f6]",
    removeBtn: "bg-red-600/80 hover:bg-red-500 text-white",
    addBtn: "border-[#e5e1d8] hover:border-amber-500/60 hover:bg-amber-500/5",
    addIcon: "text-[#6b6560] group-hover:text-amber-600",
    addLabel: "text-[#6b6560] group-hover:text-amber-600",
    countLabel: "text-[#6b6560]",
    errorOverlay: "bg-black/50 text-red-300",
  },
} as const

// ── Props ────────────────────────────────────────────────────────────────────

type Props = EntityComponentProps<typeof multiPhotoFieldEntity> & {
  surface?: "dark" | "cream"
  clientId: string
  submissionId: string
  /** Phase 15: dynamic required from a fired `require` visibility rule. */
  dynamicRequired?: boolean
}

// ── Renderer ─────────────────────────────────────────────────────────────────

export function MultiPhotoFieldRenderer({
  entity,
  setValue,
  surface = "cream",
  clientId,
  submissionId,
  dynamicRequired = false,
}: Props) {
  const t = surfaceTokens[surface]
  const attrs = entity.attributes
  const error = entity.error ? String(entity.error) : undefined

  const maxPhotos = (attrs.maxPhotos as number) ?? 5
  // Committed storage paths — the canonical entity.value
  const photos = (entity.value as string[]) ?? []

  // In-flight upload items with object-URL previews
  const [pendingItems, setPendingItems] = useState<PendingPhoto[]>([])

  // Hidden file input ref
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Media processor hook (HEIC→JPEG + EXIF auto-rotate + 1.2-1.5MB compression)
  const { isProcessing, processImage } = useMediaProcessor()

  // T-14-04-01: revoke all pending object URLs on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      setPendingItems((items) => {
        items.forEach((item) => URL.revokeObjectURL(item.previewUrl))
        return []
      })
    }
  }, [])

  // ── File handling ──────────────────────────────────────────────────────────

  const handleFiles = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const selected = Array.from(e.target.files ?? [])
      // Reset input so the same file can be re-picked after a remove
      if (fileInputRef.current) fileInputRef.current.value = ""

      if (selected.length === 0) return

      // T-14-04-02: DoS guard — only accept up to (maxPhotos - currentCount) files
      const currentCount = photos.length + pendingItems.length
      const room = Math.max(0, maxPhotos - currentCount)
      if (room === 0) return

      const accepted = selected.slice(0, room)
      const dropped = selected.length - accepted.length
      if (dropped > 0) {
        toast(`Only ${room} photo${room === 1 ? "" : "s"} can be added; the first ${room} ${room === 1 ? "was" : "were"} queued.`)
      }

      // Stage all accepted files as 'processing' immediately with object-URL previews
      const staged: PendingPhoto[] = accepted.map((file) => ({
        id: crypto.randomUUID(),
        previewUrl: URL.createObjectURL(file),
        status: "processing" as PendingStatus,
      }))

      setPendingItems((prev) => [...prev, ...staged])

      // Accumulate successfully uploaded storage paths during this batch.
      // We can't use a functional-updater form of setValue (coltorapps only accepts
      // a direct value), so we track the running total in a local array and call
      // setValue once per successful upload with the full accumulated list.
      const committedPaths: string[] = [...photos]

      // Process and upload each file sequentially (simpler than parallel for error tracking)
      for (let i = 0; i < accepted.length; i++) {
        const file = accepted[i]
        const pendingId = staged[i].id

        try {
          // Step 1: HEIC→JPEG + EXIF + compression (FORM-06)
          const processedFile = await processImage(file)
          if (!processedFile) {
            throw new Error("Image processing returned null")
          }

          // Step 2: Convert processed file to base64 data URL for server action
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => resolve(reader.result as string)
            reader.onerror = () => reject(new Error("FileReader failed"))
            reader.readAsDataURL(processedFile)
          })

          // Mark as uploading
          setPendingItems((prev) =>
            prev.map((item) =>
              item.id === pendingId ? { ...item, status: "uploading" as PendingStatus } : item
            )
          )

          // Step 3: Upload to Supabase storage via server action (D-17)
          const storagePath = await uploadMediaAction(
            submissionId,
            entity.id,
            dataUrl,
            "image",
            clientId,
            "photo"
          )

          // Step 4: Commit storage path to entity.value; revoke the object URL
          // (T-14-04-01: prevent memory leak on success path)
          setPendingItems((prev) => {
            const item = prev.find((p) => p.id === pendingId)
            if (item) URL.revokeObjectURL(item.previewUrl)
            return prev.filter((p) => p.id !== pendingId)
          })

          committedPaths.push(storagePath)
          setValue(committedPaths)
        } catch {
          toast.error("Photo could not be processed. Try a different image.")
          // Mark pending item as errored (shows AlertCircle overlay in cell)
          setPendingItems((prev) =>
            prev.map((item) =>
              item.id === pendingId
                ? { ...item, status: "error" as PendingStatus }
                : item
            )
          )
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [photos, pendingItems.length, maxPhotos, submissionId, entity.id, clientId, processImage]
  )

  // ── Remove committed photo ─────────────────────────────────────────────────
  // NOTE: This does NOT delete the storage object or field_media row.
  // Orphan cleanup is a Phase 16 concern (see JSDoc above).
  const handleRemove = (index: number) => {
    setValue(photos.filter((_, i) => i !== index))
  }

  // ── Remove errored pending item ────────────────────────────────────────────
  const handleRemovePending = (pendingId: string) => {
    setPendingItems((prev) => {
      const item = prev.find((p) => p.id === pendingId)
      if (item) URL.revokeObjectURL(item.previewUrl) // T-14-04-01
      return prev.filter((p) => p.id !== pendingId)
    })
  }

  const canAdd =
    photos.length + pendingItems.length < maxPhotos && !isProcessing

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-1.5">
      <label className={cn("text-sm font-semibold", t.label)}>
        {attrs.label}
        {(attrs.required || dynamicRequired) && (
          <span className={cn("ml-1", t.required)}>*</span>
        )}
      </label>

      {/* Photo grid — grid-cols-2 mobile, sm:grid-cols-3 desktop (UI-SPEC §multiPhotoFieldRenderer) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">

        {/* Committed storage-path photos */}
        {photos.map((storagePath, i) => (
          <div
            key={storagePath}
            className={cn(
              "relative aspect-square rounded-sm overflow-hidden border group",
              t.cell
            )}
          >
            {/* We show the storage path as src — on the admin surface these are
                internal paths. Plan 14-06 / Phase 16 may add signed URLs. */}
            <img
              src={storagePath}
              alt={`Photo ${i + 1}`}
              className="object-cover w-full h-full"
            />
            <button
              type="button"
              aria-label={`Remove photo ${i + 1}`}
              onClick={() => handleRemove(i)}
              className={cn(
                "absolute top-1 right-1 h-6 w-6 rounded-sm flex items-center justify-center",
                "opacity-0 group-hover:opacity-100 transition-opacity",
                t.removeBtn
              )}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}

        {/* In-flight upload cells (processing / uploading / error) */}
        {pendingItems.map((item) => (
          <div
            key={item.id}
            className={cn(
              "relative aspect-square rounded-sm overflow-hidden border",
              t.cell
            )}
          >
            <img
              src={item.previewUrl}
              alt="Uploading photo"
              className="object-cover w-full h-full"
            />
            {/* Overlay: spinner while processing/uploading; error icon on failure */}
            <div
              className={cn(
                "absolute inset-0 flex flex-col items-center justify-center",
                item.status === "error"
                  ? t.errorOverlay
                  : "bg-black/40"
              )}
            >
              {item.status === "error" ? (
                <>
                  <AlertCircle className="h-5 w-5 mb-1" />
                  <span className="text-xs font-mono">Failed</span>
                  <button
                    type="button"
                    aria-label="Remove failed photo"
                    onClick={() => handleRemovePending(item.id)}
                    className="mt-1 text-xs underline opacity-80 hover:opacity-100"
                  >
                    Dismiss
                  </button>
                </>
              ) : (
                <Loader2 className="h-5 w-5 animate-spin text-white" />
              )}
            </div>
          </div>
        ))}

        {/* Add cell — only shown when below maxPhotos cap */}
        {canAdd && (
          <label
            className={cn(
              "aspect-square rounded-sm border-2 border-dashed flex flex-col items-center justify-center",
              "cursor-pointer transition-all group",
              t.addBtn
            )}
            aria-label={`Add photo to ${attrs.label as string}`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              className="sr-only"
              aria-label={`Add photo to ${attrs.label as string}`}
              onChange={handleFiles}
            />
            {isProcessing ? (
              <Loader2 className="h-6 w-6 text-amber-500 animate-spin" />
            ) : (
              <>
                <Plus className={cn("h-6 w-6 mb-1", t.addIcon)} />
                <span className={cn("text-xs font-medium", t.addLabel)}>Add Photo</span>
              </>
            )}
          </label>
        )}
      </div>

      {/* Count label: "{photos.length} / {maxPhotos}" (committed photos only) */}
      <span className={cn("font-mono text-xs uppercase tracking-wider", t.countLabel)}>
        {photos.length} / {maxPhotos}
      </span>

      {attrs.helpText && (
        <p className={cn("text-xs", t.helpText)}>{attrs.helpText as string}</p>
      )}
      {error && (
        <p className={cn("text-xs", t.error)}>{error}</p>
      )}

      {/* Note: multiPhotoField is already a photo grid; attachPhotos here is meta —
          extra context photos beyond the main grid. Intentional per FORM-05:
          the per-field affordance applies even to photo fields (D-05). */}
      {attrs.attachPhotos && (
        <AttachPhotosAffordance
          submissionId={submissionId}
          entityId={entity.id}
          fieldLabel={attrs.label as string}
          surface={surface}
          clientId={clientId}
        />
      )}
    </div>
  )
}
