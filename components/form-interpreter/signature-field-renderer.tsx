"use client"

/**
 * SignatureFieldRenderer
 *
 * Wraps the existing <SignatureField> canvas component inside the coltorapps
 * EntityComponentProps shell and adds the upload lifecycle required by Plan 14-04.
 *
 * Upload contract (D-16):
 *   canvas.toDataURL("image/png") → uploadMediaAction(submissionId, entity.id,
 *   dataUrl, "image", clientId, "signature") → storagePath stored in entity.value.
 *
 * Preview display contract:
 *   During the current session the renderer keeps a local base64 preview in state
 *   for instant display (no network round-trip). On a fresh page load with only the
 *   storage path in entity.value, the renderer shows a "Signature captured" pill
 *   with a Redraw button rather than fetching a signed URL. This trade-off avoids
 *   an extra network round-trip on every render; acceptable because the existing
 *   assessment flow submits within one session. Phase 16 may add a signed-URL
 *   fetcher when the client-surface fill flow lands. (D-T-14-04-05)
 *
 * AttachPhotosAffordance cross-plan dependency (D-05):
 *   Plan 14-06 shipped the <AttachPhotosAffordance> component. The import and
 *   JSX invocation are now active — rendered conditionally on attrs.attachPhotos.
 *
 * @see D-16 (signature storage path)
 * @see D-05 (attachPhotos affordance)
 * @see D-06 (attachPhotos attribute)
 * @see T-14-04-04 (XSS: canvas PNG data URLs cannot carry scripts)
 */

import { useState } from "react"
import { Loader2, Eraser } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import type { EntityComponentProps } from "@coltorapps/builder-react"
import type { signatureFieldEntity } from "@/lib/form-builder/entities/signature-field"
import { SignatureField } from "@/components/forms/signature-field"
import { uploadMediaAction } from "@/app/admin/assessments/actions"

import { AttachPhotosAffordance } from "./attach-photos-affordance"

type Props = EntityComponentProps<typeof signatureFieldEntity> & {
  surface?: "dark" | "cream"
  clientId: string
  submissionId: string
  /** Phase 15: dynamic required from a fired `require` visibility rule. */
  dynamicRequired?: boolean
}

const surfaceTokens = {
  dark: {
    label: "text-white/70",
    required: "text-[#8b2b21]",
    helpText: "text-white/40",
    error: "text-[#8b2b21]",
    pillBorder: "border-white/10 bg-slate-900",
    pillText: "text-white/60",
    pillPath: "text-white/30",
    redrawIcon: "text-white/50 hover:text-white",
  },
  cream: {
    label: "text-[#1a1a1a]",
    required: "text-[#8b2b21]",
    helpText: "text-[#6b6560]",
    error: "text-[#8b2b21]",
    pillBorder: "border-[#e5e1d8] bg-[#faf9f6]",
    pillText: "text-[#1a1a1a]",
    pillPath: "text-[#a8a39d]",
    redrawIcon: "text-[#6b6560] hover:text-[#1a1a1a]",
  },
} as const

export function SignatureFieldRenderer({
  entity,
  setValue,
  surface = "cream",
  clientId,
  submissionId,
  dynamicRequired = false,
}: Props) {
  const t = surfaceTokens[surface]
  const attrs = entity.attributes

  // Storage path (persisted value from prior upload)
  const storedPath = entity.value as string | undefined
  const error = entity.error ? String(entity.error) : undefined

  // Local base64 preview — kept in state during the current session so we can
  // show the signature immediately after capture without a signed-URL round-trip.
  const [localPreview, setLocalPreview] = useState<string | undefined>(undefined)
  const [isUploading, setIsUploading] = useState(false)

  // The value we pass into <SignatureField> for its preview state.
  // Prefer localPreview (base64) so the canvas component can show the drawn sig;
  // fall back to storedPath only so the SignatureField knows a value exists
  // (it will show its own "Signed" pill + Redraw/Remove buttons from its internal state).
  const signatureValue = localPreview ?? storedPath

  const handleChange = async (dataUrl: string | null) => {
    // SignatureField calls onChange(null) when the user removes / clears
    if (dataUrl === null || dataUrl === undefined) {
      setLocalPreview(undefined)
      setValue(undefined)
      return
    }

    setIsUploading(true)
    try {
      const storagePath = await uploadMediaAction(
        submissionId,
        entity.id,
        dataUrl,
        "image",
        clientId,
        "signature"
      )
      // Store path in entity.value for form submission; keep local preview for
      // instant display (T-14-04-05: defer signed-URL round-trip to Phase 16)
      setLocalPreview(dataUrl)
      setValue(storagePath)
    } catch {
      toast.error("Failed to save signature. Try again.")
    } finally {
      setIsUploading(false)
    }
  }

  const handleRedraw = () => {
    setLocalPreview(undefined)
    setValue(undefined)
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label className={cn("text-sm font-semibold", t.label)}>
        {attrs.label}
        {(attrs.required || dynamicRequired) && (
          <span className={cn("ml-1", t.required)}>*</span>
        )}
      </label>

      {/* Canvas area — wrapped in a relative container for the uploading overlay */}
      <div
        className="relative"
        // T-14-04-04: canvas PNG data URLs are XSS-safe; no scripting surface.
        // Role annotation for the canvas wrapper region.
        role="img"
        aria-label="Signature pad — draw your signature"
      >
        {/* If we only have a storage path (page reload scenario) — show a pill
            rather than attempting to fetch a signed URL (D-T-14-04-05) */}
        {storedPath && !localPreview && !isUploading ? (
          <div className={cn("rounded-sm border px-4 py-3 flex items-center justify-between", t.pillBorder)}>
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className={cn("text-xs font-mono uppercase tracking-wider", t.pillText)}>
                Signature captured
              </span>
              <span className={cn("text-xs font-mono truncate max-w-[240px]", t.pillPath)}>
                {storedPath}
              </span>
            </div>
            <button
              type="button"
              onClick={handleRedraw}
              className={cn("flex items-center gap-1.5 text-xs ml-4 shrink-0", t.redrawIcon)}
              aria-label="Redraw signature"
            >
              <Eraser className="h-3.5 w-3.5" />
              Redraw
            </button>
          </div>
        ) : (
          <div className={cn("relative", isUploading && "pointer-events-none")}>
            <SignatureField
              value={signatureValue}
              onChange={handleChange}
              surface={surface}
            />
            {isUploading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/30 rounded-sm z-10">
                <Loader2 className="h-6 w-6 animate-spin text-white mb-1" />
                <span className="text-xs font-mono text-white">Saving signature…</span>
              </div>
            )}
          </div>
        )}
      </div>

      {attrs.helpText && (
        <p className={cn("text-xs", t.helpText)}>{attrs.helpText as string}</p>
      )}
      {error && (
        <p className={cn("text-xs", t.error)}>{error}</p>
      )}

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
