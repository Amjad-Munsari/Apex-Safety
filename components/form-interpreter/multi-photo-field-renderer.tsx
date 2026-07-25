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
 * Committed photos are previewed with short-lived signed URLs. Removing one
 * deletes the private storage object and its field_media row before updating the
 * form value, so cancelled uploads do not leave hidden files behind.
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
import {
  deleteMediaAction,
  getMediaPreviewUrlsAction,
  uploadMediaAction,
} from "@/app/admin/assessments/actions"

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
    label: "text-foreground",
    required: "text-danger",
    helpText: "text-muted-foreground",
    error: "text-danger",
    cell: "border-border bg-muted",
    removeBtn: "bg-danger/80 hover:bg-danger text-foreground",
    addBtn: "border-border hover:border-gold/50 hover:bg-gold/5",
    addIcon: "text-muted-foreground group-hover:text-gold",
    addLabel: "text-muted-foreground group-hover:text-gold",
    countLabel: "text-muted-foreground",
    errorOverlay: "bg-black/60 text-red-400",
  },
  cream: {
    label: "text-foreground",
    required: "text-danger",
    helpText: "text-muted-foreground",
    error: "text-danger",
    cell: "border-border bg-muted",
    removeBtn: "bg-red-600/80 hover:bg-red-500 text-white",
    addBtn: "border-border hover:border-amber-500/60 hover:bg-amber-500/5",
    addIcon: "text-muted-foreground group-hover:text-amber-600",
    addLabel: "text-muted-foreground group-hover:text-amber-600",
    countLabel: "text-muted-foreground",
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
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({})
  const [removingPaths, setRemovingPaths] = useState<string[]>([])

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

  const photoPathsKey = photos.join("\u0000")
  useEffect(() => {
    let cancelled = false
    if (photos.length === 0) {
      return
    }

    getMediaPreviewUrlsAction(submissionId, entity.id, photos)
      .then((urls) => {
        if (!cancelled) setPreviewUrls(urls)
      })
      .catch((err) => {
        if (cancelled) return
        console.error("Photo preview signing failed:", err)
        toast.error("Saved photos could not be previewed. Refresh and try again.")
      })

    return () => {
      cancelled = true
    }
    // photos is represented by a stable content key to avoid re-signing on
    // unrelated renderer updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photoPathsKey, submissionId, entity.id])

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
        } catch (err) {
          // Surface the real failure (server action errors carry the cause,
          // e.g. storage/DB failures) instead of swallowing it.
          console.error("Photo upload failed:", err)
          toast.error(
            err instanceof Error && err.message
              ? `Photo upload failed: ${err.message}`
              : "Photo could not be processed. Try a different image."
          )
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
  const handleRemove = async (index: number) => {
    const storagePath = photos[index]
    setRemovingPaths((current) => [...current, storagePath])
    try {
      await deleteMediaAction(submissionId, entity.id, storagePath)
      setValue(photos.filter((_, i) => i !== index))
      setPreviewUrls((current) => {
        const next = { ...current }
        delete next[storagePath]
        return next
      })
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "The photo could not be removed."
      )
    } finally {
      setRemovingPaths((current) =>
        current.filter((path) => path !== storagePath)
      )
    }
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

  // BUG 3: photo fields marked `required` are treated as RECOMMENDED, not
  // required — they never block submission. When the template marks this field
  // required (statically or via a fired `require` rule) but no photos have been
  // added yet, show a non-blocking hint instead of the required `*` asterisk.
  const isRecommended = Boolean(attrs.required) || dynamicRequired
  const showRecommendedHint = isRecommended && photos.length === 0

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-1.5">
      <label className={cn("text-sm font-semibold", t.label)}>
        {attrs.label}
      </label>

      {/* BUG 3: non-blocking recommendation in place of a hard required gate. */}
      {showRecommendedHint && (
        <p className={cn("text-xs", t.helpText)}>Photos recommended but not required</p>
      )}

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
            {previewUrls[storagePath] ? (
              <img
                src={previewUrls[storagePath]}
                alt={`Photo ${i + 1}`}
                className="object-cover w-full h-full"
              />
            ) : (
              <div className="h-full w-full flex items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}
            <button
              type="button"
              aria-label={`Remove photo ${i + 1}`}
              onClick={() => handleRemove(i)}
              disabled={removingPaths.includes(storagePath)}
              className={cn(
                "absolute top-1 right-1 h-6 w-6 rounded-sm flex items-center justify-center",
                "opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity disabled:opacity-50",
                t.removeBtn
              )}
            >
              {removingPaths.includes(storagePath) ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <X className="h-3 w-3" />
              )}
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
