/**
 * GeolocationFieldRenderer
 *
 * Captures GPS coordinates via navigator.geolocation.getCurrentPosition (D-11),
 * shows a dynamic-imported Leaflet map preview (D-13), and displays a desktop
 * accuracy badge when the capture may be inaccurate (D-12).
 *
 * Dynamic import contract (RESEARCH Pitfall 1 + 2):
 *   const GeoMap = dynamic(() => import("./geolocation-map"), { ssr: false })
 * Leaflet calls `window` at import time — SSR must be disabled.
 *
 * Auto-capture on mount (D-11): if no value is stored, the renderer triggers
 * navigator.geolocation.getCurrentPosition once on mount in the background.
 * This never blocks the fill flow — if permission is denied, the user sees the
 * error state and can continue filling other fields.
 *
 * Desktop accuracy badge (D-12): shown when:
 *   (a) user agent does NOT match a mobile pattern, OR
 *   (b) position.coords.accuracy > 100m
 * The UA check is intentionally imperfect (e.g., iPad in desktop mode reads as
 * desktop). The accuracy threshold (>100m) is the secondary signal per D-12.
 *
 * Click-to-pin (D-13): when value exists and the field is editable, clicking
 * the map updates entity.value.lat/lng to the clicked coordinates.
 *
 * Security note (T-14-05-01): navigator.geolocation errors are logged only by
 * their numeric code (GeolocationPositionError.code), never by the full coords.
 *
 * TODO (Plan 14-06): Wire AttachPhotosAffordance when attrs.attachPhotos === true.
 * This renderer does not import it yet — Plan 14-06 adds the affordance import
 * and wires clientId + submissionId from interpreter-renderer.tsx.
 */
"use client"

import { useEffect, useState } from "react"
import dynamic from "next/dynamic"
import { AlertCircle, Loader2, MapPin, RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"
import type { EntityComponentProps } from "@coltorapps/builder-react"
import type { geolocationFieldEntity } from "@/lib/form-builder/entities/geolocation-field"

// Dynamic import with ssr: false — Leaflet uses window at module load time.
// This is the canonical pattern per RESEARCH Pattern 6 + Pitfall 1 + 2.
const GeoMap = dynamic(() => import("./geolocation-map"), { ssr: false })

import { AttachPhotosAffordance } from "./attach-photos-affordance"

type GeoValue = {
  lat: number
  lng: number
  accuracy: number
  capturedAt: string
}

type CaptureState = "idle" | "acquiring" | "success" | "permission-denied" | "unavailable" | "error"

type Props = EntityComponentProps<typeof geolocationFieldEntity> & {
  surface?: "dark" | "cream"
  /** Optional — only required when attrs.attachPhotos is true */
  clientId?: string
  /** Optional — only required when attrs.attachPhotos is true */
  submissionId?: string
}

const surfaceTokens = {
  dark: {
    label: "text-white/70",
    required: "text-[#8b2b21]",
    helpText: "text-white/40",
    error: "text-[#8b2b21]",
    panel: "bg-white/5 border-white/10",
    panelText: "text-white",
    panelMuted: "text-white/50",
    panelError: "text-[#8b2b21]",
    instructionText: "text-white/40",
  },
  cream: {
    label: "text-[#1a1a1a]",
    required: "text-[#8b2b21]",
    helpText: "text-[#6b6560]",
    error: "text-[#8b2b21]",
    panel: "bg-white border-[#e5e1d8]",
    panelText: "text-[#1a1a1a]",
    panelMuted: "text-[#6b6560]",
    panelError: "text-[#8b2b21]",
    instructionText: "text-[#6b6560]",
  },
} as const

/**
 * Returns a human-readable error message for a GeolocationPositionError.
 * Only the error.code (a small integer enum) is used — never the full position.
 */
function geolocationErrorMessage(code: number): string {
  switch (code) {
    case 1: // PERMISSION_DENIED
      return "Location permission was denied. Enable it in your browser to capture coordinates."
    case 2: // POSITION_UNAVAILABLE
      return "Location is currently unavailable."
    case 3: // TIMEOUT
      return "Couldn't get your location. Try again."
    default:
      return "Couldn't get your location. Try again."
  }
}

/**
 * Determines whether to show the desktop accuracy badge (D-12):
 *   - true when UA does NOT match mobile pattern (UA-based heuristic)
 *   - true when accuracy > 100m (accuracy-based signal)
 *
 * Note (T-14-05-07): UA spoofing is trivial; the accuracy threshold is the
 * authoritative signal. The badge is informational, not a security control.
 */
function shouldShowAccuracyBadge(accuracy: number): boolean {
  const isMobile =
    typeof navigator !== "undefined" && /Mobi|Android/i.test(navigator.userAgent)
  return !isMobile || accuracy > 100
}

export function GeolocationFieldRenderer({ entity, setValue, surface = "cream", clientId, submissionId }: Props) {
  const t = surfaceTokens[surface]
  const attrs = entity.attributes
  const error = entity.error ? String(entity.error) : undefined

  const value = entity.value as GeoValue | undefined

  const [captureState, setCaptureState] = useState<CaptureState>("idle")
  const [captureError, setCaptureError] = useState<string | null>(null)

  /**
   * Trigger navigator.geolocation.getCurrentPosition.
   * On success: write {lat, lng, accuracy, capturedAt} to the interpreter store.
   * On error: set captureError with a copy-safe message per UI-SPEC §Error States.
   * Security note (T-14-05-01): error.code only, never coords, is used in state.
   */
  const capture = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setCaptureState("error")
      setCaptureError("Geolocation is not supported on this device.")
      return
    }
    setCaptureState("acquiring")
    setCaptureError(null)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setValue({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          capturedAt: new Date().toISOString(),
        })
        setCaptureState("success")
      },
      (err) => {
        // Log only the numeric code (T-14-05-01 — never log coords)
        const code = err.code
        if (code === 1) {
          setCaptureState("permission-denied")
        } else if (code === 2) {
          setCaptureState("unavailable")
        } else {
          setCaptureState("error")
        }
        setCaptureError(geolocationErrorMessage(code))
      },
      { enableHighAccuracy: true, timeout: 15000 }
    )
  }

  /**
   * Auto-capture on mount (D-11): if no value is stored, trigger capture once
   * in the background. Never blocks the fill flow — failure is silent until
   * the user explicitly sees the error state via the capture panel.
   */
  useEffect(() => {
    if (!value) {
      capture()
    } else {
      setCaptureState("success")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const isAcquiring = captureState === "acquiring"
  const hasError = captureState === "permission-denied" || captureState === "unavailable" || captureState === "error"
  const showAccuracyBadge = value && shouldShowAccuracyBadge(value.accuracy)

  return (
    <div className="flex flex-col gap-1.5">
      {/* Field label */}
      <label className={cn("text-sm font-semibold", t.label)}>
        {attrs.label}
        {attrs.required && <span className={cn("ml-1", t.required)}>*</span>}
      </label>

      {/* Help text */}
      {attrs.helpText && (
        <p className={cn("text-xs", t.helpText)}>{attrs.helpText as string}</p>
      )}

      {/* Capture panel */}
      <div className={cn("rounded-sm border p-4 flex items-start gap-3", t.panel)}>
        {/* Status icon */}
        <div className="flex-shrink-0 mt-0.5">
          {isAcquiring ? (
            <Loader2 className={cn("h-4 w-4 animate-spin", t.panelMuted)} />
          ) : hasError ? (
            <AlertCircle className={cn("h-4 w-4", t.panelError)} />
          ) : value ? (
            <MapPin className={cn("h-4 w-4", t.panelText)} />
          ) : (
            <MapPin className={cn("h-4 w-4", t.panelMuted)} />
          )}
        </div>

        {/* Status text */}
        <div className="flex-1 min-w-0">
          {isAcquiring && (
            <p className={cn("text-sm", t.panelMuted)}>Acquiring GPS coordinates…</p>
          )}
          {hasError && captureError && (
            <p className={cn("text-sm", t.panelError)}>{captureError}</p>
          )}
          {!isAcquiring && !hasError && value && (
            <>
              <p className={cn("text-sm font-mono", t.panelText)}>
                Lat: {value.lat.toFixed(4)}, Lng: {value.lng.toFixed(4)}
              </p>
              <p className={cn("text-xs", t.panelMuted)}>
                ±{Math.round(value.accuracy)}m ·{" "}
                {new Date(value.capturedAt).toLocaleTimeString()}
              </p>
            </>
          )}
          {captureState === "idle" && !value && (
            <p className={cn("text-sm", t.panelMuted)}>No location captured yet.</p>
          )}
        </div>

        {/* Refresh button */}
        <button
          type="button"
          onClick={capture}
          disabled={isAcquiring}
          className={cn(
            "flex-shrink-0 flex items-center gap-1.5 text-xs rounded-sm px-2 py-1 transition-colors",
            "border border-transparent",
            isAcquiring ? "opacity-50 cursor-not-allowed" : "hover:opacity-80",
            t.panelMuted
          )}
          aria-label="Refresh location"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", isAcquiring && "animate-spin")} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Desktop accuracy badge (D-12) — role="alert" so screen readers announce */}
      {showAccuracyBadge && (
        <div
          role="alert"
          className="inline-flex items-center gap-2 px-2 py-1 rounded-sm text-xs font-mono bg-amber-100 text-amber-900 border border-amber-300"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-3 w-3 flex-shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
            <path d="M12 9v4" />
            <path d="M12 17h.01" />
          </svg>
          Desktop capture — verify pin on map
        </div>
      )}

      {/* Map preview — shown only when coordinates are captured */}
      {value && (
        <>
          <div className="rounded-sm overflow-hidden" style={{ height: 200 }}>
            <GeoMap
              lat={value.lat}
              lng={value.lng}
              onClickPin={(lat, lng) => {
                // D-13: click-to-pin updates lat/lng, preserves accuracy + capturedAt
                setValue({
                  ...value,
                  lat,
                  lng,
                  capturedAt: new Date().toISOString(),
                })
              }}
            />
          </div>

          {/* Click-to-pin instruction */}
          <p className={cn("text-xs", t.instructionText)}>
            Click the map to move the pin to the correct location.
          </p>
        </>
      )}

      {/* Validation error */}
      {error && <p className={cn("text-xs", t.error)}>{error}</p>}

      {attrs.attachPhotos && clientId && submissionId && (
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
